import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as s from "@/lib/db/schema";
import { createTestDatabase, type TestDatabase } from "./database";

let db: TestDatabase;
let close: () => Promise<void>;

beforeAll(async () => {
  const created = await createTestDatabase();
  db = created.db;
  close = created.close;
});

afterAll(async () => {
  await close();
});

/** Runs a statement that must fail and returns the database's error text. */
async function failure(run: () => PromiseLike<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const parts: string[] = [];
    let current: unknown = error;
    while (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    }
    return parts.join(" | ");
  }
  throw new Error("Expected the statement to be rejected, but it succeeded");
}

const DIGEST = (seed: string) => seed.repeat(64).slice(0, 64);

async function makeUser(label: string) {
  const id = `user_${label}_${randomUUID()}`;
  await db.insert(s.users).values({ id, name: label, email: `${id}@example.test` });
  return id;
}

async function makeOrganisation(label: string) {
  const [row] = await db
    .insert(s.organisations)
    .values({ name: label, slug: `${label}-${randomUUID().slice(0, 8)}`, category: "dao" })
    .returning();
  return row.id;
}

/** A contribution with an approved request, ready to carry an attestation. */
async function makeApprovedClaim() {
  const contributor = await makeUser("contributor");
  const reviewer = await makeUser("reviewer");
  const organisationId = await makeOrganisation("org");
  const [contribution] = await db
    .insert(s.contributions)
    .values({
      contributorUserId: contributor,
      organisationId,
      title: "Proposal review interface",
      status: "approved_pending_anchor",
    })
    .returning();
  const [request] = await db
    .insert(s.verificationRequests)
    .values({
      contributionId: contribution.id,
      organisationId,
      submittedBy: contributor,
      status: "approved",
    })
    .returning();
  return { contributor, reviewer, organisationId, contribution, request };
}

async function makeAttestation(digestSeed: string) {
  const claim = await makeApprovedClaim();
  const [attestation] = await db
    .insert(s.attestations)
    .values({
      contributionId: claim.contribution.id,
      verificationRequestId: claim.request.id,
      subjectUserId: claim.contributor,
      issuerOrganisationId: claim.organisationId,
      reviewerUserId: claim.reviewer,
      schemaVersion: "proofme.attestation.v1",
      canonicalPayload: '{"frozen":true}',
      payloadDigest: DIGEST(digestSeed),
      issuedAt: new Date("2026-10-05T09:30:00Z"),
    })
    .returning();
  return { ...claim, attestation };
}

describe("migrations", () => {
  it("apply cleanly and create every table", async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      "accounts",
      "attestation_status_events",
      "attestations",
      "audit_events",
      "connected_accounts",
      "contributions",
      "evidence",
      "evidence_claims",
      "evidence_findings",
      "evidence_investigations",
      "evidence_resources",
      "github_identities",
      "github_oauth_states",
      "near_challenges",
      "notifications",
      "organisation_invitations",
      "organisation_members",
      "organisations",
      "projects",
      "rate_limits",
      "reports",
      "sessions",
      "user_profiles",
      "users",
      "verification_requests",
      "verification_reviews",
      "verifications",
    ]);
  });
});

describe("identity constraints", () => {
  it("keeps emails and usernames unique", async () => {
    const first = await makeUser("a");
    const second = await makeUser("b");
    await db
      .insert(s.userProfiles)
      .values({ userId: first, username: "daniel-okafor", displayName: "Daniel" });
    expect(
      await failure(() =>
        db
          .insert(s.userProfiles)
          .values({ userId: second, username: "daniel-okafor", displayName: "Other" }),
      ),
    ).toMatch(/unique|duplicate/i);

    const [existing] = await db.select().from(s.users).where(eq(s.users.id, first));
    expect(
      await failure(() =>
        db.insert(s.users).values({ id: "dup", name: "x", email: existing.email }),
      ),
    ).toMatch(/unique|duplicate/i);
  });

  it.each(["Ab", "UPPER", "-leading", "trailing-", "has space", "a", "ab", "x".repeat(31)])(
    "rejects the username %j",
    async (username) => {
      const user = await makeUser("u");
      expect(
        await failure(() =>
          db.insert(s.userProfiles).values({ userId: user, username, displayName: "X" }),
        ),
      ).toMatch(/user_profiles_username_format/);
    },
  );

  it("starts profiles private and users without admin rights", async () => {
    const user = await makeUser("defaults");
    const [profile] = await db
      .insert(s.userProfiles)
      .values({ userId: user, username: `u-${randomUUID().slice(0, 8)}`, displayName: "D" })
      .returning();
    expect(profile.visibility).toBe("private");
    const [row] = await db.select().from(s.users).where(eq(s.users.id, user));
    expect(row.isPlatformAdmin).toBe(false);
    expect(row.status).toBe("active");
  });
});

describe("organisation constraints", () => {
  it("starts organisations unverified with no issuer", async () => {
    const id = await makeOrganisation("fresh");
    const [org] = await db.select().from(s.organisations).where(eq(s.organisations.id, id));
    expect(org.platformVerificationStatus).toBe("unverified");
    expect(org.nearIssuerStatus).toBe("none");
  });

  it("refuses an issuer status without an issuer account", async () => {
    const id = await makeOrganisation("issuer");
    expect(
      await failure(() =>
        db
          .update(s.organisations)
          .set({ nearIssuerStatus: "registered" })
          .where(eq(s.organisations.id, id)),
      ),
    ).toMatch(/organisations_issuer_account_present/);
  });

  it("allows one membership per user per organisation", async () => {
    const user = await makeUser("member");
    const organisationId = await makeOrganisation("team");
    await db
      .insert(s.organisationMembers)
      .values({ organisationId, userId: user, role: "reviewer" });
    expect(
      await failure(() =>
        db.insert(s.organisationMembers).values({ organisationId, userId: user, role: "owner" }),
      ),
    ).toMatch(/unique|duplicate/i);
  });

  it("never grants ownership by invitation", async () => {
    const user = await makeUser("inviter");
    const organisationId = await makeOrganisation("invites");
    expect(
      await failure(() =>
        db.insert(s.organisationInvitations).values({
          organisationId,
          email: "new@example.test",
          role: "owner",
          tokenHash: DIGEST("a"),
          expiresAt: new Date(Date.now() + 86_400_000),
          createdBy: user,
        }),
      ),
    ).toMatch(/organisation_invitations_no_owner/);
  });
});

describe("contribution and evidence constraints", () => {
  it("lets a draft exist without an organisation, but not a submitted claim", async () => {
    const user = await makeUser("drafter");
    const [draft] = await db
      .insert(s.contributions)
      .values({ contributorUserId: user, title: "Draft" })
      .returning();
    expect(draft.status).toBe("draft");
    expect(draft.visibility).toBe("private");
    expect(
      await failure(() =>
        db
          .update(s.contributions)
          .set({ status: "pending" })
          .where(eq(s.contributions.id, draft.id)),
      ),
    ).toMatch(/contributions_org_required_after_draft/);
  });

  it("only lets a verified contribution be featured", async () => {
    const user = await makeUser("featurer");
    expect(
      await failure(() =>
        db.insert(s.contributions).values({
          contributorUserId: user,
          title: "Self-reported",
          status: "self_reported",
          featured: true,
        }),
      ),
    ).toMatch(/contributions_featured_only_verified/);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///etc/passwd",
    "http://example.com/",
    "http://localhost.evil.example/",
    "ftp://example.com/",
  ])("refuses to store the evidence URL %s", async (url) => {
    const user = await makeUser("evidence");
    const [contribution] = await db
      .insert(s.contributions)
      .values({ contributorUserId: user, title: "With evidence" })
      .returning();
    expect(
      await failure(() =>
        db
          .insert(s.evidence)
          .values({ contributionId: contribution.id, type: "other", url, label: "x" }),
      ),
    ).toMatch(/evidence_url_scheme/);
  });

  it("stores https evidence and local development evidence", async () => {
    const user = await makeUser("evidence-ok");
    const [contribution] = await db
      .insert(s.contributions)
      .values({ contributorUserId: user, title: "With evidence" })
      .returning();
    await db.insert(s.evidence).values([
      {
        contributionId: contribution.id,
        type: "github_pr",
        url: "https://github.com/a/b/pull/1",
        label: "PR",
      },
      {
        contributionId: contribution.id,
        type: "demo",
        url: "http://localhost:3000/demo",
        label: "Demo",
      },
    ]);
    const rows = await db
      .select()
      .from(s.evidence)
      .where(eq(s.evidence.contributionId, contribution.id));
    expect(rows).toHaveLength(2);
  });
});

describe("verification constraints", () => {
  it("allows only one open request per contribution, but a new one after resolution", async () => {
    const user = await makeUser("submitter");
    const organisationId = await makeOrganisation("queue");
    const [contribution] = await db
      .insert(s.contributions)
      .values({ contributorUserId: user, organisationId, title: "Claim", status: "pending" })
      .returning();
    const base = { contributionId: contribution.id, organisationId, submittedBy: user };

    const [first] = await db.insert(s.verificationRequests).values(base).returning();
    expect(await failure(() => db.insert(s.verificationRequests).values(base))).toMatch(
      /verification_requests_one_open|unique|duplicate/i,
    );
    expect(
      await failure(() =>
        db.insert(s.verificationRequests).values({ ...base, status: "needs_information" }),
      ),
    ).toMatch(/verification_requests_one_open|unique|duplicate/i);

    await db
      .update(s.verificationRequests)
      .set({ status: "rejected", resolvedAt: new Date() })
      .where(eq(s.verificationRequests.id, first.id));
    await db.insert(s.verificationRequests).values(base);
  });

  it("requires a message for everything except approval", async () => {
    const { request, reviewer } = await makeApprovedClaim();
    const base = { verificationRequestId: request.id, authorUserId: reviewer };
    for (const kind of ["reject", "request_information", "contributor_response"] as const) {
      for (const message of [null, "", "   "]) {
        expect(
          await failure(() => db.insert(s.verificationReviews).values({ ...base, kind, message })),
        ).toMatch(/verification_reviews_message_required/);
      }
    }
    await db.insert(s.verificationReviews).values({ ...base, kind: "approve" });
    await db
      .insert(s.verificationReviews)
      .values({ ...base, kind: "reject", message: "Evidence does not show authorship." });
  });

  it("keeps review history append-only", async () => {
    const { request, reviewer } = await makeApprovedClaim();
    const [review] = await db
      .insert(s.verificationReviews)
      .values({
        verificationRequestId: request.id,
        authorUserId: reviewer,
        kind: "reject",
        message: "Original reason",
      })
      .returning();
    expect(
      await failure(() =>
        db
          .update(s.verificationReviews)
          .set({ message: "Rewritten" })
          .where(eq(s.verificationReviews.id, review.id)),
      ),
    ).toMatch(/append-only/);
    expect(
      await failure(() =>
        db.delete(s.verificationReviews).where(eq(s.verificationReviews.id, review.id)),
      ),
    ).toMatch(/append-only/);
  });
});

describe("attestation integrity", () => {
  it("refuses any change to the approved content", async () => {
    const { attestation, organisationId } = await makeAttestation("a");
    const otherUser = await makeUser("other");
    const otherOrganisation = await makeOrganisation("other");
    const frozenChanges: Partial<typeof s.attestations.$inferInsert>[] = [
      { canonicalPayload: '{"frozen":false}' },
      { payloadDigest: DIGEST("f") },
      { schemaVersion: "proofme.attestation.v2" },
      { subjectUserId: otherUser },
      { reviewerUserId: otherUser },
      { issuerOrganisationId: otherOrganisation },
      { issuedAt: new Date("2020-01-01T00:00:00Z") },
      { createdAt: new Date("2020-01-01T00:00:00Z") },
      { id: randomUUID() },
    ];
    for (const change of frozenChanges) {
      expect(
        await failure(() =>
          db.update(s.attestations).set(change).where(eq(s.attestations.id, attestation.id)),
        ),
      ).toMatch(/approved content of an attestation cannot be changed/);
    }
    const [unchanged] = await db
      .select()
      .from(s.attestations)
      .where(eq(s.attestations.id, attestation.id));
    expect(unchanged.canonicalPayload).toBe('{"frozen":true}');
    expect(unchanged.payloadDigest).toBe(DIGEST("a"));
    expect(unchanged.issuerOrganisationId).toBe(organisationId);
  });

  it("can never be deleted", async () => {
    const { attestation } = await makeAttestation("b");
    expect(
      await failure(() => db.delete(s.attestations).where(eq(s.attestations.id, attestation.id))),
    ).toMatch(/never deleted/);
  });

  it("allows one attestation per approved request and one per digest", async () => {
    const first = await makeAttestation("c");
    const values = {
      contributionId: first.contribution.id,
      subjectUserId: first.contributor,
      issuerOrganisationId: first.organisationId,
      reviewerUserId: first.reviewer,
      schemaVersion: "proofme.attestation.v1",
      canonicalPayload: "{}",
      issuedAt: new Date(),
    };
    expect(
      await failure(() =>
        db.insert(s.attestations).values({
          ...values,
          verificationRequestId: first.request.id,
          payloadDigest: DIGEST("d"),
        }),
      ),
    ).toMatch(/unique|duplicate/i);

    const second = await makeApprovedClaim();
    expect(
      await failure(() =>
        db.insert(s.attestations).values({
          ...values,
          verificationRequestId: second.request.id,
          payloadDigest: DIGEST("c"),
        }),
      ),
    ).toMatch(/unique|duplicate/i);
  });

  it("rejects malformed digests", async () => {
    const claim = await makeApprovedClaim();
    for (const payloadDigest of ["abc", DIGEST("A"), `0x${DIGEST("a").slice(2)}`]) {
      expect(
        await failure(() =>
          db.insert(s.attestations).values({
            contributionId: claim.contribution.id,
            verificationRequestId: claim.request.id,
            subjectUserId: claim.contributor,
            issuerOrganisationId: claim.organisationId,
            reviewerUserId: claim.reviewer,
            schemaVersion: "proofme.attestation.v1",
            canonicalPayload: "{}",
            payloadDigest,
            issuedAt: new Date(),
          }),
        ),
      ).toMatch(/attestations_digest_format/);
    }
  });

  it("cannot be marked anchored without a transaction reference", async () => {
    const { attestation } = await makeAttestation("e");
    expect(attestation.nearAnchorStatus).toBe("awaiting");
    expect(
      await failure(() =>
        db
          .update(s.attestations)
          .set({ nearAnchorStatus: "confirmed" })
          .where(eq(s.attestations.id, attestation.id)),
      ),
    ).toMatch(/attestations_confirmed_has_transaction/);
    expect(
      await failure(() =>
        db
          .update(s.attestations)
          .set({ nearAnchorStatus: "confirmed", nearTransactionHash: "tx" })
          .where(eq(s.attestations.id, attestation.id)),
      ),
    ).toMatch(/attestations_confirmed_has_transaction/);
  });

  it("makes a confirmed anchor final", async () => {
    const { attestation } = await makeAttestation("1");
    await db
      .update(s.attestations)
      .set({
        nearAnchorStatus: "confirmed",
        nearTransactionHash: "tx-one",
        nearNetwork: "sandbox",
        nearContractId: "registry.test.near",
        nearIssuerAccountId: "issuer.test.near",
      })
      .where(eq(s.attestations.id, attestation.id));
    for (const change of [
      { nearTransactionHash: "tx-two" },
      { nearAnchorStatus: "failed" as const },
      { nearContractId: "other.test.near" },
      { nearIssuerAccountId: "other-issuer.test.near" },
    ]) {
      expect(
        await failure(() =>
          db.update(s.attestations).set(change).where(eq(s.attestations.id, attestation.id)),
        ),
      ).toMatch(/confirmed NEAR anchor cannot be changed/);
    }
  });

  it("requires a reason to revoke, and revocation is final", async () => {
    const { attestation } = await makeAttestation("2");
    const where = eq(s.attestations.id, attestation.id);
    expect(
      await failure(() => db.update(s.attestations).set({ status: "revoked" }).where(where)),
    ).toMatch(/attestations_revocation_has_reason/);
    expect(
      await failure(() =>
        db
          .update(s.attestations)
          .set({ status: "revoked", revokedAt: new Date(), revocationReason: "  " })
          .where(where),
      ),
    ).toMatch(/attestations_revocation_has_reason/);

    await db
      .update(s.attestations)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revocationReason: "Issued to the wrong contributor.",
      })
      .where(where);

    expect(
      await failure(() => db.update(s.attestations).set({ status: "active" }).where(where)),
    ).toMatch(/revoked attestation cannot change status/);
    expect(
      await failure(() =>
        db.update(s.attestations).set({ revocationReason: "Never mind." }).where(where),
      ),
    ).toMatch(/revocation details cannot be rewritten/);

    // The revocation transaction can still be recorded afterwards.
    await db
      .update(s.attestations)
      .set({ nearRevocationTransactionHash: "tx-revoke" })
      .where(where);
  });

  it("requires a successor to mark an attestation superseded", async () => {
    const { attestation } = await makeAttestation("3");
    const where = eq(s.attestations.id, attestation.id);
    expect(
      await failure(() => db.update(s.attestations).set({ status: "superseded" }).where(where)),
    ).toMatch(/attestations_superseded_has_successor/);
    const successor = await makeAttestation("4");
    await db
      .update(s.attestations)
      .set({ status: "superseded", supersededByAttestationId: successor.attestation.id })
      .where(where);
    expect(
      await failure(() => db.update(s.attestations).set({ status: "active" }).where(where)),
    ).toMatch(/superseded attestation cannot change status/);
  });
});

describe("append-only event tables", () => {
  it("refuses edits and deletions of audit events", async () => {
    const actor = await makeUser("actor");
    const [event] = await db
      .insert(s.auditEvents)
      .values({
        actorUserId: actor,
        action: "organisation.created",
        entityType: "organisation",
        entityId: "x",
      })
      .returning();
    const where = eq(s.auditEvents.id, event.id);
    expect(
      await failure(() =>
        db.update(s.auditEvents).set({ action: "nothing.happened" }).where(where),
      ),
    ).toMatch(/append-only/);
    expect(
      await failure(() =>
        db
          .update(s.auditEvents)
          .set({ metadata: { edited: true } })
          .where(where),
      ),
    ).toMatch(/append-only/);
    const someoneElse = await makeUser("someone-else");
    expect(
      await failure(() => db.update(s.auditEvents).set({ actorUserId: someoneElse }).where(where)),
    ).toMatch(/append-only/);
    expect(await failure(() => db.delete(s.auditEvents).where(where))).toMatch(/append-only/);
  });

  it("keeps an audit event, without its actor, when that user is deleted", async () => {
    const actor = await makeUser("leaver");
    const [event] = await db
      .insert(s.auditEvents)
      .values({
        actorUserId: actor,
        action: "profile.updated",
        entityType: "profile",
        entityId: "y",
      })
      .returning();
    await db.delete(s.users).where(eq(s.users.id, actor));
    const [kept] = await db.select().from(s.auditEvents).where(eq(s.auditEvents.id, event.id));
    expect(kept.actorUserId).toBeNull();
    expect(kept.action).toBe("profile.updated");
  });

  it("refuses edits and deletions of attestation status events", async () => {
    const { attestation, reviewer } = await makeAttestation("5");
    const [event] = await db
      .insert(s.attestationStatusEvents)
      .values({ attestationId: attestation.id, newStatus: "active", actorUserId: reviewer })
      .returning();
    const where = eq(s.attestationStatusEvents.id, event.id);
    expect(
      await failure(() =>
        db.update(s.attestationStatusEvents).set({ newStatus: "revoked" }).where(where),
      ),
    ).toMatch(/append-only/);
    expect(await failure(() => db.delete(s.attestationStatusEvents).where(where))).toMatch(
      /append-only/,
    );
  });

  it("does not let a user with issued records be deleted outright", async () => {
    const { contributor } = await makeAttestation("6");
    expect(await failure(() => db.delete(s.users).where(eq(s.users.id, contributor)))).toMatch(
      /foreign key|violates|never deleted/i,
    );
  });
});
