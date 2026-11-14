import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import {
  auditEvents,
  connectedAccounts,
  contributions,
  evidence,
  notifications,
  organisationMembers,
  sessions,
  userProfiles,
  users,
} from "@/lib/db/schema";

/**
 * Account-level rules: data export, deletion requests and notifications.
 * Every function acts only on the user ID it is given, which callers take
 * from the verified session.
 */

export const EXPORT_FORMAT = "proofme.account-export.v1";

/**
 * Everything Atesta holds about the person, in one JSON document. Secrets
 * (password hashes, session tokens) are never included.
 */
export async function exportAccountData(db: Database, userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  const ownContributions = await db
    .select()
    .from(contributions)
    .where(eq(contributions.contributorUserId, userId));
  const ownEvidence = [];
  for (const contribution of ownContributions) {
    ownEvidence.push(
      ...(await db.select().from(evidence).where(eq(evidence.contributionId, contribution.id))),
    );
  }

  return {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    account: user,
    profile: profile ?? null,
    connectedAccounts: await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId)),
    contributions: ownContributions,
    evidence: ownEvidence,
    organisationMemberships: await db
      .select()
      .from(organisationMembers)
      .where(eq(organisationMembers.userId, userId)),
    notifications: await db.select().from(notifications).where(eq(notifications.userId, userId)),
    yourActivity: await db.select().from(auditEvents).where(eq(auditEvents.actorUserId, userId)),
  };
}

export type DeletionResult = { ok: true } | { ok: false; error: string };

/**
 * Records a request to delete the account. The account stops working at once:
 * the profile becomes private and every session ends. Removing data that is not
 * needed to keep issued attestations honest happens in a later processing step.
 */
export async function requestAccountDeletion(
  db: Database,
  userId: string,
  confirmation: unknown,
): Promise<DeletionResult> {
  const [profile] = await db
    .select({ id: userProfiles.id, username: userProfiles.username })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));
  if (!profile) return { ok: false, error: "Set up your profile first." };

  if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== profile.username) {
    return { ok: false, error: `Type your username, ${profile.username}, to confirm.` };
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: "deletion_requested" }).where(eq(users.id, userId));
    await tx
      .update(userProfiles)
      .set({ visibility: "private" })
      .where(eq(userProfiles.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.insert(auditEvents).values({
      actorUserId: userId,
      action: "account.deletion_requested",
      entityType: "user",
      entityId: userId,
      metadata: {},
    });
  });
  return { ok: true };
}

// ── Notifications ────────────────────────────────────────────────────────────

export type Notification = typeof notifications.$inferSelect;

export async function listNotifications(
  db: Database,
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return rows.length;
}

export async function markAllNotificationsRead(db: Database, userId: string): Promise<number> {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return updated.length;
}

/** For services that need to tell someone something. Links must be same-site paths. */
export async function notify(
  db: Database,
  input: { userId: string; type: string; title: string; body?: string; href?: string },
) {
  if (input.href && (!input.href.startsWith("/") || input.href.startsWith("//"))) {
    throw new Error("Notification links must be same-site paths.");
  }
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .returning();
  return row;
}
