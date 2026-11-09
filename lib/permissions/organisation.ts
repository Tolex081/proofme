/**
 * Organisation permission rules. Pure functions: services load the actor's
 * membership from the database (never from client input) and ask these.
 *
 * Deny by default. A missing, removed or other-organisation membership never
 * grants anything.
 */

export const ORGANISATION_ROLES = ["owner", "admin", "reviewer", "viewer"] as const;
export type OrganisationRole = (typeof ORGANISATION_ROLES)[number];

export const ORGANISATION_ACTIONS = [
  "organisation.view_workspace",
  "organisation.update_profile",
  "organisation.request_platform_review",
  "organisation.transfer_ownership",
  "team.view",
  "team.manage",
  "project.manage",
  "verification.view",
  "verification.decide",
  "attestation.view_issued",
  "attestation.anchor",
  "attestation.revoke",
  "issuer.configure",
  "audit.view",
] as const;

export type OrganisationAction = (typeof ORGANISATION_ACTIONS)[number];

const ALL: readonly OrganisationRole[] = ORGANISATION_ROLES;
const MANAGERS: readonly OrganisationRole[] = ["owner", "admin"];
const REVIEWERS: readonly OrganisationRole[] = ["owner", "admin", "reviewer"];
const OWNERS: readonly OrganisationRole[] = ["owner"];

const ACTION_ROLES: Record<OrganisationAction, readonly OrganisationRole[]> = {
  "organisation.view_workspace": ALL,
  "organisation.update_profile": MANAGERS,
  "organisation.request_platform_review": MANAGERS,
  "organisation.transfer_ownership": OWNERS,
  "team.view": ALL,
  "team.manage": MANAGERS,
  "project.manage": MANAGERS,
  // Verification requests contain a contributor's unpublished claim and the
  // reviewers' private notes, so read-only viewers do not see them.
  "verification.view": REVIEWERS,
  "verification.decide": REVIEWERS,
  "attestation.view_issued": ALL,
  "attestation.anchor": REVIEWERS,
  // Revoking withdraws the organisation's word; kept to owners and admins.
  "attestation.revoke": MANAGERS,
  // Choosing which NEAR account speaks for the organisation is owner-only.
  "issuer.configure": OWNERS,
  "audit.view": MANAGERS,
};

export interface Membership {
  organisationId: string;
  userId: string;
  role: OrganisationRole;
  status: "active" | "removed";
}

export type Decision = { allowed: true } | { allowed: false; reason: string };

const ALLOW: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

/**
 * Can the holder of `membership` perform `action` in `organisationId`?
 * `organisationId` is the organisation that owns the resource being touched,
 * taken from the resource row, not from the URL.
 */
export function canInOrganisation(
  membership: Membership | null | undefined,
  organisationId: string,
  action: OrganisationAction,
): Decision {
  if (!membership) return deny("You are not a member of this organisation.");
  if (membership.organisationId !== organisationId) {
    return deny("You are not a member of this organisation.");
  }
  if (membership.status !== "active") {
    return deny("Your membership of this organisation is no longer active.");
  }
  if (!ACTION_ROLES[action].includes(membership.role)) {
    return deny("Your role in this organisation does not allow this.");
  }
  return ALLOW;
}

/**
 * The core trust rule. A reviewer may decide a request only if they hold a
 * reviewing role in the organisation the request was sent to AND they are not
 * the person who made the claim. Being an owner does not override the second part.
 */
export function canDecideVerification(
  membership: Membership | null | undefined,
  request: { organisationId: string; contributorUserId: string },
): Decision {
  const base = canInOrganisation(membership, request.organisationId, "verification.decide");
  if (!base.allowed) return base;
  if (membership!.userId === request.contributorUserId) {
    return deny("You cannot review your own contribution.");
  }
  return ALLOW;
}

/**
 * Anchoring issues the organisation's attestation on NEAR. The subject of an
 * attestation may not be the one to issue it, for the same reason they may not
 * approve it.
 */
export function canAnchorAttestation(
  membership: Membership | null | undefined,
  attestation: { issuerOrganisationId: string; subjectUserId: string },
): Decision {
  const base = canInOrganisation(
    membership,
    attestation.issuerOrganisationId,
    "attestation.anchor",
  );
  if (!base.allowed) return base;
  if (membership!.userId === attestation.subjectUserId) {
    return deny("You cannot issue an attestation about your own contribution.");
  }
  return ALLOW;
}

/** Roles an inviter may hand out. Ownership moves only by explicit transfer. */
export function canAssignRole(
  actorRole: OrganisationRole,
  roleToAssign: OrganisationRole,
): Decision {
  if (!MANAGERS.includes(actorRole)) return deny("Your role does not allow managing the team.");
  if (roleToAssign === "owner") {
    return deny("Ownership is granted only through an ownership transfer.");
  }
  if (actorRole === "admin" && roleToAssign === "admin") {
    return deny("Only an owner can make someone an admin.");
  }
  return ALLOW;
}

export interface MemberChange {
  actor: Membership;
  target: Membership;
  /** The new role, or null to remove the member. */
  newRole: OrganisationRole | null;
  /** Number of active owners in the organisation before the change. */
  activeOwnerCount: number;
}

/** Changing or removing an existing member, including leaving. */
export function canChangeMember(change: MemberChange): Decision {
  const { actor, target, newRole, activeOwnerCount } = change;
  if (actor.organisationId !== target.organisationId) {
    return deny("You are not a member of this organisation.");
  }
  if (actor.status !== "active") {
    return deny("Your membership of this organisation is no longer active.");
  }
  if (target.status !== "active") return deny("This person is no longer a member.");

  const isSelf = actor.userId === target.userId;
  const isLeaving = isSelf && newRole === null;

  if (!isLeaving) {
    if (!MANAGERS.includes(actor.role)) return deny("Your role does not allow managing the team.");
    if (isSelf) return deny("You cannot change your own role.");
    if (actor.role === "admin" && (target.role === "owner" || target.role === "admin")) {
      return deny("Only an owner can change or remove owners and admins.");
    }
    if (newRole !== null) {
      const assignable = canAssignRole(actor.role, newRole);
      if (!assignable.allowed) return assignable;
    }
  }

  const removesAnOwner = target.role === "owner" && newRole !== "owner";
  if (removesAnOwner && activeOwnerCount <= 1) {
    return deny("An organisation must keep at least one owner. Transfer ownership first.");
  }
  return ALLOW;
}

/**
 * Ownership transfer: an owner makes another active member an owner. The
 * previous owner keeps their ownership unless they then step down, which the
 * last-owner rule in `canChangeMember` governs.
 */
export function canTransferOwnership(actor: Membership, target: Membership): Decision {
  const base = canInOrganisation(actor, target.organisationId, "organisation.transfer_ownership");
  if (!base.allowed) return base;
  if (target.status !== "active") return deny("This person is no longer a member.");
  if (actor.userId === target.userId) return deny("You already own this organisation.");
  if (target.role === "owner") return deny("This person is already an owner.");
  return ALLOW;
}
