import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { listNotifications } from "@/server/services/account";
import {
  changeMember,
  createInvitation,
  createOrganisation,
  createProject,
  getOrganisationForMember,
  getProjectForMember,
  getPublicOrganisation,
  getPublicProject,
  hashInvitationToken,
  listMembers,
  listMyOrganisations,
  listPendingInvitations,
  listProjectsForMember,
  organisationOverview,
  requestPlatformReview,
  respondToInvitation,
  revokeInvitation,
  transferOwnership,
  updateOrganisation,
  updateProject,
  viewInvitation,
} from "@/server/services/organisations";
import { createTestDatabase } from "./database";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDatabase();
  db = created.db as unknown as Database;
  close = created.close;
});

afterAll(async () => {
  await close();
});

const short = () => randomUUID().slice(0, 8);

async function person() {
  const id = `user_${randomUUID()}`;
  const email = `${id}@example.test`.toLowerCase();
  await db.insert(s.users).values({ id, name: "Person", email });
  return { id, email };
}

function orgInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Northstar Protocol",
    slug: `northstar-${short()}`,
    category: "web3_protocol",
    description: "A fictional protocol used in tests.",
    websiteUrl: "https://northstar.example.org",
    ...overrides,
  };
}

async function organisation(ownerId: string, overrides: Record<string, unknown> = {}) {
  const result = await createOrganisation(db, ownerId, orgInput(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

/** Adds a member directly, standing in for an accepted invitation. */
async function addMember(
  organisationId: string,
  userId: string,
  role: "owner" | "admin" | "reviewer" | "viewer",
) {
  await db.insert(s.organisationMembers).values({ organisationId, userId, role, status: "active" });
}

const project = (overrides: Record<string, unknown> = {}) => ({
  name: "Open Grants Portal",
  description: "Where grant proposals are reviewed.",
  websiteUrl: "",
  repositoryUrl: "https://github.com/northstar-demo/portal",
  status: "active",
  startDate: "",
  endDate: "",
  ...overrides,
});

describe("creating an organisation", () => {
  it("uses the existing account, makes the creator owner, and starts unverified", async () => {
    const owner = await person();
    const org = await organisation(owner.id);
    expect(org.platformVerificationStatus).toBe("unverified");
    expect(org.nearIssuerStatus).toBe("none");

    const access = await getOrganisationForMember(db, owner.id, org.slug);
    expect(access?.membership.role).toBe("owner");
    expect((await listMyOrganisations(db, owner.id)).map((o) => o.slug)).toEqual([org.slug]);

    const users = await db.select().from(s.users).where(eq(s.users.email, owner.email));
    expect(users).toHaveLength(1);
  });

  it("refuses a request trying to mark itself verified or registered", async () => {
    const owner = await person();
    const org = await organisation(owner.id, {
      platformVerificationStatus: "verified",
      nearIssuerStatus: "registered",
      nearIssuerAccountId: "fake.testnet",
    });
    expect(org.platformVerificationStatus).toBe("unverified");
    expect(org.nearIssuerStatus).toBe("none");
    expect(org.nearIssuerAccountId).toBeNull();
  });

  it("rejects a taken, reserved or malformed address", async () => {
    const owner = await person();
    const first = await organisation(owner.id);
    const taken = await createOrganisation(db, owner.id, orgInput({ slug: first.slug }));
    expect(taken).toEqual({
      ok: false,
      errors: { slug: "That address is taken. Choose another." },
    });
    for (const slug of ["new", "ab", "Has Space", "-lead"]) {
      expect((await createOrganisation(db, owner.id, orgInput({ slug }))).ok, slug).toBe(false);
    }
  });
});

describe("platform review", () => {
  it("moves to pending once, needs a description and website, and is audited", async () => {
    const owner = await person();
    const bare = await organisation(owner.id, { description: "", websiteUrl: "" });
    expect((await requestPlatformReview(db, owner.id, bare.id)).ok).toBe(false);

    const org = await organisation(owner.id);
    const result = await requestPlatformReview(db, owner.id, org.id);
    expect(result.ok && result.value.platformVerificationStatus).toBe("pending");
    expect((await requestPlatformReview(db, owner.id, org.id)).ok).toBe(false);
    const events = await db
      .select()
      .from(s.auditEvents)
      .where(eq(s.auditEvents.organisationId, org.id));
    expect(events.map((e) => e.action)).toContain("organisation.review_requested");
  });

  it("is open to owners and admins only", async () => {
    const owner = await person();
    const reviewer = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, reviewer.id, "reviewer");
    expect((await requestPlatformReview(db, reviewer.id, org.id)).ok).toBe(false);
  });
});

describe("roles", () => {
  it("lets owners and admins edit the organisation and projects, not reviewers or viewers", async () => {
    const owner = await person();
    const admin = await person();
    const reviewer = await person();
    const viewer = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, admin.id, "admin");
    await addMember(org.id, reviewer.id, "reviewer");
    await addMember(org.id, viewer.id, "viewer");

    expect(
      (
        await updateOrganisation(
          db,
          admin.id,
          org.id,
          orgInput({ slug: org.slug, name: "Renamed" }),
        )
      ).ok,
    ).toBe(true);
    for (const actor of [reviewer, viewer]) {
      expect(
        (await updateOrganisation(db, actor.id, org.id, orgInput({ slug: org.slug }))).ok,
      ).toBe(false);
      expect((await createProject(db, actor.id, org.id, project())).ok).toBe(false);
    }
    const created = await createProject(db, admin.id, org.id, project());
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.slug).toContain(org.slug);
      expect(
        (await updateProject(db, viewer.id, created.value.id, project({ name: "Hijack" }))).ok,
      ).toBe(false);
    }
    // Every member can see the workspace and its projects.
    expect(await listProjectsForMember(db, viewer.id, org.id)).toHaveLength(1);
  });

  it("gives each project a unique public address", async () => {
    const owner = await person();
    const org = await organisation(owner.id);
    const a = await createProject(db, owner.id, org.id, project());
    const b = await createProject(db, owner.id, org.id, project());
    expect(a.ok && b.ok && a.value.slug !== b.value.slug).toBe(true);
  });
});

describe("isolation between organisations", () => {
  it("never lets a member of one organisation read or change another's private data", async () => {
    const ownerA = await person();
    const ownerB = await person();
    const orgA = await organisation(ownerA.id);
    const orgB = await organisation(ownerB.id);
    const projectB = await createProject(db, ownerB.id, orgB.id, project({ status: "draft" }));
    if (!projectB.ok) throw new Error("setup");

    expect(await getOrganisationForMember(db, ownerA.id, orgB.slug)).toBeNull();
    expect(await listProjectsForMember(db, ownerA.id, orgB.id)).toBeNull();
    expect(await getProjectForMember(db, ownerA.id, orgB.id, projectB.value.id)).toBeNull();
    // Asking for B's project through A's organisation does not work either.
    expect(await getProjectForMember(db, ownerA.id, orgA.id, projectB.value.id)).toBeNull();
    expect(await listMembers(db, ownerA.id, orgB.id)).toBeNull();
    expect(await listPendingInvitations(db, ownerA.id, orgB.id)).toBeNull();
    expect(await organisationOverview(db, ownerA.id, orgB.id)).toBeNull();

    expect(
      (await updateOrganisation(db, ownerA.id, orgB.id, orgInput({ slug: orgB.slug }))).ok,
    ).toBe(false);
    expect(
      (await updateProject(db, ownerA.id, projectB.value.id, project({ name: "Taken over" }))).ok,
    ).toBe(false);
    expect((await createProject(db, ownerA.id, orgB.id, project())).ok).toBe(false);
    expect(
      (await createInvitation(db, ownerA.id, orgB.id, { email: "x@example.test", role: "admin" }))
        .ok,
    ).toBe(false);
    expect((await changeMember(db, ownerA.id, orgB.id, ownerB.id, null)).ok).toBe(false);
    expect((await requestPlatformReview(db, ownerA.id, orgB.id)).ok).toBe(false);

    const [unchanged] = await db
      .select()
      .from(s.projects)
      .where(eq(s.projects.id, projectB.value.id));
    expect(unchanged.name).toBe("Open Grants Portal");
  });

  it("treats removed members like strangers", async () => {
    const owner = await person();
    const former = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, former.id, "admin");
    expect((await changeMember(db, owner.id, org.id, former.id, null)).ok).toBe(true);
    expect(await getOrganisationForMember(db, former.id, org.slug)).toBeNull();
    expect((await createProject(db, former.id, org.id, project())).ok).toBe(false);
  });
});

describe("invitations", () => {
  it("stores only a hash, and the invited person can accept with their own email", async () => {
    const owner = await person();
    const invitee = await person();
    const org = await organisation(owner.id);
    const created = await createInvitation(db, owner.id, org.id, {
      email: invitee.email.toUpperCase(),
      role: "reviewer",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { token } = created.value;

    const [row] = await db
      .select()
      .from(s.organisationInvitations)
      .where(eq(s.organisationInvitations.organisationId, org.id));
    expect(row.tokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.email).toBe(invitee.email);

    const view = await viewInvitation(db, token);
    expect(view).toMatchObject({
      state: "open",
      role: "reviewer",
      organisation: { slug: org.slug },
    });
    expect((await listNotifications(db, invitee.id)).map((n) => n.type)).toContain(
      "organisation.invitation",
    );

    const accepted = await respondToInvitation(db, invitee, token, true);
    expect(accepted).toEqual({ ok: true, value: { organisationSlug: org.slug } });
    expect((await getOrganisationForMember(db, invitee.id, org.slug))?.membership.role).toBe(
      "reviewer",
    );
    expect(await viewInvitation(db, token)).toEqual({ state: "invalid" });
    expect((await respondToInvitation(db, invitee, token, true)).ok).toBe(false);
    expect((await listNotifications(db, owner.id)).map((n) => n.type)).toContain(
      "organisation.invitation_accepted",
    );
  });

  it("cannot be used by someone else who has the link", async () => {
    const owner = await person();
    const invitee = await person();
    const thief = await person();
    const org = await organisation(owner.id);
    const created = await createInvitation(db, owner.id, org.id, {
      email: invitee.email,
      role: "admin",
    });
    if (!created.ok) throw new Error("setup");
    const stolen = await respondToInvitation(db, thief, created.value.token, true);
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.errors.form).toContain(invitee.email);
    expect(await getOrganisationForMember(db, thief.id, org.slug)).toBeNull();
  });

  it("can be declined, revoked, replaced, and expires", async () => {
    const owner = await person();
    const invitee = await person();
    const org = await organisation(owner.id);

    const first = await createInvitation(db, owner.id, org.id, {
      email: invitee.email,
      role: "viewer",
    });
    const second = await createInvitation(db, owner.id, org.id, {
      email: invitee.email,
      role: "reviewer",
    });
    if (!first.ok || !second.ok) throw new Error("setup");
    expect(await viewInvitation(db, first.value.token)).toEqual({ state: "invalid" });
    expect((await listPendingInvitations(db, owner.id, org.id))?.map((i) => i.role)).toEqual([
      "reviewer",
    ]);

    expect((await respondToInvitation(db, invitee, second.value.token, false)).ok).toBe(true);
    expect(await getOrganisationForMember(db, invitee.id, org.slug)).toBeNull();

    const third = await createInvitation(db, owner.id, org.id, {
      email: invitee.email,
      role: "viewer",
    });
    if (!third.ok) throw new Error("setup");
    const [pending] = (await listPendingInvitations(db, owner.id, org.id)) ?? [];
    expect((await revokeInvitation(db, owner.id, org.id, pending.id)).ok).toBe(true);
    expect(await viewInvitation(db, third.value.token)).toEqual({ state: "invalid" });

    const fourth = await createInvitation(db, owner.id, org.id, {
      email: invitee.email,
      role: "viewer",
    });
    if (!fourth.ok) throw new Error("setup");
    await db
      .update(s.organisationInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(s.organisationInvitations.tokenHash, hashInvitationToken(fourth.value.token)));
    expect((await respondToInvitation(db, invitee, fourth.value.token, true)).ok).toBe(false);
  });

  it("follows the role rules: no owner invitations, admins invite only reviewers and viewers", async () => {
    const owner = await person();
    const admin = await person();
    const reviewer = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, admin.id, "admin");
    await addMember(org.id, reviewer.id, "reviewer");

    expect(
      (await createInvitation(db, owner.id, org.id, { email: "a@example.test", role: "owner" })).ok,
    ).toBe(false);
    expect(
      (await createInvitation(db, admin.id, org.id, { email: "b@example.test", role: "admin" })).ok,
    ).toBe(false);
    expect(
      (await createInvitation(db, admin.id, org.id, { email: "c@example.test", role: "reviewer" }))
        .ok,
    ).toBe(true);
    expect(
      (await createInvitation(db, reviewer.id, org.id, { email: "d@example.test", role: "viewer" }))
        .ok,
    ).toBe(false);
    expect(
      (await createInvitation(db, owner.id, org.id, { email: admin.email, role: "viewer" })).ok,
    ).toBe(false);
    expect(
      (await createInvitation(db, owner.id, org.id, { email: "not-an-email", role: "viewer" })).ok,
    ).toBe(false);
  });

  it("treats malformed tokens as invalid", async () => {
    const someone = await person();
    for (const token of ["", "short", "x".repeat(500)]) {
      expect(await viewInvitation(db, token)).toEqual({ state: "invalid" });
      expect((await respondToInvitation(db, someone, token, true)).ok).toBe(false);
    }
  });
});

describe("changing members", () => {
  it("never leaves an organisation without an owner", async () => {
    const owner = await person();
    const org = await organisation(owner.id);
    const leaving = await changeMember(db, owner.id, org.id, owner.id, null);
    expect(leaving.ok).toBe(false);
    const demoted = await changeMember(db, owner.id, org.id, owner.id, "admin");
    expect(demoted.ok).toBe(false);
    const [row] = await db
      .select()
      .from(s.organisationMembers)
      .where(
        and(
          eq(s.organisationMembers.organisationId, org.id),
          eq(s.organisationMembers.userId, owner.id),
        ),
      );
    expect(row).toMatchObject({ role: "owner", status: "active" });
  });

  it("allows transferring ownership, after which the first owner may step down", async () => {
    const owner = await person();
    const next = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, next.id, "admin");
    expect((await transferOwnership(db, next.id, org.id, owner.id)).ok).toBe(false);
    expect((await transferOwnership(db, owner.id, org.id, next.id)).ok).toBe(true);
    expect((await changeMember(db, owner.id, org.id, owner.id, null)).ok).toBe(true);
    expect((await getOrganisationForMember(db, next.id, org.slug))?.membership.role).toBe("owner");
  });

  it("records every membership change", async () => {
    const owner = await person();
    const member = await person();
    const org = await organisation(owner.id);
    await addMember(org.id, member.id, "viewer");
    await changeMember(db, owner.id, org.id, member.id, "reviewer");
    await changeMember(db, owner.id, org.id, member.id, null);
    const actions = (
      await db.select().from(s.auditEvents).where(eq(s.auditEvents.organisationId, org.id))
    ).map((event) => event.action);
    expect(actions).toEqual(expect.arrayContaining(["team.role_changed", "team.removed"]));
  });
});

describe("public views", () => {
  it("shows the organisation with its status, and only active or completed projects", async () => {
    const owner = await person();
    const org = await organisation(owner.id);
    await createProject(db, owner.id, org.id, project({ name: "Live project" }));
    await createProject(db, owner.id, org.id, project({ name: "Secret draft", status: "draft" }));

    const view = await getPublicOrganisation(db, org.slug);
    expect(view?.platformVerificationStatus).toBe("unverified");
    expect(view?.projects.map((p) => p.name)).toEqual(["Live project"]);
    expect(JSON.stringify(view)).not.toContain(owner.id);

    const [draft] = await db.select().from(s.projects).where(eq(s.projects.name, "Secret draft"));
    expect(await getPublicProject(db, draft.slug)).toBeNull();
    const live = view?.projects[0];
    expect((await getPublicProject(db, live!.slug))?.organisation.slug).toBe(org.slug);
  });
});
