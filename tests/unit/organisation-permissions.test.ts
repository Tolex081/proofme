import { describe, expect, it } from "vitest";

import {
  ORGANISATION_ACTIONS,
  ORGANISATION_ROLES,
  canAnchorAttestation,
  canAssignRole,
  canChangeMember,
  canDecideVerification,
  canInOrganisation,
  canTransferOwnership,
  type Membership,
  type OrganisationAction,
  type OrganisationRole,
} from "@/lib/permissions/organisation";

const ORG_A = "org-a";
const ORG_B = "org-b";

function member(role: OrganisationRole, overrides: Partial<Membership> = {}): Membership {
  return { organisationId: ORG_A, userId: `user-${role}`, role, status: "active", ...overrides };
}

// The whole matrix, written out so a change to any cell is a visible test change.
const MATRIX: Record<OrganisationAction, OrganisationRole[]> = {
  "organisation.view_workspace": ["owner", "admin", "reviewer", "viewer"],
  "organisation.update_profile": ["owner", "admin"],
  "organisation.request_platform_review": ["owner", "admin"],
  "organisation.transfer_ownership": ["owner"],
  "team.view": ["owner", "admin", "reviewer", "viewer"],
  "team.manage": ["owner", "admin"],
  "project.manage": ["owner", "admin"],
  "verification.view": ["owner", "admin", "reviewer"],
  "verification.decide": ["owner", "admin", "reviewer"],
  "attestation.view_issued": ["owner", "admin", "reviewer", "viewer"],
  "attestation.anchor": ["owner", "admin", "reviewer"],
  "attestation.revoke": ["owner", "admin"],
  "issuer.configure": ["owner"],
  "audit.view": ["owner", "admin"],
};

describe("canInOrganisation", () => {
  it("covers every action in the matrix", () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...ORGANISATION_ACTIONS].sort());
  });

  for (const action of ORGANISATION_ACTIONS) {
    for (const role of ORGANISATION_ROLES) {
      const expected = MATRIX[action].includes(role);
      it(`${role} ${expected ? "can" : "cannot"} ${action}`, () => {
        expect(canInOrganisation(member(role), ORG_A, action).allowed).toBe(expected);
      });
    }
  }

  it("denies everything without a membership", () => {
    for (const action of ORGANISATION_ACTIONS) {
      expect(canInOrganisation(null, ORG_A, action).allowed).toBe(false);
      expect(canInOrganisation(undefined, ORG_A, action).allowed).toBe(false);
    }
  });

  it("denies everything to a member of a different organisation, even its owner", () => {
    for (const action of ORGANISATION_ACTIONS) {
      expect(canInOrganisation(member("owner"), ORG_B, action).allowed).toBe(false);
    }
  });

  it("denies everything to a removed member, whatever role they held", () => {
    for (const role of ORGANISATION_ROLES) {
      for (const action of ORGANISATION_ACTIONS) {
        const removed = member(role, { status: "removed" });
        expect(canInOrganisation(removed, ORG_A, action).allowed).toBe(false);
      }
    }
  });

  it("gives the same message for 'no membership' and 'other organisation'", () => {
    // So a response never reveals whether another organisation's resource exists.
    const none = canInOrganisation(null, ORG_B, "verification.view");
    const other = canInOrganisation(member("owner"), ORG_B, "verification.view");
    expect(none).toEqual(other);
  });
});

describe("canDecideVerification — nobody verifies their own claim", () => {
  const request = { organisationId: ORG_A, contributorUserId: "user-contributor" };

  it("lets owners, admins and reviewers decide someone else's request", () => {
    for (const role of ["owner", "admin", "reviewer"] as const) {
      expect(canDecideVerification(member(role), request).allowed).toBe(true);
    }
  });

  it("does not let viewers decide", () => {
    expect(canDecideVerification(member("viewer"), request).allowed).toBe(false);
  });

  it("refuses the contributor, even when they own the organisation", () => {
    for (const role of ORGANISATION_ROLES) {
      const self = member(role, { userId: "user-contributor" });
      const decision = canDecideVerification(self, request);
      expect(decision.allowed).toBe(false);
    }
    const owner = canDecideVerification(member("owner", { userId: "user-contributor" }), request);
    expect(owner).toEqual({ allowed: false, reason: "You cannot review your own contribution." });
  });

  it("refuses reviewers from another organisation", () => {
    const outsider = member("owner", { organisationId: ORG_B });
    expect(canDecideVerification(outsider, request).allowed).toBe(false);
  });

  it("refuses removed reviewers and people with no membership", () => {
    expect(canDecideVerification(member("reviewer", { status: "removed" }), request).allowed).toBe(
      false,
    );
    expect(canDecideVerification(null, request).allowed).toBe(false);
  });
});

describe("canAnchorAttestation", () => {
  const attestation = { issuerOrganisationId: ORG_A, subjectUserId: "user-contributor" };

  it("lets reviewing roles of the issuer anchor", () => {
    for (const role of ["owner", "admin", "reviewer"] as const) {
      expect(canAnchorAttestation(member(role), attestation).allowed).toBe(true);
    }
    expect(canAnchorAttestation(member("viewer"), attestation).allowed).toBe(false);
  });

  it("refuses the subject of the attestation and members of other organisations", () => {
    const subject = member("owner", { userId: "user-contributor" });
    expect(canAnchorAttestation(subject, attestation).allowed).toBe(false);
    const outsider = member("owner", { organisationId: ORG_B });
    expect(canAnchorAttestation(outsider, attestation).allowed).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("lets an owner assign admin, reviewer and viewer but never owner", () => {
    expect(canAssignRole("owner", "admin").allowed).toBe(true);
    expect(canAssignRole("owner", "reviewer").allowed).toBe(true);
    expect(canAssignRole("owner", "viewer").allowed).toBe(true);
    expect(canAssignRole("owner", "owner").allowed).toBe(false);
  });

  it("lets an admin assign reviewer and viewer only", () => {
    expect(canAssignRole("admin", "reviewer").allowed).toBe(true);
    expect(canAssignRole("admin", "viewer").allowed).toBe(true);
    expect(canAssignRole("admin", "admin").allowed).toBe(false);
    expect(canAssignRole("admin", "owner").allowed).toBe(false);
  });

  it("lets reviewers and viewers assign nothing", () => {
    for (const actor of ["reviewer", "viewer"] as const) {
      for (const role of ORGANISATION_ROLES) {
        expect(canAssignRole(actor, role).allowed).toBe(false);
      }
    }
  });
});

describe("canChangeMember", () => {
  const owner = member("owner");
  const secondOwner = member("owner", { userId: "user-owner-2" });
  const admin = member("admin");
  const secondAdmin = member("admin", { userId: "user-admin-2" });
  const reviewer = member("reviewer");
  const viewer = member("viewer");

  it("lets an owner change and remove non-owners", () => {
    expect(
      canChangeMember({ actor: owner, target: reviewer, newRole: "admin", activeOwnerCount: 1 })
        .allowed,
    ).toBe(true);
    expect(
      canChangeMember({ actor: owner, target: admin, newRole: null, activeOwnerCount: 1 }).allowed,
    ).toBe(true);
  });

  it("lets an admin manage reviewers and viewers but not owners or other admins", () => {
    expect(
      canChangeMember({ actor: admin, target: viewer, newRole: "reviewer", activeOwnerCount: 1 })
        .allowed,
    ).toBe(true);
    expect(
      canChangeMember({ actor: admin, target: reviewer, newRole: null, activeOwnerCount: 1 })
        .allowed,
    ).toBe(true);
    expect(
      canChangeMember({ actor: admin, target: owner, newRole: "viewer", activeOwnerCount: 2 })
        .allowed,
    ).toBe(false);
    expect(
      canChangeMember({ actor: admin, target: secondAdmin, newRole: null, activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
    expect(
      canChangeMember({ actor: admin, target: reviewer, newRole: "admin", activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
  });

  it("stops anyone promoting a member to owner through a role change", () => {
    expect(
      canChangeMember({ actor: owner, target: admin, newRole: "owner", activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
  });

  it("stops members changing their own role", () => {
    expect(
      canChangeMember({ actor: admin, target: admin, newRole: "viewer", activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
    expect(
      canChangeMember({ actor: reviewer, target: reviewer, newRole: "admin", activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
  });

  it("lets reviewers and viewers manage nobody", () => {
    for (const actor of [reviewer, viewer]) {
      expect(
        canChangeMember({ actor, target: admin, newRole: "viewer", activeOwnerCount: 1 }).allowed,
      ).toBe(false);
      expect(
        canChangeMember({
          actor,
          target: member("viewer", { userId: "user-x" }),
          newRole: null,
          activeOwnerCount: 1,
        }).allowed,
      ).toBe(false);
    }
  });

  it("lets any non-owner member leave", () => {
    for (const actor of [admin, reviewer, viewer]) {
      expect(
        canChangeMember({ actor, target: actor, newRole: null, activeOwnerCount: 1 }).allowed,
      ).toBe(true);
    }
  });

  it("never removes or demotes the last owner", () => {
    const leaving = canChangeMember({
      actor: owner,
      target: owner,
      newRole: null,
      activeOwnerCount: 1,
    });
    expect(leaving.allowed).toBe(false);
    if (!leaving.allowed) expect(leaving.reason).toMatch(/at least one owner/);

    expect(
      canChangeMember({ actor: owner, target: owner, newRole: null, activeOwnerCount: 2 }).allowed,
    ).toBe(true);
    expect(
      canChangeMember({
        actor: owner,
        target: secondOwner,
        newRole: "admin",
        activeOwnerCount: 2,
      }).allowed,
    ).toBe(true);
    // A stale count of one must still block, whoever asks.
    expect(
      canChangeMember({
        actor: secondOwner,
        target: owner,
        newRole: null,
        activeOwnerCount: 1,
      }).allowed,
    ).toBe(false);
  });

  it("refuses changes across organisations and by or to removed members", () => {
    const outsider = member("owner", { organisationId: ORG_B, userId: "user-outsider" });
    expect(
      canChangeMember({ actor: outsider, target: reviewer, newRole: null, activeOwnerCount: 1 })
        .allowed,
    ).toBe(false);
    expect(
      canChangeMember({
        actor: member("owner", { status: "removed" }),
        target: reviewer,
        newRole: null,
        activeOwnerCount: 2,
      }).allowed,
    ).toBe(false);
    expect(
      canChangeMember({
        actor: owner,
        target: member("reviewer", { status: "removed" }),
        newRole: "admin",
        activeOwnerCount: 1,
      }).allowed,
    ).toBe(false);
  });
});

describe("canTransferOwnership", () => {
  it("lets an owner make another active member an owner", () => {
    expect(canTransferOwnership(member("owner"), member("admin")).allowed).toBe(true);
    expect(canTransferOwnership(member("owner"), member("viewer")).allowed).toBe(true);
  });

  it("refuses non-owners, self-transfer, existing owners, removed and outside members", () => {
    expect(canTransferOwnership(member("admin"), member("reviewer")).allowed).toBe(false);
    expect(canTransferOwnership(member("owner"), member("owner")).allowed).toBe(false);
    expect(
      canTransferOwnership(member("owner"), member("owner", { userId: "user-owner-2" })).allowed,
    ).toBe(false);
    expect(
      canTransferOwnership(member("owner"), member("admin", { status: "removed" })).allowed,
    ).toBe(false);
    expect(
      canTransferOwnership(member("owner"), member("admin", { organisationId: ORG_B })).allowed,
    ).toBe(false);
  });
});
