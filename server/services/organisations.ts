import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import {
  auditEvents,
  contributions,
  organisationInvitations,
  organisationMembers,
  organisations,
  projects,
  userProfiles,
  users,
} from "@/lib/db/schema";
import {
  canAssignRole,
  canChangeMember,
  canInOrganisation,
  canTransferOwnership,
  type Membership,
  type OrganisationAction,
  type OrganisationRole,
} from "@/lib/permissions/organisation";
import {
  invitationSchema,
  organisationSchema,
  projectSchema,
  roleSchema,
  slugify,
} from "@/lib/validation/organisation";
import { fieldErrors } from "@/lib/validation/profile";
import { notify } from "./account";

/**
 * Organisations, projects and teams.
 *
 * The rule throughout: the actor's membership is loaded from the database by
 * (organisation, user) and checked against the organisation that owns the
 * resource being touched. A slug or ID from the URL only identifies what is
 * being asked for; it never grants anything. "No access" and "does not exist"
 * return the same result, so a response never reveals another organisation's
 * private records.
 */

export type Organisation = typeof organisations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const DENIED = { ok: false as const, errors: { form: "You do not have access to do that." } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITATION_DAYS = 7;

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    if (
      typeof candidate.message === "string" &&
      /duplicate key|unique constraint/i.test(candidate.message)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

async function audit(
  db: Database,
  actorUserId: string,
  organisationId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(auditEvents).values({
    actorUserId,
    organisationId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

// ── Membership lookups ───────────────────────────────────────────────────────

export async function getMembership(
  db: Database,
  userId: string,
  organisationId: string,
): Promise<Membership | null> {
  if (!UUID.test(organisationId)) return null;
  const [row] = await db
    .select()
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.userId, userId),
      ),
    );
  return row
    ? { organisationId: row.organisationId, userId: row.userId, role: row.role, status: row.status }
    : null;
}

export interface OrganisationAccess {
  organisation: Organisation;
  membership: Membership;
}

/**
 * The organisation behind a slug, for an active member only. Anyone else,
 * including former members, gets null: the same as a slug that does not exist.
 */
export async function getOrganisationForMember(
  db: Database,
  userId: string,
  slug: string,
): Promise<OrganisationAccess | null> {
  const [row] = await db
    .select({ organisation: organisations, member: organisationMembers })
    .from(organisations)
    .innerJoin(
      organisationMembers,
      and(
        eq(organisationMembers.organisationId, organisations.id),
        eq(organisationMembers.userId, userId),
      ),
    )
    .where(eq(organisations.slug, slug.toLowerCase()));
  if (!row || row.member.status !== "active") return null;
  return {
    organisation: row.organisation,
    membership: {
      organisationId: row.member.organisationId,
      userId: row.member.userId,
      role: row.member.role,
      status: row.member.status,
    },
  };
}

/** Loads the actor's membership and checks one action, in one step. */
async function authorise(
  db: Database,
  userId: string,
  organisationId: string,
  action: OrganisationAction,
): Promise<Membership | null> {
  const membership = await getMembership(db, userId, organisationId);
  return canInOrganisation(membership, organisationId, action).allowed ? membership : null;
}

export async function listMyOrganisations(db: Database, userId: string) {
  return db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      category: organisations.category,
      platformVerificationStatus: organisations.platformVerificationStatus,
      role: organisationMembers.role,
    })
    .from(organisationMembers)
    .innerJoin(organisations, eq(organisations.id, organisationMembers.organisationId))
    .where(and(eq(organisationMembers.userId, userId), eq(organisationMembers.status, "active")))
    .orderBy(asc(organisations.name));
}

// ── Organisations ────────────────────────────────────────────────────────────

/**
 * Creates an organisation with the creator as its owner. Uses the person's
 * existing account. It starts unverified: the platform-verified badge can only
 * be set by a ProofMe administrator.
 */
export async function createOrganisation(
  db: Database,
  userId: string,
  input: unknown,
): Promise<Result<Organisation>> {
  const parsed = organisationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const created = await db.transaction(async (tx) => {
      const [organisation] = await tx
        .insert(organisations)
        .values({
          ...parsed.data,
          platformVerificationStatus: "unverified",
          nearIssuerStatus: "none",
        })
        .returning();
      await tx.insert(organisationMembers).values({
        organisationId: organisation.id,
        userId,
        role: "owner",
        status: "active",
      });
      await audit(
        tx as unknown as Database,
        userId,
        organisation.id,
        "organisation.created",
        "organisation",
        organisation.id,
      );
      return organisation;
    });
    return { ok: true, value: created };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, errors: { slug: "That address is taken. Choose another." } };
    }
    throw error;
  }
}

export async function updateOrganisation(
  db: Database,
  userId: string,
  organisationId: string,
  input: unknown,
): Promise<Result<Organisation>> {
  if (!(await authorise(db, userId, organisationId, "organisation.update_profile"))) return DENIED;
  const parsed = organisationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const [organisation] = await db
      .update(organisations)
      .set(parsed.data)
      .where(eq(organisations.id, organisationId))
      .returning();
    await audit(db, userId, organisationId, "organisation.updated", "organisation", organisationId);
    return { ok: true, value: organisation };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, errors: { slug: "That address is taken. Choose another." } };
    }
    throw error;
  }
}

/** Asks ProofMe's administrators to review the organisation. */
export async function requestPlatformReview(
  db: Database,
  userId: string,
  organisationId: string,
): Promise<Result<Organisation>> {
  if (!(await authorise(db, userId, organisationId, "organisation.request_platform_review"))) {
    return DENIED;
  }
  const [current] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  if (!current) return DENIED;
  if (
    current.platformVerificationStatus !== "unverified" &&
    current.platformVerificationStatus !== "rejected"
  ) {
    return { ok: false, errors: { form: "This organisation cannot ask for review right now." } };
  }
  if (!current.description || !current.websiteUrl) {
    return {
      ok: false,
      errors: {
        form: "Add a description and a website first, so reviewers can check who you are.",
      },
    };
  }
  const [organisation] = await db
    .update(organisations)
    .set({ platformVerificationStatus: "pending" })
    .where(eq(organisations.id, organisationId))
    .returning();
  await audit(
    db,
    userId,
    organisationId,
    "organisation.review_requested",
    "organisation",
    organisationId,
    {
      from: current.platformVerificationStatus,
      to: "pending",
    },
  );
  return { ok: true, value: organisation };
}

/** What a signed-out visitor may see about an organisation. Built field by field. */
export interface PublicOrganisation {
  name: string;
  slug: string;
  category: Organisation["category"];
  description: string | null;
  websiteUrl: string | null;
  platformVerificationStatus: Organisation["platformVerificationStatus"];
  nearIssuerStatus: Organisation["nearIssuerStatus"];
  nearIssuerAccountId: string | null;
  createdAt: Date;
  projects: { name: string; slug: string; status: Project["status"]; description: string | null }[];
}

export async function getPublicOrganisation(
  db: Database,
  slug: string,
): Promise<PublicOrganisation | null> {
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, slug.toLowerCase()));
  if (!organisation) return null;
  const visibleProjects = await db
    .select({
      name: projects.name,
      slug: projects.slug,
      status: projects.status,
      description: projects.description,
    })
    .from(projects)
    .where(
      and(
        eq(projects.organisationId, organisation.id),
        inArray(projects.status, ["active", "completed"]),
      ),
    )
    .orderBy(asc(projects.name));
  return {
    name: organisation.name,
    slug: organisation.slug,
    category: organisation.category,
    description: organisation.description,
    websiteUrl: organisation.websiteUrl,
    platformVerificationStatus: organisation.platformVerificationStatus,
    nearIssuerStatus: organisation.nearIssuerStatus,
    nearIssuerAccountId:
      organisation.nearIssuerStatus === "registered" ? organisation.nearIssuerAccountId : null,
    createdAt: organisation.createdAt,
    projects: visibleProjects,
  };
}

// ── Projects ─────────────────────────────────────────────────────────────────

async function uniqueProjectSlug(
  db: Database,
  organisationSlug: string,
  name: string,
): Promise<string> {
  const base = slugify(`${organisationSlug}-${name}`, 70) || "project";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const [taken] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, candidate));
    if (!taken) return candidate;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function createProject(
  db: Database,
  userId: string,
  organisationId: string,
  input: unknown,
): Promise<Result<Project>> {
  if (!(await authorise(db, userId, organisationId, "project.manage"))) return DENIED;
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  const slug = await uniqueProjectSlug(db, organisation.slug, parsed.data.name);
  const [project] = await db
    .insert(projects)
    .values({ ...parsed.data, organisationId, slug })
    .returning();
  await audit(db, userId, organisationId, "project.created", "project", project.id);
  return { ok: true, value: project };
}

export async function updateProject(
  db: Database,
  userId: string,
  projectId: string,
  input: unknown,
): Promise<Result<Project>> {
  if (!UUID.test(projectId)) return DENIED;
  const [existing] = await db.select().from(projects).where(eq(projects.id, projectId));
  // The permission check uses the project's own organisation, never one from the request.
  if (!existing || !(await authorise(db, userId, existing.organisationId, "project.manage")))
    return DENIED;
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const [project] = await db
    .update(projects)
    .set(parsed.data)
    .where(eq(projects.id, projectId))
    .returning();
  await audit(db, userId, existing.organisationId, "project.updated", "project", project.id);
  return { ok: true, value: project };
}

/** Projects of an organisation, for any active member. */
export async function listProjectsForMember(db: Database, userId: string, organisationId: string) {
  if (!(await authorise(db, userId, organisationId, "organisation.view_workspace"))) return null;
  return db
    .select()
    .from(projects)
    .where(eq(projects.organisationId, organisationId))
    .orderBy(asc(projects.name));
}

export async function getProjectForMember(
  db: Database,
  userId: string,
  organisationId: string,
  projectId: string,
) {
  if (!UUID.test(projectId)) return null;
  if (!(await authorise(db, userId, organisationId, "organisation.view_workspace"))) return null;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organisationId, organisationId)));
  return project ?? null;
}

export async function getPublicProject(db: Database, slug: string) {
  const [row] = await db
    .select({ project: projects, organisation: organisations })
    .from(projects)
    .innerJoin(organisations, eq(organisations.id, projects.organisationId))
    .where(eq(projects.slug, slug.toLowerCase()));
  if (!row || (row.project.status !== "active" && row.project.status !== "completed")) return null;
  return {
    name: row.project.name,
    slug: row.project.slug,
    description: row.project.description,
    websiteUrl: row.project.websiteUrl,
    repositoryUrl: row.project.repositoryUrl,
    status: row.project.status,
    startDate: row.project.startDate,
    endDate: row.project.endDate,
    organisation: {
      name: row.organisation.name,
      slug: row.organisation.slug,
      platformVerificationStatus: row.organisation.platformVerificationStatus,
    },
  };
}

// ── Team ─────────────────────────────────────────────────────────────────────

export async function listMembers(db: Database, userId: string, organisationId: string) {
  if (!(await authorise(db, userId, organisationId, "team.view"))) return null;
  return db
    .select({
      userId: organisationMembers.userId,
      role: organisationMembers.role,
      status: organisationMembers.status,
      joinedAt: organisationMembers.joinedAt,
      name: users.name,
      username: userProfiles.username,
    })
    .from(organisationMembers)
    .innerJoin(users, eq(users.id, organisationMembers.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, organisationMembers.userId))
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.status, "active"),
      ),
    )
    .orderBy(asc(organisationMembers.joinedAt));
}

export async function listPendingInvitations(db: Database, userId: string, organisationId: string) {
  if (!(await authorise(db, userId, organisationId, "team.manage"))) return null;
  return db
    .select({
      id: organisationInvitations.id,
      email: organisationInvitations.email,
      role: organisationInvitations.role,
      expiresAt: organisationInvitations.expiresAt,
      createdAt: organisationInvitations.createdAt,
    })
    .from(organisationInvitations)
    .where(
      and(
        eq(organisationInvitations.organisationId, organisationId),
        isNull(organisationInvitations.acceptedAt),
        isNull(organisationInvitations.declinedAt),
        isNull(organisationInvitations.revokedAt),
        sql`${organisationInvitations.expiresAt} > now()`,
      ),
    )
    .orderBy(desc(organisationInvitations.createdAt));
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Creates an invitation and returns its token. The token is shown to the
 * inviter once and never stored: only its SHA-256 hash is kept.
 */
export async function createInvitation(
  db: Database,
  userId: string,
  organisationId: string,
  input: unknown,
): Promise<Result<{ token: string; expiresAt: Date }>> {
  const membership = await authorise(db, userId, organisationId, "team.manage");
  if (!membership) return DENIED;
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const allowed = canAssignRole(membership.role, parsed.data.role);
  if (!allowed.allowed) return { ok: false, errors: { role: allowed.reason } };

  const [existingMember] = await db
    .select({ status: organisationMembers.status })
    .from(organisationMembers)
    .innerJoin(users, eq(users.id, organisationMembers.userId))
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(users.email, parsed.data.email),
      ),
    );
  if (existingMember?.status === "active") {
    return { ok: false, errors: { email: "This person is already in the organisation." } };
  }

  // A new invitation replaces any earlier open one for the same address.
  await db
    .update(organisationInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organisationInvitations.organisationId, organisationId),
        eq(organisationInvitations.email, parsed.data.email),
        isNull(organisationInvitations.acceptedAt),
        isNull(organisationInvitations.declinedAt),
        isNull(organisationInvitations.revokedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
  const [invitation] = await db
    .insert(organisationInvitations)
    .values({
      organisationId,
      email: parsed.data.email,
      role: parsed.data.role,
      tokenHash: hashInvitationToken(token),
      expiresAt,
      createdBy: userId,
    })
    .returning();
  await audit(db, userId, organisationId, "team.invited", "invitation", invitation.id, {
    role: parsed.data.role,
  });

  const [invitee] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email));
  if (invitee) {
    const [organisation] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, organisationId));
    await notify(db, {
      userId: invitee.id,
      type: "organisation.invitation",
      title: `You were invited to join ${organisation.name}`,
      body: "Open the invitation link you were sent to accept or decline.",
    });
  }
  return { ok: true, value: { token, expiresAt } };
}

export async function revokeInvitation(
  db: Database,
  userId: string,
  organisationId: string,
  invitationId: string,
) {
  if (!UUID.test(invitationId)) return DENIED;
  if (!(await authorise(db, userId, organisationId, "team.manage"))) return DENIED;
  const updated = await db
    .update(organisationInvitations)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(organisationInvitations.id, invitationId),
        eq(organisationInvitations.organisationId, organisationId),
        isNull(organisationInvitations.acceptedAt),
        isNull(organisationInvitations.revokedAt),
      ),
    )
    .returning({ id: organisationInvitations.id });
  if (updated.length === 0) return DENIED;
  await audit(db, userId, organisationId, "team.invitation_revoked", "invitation", invitationId);
  return { ok: true as const, value: null };
}

export type InvitationView =
  | {
      state: "open";
      organisation: { name: string; slug: string };
      role: OrganisationRole;
      email: string;
      expiresAt: Date;
    }
  | { state: "invalid" };

/** Looks up an invitation by its token. Anything unusable reads as "invalid". */
export async function viewInvitation(db: Database, token: string): Promise<InvitationView> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100)
    return { state: "invalid" };
  const [row] = await db
    .select({ invitation: organisationInvitations, organisation: organisations })
    .from(organisationInvitations)
    .innerJoin(organisations, eq(organisations.id, organisationInvitations.organisationId))
    .where(eq(organisationInvitations.tokenHash, hashInvitationToken(token)));
  if (
    !row ||
    row.invitation.acceptedAt ||
    row.invitation.declinedAt ||
    row.invitation.revokedAt ||
    row.invitation.expiresAt.getTime() <= Date.now()
  ) {
    return { state: "invalid" };
  }
  return {
    state: "open",
    organisation: { name: row.organisation.name, slug: row.organisation.slug },
    role: row.invitation.role,
    email: row.invitation.email,
    expiresAt: row.invitation.expiresAt,
  };
}

/**
 * Accepts or declines an invitation. It must be addressed to the signed-in
 * person's email, so a forwarded or leaked link cannot be used by anyone else.
 */
export async function respondToInvitation(
  db: Database,
  user: { id: string; email: string },
  token: string,
  accept: boolean,
): Promise<Result<{ organisationSlug: string }>> {
  const invalid = {
    ok: false as const,
    errors: { form: "This invitation is no longer valid. Ask for a new one." },
  };
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return invalid;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ invitation: organisationInvitations, organisation: organisations })
      .from(organisationInvitations)
      .innerJoin(organisations, eq(organisations.id, organisationInvitations.organisationId))
      .where(eq(organisationInvitations.tokenHash, hashInvitationToken(token)));
    if (
      !row ||
      row.invitation.acceptedAt ||
      row.invitation.declinedAt ||
      row.invitation.revokedAt ||
      row.invitation.expiresAt.getTime() <= Date.now()
    ) {
      return invalid;
    }
    if (row.invitation.email !== user.email.toLowerCase()) {
      return {
        ok: false as const,
        errors: {
          form: `This invitation was sent to ${row.invitation.email}. Sign in with that address to respond.`,
        },
      };
    }

    const now = new Date();
    const { invitation, organisation } = row;
    const db2 = tx as unknown as Database;
    if (accept) {
      await tx
        .insert(organisationMembers)
        .values({
          organisationId: invitation.organisationId,
          userId: user.id,
          role: invitation.role,
          status: "active",
          invitedBy: invitation.createdBy,
          joinedAt: now,
        })
        .onConflictDoUpdate({
          target: [organisationMembers.organisationId, organisationMembers.userId],
          set: {
            role: invitation.role,
            status: "active",
            invitedBy: invitation.createdBy,
            joinedAt: now,
          },
        });
      await tx
        .update(organisationInvitations)
        .set({ acceptedAt: now })
        .where(eq(organisationInvitations.id, invitation.id));
      await audit(
        db2,
        user.id,
        organisation.id,
        "team.invitation_accepted",
        "invitation",
        invitation.id,
        {
          role: invitation.role,
        },
      );
    } else {
      await tx
        .update(organisationInvitations)
        .set({ declinedAt: now })
        .where(eq(organisationInvitations.id, invitation.id));
      await audit(
        db2,
        user.id,
        organisation.id,
        "team.invitation_declined",
        "invitation",
        invitation.id,
      );
    }
    await notify(db2, {
      userId: invitation.createdBy,
      type: accept ? "organisation.invitation_accepted" : "organisation.invitation_declined",
      title: `${user.email} ${accept ? "accepted" : "declined"} your invitation to ${organisation.name}`,
      href: `/org/${organisation.slug}/team`,
    });
    return { ok: true as const, value: { organisationSlug: organisation.slug } };
  });
}

async function activeOwnerCount(db: Database, organisationId: string): Promise<number> {
  const rows = await db
    .select({ id: organisationMembers.id })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.role, "owner"),
        eq(organisationMembers.status, "active"),
      ),
    );
  return rows.length;
}

/**
 * Changes a member's role, or removes them (newRole null), including leaving.
 * Runs in a transaction that re-reads both memberships and the owner count,
 * so two owners removing each other at once cannot leave the organisation
 * with none.
 */
export async function changeMember(
  db: Database,
  actorId: string,
  organisationId: string,
  targetUserId: string,
  newRole: unknown,
): Promise<Result<null>> {
  const role = newRole === null ? null : roleSchema.safeParse(newRole);
  if (role !== null && !role.success)
    return { ok: false, errors: { role: "Choose a valid role." } };
  const parsedRole = role === null ? null : role.data;

  return db.transaction(async (tx) => {
    const db2 = tx as unknown as Database;
    // Lock the organisation's membership rows for the length of this change.
    await tx.execute(
      sql`SELECT id FROM organisation_members WHERE organisation_id = ${organisationId} FOR UPDATE`,
    );
    const actor = await getMembership(db2, actorId, organisationId);
    const target = await getMembership(db2, targetUserId, organisationId);
    if (!actor || actor.status !== "active" || !target) return DENIED;
    const decision = canChangeMember({
      actor,
      target,
      newRole: parsedRole,
      activeOwnerCount: await activeOwnerCount(db2, organisationId),
    });
    if (!decision.allowed) return { ok: false as const, errors: { form: decision.reason } };

    await tx
      .update(organisationMembers)
      .set(parsedRole === null ? { status: "removed" } : { role: parsedRole })
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.userId, targetUserId),
        ),
      );
    await audit(
      db2,
      actorId,
      organisationId,
      parsedRole === null
        ? actorId === targetUserId
          ? "team.left"
          : "team.removed"
        : "team.role_changed",
      "membership",
      targetUserId,
      { from: target.role, to: parsedRole },
    );
    return { ok: true as const, value: null };
  });
}

export async function transferOwnership(
  db: Database,
  actorId: string,
  organisationId: string,
  targetUserId: string,
): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    const db2 = tx as unknown as Database;
    const actor = await getMembership(db2, actorId, organisationId);
    const target = await getMembership(db2, targetUserId, organisationId);
    if (!actor || !target) return DENIED;
    const decision = canTransferOwnership(actor, target);
    if (!decision.allowed) return { ok: false as const, errors: { form: decision.reason } };
    await tx
      .update(organisationMembers)
      .set({ role: "owner" })
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.userId, targetUserId),
        ),
      );
    await audit(
      db2,
      actorId,
      organisationId,
      "team.ownership_granted",
      "membership",
      targetUserId,
      {
        from: target.role,
      },
    );
    return { ok: true as const, value: null };
  });
}

// ── Overview ─────────────────────────────────────────────────────────────────

/** Counts for the organisation's overview. Members only. */
export async function organisationOverview(db: Database, userId: string, organisationId: string) {
  if (!(await authorise(db, userId, organisationId, "organisation.view_workspace"))) return null;
  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, organisationId),
        eq(organisationMembers.status, "active"),
      ),
    );
  const [projectCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projects)
    .where(and(eq(projects.organisationId, organisationId), ne(projects.status, "archived")));
  const [pendingCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contributions)
    .where(
      and(
        eq(contributions.organisationId, organisationId),
        inArray(contributions.status, ["pending", "needs_information"]),
      ),
    );
  return {
    members: memberCount.count,
    projects: projectCount.count,
    awaitingReview: pendingCount.count,
  };
}
