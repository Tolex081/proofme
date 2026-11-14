import { and, asc, desc, eq, ne, sql } from "drizzle-orm";

import { canonicalize, sha256Hex, type JsonValue } from "@/lib/attestations/canonical";
import type { Database } from "@/lib/db/client";
import {
  auditEvents,
  contributions,
  evidence,
  evidenceClaims,
  evidenceFindings,
  evidenceInvestigations,
  evidenceResources,
  verificationRequests,
} from "@/lib/db/schema";
import {
  AnalystUnavailableError,
  validateAnalystOutput,
  type AnalystSource,
  type EvidenceAnalyst,
} from "@/lib/evidence/analyst";
import {
  GitHubUnavailableError,
  type GitHubAccount,
  type GitHubCommit,
  type GitHubReader,
} from "@/lib/github/client";
import { describeRef, parseGitHubUrl, type GitHubRef } from "@/lib/github/urls";
import { canInOrganisation } from "@/lib/permissions/organisation";
import { connectedGitHubAccounts } from "./github-identity";
import { getMembership } from "./organisations";

/**
 * The Evidence Agent: investigates a contribution's evidence against its
 * original sources and writes an explainable, versioned report for the
 * organisation's reviewer.
 *
 * Layer A (source checks) uses only what GitHub returns. It establishes each
 * resource and the contributor's relationship to it, keeping different
 * relationships apart: opening a pull request, authoring a commit, committing
 * it, reviewing, merging and being assigned an issue are never treated as the
 * same thing. Attribution is checked against the contributor's linked GitHub
 * account by numeric ID, never by a typed username.
 *
 * Layer B (analysis) asks a model to interpret the claim against those facts,
 * if one is configured. Its output is validated and labelled as AI; it never
 * overrides a source check.
 *
 * The agent never approves, rejects or mints anything. A report is advice to
 * a human reviewer, who decides.
 */

export const FINDING_STATUSES = [
  "source_confirmed",
  "supports_claim",
  "contradicts_claim",
  "not_found",
  "unavailable",
  "manual_review",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };
const fail = (form: string) => ({ ok: false as const, errors: { form } });

export interface ReportSource {
  key: string;
  url: string;
  label: string;
  resourceType: GitHubRef["kind"] | "other";
  repositoryId: number | null;
  externalId: string | null;
  status: "retrieved" | "not_found" | "unavailable" | "not_github";
  retrievedAt: string;
  sourceAuthor: GitHubAccount | null;
  /** The contributor's relationship to this resource, as the source shows it. */
  role: string;
  attribution: "confirmed" | "contradicted" | "unverified";
  facts: Record<string, string | number | boolean | null>;
  snapshotDigest: string | null;
}

export interface ReportFinding {
  claim: string;
  status: FindingStatus;
  explanation: string;
  origin: "deterministic" | "ai";
  sources: string[];
}

export interface EvidenceReport {
  schema: "proofme.evidence-report.v1";
  contributionId: string;
  contributorProfileUserId: string;
  version: number;
  investigatedAt: string;
  github: { accounts: GitHubAccount[] };
  sources: ReportSource[];
  findings: ReportFinding[];
  ai: { status: "completed" | "not_configured" | "unavailable" | "rejected"; model: string | null };
  notice: string;
}

const NOTICE =
  "This report is advice for the organisation's reviewer. Source checks come from GitHub's API at the time shown; AI findings are interpretations and may be wrong. Atesta's agent never approves a claim or issues a credential: the organisation's reviewer decides.";

// ── Layer A: source checks ───────────────────────────────────────────────────

interface Investigated {
  source: ReportSource;
  findings: Omit<ReportFinding, "origin">[];
  untrusted: AnalystSource["untrusted"];
}

function isLinked(accounts: GitHubAccount[], who: GitHubAccount | null): boolean {
  return who !== null && accounts.some((account) => account.id === who.id);
}

function who(account: GitHubAccount | null): string {
  return account ? `@${account.login} (GitHub ID ${account.id})` : "no GitHub account";
}

async function snapshotDigest(value: unknown): Promise<string> {
  return sha256Hex(canonicalize(JSON.parse(JSON.stringify(value)) as JsonValue));
}

async function investigateRef(
  github: GitHubReader,
  ref: GitHubRef,
  base: { key: string; url: string; label: string },
  accounts: GitHubAccount[],
): Promise<Investigated> {
  const retrievedAt = new Date().toISOString();
  const name = describeRef(ref);
  const source: ReportSource = {
    ...base,
    resourceType: ref.kind,
    repositoryId: null,
    externalId: null,
    status: "retrieved",
    retrievedAt,
    sourceAuthor: null,
    role: "none",
    attribution: "unverified",
    facts: {},
    snapshotDigest: null,
  };
  const findings: Investigated["findings"] = [];
  const untrusted: Investigated["untrusted"] = {};
  const noIdentity = accounts.length === 0;
  const NO_IDENTITY_TEXT =
    "The contributor has not linked a GitHub account, so who did this work cannot be checked against the source.";

  try {
    if (ref.kind === "repository") {
      const repo = await github.getRepository(ref.owner, ref.repo);
      if (!repo) return notFound(source, name, untrusted);
      Object.assign(source, {
        repositoryId: repo.id,
        externalId: String(repo.id),
        sourceAuthor: repo.owner,
        facts: { fullName: repo.fullName, ownerLogin: repo.owner.login, ownerId: repo.owner.id },
      });
      findings.push({
        claim: `The repository ${repo.fullName} exists`,
        status: "source_confirmed",
        explanation: `GitHub reports public repository ${repo.fullName} (repository ID ${repo.id}).`,
        sources: [base.key],
      });
      const owns = isLinked(accounts, repo.owner);
      source.role = owns ? "repository_owner" : "none";
      source.attribution = owns ? "confirmed" : "unverified";
      findings.push({
        claim: "The contributor's part in this repository",
        status: "manual_review",
        explanation: owns
          ? "The repository belongs to the contributor's linked account. Owning a repository does not show which parts of it they wrote."
          : "A repository link alone does not show who wrote any particular part of it. Look for pull requests or commits.",
        sources: [base.key],
      });
    } else if (ref.kind === "pull_request") {
      const pull = await github.getPull(ref.owner, ref.repo, ref.number);
      if (!pull) return notFound(source, name, untrusted);
      const [commits, reviews] = await Promise.all([
        github.getPullCommits(ref.owner, ref.repo, ref.number),
        github.getPullReviews(ref.owner, ref.repo, ref.number),
      ]);
      untrusted.title = pull.title;
      untrusted.body = pull.body;
      untrusted.commitMessages = commits.map((commit) => commit.message);
      const ownCommits = commits.filter((commit) => isLinked(accounts, commit.author));
      const coAuthorTrailers = commits.filter((commit) =>
        accounts.some((account) =>
          new RegExp(`co-authored-by:[^\\n]*\\b${account.login}\\b`, "i").test(commit.message),
        ),
      );
      const reviewed = reviews.some((review) => isLinked(accounts, review.reviewer));
      Object.assign(source, {
        repositoryId: pull.repositoryId,
        externalId: String(pull.number),
        sourceAuthor: pull.author,
        facts: {
          number: pull.number,
          state: pull.state,
          merged: pull.merged,
          mergedAt: pull.mergedAt,
          mergedBy: pull.mergedBy?.login ?? null,
          createdAt: pull.createdAt,
          openedBy: pull.author?.login ?? null,
          openedById: pull.author?.id ?? null,
          commits: commits.length,
          commitsAttributedToContributor: ownCommits.length,
          reviewedByContributor: reviewed,
          attribution: "pending",
        },
      });
      findings.push({
        claim: `${name} exists`,
        status: "source_confirmed",
        explanation: `Opened by ${who(pull.author)} on ${pull.createdAt.slice(0, 10)}; ${
          pull.merged
            ? `merged on ${pull.mergedAt?.slice(0, 10)}${pull.mergedBy ? ` by @${pull.mergedBy.login}` : ""}`
            : `not merged (${pull.state})`
        }; ${commits.length} commit(s).`,
        sources: [base.key],
      });
      if (noIdentity) {
        findings.push({
          claim: "Who did this work",
          status: "manual_review",
          explanation: NO_IDENTITY_TEXT,
          sources: [base.key],
        });
      } else if (isLinked(accounts, pull.author)) {
        source.role = "pr_author";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor opened this pull request",
          status: "source_confirmed",
          explanation: `GitHub lists the contributor's linked account ${who(pull.author)} as the author of the pull request. ${ownCommits.length} of ${commits.length} commit(s) are attributed to it.`,
          sources: [base.key],
        });
      } else if (ownCommits.length > 0) {
        source.role = "commit_author";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor's work in this pull request",
          status: "supports_claim",
          explanation: `The pull request was opened by ${who(pull.author)}, not the contributor, but GitHub attributes ${ownCommits.length} of its ${commits.length} commit(s) to the contributor's linked account. This supports their part in shared work, not authorship of the whole pull request.`,
          sources: [base.key],
        });
      } else if (coAuthorTrailers.length > 0) {
        source.role = "co_author_trailer";
        findings.push({
          claim: "The contributor co-authored this pull request",
          status: "manual_review",
          explanation: `Only a self-declared "Co-authored-by" line in a commit message names the contributor. Anyone can write that line, so it is weak evidence; ask for corroboration.`,
          sources: [base.key],
        });
      } else if (reviewed) {
        source.role = "reviewer";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor's part in this pull request",
          status: "manual_review",
          explanation: `The contributor's linked account reviewed this pull request. It did not open it and none of its commits are attributed to it, so this shows review, not authorship.`,
          sources: [base.key],
        });
      } else {
        source.role = "none";
        source.attribution = "contradicted";
        findings.push({
          claim: "The contributor authored this pull request",
          status: "contradicts_claim",
          explanation: `GitHub lists ${who(pull.author)} as the author, which is not the contributor's linked account, and none of its commits or reviews are attributed to the contributor. It cannot count as their authorship.`,
          sources: [base.key],
        });
      }
      source.facts.attribution = source.attribution;
    } else if (ref.kind === "commit") {
      const commit = await github.getCommit(ref.owner, ref.repo, ref.sha);
      if (!commit) return notFound(source, name, untrusted);
      untrusted.commitMessages = [commit.message];
      Object.assign(source, {
        repositoryId: commit.repositoryId,
        externalId: commit.sha,
        sourceAuthor: commit.author,
        facts: commitFacts(commit),
      });
      findings.push({
        claim: `${name} exists`,
        status: "source_confirmed",
        explanation: `Authored by ${who(commit.author)}${commit.gitAuthorName ? ` (git name "${commit.gitAuthorName}")` : ""}; committed by ${who(commit.committer)}. These are different relationships.`,
        sources: [base.key],
      });
      findings.push({
        claim: "Commit signature",
        status: commit.signatureVerified ? "source_confirmed" : "manual_review",
        explanation: commit.signatureVerified
          ? "GitHub reports a verified signature. This shows the signing key, not on its own who did the work."
          : `GitHub reports no verified signature${commit.signatureReason ? ` (${commit.signatureReason})` : ""}.`,
        sources: [base.key],
      });
      if (noIdentity) {
        findings.push({
          claim: "Who did this work",
          status: "manual_review",
          explanation: NO_IDENTITY_TEXT,
          sources: [base.key],
        });
      } else if (isLinked(accounts, commit.author)) {
        source.role = "commit_author";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor authored this commit",
          status: "source_confirmed",
          explanation: `GitHub attributes the commit's authorship to the contributor's linked account ${who(commit.author)}.`,
          sources: [base.key],
        });
      } else if (isLinked(accounts, commit.committer)) {
        source.role = "committer";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor authored this commit",
          status: "manual_review",
          explanation: `The contributor's linked account committed it, but GitHub attributes authorship to ${who(commit.author)}. Committing is not the same as authoring.`,
          sources: [base.key],
        });
      } else if (!commit.author) {
        findings.push({
          claim: "The contributor authored this commit",
          status: "manual_review",
          explanation: `GitHub does not link this commit's author to any account${commit.gitAuthorName ? ` (git name "${commit.gitAuthorName}", which anyone can set)` : ""}, so authorship cannot be established from the source.`,
          sources: [base.key],
        });
      } else {
        source.attribution = "contradicted";
        findings.push({
          claim: "The contributor authored this commit",
          status: "contradicts_claim",
          explanation: `GitHub attributes the commit to ${who(commit.author)}, not the contributor's linked account.`,
          sources: [base.key],
        });
      }
    } else {
      const issue = await github.getIssue(ref.owner, ref.repo, ref.number);
      if (!issue) return notFound(source, name, untrusted);
      untrusted.title = issue.title;
      untrusted.body = issue.body;
      const assigned = issue.assignees.some((person) => isLinked(accounts, person));
      Object.assign(source, {
        repositoryId: issue.repositoryId,
        externalId: String(issue.number),
        sourceAuthor: issue.author,
        facts: {
          number: issue.number,
          state: issue.state,
          createdAt: issue.createdAt,
          closedAt: issue.closedAt,
          openedBy: issue.author?.login ?? null,
          assignees: issue.assignees.map((person) => person.login).join(", ") || null,
          labels: issue.labels.join(", ") || null,
          assignedToContributor: assigned,
        },
      });
      findings.push({
        claim: `${name} exists`,
        status: "source_confirmed",
        explanation: `Opened by ${who(issue.author)} on ${issue.createdAt.slice(0, 10)}; ${issue.state}${issue.closedAt ? ` since ${issue.closedAt.slice(0, 10)}` : ""}.`,
        sources: [base.key],
      });
      if (noIdentity) {
        findings.push({
          claim: "Who did this work",
          status: "manual_review",
          explanation: NO_IDENTITY_TEXT,
          sources: [base.key],
        });
      } else if (isLinked(accounts, issue.author)) {
        source.role = "issue_author";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor's part in this issue",
          status: "manual_review",
          explanation:
            "The contributor opened this issue. Opening an issue does not show who resolved it.",
          sources: [base.key],
        });
      } else if (assigned) {
        source.role = "assignee";
        source.attribution = "confirmed";
        findings.push({
          claim: "The contributor completed this issue",
          status: "manual_review",
          explanation:
            "The contributor's linked account is assigned to this issue. Being assigned does not establish that they completed it; look for the pull request that closed it.",
          sources: [base.key],
        });
      } else {
        findings.push({
          claim: "The contributor's part in this issue",
          status: "manual_review",
          explanation:
            "The contributor neither opened this issue nor is assigned to it. An issue on its own does not show who resolved it.",
          sources: [base.key],
        });
      }
    }
  } catch (error) {
    if (!(error instanceof GitHubUnavailableError)) throw error;
    source.status = "unavailable";
    findings.length = 0;
    findings.push({
      claim: `${name} could be checked`,
      status: "unavailable",
      explanation: `GitHub could not be checked (${error.message}). This says nothing about whether the claim is true; run the investigation again later.`,
      sources: [base.key],
    });
    return { source, findings, untrusted: {} };
  }
  source.snapshotDigest = await snapshotDigest({
    url: source.url,
    repositoryId: source.repositoryId,
    externalId: source.externalId,
    sourceAuthor: source.sourceAuthor,
    facts: source.facts,
    untrusted,
  });
  return { source, findings, untrusted };
}

function commitFacts(commit: GitHubCommit) {
  return {
    sha: commit.sha,
    author: commit.author?.login ?? null,
    authorId: commit.author?.id ?? null,
    committer: commit.committer?.login ?? null,
    committerId: commit.committer?.id ?? null,
    gitAuthorName: commit.gitAuthorName,
    authoredAt: commit.authoredAt,
    signatureVerified: commit.signatureVerified,
  };
}

function notFound(
  source: ReportSource,
  name: string,
  untrusted: Investigated["untrusted"],
): Investigated {
  source.status = "not_found";
  return {
    source,
    untrusted,
    findings: [
      {
        claim: `${name} exists`,
        status: "not_found",
        explanation:
          "GitHub has no public resource at this address. It may be private, deleted or mistyped. This alone is not evidence of dishonesty.",
        sources: [source.key],
      },
    ],
  };
}

// ── The investigation ────────────────────────────────────────────────────────

export interface AgentDependencies {
  github: GitHubReader;
  /** Null when no AI provider is configured. */
  analyst: EvidenceAnalyst | null;
}

const AUTHOR_ROLES = ["pr_author", "commit_author", "issue_author"];

/**
 * Investigates a contribution's evidence. Only its contributor may start it.
 * Each run is a new version; earlier reports are kept unchanged.
 */
export async function investigateContribution(
  db: Database,
  deps: AgentDependencies,
  userId: string,
  contributionId: string,
): Promise<Result<{ investigationId: string; version: number; report: EvidenceReport }>> {
  if (!/^[0-9a-f-]{36}$/i.test(contributionId)) return fail("That does not exist.");
  const [contribution] = await db
    .select()
    .from(contributions)
    .where(eq(contributions.id, contributionId));
  if (!contribution || contribution.contributorUserId !== userId) {
    return fail("That does not exist, or you do not have access to it.");
  }
  const links = await db
    .select()
    .from(evidence)
    .where(eq(evidence.contributionId, contribution.id))
    .orderBy(asc(evidence.position));
  if (links.length === 0) return fail("Add at least one evidence link first.");
  const accounts = await connectedGitHubAccounts(db, userId);

  // Layer A, one source at a time (GitHub rate limits are per minute).
  const investigated: Investigated[] = [];
  const seen = new Set<string>();
  for (const [index, link] of links.entries()) {
    const key = `S${index + 1}`;
    const base = { key, url: link.url, label: link.label };
    const ref = parseGitHubUrl(link.url);
    if (!ref) {
      investigated.push({
        source: {
          ...base,
          resourceType: "other",
          repositoryId: null,
          externalId: null,
          status: "not_github",
          retrievedAt: new Date().toISOString(),
          sourceAuthor: null,
          role: "none",
          attribution: "unverified",
          facts: {},
          snapshotDigest: null,
        },
        untrusted: {},
        findings: [
          {
            claim: `${link.label} supports the claim`,
            status: "manual_review",
            explanation:
              "This is not a GitHub repository, pull request, commit or issue link, so Atesta cannot check it automatically. Open it and judge it yourself.",
            sources: [key],
          },
        ],
      });
      continue;
    }
    const result = await investigateRef(deps.github, ref, base, accounts);
    const identity = `${result.source.resourceType}:${result.source.repositoryId}:${result.source.externalId}`;
    if (result.source.status === "retrieved" && seen.has(identity)) {
      result.findings.push({
        claim: "Each piece of evidence is independent",
        status: "manual_review",
        explanation:
          "This is the same GitHub resource as another link on this contribution. It counts once.",
        sources: [key],
      });
    }
    seen.add(identity);
    investigated.push(result);
  }

  // Resources by stable identity, and duplicate or conflicting use.
  const resourceIds = new Map<string, string>();
  for (const item of investigated) {
    const { source } = item;
    if (
      source.status !== "retrieved" ||
      source.repositoryId === null ||
      source.externalId === null
    ) {
      continue;
    }
    const [resource] = await db
      .insert(evidenceResources)
      .values({
        provider: "github",
        resourceType: source.resourceType,
        repositoryId: source.repositoryId,
        externalId: source.externalId,
        canonicalUrl: source.url,
      })
      .onConflictDoUpdate({
        target: [
          evidenceResources.provider,
          evidenceResources.resourceType,
          evidenceResources.repositoryId,
          evidenceResources.externalId,
        ],
        set: { provider: sql`excluded.provider` },
      })
      .returning({ id: evidenceResources.id });
    resourceIds.set(source.key, resource.id);

    const earlier = await db
      .select({
        contributionId: evidenceClaims.contributionId,
        userId: evidenceClaims.userId,
        role: evidenceClaims.role,
        attribution: evidenceClaims.attribution,
        title: contributions.title,
      })
      .from(evidenceClaims)
      .innerJoin(contributions, eq(contributions.id, evidenceClaims.contributionId))
      .where(
        and(
          eq(evidenceClaims.resourceId, resource.id),
          ne(evidenceClaims.contributionId, contribution.id),
        ),
      );
    const ownReuse = earlier.find((row) => row.userId === userId);
    if (ownReuse) {
      item.findings.push({
        claim: "This evidence is not already counted elsewhere",
        status: "manual_review",
        explanation: `You already used this same resource as evidence for another contribution ("${ownReuse.title}"). One piece of work should not count as two independent accomplishments.`,
        sources: [source.key],
      });
    }
    const otherAuthor = earlier.find(
      (row) =>
        row.userId !== userId && row.attribution === "confirmed" && AUTHOR_ROLES.includes(row.role),
    );
    if (otherAuthor && source.attribution !== "confirmed") {
      item.findings.push({
        claim: "Nobody else holds the authorship of this resource",
        status: "manual_review",
        explanation:
          "Another Atesta contributor's linked GitHub account is the source-attributed author of this resource and has used it as evidence. Check carefully who did the work.",
        sources: [source.key],
      });
    }
  }

  // Layer B: AI analysis, if configured. Never overrides layer A.
  let aiStatus: EvidenceReport["ai"]["status"] = "not_configured";
  let aiFindings: ReportFinding[] = [];
  if (deps.analyst) {
    try {
      const raw = await deps.analyst.analyse({
        claim: {
          title: contribution.title,
          summary: contribution.summary,
          description: contribution.description,
          role: contribution.role,
        },
        sources: investigated.map((item) => ({
          key: item.source.key,
          kind: item.source.resourceType,
          url: item.source.url,
          facts: {
            status: item.source.status,
            role: item.source.role,
            attribution: item.source.attribution,
            ...item.source.facts,
          },
          untrusted: item.untrusted,
        })),
      });
      const valid = validateAnalystOutput(
        raw,
        investigated.map((item) => item.source.key),
      );
      if (valid) {
        aiStatus = "completed";
        aiFindings = valid.map((finding) => ({ ...finding, origin: "ai" as const }));
      } else {
        aiStatus = "rejected";
      }
    } catch (error) {
      if (!(error instanceof AnalystUnavailableError)) throw error;
      aiStatus = "unavailable";
    }
  }

  const [latest] = await db
    .select({ version: evidenceInvestigations.version })
    .from(evidenceInvestigations)
    .where(eq(evidenceInvestigations.contributionId, contribution.id))
    .orderBy(desc(evidenceInvestigations.version))
    .limit(1);
  const version = (latest?.version ?? 0) + 1;
  const report: EvidenceReport = {
    schema: "proofme.evidence-report.v1",
    contributionId: contribution.id,
    contributorProfileUserId: userId,
    version,
    investigatedAt: new Date().toISOString(),
    github: { accounts },
    sources: investigated.map((item) => item.source),
    findings: [
      ...investigated.flatMap((item) =>
        item.findings.map((finding) => ({ ...finding, origin: "deterministic" as const })),
      ),
      ...aiFindings,
    ],
    ai: { status: aiStatus, model: deps.analyst?.model ?? null },
    notice: NOTICE,
  };
  const reportDigest = await sha256Hex(
    canonicalize(JSON.parse(JSON.stringify(report)) as JsonValue),
  );
  const partial = investigated.some((item) => item.source.status === "unavailable");

  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(evidenceInvestigations)
      .values({
        contributionId: contribution.id,
        userId,
        version,
        githubUserId: accounts[0]?.id ?? null,
        githubLoginSnapshot: accounts.map((account) => account.login).join(", ") || null,
        sourceStatus: partial ? "partial" : "completed",
        aiStatus,
        aiModel: deps.analyst?.model ?? null,
        report,
        reportDigest,
      })
      .returning({ id: evidenceInvestigations.id });
    if (report.findings.length > 0) {
      await tx.insert(evidenceFindings).values(
        report.findings.map((finding, position) => ({
          investigationId: row.id,
          position,
          claim: finding.claim,
          status: finding.status,
          explanation: finding.explanation,
          origin: finding.origin,
          resourceIds: finding.sources.flatMap((key) => {
            const id = resourceIds.get(key);
            return id ? [id] : [];
          }),
        })),
      );
    }
    for (const item of investigated) {
      const resourceId = resourceIds.get(item.source.key);
      if (!resourceId) continue;
      await tx.insert(evidenceClaims).values({
        resourceId,
        contributionId: contribution.id,
        userId,
        investigationId: row.id,
        role: item.source.role,
        attribution: item.source.attribution,
        githubUserId: accounts[0]?.id ?? null,
        snapshot: { facts: item.source.facts, sourceAuthor: item.source.sourceAuthor },
        snapshotDigest: item.source.snapshotDigest ?? reportDigest,
        retrievedAt: new Date(item.source.retrievedAt),
      });
    }
    await tx.insert(auditEvents).values({
      actorUserId: userId,
      organisationId: null,
      action: "evidence.investigated",
      entityType: "contribution",
      entityId: contribution.id,
      metadata: {
        version,
        reportDigest,
        aiStatus,
        sourceStatus: partial ? "partial" : "completed",
      },
    });
    return row;
  });
  return { ok: true, value: { investigationId: saved.id, version, report } };
}

/** The latest report for a contribution, for its contributor. */
export async function latestReportForContributor(
  db: Database,
  userId: string,
  contributionId: string,
) {
  const [row] = await db
    .select({ investigation: evidenceInvestigations, owner: contributions.contributorUserId })
    .from(evidenceInvestigations)
    .innerJoin(contributions, eq(contributions.id, evidenceInvestigations.contributionId))
    .where(eq(evidenceInvestigations.contributionId, contributionId))
    .orderBy(desc(evidenceInvestigations.version))
    .limit(1);
  if (!row || row.owner !== userId) return null;
  return toView(row.investigation);
}

/**
 * The latest report for the contribution behind a verification request, for
 * members of the organisation reviewing it.
 */
export async function latestReportForReviewer(db: Database, userId: string, requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return null;
  const [request] = await db
    .select()
    .from(verificationRequests)
    .where(eq(verificationRequests.id, requestId));
  if (!request) return null;
  const membership = await getMembership(db, userId, request.organisationId);
  if (!canInOrganisation(membership, request.organisationId, "verification.view").allowed)
    return null;
  const [row] = await db
    .select()
    .from(evidenceInvestigations)
    .where(eq(evidenceInvestigations.contributionId, request.contributionId))
    .orderBy(desc(evidenceInvestigations.version))
    .limit(1);
  return row ? toView(row) : null;
}

function toView(row: typeof evidenceInvestigations.$inferSelect) {
  return {
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    reportDigest: row.reportDigest,
    sourceStatus: row.sourceStatus,
    aiStatus: row.aiStatus,
    report: row.report as EvidenceReport,
  };
}

export type ReportView = NonNullable<Awaited<ReturnType<typeof latestReportForContributor>>>;

/** Every version, oldest first. Test and history helper. */
export async function investigationHistory(db: Database, contributionId: string) {
  return db
    .select()
    .from(evidenceInvestigations)
    .where(eq(evidenceInvestigations.contributionId, contributionId))
    .orderBy(asc(evidenceInvestigations.version));
}
