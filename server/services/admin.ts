import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "@/lib/db/client";
import {
  attestations,
  auditEvents,
  contributions,
  organisationMembers,
  organisations,
  projects,
  reports,
  sessions,
  userProfiles,
  users,
} from "@/lib/db/schema";
import { CONTRIBUTION_CATEGORIES } from "@/lib/attestations/payload";
import { notify } from "./account";

/**
 * Platform administration.
 *
 * Administrators review organisations, handle reports, suspend accounts and
 * read the audit trail. By design there is no function here that writes to
 * an attestation, a contribution's claim or a verification decision: an
 * administrator cannot issue, edit or revoke an organisation's word.
 *
 * Every function takes the acting user's ID and re-checks the admin flag in
 * the database, so a stale session or a forged request cannot act as admin.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DENIED = {
  ok: false as const,
  errors: { form: "Only platform administrators can do this." },
};

export async function isPlatformAdmin(db: Database, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin, status: users.status })
    .from(users)
    .where(eq(users.id, userId));
  return Boolean(row?.isPlatformAdmin && row.status === "active");
}

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

const reasonSchema = z
  .string()
  .trim()
  .max(1000, "Keep the reason under 1,000 characters.")
  .transform((value) => value.normalize("NFC"));

// ── Overview ─────────────────────────────────────────────────────────────────

export async function adminOverview(db: Database, adminId: string) {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  const count = async (query: Promise<{ count: number }[]>) => (await query)[0]?.count ?? 0;
  return {
    pendingOrganisations: await count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(organisations)
        .where(eq(organisations.platformVerificationStatus, "pending")),
    ),
    openReports: await count(
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(eq(reports.status, "open")),
    ),
    users: await count(db.select({ count: sql<number>`count(*)::int` }).from(users)),
    organisations: await count(
      db.select({ count: sql<number>`count(*)::int` }).from(organisations),
    ),
    attestations: await count(db.select({ count: sql<number>`count(*)::int` }).from(attestations)),
  };
}

// ── Organisations ────────────────────────────────────────────────────────────

const ORG_FILTERS = ["pending", "unverified", "verified", "rejected", "suspended", "all"] as const;
export type OrganisationFilter = (typeof ORG_FILTERS)[number];

export async function listOrganisationsForAdmin(
  db: Database,
  adminId: string,
  filter: OrganisationFilter = "pending",
  query = "",
) {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  const conditions = [];
  const status = (ORG_FILTERS as readonly string[]).includes(filter) ? filter : "pending";
  if (status !== "all") conditions.push(eq(organisations.platformVerificationStatus, status));
  const term = query.trim().slice(0, 80);
  if (term) {
    conditions.push(
      or(ilike(organisations.name, `%${term}%`), ilike(organisations.slug, `%${term}%`)),
    );
  }
  return db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      category: organisations.category,
      platformVerificationStatus: organisations.platformVerificationStatus,
      nearIssuerStatus: organisations.nearIssuerStatus,
      updatedAt: organisations.updatedAt,
    })
    .from(organisations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(organisations.updatedAt))
    .limit(100);
}

export async function getOrganisationForAdmin(
  db: Database,
  adminId: string,
  organisationId: string,
) {
  if (!UUID.test(organisationId) || !(await isPlatformAdmin(db, adminId))) return null;
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  if (!organisation) return null;
  const owners = await db
    .select({ name: users.name, email: users.email, username: userProfiles.username })
    .from(organisationMembers)
    .innerJoin(users, eq(users.id, organisationMembers.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, organisationMembers.userId))
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.role, "owner"),
        eq(organisationMembers.status, "active"),
      ),
    );
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.status, "active"),
      ),
    );
  const [issued] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attestations)
    .where(eq(attestations.issuerOrganisationId, organisationId));
  const history = await db
    .select({
      action: auditEvents.action,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorName: users.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(
      and(eq(auditEvents.entityType, "organisation"), eq(auditEvents.entityId, organisationId)),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(30);
  return {
    organisation,
    owners,
    members: memberCount.count,
    attestationsIssued: issued.count,
    history,
  };
}

const ORG_DECISIONS = {
  approve: { to: "verified", from: ["pending"], needsReason: false },
  reject: { to: "rejected", from: ["pending"], needsReason: true },
  request_information: { to: "unverified", from: ["pending"], needsReason: true },
  suspend: {
    to: "suspended",
    from: ["unverified", "pending", "verified", "rejected"],
    needsReason: true,
  },
  reinstate: { to: "unverified", from: ["suspended"], needsReason: true },
} as const;

export type OrganisationDecision = keyof typeof ORG_DECISIONS;

const ORG_DECISION_TEXT: Record<OrganisationDecision, string> = {
  approve: "was reviewed and approved by ProofMe",
  reject: "was not approved in ProofMe's review",
  request_information: "needs more information before ProofMe can review it",
  suspend: "was suspended by ProofMe",
  reinstate: "was reinstated by ProofMe",
};

/**
 * A platform review decision about an organisation. Changes only the
 * organisation's platform standing; its attestations and its NEAR issuer
 * registration are not touched.
 */
export async function decideOrganisation(
  db: Database,
  adminId: string,
  organisationId: string,
  input: { decision: unknown; reason: unknown },
): Promise<Result<{ status: string }>> {
  if (!(await isPlatformAdmin(db, adminId))) return DENIED;
  if (!UUID.test(organisationId)) return { ok: false, errors: { form: "No such organisation." } };
  const decision =
    typeof input.decision === "string" && input.decision in ORG_DECISIONS
      ? (input.decision as OrganisationDecision)
      : null;
  if (!decision) return { ok: false, errors: { decision: "Choose a decision." } };
  const reason = reasonSchema.safeParse(typeof input.reason === "string" ? input.reason : "");
  if (!reason.success) return { ok: false, errors: { reason: reason.error.issues[0].message } };
  const rule = ORG_DECISIONS[decision];
  if (rule.needsReason && reason.data.length === 0) {
    return {
      ok: false,
      errors: { reason: "Give a reason. The organisation's owners will see it." },
    };
  }

  const [current] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  if (!current) return { ok: false, errors: { form: "No such organisation." } };
  if (!(rule.from as readonly string[]).includes(current.platformVerificationStatus)) {
    return {
      ok: false,
      errors: {
        form: `This is not possible while the organisation is ${current.platformVerificationStatus}.`,
      },
    };
  }

  const updated = await db
    .update(organisations)
    .set({
      platformVerificationStatus: rule.to,
      platformVerificationReviewedBy: adminId,
      platformVerificationReviewedAt: new Date(),
      platformVerificationReason: reason.data || null,
    })
    .where(
      and(
        eq(organisations.id, organisationId),
        eq(organisations.platformVerificationStatus, current.platformVerificationStatus),
      ),
    )
    .returning({ id: organisations.id });
  if (updated.length === 0) {
    return {
      ok: false,
      errors: { form: "Someone else changed this organisation a moment ago. Reload." },
    };
  }
  await audit(
    db,
    adminId,
    organisationId,
    `admin.organisation.${decision}`,
    "organisation",
    organisationId,
    {
      from: current.platformVerificationStatus,
      to: rule.to,
      reason: reason.data || null,
    },
  );

  const owners = await db
    .select({ userId: organisationMembers.userId })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        inArray(organisationMembers.role, ["owner", "admin"]),
        eq(organisationMembers.status, "active"),
      ),
    );
  for (const owner of owners) {
    await notify(db, {
      userId: owner.userId,
      type: `organisation.platform_${decision}`,
      title: `${current.name} ${ORG_DECISION_TEXT[decision]}`,
      body: reason.data || undefined,
      href: `/org/${current.slug}/dashboard`,
    });
  }
  return { ok: true, value: { status: rule.to } };
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function searchUsers(db: Database, adminId: string, query = "") {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  const term = query.trim().slice(0, 80);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      isPlatformAdmin: users.isPlatformAdmin,
      createdAt: users.createdAt,
      username: userProfiles.username,
      visibility: userProfiles.visibility,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      term
        ? or(
            ilike(users.name, `%${term}%`),
            ilike(users.email, `%${term}%`),
            ilike(userProfiles.username, `%${term}%`),
          )
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(100);
}

/**
 * Suspends or reinstates an account. Suspension ends every session at once.
 * Administrators cannot suspend themselves or another administrator.
 */
export async function setUserSuspended(
  db: Database,
  adminId: string,
  targetUserId: string,
  suspend: boolean,
  reasonInput: unknown,
): Promise<Result<null>> {
  if (!(await isPlatformAdmin(db, adminId))) return DENIED;
  const reason = reasonSchema.safeParse(typeof reasonInput === "string" ? reasonInput : "");
  if (!reason.success || reason.data.length === 0) {
    return { ok: false, errors: { reason: "Give a reason. It is kept in the audit log." } };
  }
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target) return { ok: false, errors: { form: "No such account." } };
  if (target.id === adminId)
    return { ok: false, errors: { form: "You cannot suspend your own account." } };
  if (target.isPlatformAdmin)
    return { ok: false, errors: { form: "Administrators cannot be suspended here." } };
  if (suspend && target.status !== "active")
    return { ok: false, errors: { form: "This account is not active." } };
  if (!suspend && target.status !== "suspended")
    return { ok: false, errors: { form: "This account is not suspended." } };

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ status: suspend ? "suspended" : "active" })
      .where(eq(users.id, target.id));
    if (suspend) await tx.delete(sessions).where(eq(sessions.userId, target.id));
    await audit(
      tx as unknown as Database,
      adminId,
      null,
      suspend ? "admin.user.suspend" : "admin.user.reinstate",
      "user",
      target.id,
      {
        reason: reason.data,
      },
    );
  });
  return { ok: true, value: null };
}

// ── Reports ──────────────────────────────────────────────────────────────────

export const REPORT_REASONS = [
  "impersonation",
  "false_claim",
  "abusive",
  "spam",
  "privacy",
  "other",
] as const;

export const REPORT_REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  impersonation: "Pretends to be someone else",
  false_claim: "Claims work that is not theirs",
  abusive: "Abusive or offensive",
  spam: "Spam",
  privacy: "Shares private information",
  other: "Something else",
};

const reportSchema = z.object({
  targetType: z.enum(["profile", "attestation", "organisation"]),
  targetId: z.string().trim().min(1).max(120),
  reason: z.enum(REPORT_REASONS, "Choose what is wrong."),
  details: reasonSchema,
});

const REPORTS_PER_DAY = 10;

/** Anyone signed in can report a public profile, organisation or attestation. */
export async function createReport(
  db: Database,
  reporterId: string,
  input: unknown,
): Promise<Result<null>> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, errors: { [String(issue.path[0] ?? "form")]: issue.message } };
  }
  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(
      and(
        eq(reports.reporterUserId, reporterId),
        sql`${reports.createdAt} > now() - interval '1 day'`,
      ),
    );
  if (recent.count >= REPORTS_PER_DAY) {
    return {
      ok: false,
      errors: { form: "You have sent a lot of reports today. Try again tomorrow." },
    };
  }
  const [report] = await db
    .insert(reports)
    .values({
      reporterUserId: reporterId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details || null,
    })
    .returning();
  await audit(db, reporterId, null, "report.created", "report", report.id, {
    targetType: report.targetType,
    targetId: report.targetId,
  });
  return { ok: true, value: null };
}

export async function listReports(
  db: Database,
  adminId: string,
  status: "open" | "reviewed" | "dismissed" = "open",
) {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  return db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
      resolvedAt: reports.resolvedAt,
      reporterName: users.name,
    })
    .from(reports)
    .leftJoin(users, eq(users.id, reports.reporterUserId))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))
    .limit(100);
}

export async function resolveReport(
  db: Database,
  adminId: string,
  reportId: string,
  outcome: unknown,
  noteInput: unknown,
): Promise<Result<null>> {
  if (!(await isPlatformAdmin(db, adminId))) return DENIED;
  if (!UUID.test(reportId)) return { ok: false, errors: { form: "No such report." } };
  if (outcome !== "reviewed" && outcome !== "dismissed")
    return { ok: false, errors: { form: "Choose an outcome." } };
  const note = reasonSchema.safeParse(typeof noteInput === "string" ? noteInput : "");
  if (!note.success) return { ok: false, errors: { note: note.error.issues[0].message } };
  const updated = await db
    .update(reports)
    .set({ status: outcome, resolvedBy: adminId, resolvedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  if (updated.length === 0)
    return { ok: false, errors: { form: "This report is already closed." } };
  await audit(db, adminId, null, `admin.report.${outcome}`, "report", reportId, {
    note: note.data || null,
  });
  return { ok: true, value: null };
}

// ── Issuers and audit ────────────────────────────────────────────────────────

/** Organisations' NEAR issuer standing as recorded by ProofMe. Read-only. */
export async function listIssuers(db: Database, adminId: string) {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  return db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      platformVerificationStatus: organisations.platformVerificationStatus,
      nearIssuerStatus: organisations.nearIssuerStatus,
      nearIssuerAccountId: organisations.nearIssuerAccountId,
      issued: sql<number>`(select count(*)::int from ${attestations} where ${attestations.issuerOrganisationId} = ${organisations.id})`,
    })
    .from(organisations)
    .where(sql`${organisations.nearIssuerStatus} <> 'none'`)
    .orderBy(organisations.name);
}

export async function listAuditEvents(
  db: Database,
  adminId: string,
  filter: { action?: string; entityId?: string } = {},
) {
  if (!(await isPlatformAdmin(db, adminId))) return null;
  const conditions = [];
  const action = filter.action?.trim().slice(0, 60);
  if (action) conditions.push(ilike(auditEvents.action, `${action.replace(/[%_]/g, "")}%`));
  const entityId = filter.entityId?.trim().slice(0, 120);
  if (entityId) conditions.push(eq(auditEvents.entityId, entityId));
  return db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorName: users.name,
      organisationName: organisations.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorUserId))
    .leftJoin(organisations, eq(organisations.id, auditEvents.organisationId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
}

// ── Public discovery ─────────────────────────────────────────────────────────

/**
 * Public search. Only public, finished profiles of active accounts, all
 * organisations except suspended ones, and active or completed projects.
 * Drafts, private profiles and reviewer notes are never searched.
 */
export async function explore(
  db: Database,
  input: { query?: string; kind?: string; category?: string; verifiedOnly?: boolean },
) {
  const term = (input.query ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[%_\\]/g, "");
  const like = `%${term}%`;
  const kind = input.kind === "organisations" || input.kind === "projects" ? input.kind : "people";
  const category = (CONTRIBUTION_CATEGORIES as readonly string[]).includes(input.category ?? "")
    ? input.category
    : undefined;

  if (kind === "people") {
    const verifiedCount = sql<number>`(
      select count(*)::int from ${contributions}
      where ${contributions.contributorUserId} = ${userProfiles.userId}
        and ${contributions.status} = 'verified'
        and ${contributions.visibility} = 'public'
        ${category ? sql`and ${contributions.category} = ${category}` : sql``}
    )`;
    const rows = await db
      .select({
        username: userProfiles.username,
        displayName: userProfiles.displayName,
        bio: userProfiles.bio,
        sectionVisibility: userProfiles.sectionVisibility,
        verified: verifiedCount,
      })
      .from(userProfiles)
      .innerJoin(users, eq(users.id, userProfiles.userId))
      .where(
        and(
          eq(userProfiles.visibility, "public"),
          sql`${userProfiles.onboardedAt} is not null`,
          eq(users.status, "active"),
          term
            ? or(ilike(userProfiles.displayName, like), ilike(userProfiles.username, like))
            : undefined,
        ),
      )
      .orderBy(userProfiles.displayName)
      .limit(60);
    return {
      kind,
      people: rows
        .filter((row) => !input.verifiedOnly || row.verified > 0)
        .filter((row) => !category || row.verified > 0)
        .map((row) => ({
          username: row.username,
          displayName: row.displayName,
          bio: row.sectionVisibility?.bio === false ? null : row.bio,
          verified: row.verified,
        })),
    };
  }

  if (kind === "organisations") {
    const rows = await db
      .select({
        name: organisations.name,
        slug: organisations.slug,
        category: organisations.category,
        description: organisations.description,
        platformVerificationStatus: organisations.platformVerificationStatus,
      })
      .from(organisations)
      .where(
        and(
          sql`${organisations.platformVerificationStatus} <> 'suspended'`,
          input.verifiedOnly ? eq(organisations.platformVerificationStatus, "verified") : undefined,
          term ? or(ilike(organisations.name, like), ilike(organisations.slug, like)) : undefined,
        ),
      )
      .orderBy(organisations.name)
      .limit(60);
    return { kind, organisations: rows };
  }

  const rows = await db
    .select({
      name: projects.name,
      slug: projects.slug,
      status: projects.status,
      description: projects.description,
      organisationName: organisations.name,
    })
    .from(projects)
    .innerJoin(organisations, eq(organisations.id, projects.organisationId))
    .where(
      and(
        inArray(projects.status, ["active", "completed"]),
        sql`${organisations.platformVerificationStatus} <> 'suspended'`,
        term ? ilike(projects.name, like) : undefined,
      ),
    )
    .orderBy(projects.name)
    .limit(60);
  return { kind, projects: rows };
}

/** The decisions that fit an organisation's current platform status. */
export function allowedOrganisationDecisions(status: string): OrganisationDecision[] {
  return (Object.keys(ORG_DECISIONS) as OrganisationDecision[]).filter((decision) =>
    (ORG_DECISIONS[decision].from as readonly string[]).includes(status),
  );
}
