import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

import {
  buildAttestationPayload,
  generateNonce,
  sealAttestation,
} from "@/lib/attestations/payload";
import type { Database } from "@/lib/db/client";
import { LIMIT_REACHED, withinLimit } from "./limits";
import {
  attestationStatusEvents,
  attestations,
  auditEvents,
  contributions,
  evidence,
  organisationMembers,
  organisations,
  projects,
  userProfiles,
  users,
  verificationRequests,
  verificationReviews,
} from "@/lib/db/schema";
import {
  isVerificationRequestOpen,
  transitionContribution,
  transitionVerificationRequest,
  type VerificationRequestStatus,
} from "@/lib/domain/status";
import { canDecideVerification, canInOrganisation } from "@/lib/permissions/organisation";
import { readinessProblems } from "@/lib/validation/contribution";
import { notify } from "./account";
import { getMembership } from "./organisations";

/**
 * The review workflow: a contributor sends a contribution to an organisation;
 * its reviewers approve it, reject it with a reason, or ask for more; the
 * contributor can answer or withdraw. Approval freezes the claim into an
 * attestation record with a canonical payload and digest.
 *
 * Every decision runs in a transaction that locks the request row and checks
 * its version, so two reviewers deciding at once cannot both succeed.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = {
  ok: false as const,
  errors: { form: "That does not exist, or you do not have access to it." },
};
const CONFLICT = {
  ok: false as const,
  errors: { form: "Someone else acted on this request a moment ago. Reload to see what changed." },
};

const messageSchema = z
  .string()
  .trim()
  .max(2000, "Keep it under 2,000 characters.")
  .transform((value) => value.normalize("NFC"));

async function audit(
  db: Database,
  actorUserId: string,
  organisationId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db
    .insert(auditEvents)
    .values({ actorUserId, organisationId, action, entityType, entityId, metadata });
}

/** Everyone in the organisation who may decide, except the contributor. */
async function reviewersOf(db: Database, organisationId: string, exceptUserId: string) {
  const rows = await db
    .select({ userId: organisationMembers.userId })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.status, "active"),
        inArray(organisationMembers.role, ["owner", "admin", "reviewer"]),
        ne(organisationMembers.userId, exceptUserId),
      ),
    );
  return rows.map((row) => row.userId);
}

// ── Contributor side ─────────────────────────────────────────────────────────

/** Organisations a contribution can be sent to, with their active projects. */
export async function listSubmissionTargets(db: Database) {
  const orgs = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      platformVerificationStatus: organisations.platformVerificationStatus,
    })
    .from(organisations)
    .where(ne(organisations.platformVerificationStatus, "suspended"))
    .orderBy(asc(organisations.name));
  const activeProjects = await db
    .select({ id: projects.id, name: projects.name, organisationId: projects.organisationId })
    .from(projects)
    .where(eq(projects.status, "active"))
    .orderBy(asc(projects.name));
  return orgs.map((organisation) => ({
    ...organisation,
    projects: activeProjects.filter((project) => project.organisationId === organisation.id),
  }));
}

async function ownContribution(db: Database, userId: string, contributionId: string) {
  if (!UUID.test(contributionId)) return null;
  const [row] = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.id, contributionId), eq(contributions.contributorUserId, userId)));
  return row ?? null;
}

async function openRequestFor(db: Database, contributionId: string) {
  const [row] = await db
    .select()
    .from(verificationRequests)
    .where(
      and(
        eq(verificationRequests.contributionId, contributionId),
        inArray(verificationRequests.status, ["pending", "needs_information"]),
      ),
    );
  return row ?? null;
}

export async function submitForReview(
  db: Database,
  userId: string,
  contributionId: string,
  target: { organisationId: unknown; projectId: unknown },
): Promise<Result<{ requestId: string }>> {
  const contribution = await ownContribution(db, userId, contributionId);
  if (!contribution) return NOT_FOUND;
  const transition = transitionContribution(contribution.status, "submit");
  if (!transition.ok)
    return { ok: false, errors: { form: "This contribution cannot be sent for review now." } };
  if (!(await withinLimit(db, userId, "submission"))) return LIMIT_REACHED;

  const organisationId = typeof target.organisationId === "string" ? target.organisationId : "";
  const projectId =
    typeof target.projectId === "string" && target.projectId !== "" ? target.projectId : null;
  if (!UUID.test(organisationId))
    return { ok: false, errors: { organisation: "Choose the organisation." } };
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  if (!organisation || organisation.platformVerificationStatus === "suspended") {
    return { ok: false, errors: { organisation: "That organisation cannot receive claims." } };
  }
  if (projectId) {
    const [project] = UUID.test(projectId)
      ? await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.id, projectId),
              eq(projects.organisationId, organisationId),
              eq(projects.status, "active"),
            ),
          )
      : [];
    if (!project)
      return {
        ok: false,
        errors: { organisation: "That project is not an active project of this organisation." },
      };
  }

  const linkCount = (
    await db
      .select({ id: evidence.id })
      .from(evidence)
      .where(eq(evidence.contributionId, contribution.id))
  ).length;
  const problems = readinessProblems({
    summary: contribution.summary,
    description: contribution.description,
    role: contribution.role,
    evidenceCount: linkCount,
  });
  if (problems.length > 0) return { ok: false, errors: { form: problems.join(" ") } };

  const requestId = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(verificationRequests)
      .values({
        contributionId: contribution.id,
        organisationId,
        submittedBy: userId,
        status: "pending",
      })
      .returning();
    await tx
      .update(contributions)
      .set({ status: transition.status, organisationId, projectId })
      .where(eq(contributions.id, contribution.id));
    await audit(
      tx as unknown as Database,
      userId,
      organisationId,
      "verification.submitted",
      "verification_request",
      request.id,
      {
        contributionId: contribution.id,
      },
    );
    return request.id;
  });

  for (const reviewerId of await reviewersOf(db, organisationId, userId)) {
    await notify(db, {
      userId: reviewerId,
      type: "verification.requested",
      title: `New contribution to review: ${contribution.title}`,
      href: `/org/${organisation.slug}/verifications/${requestId}`,
    });
  }
  return { ok: true, value: { requestId } };
}

export async function withdrawRequest(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<Result<null>> {
  const contribution = await ownContribution(db, userId, contributionId);
  if (!contribution) return NOT_FOUND;
  const request = await openRequestFor(db, contribution.id);
  if (!request) return { ok: false, errors: { form: "There is no open review to withdraw." } };
  const requestStep = transitionVerificationRequest(request.status, "withdraw");
  const contributionStep = transitionContribution(contribution.status, "withdraw");
  if (!requestStep.ok || !contributionStep.ok)
    return { ok: false, errors: { form: "This review cannot be withdrawn now." } };

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(verificationRequests)
      .set({
        status: requestStep.status,
        resolvedAt: new Date(),
        version: sql`${verificationRequests.version} + 1`,
      })
      .where(
        and(
          eq(verificationRequests.id, request.id),
          eq(verificationRequests.version, request.version),
        ),
      )
      .returning({ id: verificationRequests.id });
    if (updated.length === 0) return CONFLICT;
    await tx
      .update(contributions)
      .set({ status: contributionStep.status })
      .where(eq(contributions.id, contribution.id));
    await audit(
      tx as unknown as Database,
      userId,
      request.organisationId,
      "verification.withdrawn",
      "verification_request",
      request.id,
    );
    return { ok: true as const, value: null };
  });
}

/** The contributor's answer to a request for information. Sends the claim back to the queue. */
export async function respondToRequest(
  db: Database,
  userId: string,
  contributionId: string,
  message: unknown,
): Promise<Result<null>> {
  const contribution = await ownContribution(db, userId, contributionId);
  if (!contribution) return NOT_FOUND;
  const request = await openRequestFor(db, contribution.id);
  if (!request || request.status !== "needs_information") {
    return {
      ok: false,
      errors: { form: "Nobody has asked you for information on this contribution." },
    };
  }
  const parsed = messageSchema.safeParse(message);
  if (!parsed.success) return { ok: false, errors: { message: parsed.error.issues[0].message } };
  if (parsed.data.length === 0)
    return { ok: false, errors: { message: "Write your answer to the reviewer." } };
  const requestStep = transitionVerificationRequest(request.status, "respond");
  const contributionStep = transitionContribution(contribution.status, "respond");
  if (!requestStep.ok || !contributionStep.ok)
    return { ok: false, errors: { form: "You cannot respond now." } };

  const result = await db.transaction(async (tx) => {
    const updated = await tx
      .update(verificationRequests)
      .set({ status: requestStep.status, version: sql`${verificationRequests.version} + 1` })
      .where(
        and(
          eq(verificationRequests.id, request.id),
          eq(verificationRequests.version, request.version),
        ),
      )
      .returning({ id: verificationRequests.id });
    if (updated.length === 0) return CONFLICT;
    await tx.insert(verificationReviews).values({
      verificationRequestId: request.id,
      authorUserId: userId,
      kind: "contributor_response",
      message: parsed.data,
    });
    await tx
      .update(contributions)
      .set({ status: contributionStep.status })
      .where(eq(contributions.id, contribution.id));
    await audit(
      tx as unknown as Database,
      userId,
      request.organisationId,
      "verification.responded",
      "verification_request",
      request.id,
    );
    return { ok: true as const, value: null };
  });
  if (result.ok) {
    const [organisation] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, request.organisationId));
    for (const reviewerId of await reviewersOf(db, request.organisationId, userId)) {
      await notify(db, {
        userId: reviewerId,
        type: "verification.responded",
        title: `The contributor answered your question on ${contribution.title}`,
        href: `/org/${organisation.slug}/verifications/${request.id}`,
      });
    }
  }
  return result;
}

/**
 * The review history a contributor may see: decisions, questions and their
 * own answers. Reviewers' internal notes are never included.
 */
export async function contributorReviewHistory(
  db: Database,
  userId: string,
  contributionId: string,
) {
  const contribution = await ownContribution(db, userId, contributionId);
  if (!contribution) return null;
  const requests = await db
    .select({ request: verificationRequests, organisation: organisations })
    .from(verificationRequests)
    .innerJoin(organisations, eq(organisations.id, verificationRequests.organisationId))
    .where(eq(verificationRequests.contributionId, contribution.id))
    .orderBy(asc(verificationRequests.submittedAt));
  const reviews = requests.length
    ? await db
        .select({
          id: verificationReviews.id,
          requestId: verificationReviews.verificationRequestId,
          kind: verificationReviews.kind,
          message: verificationReviews.message,
          createdAt: verificationReviews.createdAt,
          byContributor: sql<boolean>`${verificationReviews.authorUserId} = ${userId}`,
        })
        .from(verificationReviews)
        .where(
          inArray(
            verificationReviews.verificationRequestId,
            requests.map((row) => row.request.id),
          ),
        )
        .orderBy(asc(verificationReviews.createdAt))
    : [];
  const [attestation] = await db
    .select({
      id: attestations.id,
      status: attestations.status,
      payloadDigest: attestations.payloadDigest,
      issuedAt: attestations.issuedAt,
      nearAnchorStatus: attestations.nearAnchorStatus,
    })
    .from(attestations)
    .where(eq(attestations.contributionId, contribution.id))
    .orderBy(desc(attestations.issuedAt))
    .limit(1);
  return {
    requests: requests.map(({ request, organisation }) => ({
      id: request.id,
      status: request.status,
      submittedAt: request.submittedAt,
      resolvedAt: request.resolvedAt,
      organisation: { name: organisation.name, slug: organisation.slug },
      reviews: reviews.filter((review) => review.requestId === request.id),
    })),
    attestation: attestation ?? null,
  };
}

// ── Reviewer side ────────────────────────────────────────────────────────────

export async function listQueue(
  db: Database,
  userId: string,
  organisationId: string,
  filter: "open" | VerificationRequestStatus = "open",
) {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "verification.view").allowed) return null;
  const statuses: VerificationRequestStatus[] =
    filter === "open" ? ["pending", "needs_information"] : [filter];
  return db
    .select({
      id: verificationRequests.id,
      status: verificationRequests.status,
      submittedAt: verificationRequests.submittedAt,
      title: contributions.title,
      category: contributions.category,
      contributorName: users.name,
      contributorUserId: contributions.contributorUserId,
      projectName: projects.name,
    })
    .from(verificationRequests)
    .innerJoin(contributions, eq(contributions.id, verificationRequests.contributionId))
    .innerJoin(users, eq(users.id, contributions.contributorUserId))
    .leftJoin(projects, eq(projects.id, contributions.projectId))
    .where(
      and(
        eq(verificationRequests.organisationId, organisationId),
        inArray(verificationRequests.status, statuses),
      ),
    )
    .orderBy(asc(verificationRequests.submittedAt));
}

/** Everything a reviewer needs to decide, for members with a reviewing role only. */
export async function getRequestForReviewer(
  db: Database,
  userId: string,
  organisationId: string,
  requestId: string,
) {
  if (!UUID.test(requestId)) return null;
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "verification.view").allowed) return null;
  const [row] = await db
    .select({ request: verificationRequests, contribution: contributions })
    .from(verificationRequests)
    .innerJoin(contributions, eq(contributions.id, verificationRequests.contributionId))
    // The organisation comes from the request row, so another organisation's request ID finds nothing.
    .where(
      and(
        eq(verificationRequests.id, requestId),
        eq(verificationRequests.organisationId, organisationId),
      ),
    );
  if (!row) return null;

  const links = await db
    .select()
    .from(evidence)
    .where(eq(evidence.contributionId, row.contribution.id))
    .orderBy(asc(evidence.position));
  const [contributor] = await db
    .select({
      name: users.name,
      username: userProfiles.username,
      visibility: userProfiles.visibility,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, row.contribution.contributorUserId));
  const [project] = row.contribution.projectId
    ? await db.select().from(projects).where(eq(projects.id, row.contribution.projectId))
    : [];
  const history = await db
    .select({
      id: verificationReviews.id,
      kind: verificationReviews.kind,
      message: verificationReviews.message,
      internalNote: verificationReviews.internalNote,
      createdAt: verificationReviews.createdAt,
      authorName: users.name,
    })
    .from(verificationReviews)
    .innerJoin(users, eq(users.id, verificationReviews.authorUserId))
    .where(eq(verificationReviews.verificationRequestId, row.request.id))
    .orderBy(asc(verificationReviews.createdAt));
  const [attestation] = await db
    .select()
    .from(attestations)
    .where(eq(attestations.verificationRequestId, row.request.id));

  const decision = canDecideVerification(membership, {
    organisationId,
    contributorUserId: row.contribution.contributorUserId,
  });
  return {
    request: row.request,
    contribution: row.contribution,
    evidence: links,
    contributor: contributor ?? { name: "Unknown", username: null, visibility: "private" as const },
    project: project ?? null,
    history,
    attestation: attestation ?? null,
    canDecide: decision.allowed && isVerificationRequestOpen(row.request.status),
    cannotDecideReason: decision.allowed ? null : decision.reason,
  };
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "request_information"], "Choose a decision."),
  message: messageSchema,
  internalNote: messageSchema,
  expectedVersion: z.coerce.number().int().min(0),
});

/**
 * Applies a reviewer's decision. Approval creates the attestation in the same
 * transaction: the claim, evidence, issuer, subject and reviewer are frozen
 * into a canonical payload whose digest is stored and later anchored on NEAR.
 */
export async function decide(
  db: Database,
  userId: string,
  requestId: string,
  input: unknown,
): Promise<Result<{ status: VerificationRequestStatus; attestationId: string | null }>> {
  if (!UUID.test(requestId)) return NOT_FOUND;
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: { form: parsed.error.issues[0].message } };
  const { decision, message, internalNote, expectedVersion } = parsed.data;
  if (!(await withinLimit(db, userId, "decision"))) return LIMIT_REACHED;
  if (decision === "reject" && message.length === 0) {
    return {
      ok: false,
      errors: { message: "Say why you are not approving it. The contributor will see this." },
    };
  }
  if (decision === "request_information" && message.length === 0) {
    return { ok: false, errors: { message: "Say what you need from the contributor." } };
  }

  const outcome = await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    // Lock the request so concurrent decisions queue behind this one.
    await tx.execute(sql`SELECT id FROM verification_requests WHERE id = ${requestId} FOR UPDATE`);
    const [request] = await tx
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId));
    if (!request) return NOT_FOUND;
    const [contribution] = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.id, request.contributionId));
    const membership = await getMembership(t, userId, request.organisationId);
    const allowed = canDecideVerification(membership, {
      organisationId: request.organisationId,
      contributorUserId: contribution.contributorUserId,
    });
    if (!allowed.allowed) {
      // Outsiders learn nothing; members are told why.
      return membership?.status === "active"
        ? { ok: false as const, errors: { form: allowed.reason } }
        : NOT_FOUND;
    }
    if (request.version !== expectedVersion) return CONFLICT;

    const event = decision === "request_information" ? "request_information" : decision;
    const requestStep = transitionVerificationRequest(request.status, event);
    const contributionStep = transitionContribution(contribution.status, event);
    if (!requestStep.ok || !contributionStep.ok) {
      return { ok: false as const, errors: { form: "This request has already been decided." } };
    }

    const resolved = requestStep.status === "approved" || requestStep.status === "rejected";
    const updated = await tx
      .update(verificationRequests)
      .set({
        status: requestStep.status,
        resolvedAt: resolved ? new Date() : null,
        version: sql`${verificationRequests.version} + 1`,
      })
      .where(
        and(
          eq(verificationRequests.id, request.id),
          eq(verificationRequests.version, expectedVersion),
        ),
      )
      .returning({ id: verificationRequests.id });
    if (updated.length === 0) return CONFLICT;

    await tx.insert(verificationReviews).values({
      verificationRequestId: request.id,
      authorUserId: userId,
      kind: decision,
      message: message || null,
      internalNote: internalNote || null,
    });
    await tx
      .update(contributions)
      .set({ status: contributionStep.status })
      .where(eq(contributions.id, contribution.id));

    let attestationId: string | null = null;
    if (decision === "approve") {
      attestationId = await issueAttestation(t, { request, contribution, reviewerId: userId });
    }
    await audit(
      t,
      userId,
      request.organisationId,
      `verification.${decision}`,
      "verification_request",
      request.id,
      {
        contributionId: contribution.id,
        attestationId,
      },
    );
    return {
      ok: true as const,
      value: {
        status: requestStep.status,
        attestationId,
        contributorUserId: contribution.contributorUserId,
        title: contribution.title,
        organisationId: request.organisationId,
      },
    };
  });

  if (!outcome.ok) return outcome;
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, outcome.value.organisationId));
  const titles = {
    approve: `${organisation.name} approved ${outcome.value.title}`,
    reject: `${organisation.name} did not approve ${outcome.value.title}`,
    request_information: `${organisation.name} has a question about ${outcome.value.title}`,
  } as const;
  const [contribution] = await db
    .select({ id: contributions.id })
    .from(contributions)
    .innerJoin(verificationRequests, eq(verificationRequests.contributionId, contributions.id))
    .where(eq(verificationRequests.id, requestId));
  await notify(db, {
    userId: outcome.value.contributorUserId,
    type: `verification.${decision}`,
    title: titles[decision],
    body:
      decision === "approve"
        ? "It is approved and waiting to be anchored on NEAR testnet."
        : message || undefined,
    href: `/dashboard/contributions/${contribution.id}`,
  });
  return {
    ok: true,
    value: { status: outcome.value.status, attestationId: outcome.value.attestationId },
  };
}

async function issueAttestation(
  db: Database,
  input: {
    request: typeof verificationRequests.$inferSelect;
    contribution: typeof contributions.$inferSelect;
    reviewerId: string;
  },
): Promise<string> {
  const { request, contribution, reviewerId } = input;
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, request.organisationId));
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, contribution.contributorUserId));
  // The record names the reviewer by their public profile ID, never their account ID.
  const [reviewerProfile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, reviewerId));
  if (!profile || !reviewerProfile) {
    throw new Error("Contributor and reviewer must both have a profile.");
  }
  const [project] = contribution.projectId
    ? await db.select().from(projects).where(eq(projects.id, contribution.projectId))
    : [];
  const links = await db
    .select()
    .from(evidence)
    .where(eq(evidence.contributionId, contribution.id))
    .orderBy(asc(evidence.position));

  const id = randomUUID();
  const issuedAt = new Date();
  const payload = buildAttestationPayload({
    id,
    issuedAt,
    issuer: { organisationId: organisation.id, name: organisation.name, slug: organisation.slug },
    subject: { profileId: profile.id, username: profile.username },
    project: project ? { id: project.id, name: project.name } : null,
    claim: {
      title: contribution.title,
      summary: contribution.summary,
      description: contribution.description,
      category: contribution.category,
      role: contribution.role,
      skills: contribution.skills,
      startDate: contribution.startDate,
      endDate: contribution.endDate,
    },
    evidence: links.map((link) => ({ type: link.type, url: link.url, label: link.label })),
    reviewerId: reviewerProfile.id,
    nonce: generateNonce(),
  });
  const sealed = await sealAttestation(payload);

  await db.insert(attestations).values({
    id,
    contributionId: contribution.id,
    verificationRequestId: request.id,
    subjectUserId: contribution.contributorUserId,
    issuerOrganisationId: organisation.id,
    reviewerUserId: reviewerId,
    schemaVersion: sealed.schemaVersion,
    canonicalPayload: sealed.canonicalPayload,
    payloadDigest: sealed.digest,
    issuedAt,
    status: "active",
    nearAnchorStatus: "awaiting",
  });
  await db.insert(attestationStatusEvents).values({
    attestationId: id,
    previousStatus: null,
    newStatus: "active",
    reason: "Approved by the organisation.",
    actorUserId: reviewerId,
  });
  await audit(db, reviewerId, organisation.id, "attestation.issued", "attestation", id, {
    digest: sealed.digest,
  });
  return id;
}

/** Attestations an organisation has issued, for any active member. */
export async function listIssuedAttestations(db: Database, userId: string, organisationId: string) {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "attestation.view_issued").allowed)
    return null;
  return db
    .select({
      id: attestations.id,
      status: attestations.status,
      issuedAt: attestations.issuedAt,
      payloadDigest: attestations.payloadDigest,
      nearAnchorStatus: attestations.nearAnchorStatus,
      nearTransactionHash: attestations.nearTransactionHash,
      nearIssuerAccountId: attestations.nearIssuerAccountId,
      subjectUserId: attestations.subjectUserId,
      isPublic: sql<boolean>`${contributions.visibility} = 'public'`,
      title: contributions.title,
      contributorName: users.name,
    })
    .from(attestations)
    .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
    .innerJoin(users, eq(users.id, attestations.subjectUserId))
    .where(eq(attestations.issuerOrganisationId, organisationId))
    .orderBy(desc(attestations.issuedAt));
}

/** A rejected contribution goes back to draft so it can be reworked and sent again. */
export async function reviseRejected(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<Result<null>> {
  const contribution = await ownContribution(db, userId, contributionId);
  if (!contribution) return NOT_FOUND;
  const step = transitionContribution(contribution.status, "revise");
  if (!step.ok) return { ok: false, errors: { form: step.reason } };
  await db
    .update(contributions)
    .set({ status: step.status })
    .where(eq(contributions.id, contribution.id));
  await audit(
    db,
    userId,
    contribution.organisationId,
    "contribution.revised",
    "contribution",
    contribution.id,
  );
  return { ok: true, value: null };
}

/** People who have sent claims to the organisation, with how many were approved. Members only. */
export async function listContributors(db: Database, userId: string, organisationId: string) {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "organisation.view_workspace").allowed)
    return null;
  const rows = await db
    .select({
      userId: contributions.contributorUserId,
      name: users.name,
      username: userProfiles.username,
      visibility: userProfiles.visibility,
      status: verificationRequests.status,
    })
    .from(verificationRequests)
    .innerJoin(contributions, eq(contributions.id, verificationRequests.contributionId))
    .innerJoin(users, eq(users.id, contributions.contributorUserId))
    .leftJoin(userProfiles, eq(userProfiles.userId, contributions.contributorUserId))
    .where(eq(verificationRequests.organisationId, organisationId));
  const people = new Map<
    string,
    {
      name: string;
      username: string | null;
      isPublic: boolean;
      approved: number;
      open: number;
      total: number;
    }
  >();
  for (const row of rows) {
    const entry = people.get(row.userId) ?? {
      name: row.name,
      username: row.username,
      isPublic: row.visibility === "public",
      approved: 0,
      open: 0,
      total: 0,
    };
    entry.total += 1;
    if (row.status === "approved") entry.approved += 1;
    if (row.status === "pending" || row.status === "needs_information") entry.open += 1;
    people.set(row.userId, entry);
  }
  return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
}
