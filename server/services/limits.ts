import { and, eq, gt, inArray, sql } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";

/**
 * Per-person limits on actions that could be abused: flooding reviewers with
 * claims, sending invitations in bulk, or creating organisations as spam.
 *
 * Each of these actions already writes an audit event with the acting user,
 * so the limit counts those events instead of keeping a second table. The
 * counts are generous for real use; they only stop scripts and accidents.
 * Sign-in and sign-up are limited separately by Better Auth.
 */
export const LIMITS = {
  contribution: { actions: ["contribution.created"], max: 30, minutes: 60 },
  submission: { actions: ["verification.submitted"], max: 20, minutes: 60 },
  decision: {
    actions: ["verification.approve", "verification.reject", "verification.request_information"],
    max: 120,
    minutes: 60,
  },
  invitation: { actions: ["team.invited"], max: 30, minutes: 60 },
  organisation: { actions: ["organisation.created"], max: 5, minutes: 24 * 60 },
  project: { actions: ["project.created"], max: 30, minutes: 60 },
  report: { actions: ["report.created"], max: 10, minutes: 24 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

export const LIMIT_REACHED = {
  ok: false as const,
  errors: {
    form: "You have done this many times in a short while. Wait a little and try again.",
  },
};

/** True while `userId` is still under the limit for `name`. */
export async function withinLimit(db: Database, userId: string, name: LimitName) {
  const limit = LIMITS[name];
  const since = new Date(Date.now() - limit.minutes * 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.actorUserId, userId),
        inArray(auditEvents.action, [...limit.actions]),
        gt(auditEvents.createdAt, since),
      ),
    );
  return (row?.count ?? 0) < limit.max;
}
