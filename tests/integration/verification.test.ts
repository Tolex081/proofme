import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkSealedAttestation } from "@/lib/attestations/payload";
import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import { listNotifications } from "@/server/services/account";
import {
  createContribution,
  getOwnContribution,
  updateContribution,
} from "@/server/services/contributions";
import { createOrganisation, createProject } from "@/server/services/organisations";
import { completeOnboarding } from "@/server/services/profile";
import {
  contributorReviewHistory,
  decide,
  getRequestForReviewer,
  listIssuedAttestations,
  listQueue,
  respondToRequest,
  reviseRejected,
  submitForReview,
  withdrawRequest,
} from "@/server/services/verification";
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

async function person(name = "Person") {
  const id = `user_${randomUUID()}`;
  await db.insert(s.users).values({ id, name, email: `${id}@example.test`.toLowerCase() });
  const result = await completeOnboarding(db, id, {
    intent: "both",
    displayName: name,
    username: `u-${short()}`,
    bio: "",
    roles: [],
  });
  if (!result.ok) throw new Error("onboarding");
  return id;
}

async function addMember(
  organisationId: string,
  userId: string,
  role: "owner" | "admin" | "reviewer" | "viewer",
) {
  await db.insert(s.organisationMembers).values({ organisationId, userId, role, status: "active" });
}

const claim = (overrides: Record<string, unknown> = {}) => ({
  title: "Proposal review interface",
  summary: "Built the reviewer-facing proposal screen.",
  description: "Designed and implemented the screen reviewers use to score proposals.",
  category: "development",
  role: "Frontend engineer",
  skills: ["TypeScript"],
  startDate: "2026-07-01",
  endDate: "2026-09-30",
  visibility: "public",
  evidence: [
    {
      type: "github_pr",
      url: "https://github.com/northstar-demo/portal/pull/42",
      label: "Pull request #42",
    },
  ],
  ...overrides,
});

/** An organisation with an owner, a reviewer and a viewer, and a contributor with a ready claim. */
async function scene() {
  const owner = await person("Owner");
  const reviewer = await person("Rita Reviewer");
  const viewer = await person("Vic Viewer");
  const contributor = await person("Daniel Contributor");
  const org = await createOrganisation(db, owner, {
    name: "Northstar Test",
    slug: `north-${short()}`,
    category: "web3_protocol",
    description: "Test organisation.",
    websiteUrl: "https://example.org",
  });
  if (!org.ok) throw new Error("org");
  await addMember(org.value.id, reviewer, "reviewer");
  await addMember(org.value.id, viewer, "viewer");
  const project = await createProject(db, owner, org.value.id, {
    name: "Open Grants Portal",
    description: "",
    websiteUrl: "",
    repositoryUrl: "",
    status: "active",
    startDate: "",
    endDate: "",
  });
  if (!project.ok) throw new Error("project");
  const contribution = await createContribution(db, contributor, claim());
  if (!contribution.ok) throw new Error("contribution");
  return {
    owner,
    reviewer,
    viewer,
    contributor,
    org: org.value,
    project: project.value,
    contribution: contribution.value,
  };
}

async function submitted() {
  const setup = await scene();
  const result = await submitForReview(db, setup.contributor, setup.contribution.id, {
    organisationId: setup.org.id,
    projectId: setup.project.id,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { ...setup, requestId: result.value.requestId };
}

async function version(requestId: string) {
  const [row] = await db
    .select()
    .from(s.verificationRequests)
    .where(eq(s.verificationRequests.id, requestId));
  return row.version;
}

describe("submitting for review", () => {
  it("creates a pending request, attaches the organisation and project, and tells the reviewers", async () => {
    const setup = await submitted();
    const stored = await getOwnContribution(db, setup.contributor, setup.contribution.id);
    expect(stored).toMatchObject({
      status: "pending",
      organisationId: setup.org.id,
      projectId: setup.project.id,
    });

    const queue = await listQueue(db, setup.reviewer, setup.org.id);
    expect(queue?.map((item) => item.id)).toEqual([setup.requestId]);
    for (const userId of [setup.owner, setup.reviewer]) {
      expect((await listNotifications(db, userId)).map((n) => n.type)).toContain(
        "verification.requested",
      );
    }
    // Viewers are not reviewers and are not notified.
    expect((await listNotifications(db, setup.viewer)).map((n) => n.type)).not.toContain(
      "verification.requested",
    );
  });

  it("refuses incomplete claims, someone else's claim, unknown organisations and foreign projects", async () => {
    const setup = await scene();
    const incomplete = await createContribution(
      db,
      setup.contributor,
      claim({ description: "", evidence: [] }),
    );
    if (!incomplete.ok) throw new Error("setup");
    const result = await submitForReview(db, setup.contributor, incomplete.value.id, {
      organisationId: setup.org.id,
      projectId: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.form).toMatch(/Describe what you did.*evidence/);

    expect(
      (
        await submitForReview(db, setup.reviewer, setup.contribution.id, {
          organisationId: setup.org.id,
          projectId: "",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await submitForReview(db, setup.contributor, setup.contribution.id, {
          organisationId: randomUUID(),
          projectId: "",
        })
      ).ok,
    ).toBe(false);

    const otherOwner = await person();
    const other = await createOrganisation(db, otherOwner, {
      name: "Other",
      slug: `other-${short()}`,
      category: "dao",
      description: "",
      websiteUrl: "",
    });
    if (!other.ok) throw new Error("setup");
    const foreignProject = await submitForReview(db, setup.contributor, setup.contribution.id, {
      organisationId: other.value.id,
      projectId: setup.project.id,
    });
    expect(foreignProject.ok).toBe(false);
  });

  it("allows only one open review per contribution", async () => {
    const setup = await submitted();
    const again = await submitForReview(db, setup.contributor, setup.contribution.id, {
      organisationId: setup.org.id,
      projectId: "",
    });
    expect(again.ok).toBe(false);
  });

  it("can be withdrawn while open", async () => {
    const setup = await submitted();
    expect((await withdrawRequest(db, setup.contributor, setup.contribution.id)).ok).toBe(true);
    expect((await getOwnContribution(db, setup.contributor, setup.contribution.id))?.status).toBe(
      "self_reported",
    );
    expect(await listQueue(db, setup.reviewer, setup.org.id)).toEqual([]);
  });
});

describe("deciding", () => {
  it("never lets the contributor decide on their own claim, even as owner", async () => {
    const owner = await person("Owner Contributor");
    const org = await createOrganisation(db, owner, {
      name: "Self Org",
      slug: `self-${short()}`,
      category: "dao",
      description: "",
      websiteUrl: "",
    });
    if (!org.ok) throw new Error("setup");
    const own = await createContribution(db, owner, claim());
    if (!own.ok) throw new Error("setup");
    const sent = await submitForReview(db, owner, own.value.id, {
      organisationId: org.value.id,
      projectId: "",
    });
    if (!sent.ok) throw new Error("setup");
    const result = await decide(db, owner, sent.value.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(result).toEqual({
      ok: false,
      errors: { form: "You cannot review your own contribution." },
    });
    const view = await getRequestForReviewer(db, owner, org.value.id, sent.value.requestId);
    expect(view?.canDecide).toBe(false);
    expect(
      await db.select().from(s.attestations).where(eq(s.attestations.contributionId, own.value.id)),
    ).toEqual([]);
  });

  it("refuses viewers and members of other organisations", async () => {
    const setup = await submitted();
    const viewerAttempt = await decide(db, setup.viewer, setup.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(viewerAttempt.ok).toBe(false);
    expect(await listQueue(db, setup.viewer, setup.org.id)).toBeNull();

    const outsider = await person("Outsider");
    const otherOrg = await createOrganisation(db, outsider, {
      name: "Other",
      slug: `x-${short()}`,
      category: "dao",
      description: "",
      websiteUrl: "",
    });
    if (!otherOrg.ok) throw new Error("setup");
    const outsiderAttempt = await decide(db, outsider, setup.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(outsiderAttempt.ok).toBe(false);
    expect(await getRequestForReviewer(db, outsider, setup.org.id, setup.requestId)).toBeNull();
    // Asking through their own organisation finds nothing either.
    expect(
      await getRequestForReviewer(db, outsider, otherOrg.value.id, setup.requestId),
    ).toBeNull();
    expect(await version(setup.requestId)).toBe(0);
  });

  it("requires a reason to reject and a message to ask for information", async () => {
    const setup = await submitted();
    const reject = await decide(db, setup.reviewer, setup.requestId, {
      decision: "reject",
      message: "  ",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(reject.ok).toBe(false);
    if (!reject.ok) expect(reject.errors.message).toMatch(/why/);
    const ask = await decide(db, setup.reviewer, setup.requestId, {
      decision: "request_information",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(ask.ok).toBe(false);
  });

  it("runs the information loop and keeps internal notes away from the contributor", async () => {
    const setup = await submitted();
    const ask = await decide(db, setup.reviewer, setup.requestId, {
      decision: "request_information",
      message: "Which commits in the pull request were yours?",
      internalNote: "Check with the project lead first.",
      expectedVersion: 0,
    });
    expect(ask.ok && ask.value.status).toBe("needs_information");
    expect((await getOwnContribution(db, setup.contributor, setup.contribution.id))?.status).toBe(
      "needs_information",
    );
    expect((await listNotifications(db, setup.contributor)).map((n) => n.type)).toContain(
      "verification.request_information",
    );

    // The contributor can edit while information is requested, then answer.
    expect(
      (
        await updateContribution(
          db,
          setup.contributor,
          setup.contribution.id,
          claim({ summary: "Built and tested the proposal screen." }),
        )
      ).ok,
    ).toBe(true);
    expect((await respondToRequest(db, setup.contributor, setup.contribution.id, "  ")).ok).toBe(
      false,
    );
    expect(
      (await respondToRequest(db, setup.contributor, setup.contribution.id, "Commits 3 to 9.")).ok,
    ).toBe(true);
    expect((await getOwnContribution(db, setup.contributor, setup.contribution.id))?.status).toBe(
      "pending",
    );

    const history = await contributorReviewHistory(db, setup.contributor, setup.contribution.id);
    const text = JSON.stringify(history);
    expect(text).toContain("Which commits in the pull request were yours?");
    expect(text).toContain("Commits 3 to 9.");
    expect(text).not.toContain("Check with the project lead first.");

    const reviewerView = await getRequestForReviewer(
      db,
      setup.reviewer,
      setup.org.id,
      setup.requestId,
    );
    expect(reviewerView?.history.map((h) => h.internalNote)).toContain(
      "Check with the project lead first.",
    );
  });

  it("rejects with a reason the contributor sees, and the claim can be revised and sent again", async () => {
    const setup = await submitted();
    const reject = await decide(db, setup.reviewer, setup.requestId, {
      decision: "reject",
      message: "We could not match this pull request to your account.",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(reject.ok).toBe(true);
    expect((await getOwnContribution(db, setup.contributor, setup.contribution.id))?.status).toBe(
      "rejected",
    );
    expect(
      (await updateContribution(db, setup.contributor, setup.contribution.id, claim())).ok,
    ).toBe(false);

    expect((await reviseRejected(db, setup.contributor, setup.contribution.id)).ok).toBe(true);
    const again = await submitForReview(db, setup.contributor, setup.contribution.id, {
      organisationId: setup.org.id,
      projectId: "",
    });
    expect(again.ok).toBe(true);
  });
});

describe("approval and the attestation record", () => {
  it("freezes the claim into an attestation whose digest re-checks, then refuses edits", async () => {
    const setup = await submitted();
    const approve = await decide(db, setup.reviewer, setup.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(approve.ok).toBe(true);
    if (!approve.ok || !approve.value.attestationId) throw new Error("no attestation");

    const [attestation] = await db
      .select()
      .from(s.attestations)
      .where(eq(s.attestations.id, approve.value.attestationId));
    expect(attestation).toMatchObject({
      status: "active",
      nearAnchorStatus: "awaiting",
      issuerOrganisationId: setup.org.id,
      subjectUserId: setup.contributor,
      reviewerUserId: setup.reviewer,
      schemaVersion: "proofme.attestation.v1",
    });
    const check = await checkSealedAttestation(
      attestation.canonicalPayload,
      attestation.payloadDigest,
    );
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.payload.id).toBe(attestation.id);
      expect(check.payload.claim.title).toBe("Proposal review interface");
      expect(check.payload.project?.name).toBe("Open Grants Portal");
      expect(check.payload.issuer.slug).toBe(setup.org.slug);
      expect(check.payload.issuedAt).toBe(attestation.issuedAt.toISOString());
    }
    // No private data in what will be public.
    expect(attestation.canonicalPayload).not.toContain("@example.test");

    expect((await getOwnContribution(db, setup.contributor, setup.contribution.id))?.status).toBe(
      "approved_pending_anchor",
    );
    expect(
      (
        await updateContribution(
          db,
          setup.contributor,
          setup.contribution.id,
          claim({ title: "Changed" }),
        )
      ).ok,
    ).toBe(false);
    await expect(
      db
        .update(s.attestations)
        .set({ canonicalPayload: "{}" })
        .where(eq(s.attestations.id, attestation.id)),
    ).rejects.toThrow();

    const events = await db
      .select()
      .from(s.attestationStatusEvents)
      .where(eq(s.attestationStatusEvents.attestationId, attestation.id));
    expect(events.map((e) => e.newStatus)).toEqual(["active"]);
    const audit = (
      await db.select().from(s.auditEvents).where(eq(s.auditEvents.organisationId, setup.org.id))
    ).map((e) => e.action);
    expect(audit).toEqual(
      expect.arrayContaining([
        "verification.submitted",
        "verification.approve",
        "attestation.issued",
      ]),
    );
    expect((await listNotifications(db, setup.contributor)).map((n) => n.type)).toContain(
      "verification.approve",
    );
    expect(
      (await listIssuedAttestations(db, setup.viewer, setup.org.id))?.map((a) => a.id),
    ).toEqual([attestation.id]);
  });

  it("lets exactly one of two simultaneous decisions win", async () => {
    const setup = await submitted();
    const results = await Promise.all([
      decide(db, setup.reviewer, setup.requestId, {
        decision: "approve",
        message: "",
        internalNote: "",
        expectedVersion: 0,
      }),
      decide(db, setup.owner, setup.requestId, {
        decision: "reject",
        message: "Not ours.",
        internalNote: "",
        expectedVersion: 0,
      }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const attestationsIssued = await db
      .select()
      .from(s.attestations)
      .where(eq(s.attestations.contributionId, setup.contribution.id));
    expect(attestationsIssued.length).toBeLessThanOrEqual(1);
    const reviews = await db
      .select()
      .from(s.verificationReviews)
      .where(eq(s.verificationReviews.verificationRequestId, setup.requestId));
    expect(reviews).toHaveLength(1);
  });

  it("refuses a decision made against an out-of-date view", async () => {
    const setup = await submitted();
    await decide(db, setup.reviewer, setup.requestId, {
      decision: "request_information",
      message: "More please.",
      internalNote: "",
      expectedVersion: 0,
    });
    await respondToRequest(db, setup.contributor, setup.contribution.id, "Here you go.");
    const stale = await decide(db, setup.owner, setup.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: 0,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.errors.form).toMatch(/Someone else acted/);
    const fresh = await decide(db, setup.owner, setup.requestId, {
      decision: "approve",
      message: "",
      internalNote: "",
      expectedVersion: await version(setup.requestId),
    });
    expect(fresh.ok).toBe(true);
  });
});
