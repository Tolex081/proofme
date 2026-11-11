import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import {
  createContribution,
  deleteDraft,
  getOwnContribution,
  listOwnContributions,
  listPublicContributions,
  publishSelfReported,
  updateContribution,
} from "@/server/services/contributions";
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

async function person() {
  const id = `user_${randomUUID()}`;
  await db.insert(s.users).values({ id, name: "Person", email: `${id}@example.test` });
  return id;
}

function claim(overrides: Record<string, unknown> = {}) {
  return {
    title: "Proposal review interface",
    summary: "Built the reviewer-facing proposal screen.",
    description: "Designed and implemented the screen reviewers use to score proposals.",
    category: "development",
    role: "Frontend engineer",
    skills: ["TypeScript", "React", "TypeScript"],
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    visibility: "public",
    evidence: [
      {
        type: "github_pr",
        url: "https://github.com/northstar-demo/portal/pull/42",
        label: "Pull request #42",
      },
      { type: "demo", url: "https://demo.example.org/review", label: "Live demo" },
    ],
    ...overrides,
  };
}

async function created(userId: string, overrides: Record<string, unknown> = {}) {
  const result = await createContribution(db, userId, claim(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

describe("creating a contribution", () => {
  it("saves a private-by-status draft with its evidence in order", async () => {
    const userId = await person();
    const contribution = await created(userId);
    expect(contribution.status).toBe("draft");
    expect(contribution.contributorUserId).toBe(userId);
    expect(contribution.organisationId).toBeNull();
    expect(contribution.skills).toEqual(["TypeScript", "React"]);
    expect(contribution.evidence.map((item) => item.label)).toEqual([
      "Pull request #42",
      "Live demo",
    ]);

    const events = await db
      .select()
      .from(s.auditEvents)
      .where(eq(s.auditEvents.entityId, contribution.id));
    expect(events.map((event) => event.action)).toEqual(["contribution.created"]);
  });

  it("allows a draft with only a title and no evidence", async () => {
    const userId = await person();
    const result = await createContribution(
      db,
      userId,
      claim({
        summary: "",
        description: "",
        role: "",
        skills: [],
        startDate: "",
        endDate: "",
        evidence: [],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", /Only https/],
    ["http://example.com/", /Only https/],
    ["https://localhost/x", /public website/],
    ["https://user:pw@example.com/", /username or password/],
    ["not a link", /spaces/],
    ["example.org/page", /complete link/],
  ])("rejects the evidence link %j with a reason", async (url, message) => {
    const userId = await person();
    const result = await createContribution(
      db,
      userId,
      claim({ evidence: [{ type: "other", url, label: "Bad link" }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["evidence.0.url"]).toMatch(message);
  });

  it("rejects duplicate links, missing labels, too many links and bad dates", async () => {
    const userId = await person();
    const link = { type: "website", url: "https://example.org/", label: "Site" };
    const cases: [Record<string, unknown>, string][] = [
      [{ evidence: [link, link] }, "evidence.1.url"],
      [{ evidence: [{ ...link, label: " " }] }, "evidence.0.label"],
      [
        {
          evidence: Array.from({ length: 11 }, (_, i) => ({
            ...link,
            url: `https://example.org/${i}`,
          })),
        },
        "evidence",
      ],
      [{ startDate: "2026-09-01", endDate: "2026-08-01" }, "endDate"],
      [{ startDate: "2999-01-01", endDate: "" }, "startDate"],
      [{ startDate: "2026-02-31" }, "startDate"],
      [{ title: "ab" }, "title"],
      [{ category: "wizardry" }, "category"],
    ];
    for (const [overrides, key] of cases) {
      const result = await createContribution(db, userId, claim(overrides));
      expect(result.ok, key).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors), key).toContain(key);
    }
  });

  it("ignores fields a contributor must never set", async () => {
    const userId = await person();
    const other = await person();
    const contribution = await created(userId, {
      status: "verified",
      contributorUserId: other,
      featured: true,
      organisationId: randomUUID(),
    });
    expect(contribution.status).toBe("draft");
    expect(contribution.contributorUserId).toBe(userId);
    expect(contribution.featured).toBe(false);
    expect(contribution.organisationId).toBeNull();
  });
});

describe("ownership", () => {
  it("never lets one person read, edit, publish or delete another's contribution", async () => {
    const owner = await person();
    const intruder = await person();
    const contribution = await created(owner);

    expect(await getOwnContribution(db, intruder, contribution.id)).toBeNull();
    expect(
      (await updateContribution(db, intruder, contribution.id, claim({ title: "Hijacked" }))).ok,
    ).toBe(false);
    expect((await publishSelfReported(db, intruder, contribution.id)).ok).toBe(false);
    expect((await deleteDraft(db, intruder, contribution.id)).ok).toBe(false);

    const still = await getOwnContribution(db, owner, contribution.id);
    expect(still?.title).toBe("Proposal review interface");
    expect(await listOwnContributions(db, intruder)).toEqual([]);
  });

  it("treats malformed and unknown IDs as not found", async () => {
    const owner = await person();
    for (const id of ["not-a-uuid", "' OR 1=1 --", randomUUID()]) {
      expect(await getOwnContribution(db, owner, id)).toBeNull();
      const result = await updateContribution(db, owner, id, claim());
      expect(result).toEqual({ ok: false, errors: { form: "That contribution does not exist." } });
    }
  });
});

describe("editing", () => {
  it("replaces the evidence list and fields while editable", async () => {
    const owner = await person();
    const contribution = await created(owner);
    const result = await updateContribution(
      db,
      owner,
      contribution.id,
      claim({
        title: "Proposal review interface, v2",
        evidence: [
          { type: "video", url: "https://video.example.org/walkthrough", label: "Walkthrough" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    const stored = await getOwnContribution(db, owner, contribution.id);
    expect(stored?.title).toBe("Proposal review interface, v2");
    expect(stored?.evidence.map((item) => item.label)).toEqual(["Walkthrough"]);
  });

  it("refuses to edit a contribution that is pending, approved or verified", async () => {
    const owner = await person();
    const contribution = await created(owner);
    for (const status of [
      "pending",
      "approved_pending_anchor",
      "verified",
      "rejected",
      "revoked",
    ] as const) {
      // Set directly, standing in for the review workflow that arrives later.
      const organisationId = (
        await db
          .insert(s.organisations)
          .values({ name: "Org", slug: `org-${randomUUID().slice(0, 8)}`, category: "dao" })
          .returning()
      )[0].id;
      await db
        .update(s.contributions)
        .set({ status, organisationId })
        .where(eq(s.contributions.id, contribution.id));
      const result = await updateContribution(
        db,
        owner,
        contribution.id,
        claim({ title: "Changed" }),
      );
      expect(result.ok, status).toBe(false);
    }
    const stored = await getOwnContribution(db, owner, contribution.id);
    expect(stored?.title).toBe("Proposal review interface");
  });
});

describe("self-reporting", () => {
  it("needs a summary, a role and at least one link", async () => {
    const owner = await person();
    const incomplete = await created(owner, { summary: "", role: "", evidence: [] });
    const result = await publishSelfReported(db, owner, incomplete.id);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.form).toContain("summary");
      expect(result.errors.form).toContain("role");
      expect(result.errors.form).toContain("evidence");
    }
  });

  it("moves a complete draft to self-reported, once, and keeps it complete", async () => {
    const owner = await person();
    const contribution = await created(owner);
    const result = await publishSelfReported(db, owner, contribution.id);
    expect(result.ok && result.value.status).toBe("self_reported");
    expect((await publishSelfReported(db, owner, contribution.id)).ok).toBe(false);

    const emptied = await updateContribution(db, owner, contribution.id, claim({ evidence: [] }));
    expect(emptied.ok).toBe(false);
    expect(
      (await updateContribution(db, owner, contribution.id, claim({ title: "Still fine" }))).ok,
    ).toBe(true);
  });
});

describe("deleting", () => {
  it("deletes drafts and their evidence, but nothing that has left draft", async () => {
    const owner = await person();
    const draft = await created(owner);
    expect((await deleteDraft(db, owner, draft.id)).ok).toBe(true);
    expect(await getOwnContribution(db, owner, draft.id)).toBeNull();
    expect(
      await db.select().from(s.evidence).where(eq(s.evidence.contributionId, draft.id)),
    ).toEqual([]);

    const reported = await created(owner);
    await publishSelfReported(db, owner, reported.id);
    expect((await deleteDraft(db, owner, reported.id)).ok).toBe(false);
  });
});

describe("public listing", () => {
  it("shows only public, listable contributions and their public evidence", async () => {
    const owner = await person();
    const draft = await created(owner, { title: "A public draft" });
    const privateReported = await created(owner, {
      title: "Private self-report",
      visibility: "private",
    });
    await publishSelfReported(db, owner, privateReported.id);
    const publicReported = await created(owner, { title: "Public self-report" });
    await publishSelfReported(db, owner, publicReported.id);
    await db
      .update(s.evidence)
      .set({ visibility: "private" })
      .where(eq(s.evidence.url, "https://demo.example.org/review"));

    const listed = await listPublicContributions(db, owner);
    expect(listed.map((item) => item.title)).toEqual(["Public self-report"]);
    expect(listed[0].status).toBe("self_reported");
    expect(listed[0].evidence.map((item) => item.label)).toEqual(["Pull request #42"]);
    expect(Object.keys(listed[0])).not.toContain("contributorUserId");
    expect(listed.some((item) => item.id === draft.id)).toBe(false);
  });

  it("filters the owner's list by status", async () => {
    const owner = await person();
    await created(owner);
    const reported = await created(owner, { title: "Reported" });
    await publishSelfReported(db, owner, reported.id);
    expect(
      (await listOwnContributions(db, owner, { status: "self_reported" })).map((c) => c.title),
    ).toEqual(["Reported"]);
    expect(await listOwnContributions(db, owner, { status: "all" })).toHaveLength(2);
  });
});
