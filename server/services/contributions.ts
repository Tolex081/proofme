import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { auditEvents, contributions, evidence } from "@/lib/db/schema";
import {
  isContributionEditable,
  isContributionPubliclyListable,
  transitionContribution,
  type ContributionStatus,
} from "@/lib/domain/status";
import {
  contributionFieldErrors,
  contributionSchema,
  readinessProblems,
  type ContributionInput,
} from "@/lib/validation/contribution";

/**
 * Contribution rules. Every function takes the acting user's ID from the
 * verified session, and every lookup is scoped by it, so a contribution ID
 * from the URL can never reach someone else's record. "Not yours" and "does
 * not exist" return the same result.
 */

export type Contribution = typeof contributions.$inferSelect;
export type Evidence = typeof evidence.$inferSelect;
export interface ContributionWithEvidence extends Contribution {
  evidence: Evidence[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const NOT_FOUND = { ok: false as const, errors: { form: "That contribution does not exist." } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findOwn(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<Contribution | null> {
  if (!UUID.test(contributionId)) return null;
  const [row] = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.id, contributionId), eq(contributions.contributorUserId, userId)));
  return row ?? null;
}

async function evidenceFor(db: Database, contributionIds: string[]): Promise<Evidence[]> {
  if (contributionIds.length === 0) return [];
  return db
    .select()
    .from(evidence)
    .where(inArray(evidence.contributionId, contributionIds))
    .orderBy(asc(evidence.contributionId), asc(evidence.position));
}

function valuesFrom(data: ContributionInput) {
  return {
    title: data.title,
    summary: data.summary,
    description: data.description,
    category: data.category,
    role: data.role,
    skills: data.skills,
    startDate: data.startDate,
    endDate: data.endDate,
    visibility: data.visibility,
  };
}

async function replaceEvidence(
  db: Database,
  contributionId: string,
  items: ContributionInput["evidence"],
) {
  await db.delete(evidence).where(eq(evidence.contributionId, contributionId));
  if (items.length > 0) {
    await db
      .insert(evidence)
      .values(items.map((item, position) => ({ contributionId, position, ...item })));
  }
}

export async function createContribution(
  db: Database,
  userId: string,
  input: unknown,
): Promise<Result<ContributionWithEvidence>> {
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: contributionFieldErrors(parsed.error) };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(contributions)
      .values({ contributorUserId: userId, status: "draft", ...valuesFrom(parsed.data) })
      .returning();
    await replaceEvidence(tx as unknown as Database, row.id, parsed.data.evidence);
    await tx.insert(auditEvents).values({
      actorUserId: userId,
      action: "contribution.created",
      entityType: "contribution",
      entityId: row.id,
      metadata: {},
    });
    return row;
  });
  return { ok: true, value: { ...created, evidence: await evidenceFor(db, [created.id]) } };
}

export async function updateContribution(
  db: Database,
  userId: string,
  contributionId: string,
  input: unknown,
): Promise<Result<ContributionWithEvidence>> {
  const existing = await findOwn(db, userId, contributionId);
  if (!existing) return NOT_FOUND;
  if (!isContributionEditable(existing.status)) {
    return {
      ok: false,
      errors: { form: "This contribution can no longer be edited. Approved records are frozen." },
    };
  }
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: contributionFieldErrors(parsed.error) };

  if (existing.status === "self_reported") {
    const problems = readinessProblems({
      summary: parsed.data.summary,
      description: parsed.data.description,
      role: parsed.data.role,
      evidenceCount: parsed.data.evidence.length,
    });
    if (problems.length > 0) {
      return {
        ok: false,
        errors: { form: `A self-reported record must stay complete. ${problems.join(" ")}` },
      };
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(contributions)
      .set(valuesFrom(parsed.data))
      .where(and(eq(contributions.id, existing.id), eq(contributions.contributorUserId, userId)))
      .returning();
    await replaceEvidence(tx as unknown as Database, row.id, parsed.data.evidence);
    return row;
  });
  return { ok: true, value: { ...updated, evidence: await evidenceFor(db, [updated.id]) } };
}

/**
 * Turns a private draft into a self-reported record: the contributor's own
 * claim, not reviewed by anyone. It is labelled self-reported wherever it
 * appears and is never shown as verified.
 */
export async function publishSelfReported(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<Result<Contribution>> {
  const existing = await findOwn(db, userId, contributionId);
  if (!existing) return NOT_FOUND;
  const transition = transitionContribution(existing.status, "publish_self_reported");
  if (!transition.ok) return { ok: false, errors: { form: transition.reason } };

  const evidenceCount = (await evidenceFor(db, [existing.id])).length;
  const problems = readinessProblems({
    summary: existing.summary,
    description: existing.description,
    role: existing.role,
    evidenceCount,
  });
  if (problems.length > 0) return { ok: false, errors: { form: problems.join(" ") } };

  const [row] = await db
    .update(contributions)
    .set({ status: transition.status })
    .where(and(eq(contributions.id, existing.id), eq(contributions.contributorUserId, userId)))
    .returning();
  await db.insert(auditEvents).values({
    actorUserId: userId,
    action: "contribution.self_reported",
    entityType: "contribution",
    entityId: row.id,
    metadata: { from: existing.status, to: row.status },
  });
  return { ok: true, value: row };
}

/** Drafts can be deleted outright. Anything that has left draft keeps its history. */
export async function deleteDraft(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<Result<null>> {
  const existing = await findOwn(db, userId, contributionId);
  if (!existing) return NOT_FOUND;
  if (existing.status !== "draft") {
    return { ok: false, errors: { form: "Only drafts can be deleted." } };
  }
  await db
    .delete(contributions)
    .where(and(eq(contributions.id, existing.id), eq(contributions.contributorUserId, userId)));
  await db.insert(auditEvents).values({
    actorUserId: userId,
    action: "contribution.draft_deleted",
    entityType: "contribution",
    entityId: existing.id,
    metadata: {},
  });
  return { ok: true, value: null };
}

export async function getOwnContribution(
  db: Database,
  userId: string,
  contributionId: string,
): Promise<ContributionWithEvidence | null> {
  const row = await findOwn(db, userId, contributionId);
  if (!row) return null;
  return { ...row, evidence: await evidenceFor(db, [row.id]) };
}

export async function listOwnContributions(
  db: Database,
  userId: string,
  filter: { status?: ContributionStatus | "all" } = {},
): Promise<ContributionWithEvidence[]> {
  const conditions = [eq(contributions.contributorUserId, userId)];
  if (filter.status && filter.status !== "all") {
    conditions.push(eq(contributions.status, filter.status));
  }
  const rows = await db
    .select()
    .from(contributions)
    .where(and(...conditions))
    .orderBy(desc(contributions.updatedAt));
  const items = await evidenceFor(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => ({
    ...row,
    evidence: items.filter((item) => item.contributionId === row.id),
  }));
}

/** The public projection of a contribution. Built field by field. */
export interface PublicContribution {
  id: string;
  title: string;
  summary: string;
  category: Contribution["category"];
  role: string;
  skills: string[];
  startDate: string | null;
  endDate: string | null;
  status: ContributionStatus;
  evidence: { type: Evidence["type"]; url: string; label: string }[];
}

/**
 * Contributions a visitor may see on a public profile: the contribution must
 * be public and in a publicly listable state (never drafts, pending or
 * rejected claims), and only its public evidence is included. The caller is
 * responsible for checking that the profile itself is public.
 */
export async function listPublicContributions(
  db: Database,
  userId: string,
): Promise<PublicContribution[]> {
  const rows = await db
    .select()
    .from(contributions)
    .where(and(eq(contributions.contributorUserId, userId), eq(contributions.visibility, "public")))
    .orderBy(desc(contributions.updatedAt));
  const listable = rows.filter((row) => isContributionPubliclyListable(row.status));
  const items = await evidenceFor(
    db,
    listable.map((row) => row.id),
  );
  return listable.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    role: row.role,
    skills: row.skills,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    evidence: items
      .filter((item) => item.contributionId === row.id && item.visibility === "public")
      .map((item) => ({ type: item.type, url: item.url, label: item.label })),
  }));
}
