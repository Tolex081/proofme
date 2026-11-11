import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { listNotifications } from "@/server/services/account";
import {
  adminOverview,
  createReport,
  decideOrganisation,
  explore,
  getOrganisationForAdmin,
  listAuditEvents,
  listOrganisationsForAdmin,
  listReports,
  resolveReport,
  searchUsers,
  setUserSuspended,
} from "@/server/services/admin";
import {
  createOrganisation,
  createProject,
  requestPlatformReview,
} from "@/server/services/organisations";
import { completeOnboarding, updatePrivacy } from "@/server/services/profile";
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

async function person(name = "Person", options: { admin?: boolean; publicProfile?: boolean } = {}) {
  const id = `user_${randomUUID()}`;
  await db.insert(s.users).values({
    id,
    name,
    email: `${id}@example.test`.toLowerCase(),
    isPlatformAdmin: options.admin ?? false,
  });
  const username = `u-${short()}`;
  const onboarded = await completeOnboarding(db, id, {
    intent: "both",
    displayName: name,
    username,
    bio: "Builds things.",
    roles: [],
  });
  if (!onboarded.ok) throw new Error("onboarding");
  if (options.publicProfile) {
    await updatePrivacy(db, id, {
      visibility: "public",
      sections: { bio: true, location: true, links: true, skills: true, nearAccount: true },
    });
  }
  return { id, username };
}

async function pendingOrganisation() {
  const owner = await person("Owner");
  const org = await createOrganisation(db, owner.id, {
    name: `Pending Org ${short()}`,
    slug: `pending-${short()}`,
    category: "dao",
    description: "Ready for review.",
    websiteUrl: "https://example.org",
  });
  if (!org.ok) throw new Error("org");
  await requestPlatformReview(db, owner.id, org.value.id);
  return { owner, org: org.value };
}

describe("admin access", () => {
  it("refuses everything to people who are not administrators", async () => {
    const plain = await person("Plain");
    const { org } = await pendingOrganisation();
    expect(await adminOverview(db, plain.id)).toBeNull();
    expect(await listOrganisationsForAdmin(db, plain.id)).toBeNull();
    expect(await getOrganisationForAdmin(db, plain.id, org.id)).toBeNull();
    expect(await searchUsers(db, plain.id)).toBeNull();
    expect(await listReports(db, plain.id)).toBeNull();
    expect(await listAuditEvents(db, plain.id)).toBeNull();
    expect(
      (await decideOrganisation(db, plain.id, org.id, { decision: "approve", reason: "" })).ok,
    ).toBe(false);
    const [unchanged] = await db
      .select()
      .from(s.organisations)
      .where(eq(s.organisations.id, org.id));
    expect(unchanged.platformVerificationStatus).toBe("pending");
  });

  it("stops working as soon as the account is no longer active", async () => {
    const admin = await person("Former Admin", { admin: true });
    await db.update(s.users).set({ status: "suspended" }).where(eq(s.users.id, admin.id));
    expect(await adminOverview(db, admin.id)).toBeNull();
  });
});

describe("organisation review", () => {
  it("approves a pending organisation, records who and when, and tells its owners", async () => {
    const admin = await person("Admin", { admin: true });
    const { owner, org } = await pendingOrganisation();
    expect((await listOrganisationsForAdmin(db, admin.id, "pending"))?.map((o) => o.id)).toContain(
      org.id,
    );

    const result = await decideOrganisation(db, admin.id, org.id, {
      decision: "approve",
      reason: "",
    });
    expect(result).toEqual({ ok: true, value: { status: "verified" } });
    const [row] = await db.select().from(s.organisations).where(eq(s.organisations.id, org.id));
    expect(row.platformVerificationStatus).toBe("verified");
    expect(row.platformVerificationReviewedBy).toBe(admin.id);
    expect(row.platformVerificationReviewedAt).toBeInstanceOf(Date);
    // Platform review never touches the NEAR issuer standing.
    expect(row.nearIssuerStatus).toBe("none");
    expect((await listNotifications(db, owner.id)).map((n) => n.type)).toContain(
      "organisation.platform_approve",
    );
    const audit = await listAuditEvents(db, admin.id, { entityId: org.id });
    expect(audit?.map((event) => event.action)).toContain("admin.organisation.approve");
  });

  it("requires a reason to reject, ask for more, suspend or reinstate", async () => {
    const admin = await person("Admin", { admin: true });
    const { org } = await pendingOrganisation();
    for (const decision of ["reject", "request_information", "suspend"]) {
      const result = await decideOrganisation(db, admin.id, org.id, { decision, reason: "  " });
      expect(result.ok, decision).toBe(false);
    }
    expect(
      (
        await decideOrganisation(db, admin.id, org.id, {
          decision: "request_information",
          reason: "Link your official site.",
        })
      ).ok,
    ).toBe(true);
    const [row] = await db.select().from(s.organisations).where(eq(s.organisations.id, org.id));
    expect(row).toMatchObject({
      platformVerificationStatus: "unverified",
      platformVerificationReason: "Link your official site.",
    });
  });

  it("only allows decisions that fit the current state", async () => {
    const admin = await person("Admin", { admin: true });
    const { org } = await pendingOrganisation();
    expect(
      (await decideOrganisation(db, admin.id, org.id, { decision: "reinstate", reason: "x" })).ok,
    ).toBe(false);
    expect(
      (
        await decideOrganisation(db, admin.id, org.id, {
          decision: "suspend",
          reason: "Impersonating a protocol.",
        })
      ).ok,
    ).toBe(true);
    expect(
      (await decideOrganisation(db, admin.id, org.id, { decision: "approve", reason: "" })).ok,
    ).toBe(false);
    expect(
      (
        await decideOrganisation(db, admin.id, org.id, {
          decision: "reinstate",
          reason: "Resolved.",
        })
      ).ok,
    ).toBe(true);
    expect(
      (await decideOrganisation(db, admin.id, org.id, { decision: "wizardry", reason: "" })).ok,
    ).toBe(false);
  });
});

describe("accounts", () => {
  it("suspends with a reason, ends sessions, and cannot touch administrators or oneself", async () => {
    const admin = await person("Admin", { admin: true });
    const otherAdmin = await person("Other Admin", { admin: true });
    const target = await person("Target");
    await db.insert(s.sessions).values({
      id: randomUUID(),
      userId: target.id,
      token: `t-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    expect((await setUserSuspended(db, admin.id, target.id, true, "")).ok).toBe(false);
    expect((await setUserSuspended(db, admin.id, admin.id, true, "Testing")).ok).toBe(false);
    expect((await setUserSuspended(db, admin.id, otherAdmin.id, true, "Testing")).ok).toBe(false);
    expect(
      (await setUserSuspended(db, admin.id, target.id, true, "Spam reports confirmed.")).ok,
    ).toBe(true);
    const [row] = await db.select().from(s.users).where(eq(s.users.id, target.id));
    expect(row.status).toBe("suspended");
    expect(await db.select().from(s.sessions).where(eq(s.sessions.userId, target.id))).toEqual([]);
    expect((await setUserSuspended(db, admin.id, target.id, false, "Appeal accepted.")).ok).toBe(
      true,
    );
  });

  it("finds accounts by name, email or username", async () => {
    const admin = await person("Admin", { admin: true });
    const target = await person("Zelda Findable");
    expect((await searchUsers(db, admin.id, "zelda"))?.map((u) => u.id)).toContain(target.id);
    expect((await searchUsers(db, admin.id, target.username))?.map((u) => u.id)).toContain(
      target.id,
    );
  });
});

describe("reports", () => {
  it("lets a signed-in person report, and an administrator close it with an outcome", async () => {
    const admin = await person("Admin", { admin: true });
    const reporter = await person("Reporter");
    const created = await createReport(db, reporter.id, {
      targetType: "profile",
      targetId: "someone",
      reason: "impersonation",
      details: "Uses a well-known developer's name.",
    });
    expect(created.ok).toBe(true);
    const open = await listReports(db, admin.id, "open");
    const report = open?.find((item) => item.targetId === "someone");
    expect(report).toMatchObject({ reason: "impersonation", reporterName: "Reporter" });

    expect(
      (await resolveReport(db, admin.id, report!.id, "reviewed", "Account suspended.")).ok,
    ).toBe(true);
    expect((await resolveReport(db, admin.id, report!.id, "dismissed", "")).ok).toBe(false);
    expect((await listReports(db, admin.id, "reviewed"))?.map((r) => r.id)).toContain(report!.id);
  });

  it("rejects malformed reports and limits how many one person can send", async () => {
    const reporter = await person("Busy Reporter");
    expect(
      (
        await createReport(db, reporter.id, {
          targetType: "planet",
          targetId: "x",
          reason: "spam",
          details: "",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await createReport(db, reporter.id, {
          targetType: "profile",
          targetId: "x",
          reason: "because",
          details: "",
        })
      ).ok,
    ).toBe(false);
    for (let i = 0; i < 10; i += 1) {
      expect(
        (
          await createReport(db, reporter.id, {
            targetType: "profile",
            targetId: `p${i}`,
            reason: "spam",
            details: "",
          })
        ).ok,
      ).toBe(true);
    }
    expect(
      (
        await createReport(db, reporter.id, {
          targetType: "profile",
          targetId: "p11",
          reason: "spam",
          details: "",
        })
      ).ok,
    ).toBe(false);
  });
});

describe("explore", () => {
  it("finds only public, finished profiles of active accounts", async () => {
    const visible = await person("Visible Searchperson", { publicProfile: true });
    const hidden = await person("Hidden Searchperson");
    const suspended = await person("Suspended Searchperson", { publicProfile: true });
    await db.update(s.users).set({ status: "suspended" }).where(eq(s.users.id, suspended.id));

    const result = await explore(db, { query: "Searchperson", kind: "people" });
    const names = result.people?.map((p) => p.username) ?? [];
    expect(names).toContain(visible.username);
    expect(names).not.toContain(hidden.username);
    expect(names).not.toContain(suspended.username);
    expect(JSON.stringify(result)).not.toContain("@example.test");
  });

  it("can require verified work, overall or in one category", async () => {
    const withWork = await person("Verified Worker", { publicProfile: true });
    const withoutWork = await person("Unverified Worker", { publicProfile: true });
    await db.insert(s.contributions).values({
      contributorUserId: withWork.id,
      title: "Verified thing",
      status: "verified",
      visibility: "public",
      category: "design",
      organisationId: (await pendingOrganisation()).org.id,
    });
    const verifiedOnly = await explore(db, { query: "Worker", kind: "people", verifiedOnly: true });
    expect(verifiedOnly.people?.map((p) => p.username)).toEqual([withWork.username]);
    expect(verifiedOnly.people?.[0].verified).toBe(1);
    const design = await explore(db, { query: "Worker", kind: "people", category: "design" });
    expect(design.people?.map((p) => p.username)).toEqual([withWork.username]);
    const research = await explore(db, { query: "Worker", kind: "people", category: "research" });
    expect(research.people).toEqual([]);
    expect(withoutWork.username).toBeTruthy();
  });

  it("lists organisations except suspended ones, and only public projects", async () => {
    const admin = await person("Admin", { admin: true });
    const { owner, org } = await pendingOrganisation();
    const { org: hiddenOrg } = await pendingOrganisation();
    await decideOrganisation(db, admin.id, hiddenOrg.id, { decision: "suspend", reason: "Abuse." });
    await createProject(db, owner.id, org.id, {
      name: "Exploreable Live",
      description: "",
      websiteUrl: "",
      repositoryUrl: "",
      status: "active",
      startDate: "",
      endDate: "",
    });
    await createProject(db, owner.id, org.id, {
      name: "Exploreable Draft",
      description: "",
      websiteUrl: "",
      repositoryUrl: "",
      status: "draft",
      startDate: "",
      endDate: "",
    });

    const orgs = await explore(db, { query: "Pending Org", kind: "organisations" });
    const slugs = orgs.organisations?.map((o) => o.slug) ?? [];
    expect(slugs).toContain(org.slug);
    expect(slugs).not.toContain(hiddenOrg.slug);

    const projects = await explore(db, { query: "Exploreable", kind: "projects" });
    expect(projects.projects?.map((p) => p.name)).toEqual(["Exploreable Live"]);
  });

  it("treats search text as text, never as a pattern or SQL", async () => {
    for (const query of ["%", "_", "' OR 1=1 --", "\\"]) {
      const result = await explore(db, { query, kind: "people" });
      expect(Array.isArray(result.people)).toBe(true);
    }
  });
});
