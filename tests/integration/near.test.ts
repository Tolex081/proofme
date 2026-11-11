import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/db/client";
import * as s from "@/lib/db/schema";
import {
  ChainUnavailableError,
  type ChainAttestation,
  type ChainIssuer,
  type ChainReader,
  type ChainTransaction,
} from "@/lib/near/chain";
import { listNotifications } from "@/server/services/account";
import { createContribution } from "@/server/services/contributions";
import {
  confirmMint,
  getPublicVerification,
  linkIssuerAccount,
  prepareMint,
  prepareRevoke,
  refreshIssuerStatus,
  revokeAttestation,
} from "@/server/services/near";
import { createOrganisation } from "@/server/services/organisations";
import { completeOnboarding } from "@/server/services/profile";
import { decide, submitForReview } from "@/server/services/verification";
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

const CONTRACT = "attestations.proofme.testnet";
const short = () => randomUUID().slice(0, 8);
// 44 base58 characters, unique per call.
const hash = () => `${randomUUID().replace(/-/g, "").replace(/0/g, "A")}ABCDEFGHJKLM`.slice(0, 44);

/** A stand-in for the contract: holds what "the chain" says and answers reads. */
class FakeChain implements ChainReader {
  readonly contractId = CONTRACT;
  issuers = new Map<string, ChainIssuer>();
  tokens = new Map<string, ChainAttestation>();
  transactions = new Map<string, ChainTransaction>();
  down = false;

  private check() {
    if (this.down) throw new ChainUnavailableError("down");
  }
  async getAttestation(tokenId: string) {
    this.check();
    return this.tokens.get(tokenId) ?? null;
  }
  async getIssuer(accountId: string) {
    this.check();
    return this.issuers.get(accountId) ?? null;
  }
  async getTransaction(transactionHash: string) {
    this.check();
    return this.transactions.get(transactionHash) ?? null;
  }

  /** Records a successful `issue` as the contract would, and returns its hash. */
  mint(input: {
    tokenId: string;
    ownerId: string;
    issuerId: string;
    organisationId: string;
    digest: string;
  }) {
    const now = new Date();
    this.tokens.set(input.tokenId, {
      ...input,
      issuerStatus: "active",
      issuedAt: now,
      status: "active",
      statusChangedAt: now,
      supersededBy: null,
    });
    return this.record(input.issuerId, "issue", input.tokenId);
  }

  revoke(tokenId: string) {
    const token = this.tokens.get(tokenId)!;
    this.tokens.set(tokenId, { ...token, status: "revoked", statusChangedAt: new Date() });
    return this.record(token.issuerId, "revoke", tokenId);
  }

  record(signerId: string, methodName: string, tokenId: string, succeeded = true) {
    const transactionHash = hash();
    this.transactions.set(transactionHash, {
      hash: transactionHash,
      signerId,
      receiverId: CONTRACT,
      succeeded,
      calls: [{ methodName, args: { token_id: tokenId } }],
    });
    return transactionHash;
  }
}

async function person(name: string, nearAccountId: string | null = null) {
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
  await db
    .update(s.userProfiles)
    .set({ nearAccountId, visibility: "public" })
    .where(eq(s.userProfiles.userId, id));
  return id;
}

/**
 * An organisation whose NEAR account is registered on the fake chain, and a
 * contributor with an approved, not yet minted attestation.
 */
async function approved(options: { visibility?: "public" | "private" } = {}) {
  const chain = new FakeChain();
  const tag = short();
  const issuerAccount = `org-${tag}.testnet`;
  const contributorAccount = `dev-${tag}.testnet`;
  const owner = await person("Owner");
  const reviewer = await person("Rita Reviewer");
  const viewer = await person("Vic Viewer");
  const contributor = await person("Daniel Contributor", contributorAccount);

  const org = await createOrganisation(db, owner, {
    name: "Northstar Test",
    slug: `north-${tag}`,
    category: "web3_protocol",
    description: "Test organisation.",
    websiteUrl: "https://example.org",
  });
  if (!org.ok) throw new Error("org");
  for (const [userId, role] of [
    [reviewer, "reviewer"],
    [viewer, "viewer"],
  ] as const) {
    await db
      .insert(s.organisationMembers)
      .values({ organisationId: org.value.id, userId, role, status: "active" });
  }

  const linked = await linkIssuerAccount(db, owner, org.value.id, issuerAccount);
  if (!linked.ok) throw new Error("link");
  chain.issuers.set(issuerAccount, { organisationId: org.value.id, status: "active" });
  const refreshed = await refreshIssuerStatus(db, chain, owner, org.value.id);
  if (!refreshed.ok || refreshed.value.status !== "registered") throw new Error("register");

  const contribution = await createContribution(db, contributor, {
    title: "Proposal review interface",
    summary: "Built the reviewer-facing proposal screen.",
    description: "Designed and implemented the screen reviewers use to score proposals.",
    category: "development",
    role: "Frontend engineer",
    skills: ["TypeScript"],
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    visibility: options.visibility ?? "public",
    evidence: [
      {
        type: "github_pr",
        url: "https://github.com/northstar-demo/portal/pull/42",
        label: "Pull request #42",
      },
    ],
  });
  if (!contribution.ok) throw new Error("contribution");
  const sent = await submitForReview(db, contributor, contribution.value.id, {
    organisationId: org.value.id,
    projectId: "",
  });
  if (!sent.ok) throw new Error(JSON.stringify(sent.errors));
  const [request] = await db
    .select()
    .from(s.verificationRequests)
    .where(eq(s.verificationRequests.id, sent.value.requestId));
  const decision = await decide(db, reviewer, request.id, {
    decision: "approve",
    message: "",
    internalNote: "",
    expectedVersion: String(request.version),
  });
  if (!decision.ok || !decision.value.attestationId) throw new Error("approve");
  const [attestation] = await db
    .select()
    .from(s.attestations)
    .where(eq(s.attestations.id, decision.value.attestationId));

  return {
    chain,
    owner,
    reviewer,
    viewer,
    contributor,
    org: org.value,
    issuerAccount,
    contributorAccount,
    contributionId: contribution.value.id,
    attestation,
  };
}

async function reload(attestationId: string) {
  const [attestation] = await db
    .select()
    .from(s.attestations)
    .where(eq(s.attestations.id, attestationId));
  const [contribution] = await db
    .select()
    .from(s.contributions)
    .where(eq(s.contributions.id, attestation.contributionId));
  return { attestation, contribution };
}

/** Mints on the fake chain and confirms it, leaving a verified contribution. */
async function minted() {
  const scene = await approved();
  const transactionHash = scene.chain.mint({
    tokenId: scene.attestation.id,
    ownerId: scene.contributorAccount,
    issuerId: scene.issuerAccount,
    organisationId: scene.org.id,
    digest: scene.attestation.payloadDigest,
  });
  const result = await confirmMint(
    db,
    scene.chain,
    "testnet",
    scene.reviewer,
    scene.attestation.id,
    transactionHash,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { ...scene, transactionHash };
}

describe("the organisation's issuer account", () => {
  it("only an owner can choose it", async () => {
    const scene = await approved();
    const byReviewer = await linkIssuerAccount(db, scene.reviewer, scene.org.id, "x.testnet");
    expect(byReviewer.ok).toBe(false);
    const byOutsider = await linkIssuerAccount(db, scene.contributor, scene.org.id, "x.testnet");
    expect(byOutsider.ok).toBe(false);
    const [org] = await db
      .select()
      .from(s.organisations)
      .where(eq(s.organisations.id, scene.org.id));
    expect(org.nearIssuerAccountId).toBe(scene.issuerAccount);
  });

  it("rejects something that is not a NEAR account", async () => {
    const scene = await approved();
    for (const value of ["", "A", "Has Spaces", "double..dot.testnet", 42]) {
      expect((await linkIssuerAccount(db, scene.owner, scene.org.id, value)).ok).toBe(false);
    }
  });

  it("linking is only a claim: the status follows what the contract says", async () => {
    const scene = await approved();
    const relinked = await linkIssuerAccount(db, scene.owner, scene.org.id, "other.testnet");
    expect(relinked.ok).toBe(true);
    // Not registered on-chain: stays linked.
    const first = await refreshIssuerStatus(db, scene.chain, scene.owner, scene.org.id);
    expect(first).toEqual({ ok: true, value: { status: "linked" } });

    // Registered on-chain, but for a different organisation: still not registered here.
    scene.chain.issuers.set("other.testnet", { organisationId: randomUUID(), status: "active" });
    const second = await refreshIssuerStatus(db, scene.chain, scene.owner, scene.org.id);
    expect(second).toEqual({ ok: true, value: { status: "linked" } });

    scene.chain.issuers.set("other.testnet", { organisationId: scene.org.id, status: "suspended" });
    const third = await refreshIssuerStatus(db, scene.chain, scene.viewer, scene.org.id);
    expect(third).toEqual({ ok: true, value: { status: "suspended" } });
  });

  it("changes nothing when the network is unreachable", async () => {
    const scene = await approved();
    scene.chain.down = true;
    const result = await refreshIssuerStatus(db, scene.chain, scene.owner, scene.org.id);
    expect(result.ok).toBe(false);
    const [org] = await db
      .select()
      .from(s.organisations)
      .where(eq(s.organisations.id, scene.org.id));
    expect(org.nearIssuerStatus).toBe("registered");
  });
});

describe("preparing a mint", () => {
  it("tells a reviewer exactly what the wallet must sign", async () => {
    const scene = await approved();
    const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
    expect(result).toEqual({
      ok: true,
      value: {
        contractId: CONTRACT,
        tokenId: scene.attestation.id,
        receiverId: scene.contributorAccount,
        digest: scene.attestation.payloadDigest,
        issuerAccountId: scene.issuerAccount,
      },
    });
  });

  it("refuses viewers, outsiders and the contributor", async () => {
    const scene = await approved();
    for (const userId of [scene.viewer, scene.contributor, await person("Stranger")]) {
      expect((await prepareMint(db, scene.chain, userId, scene.attestation.id)).ok).toBe(false);
    }
  });

  it("refuses when the contributor has no NEAR account", async () => {
    const scene = await approved();
    await db
      .update(s.userProfiles)
      .set({ nearAccountId: null })
      .where(eq(s.userProfiles.userId, scene.contributor));
    const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
    expect(result.ok).toBe(false);
  });

  it("refuses when the organisation is not a registered issuer", async () => {
    const scene = await approved();
    await linkIssuerAccount(db, scene.owner, scene.org.id, "fresh.testnet");
    const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
    expect(result.ok).toBe(false);
  });

  it("refuses when NEAR is not configured", async () => {
    const scene = await approved();
    expect((await prepareMint(db, null, scene.reviewer, scene.attestation.id)).ok).toBe(false);
  });
});

describe("confirming a mint", () => {
  it("records it and marks the contribution verified once the contract agrees", async () => {
    const scene = await minted();
    const { attestation, contribution } = await reload(scene.attestation.id);
    expect(attestation.nearAnchorStatus).toBe("confirmed");
    expect(attestation.nearTransactionHash).toBe(scene.transactionHash);
    expect(attestation.nearContractId).toBe(CONTRACT);
    expect(attestation.nearIssuerAccountId).toBe(scene.issuerAccount);
    expect(attestation.nearNetwork).toBe("testnet");
    expect(contribution.status).toBe("verified");

    const notes = await listNotifications(db, scene.contributor);
    expect(notes.some((note) => note.type === "attestation.minted")).toBe(true);
  });

  it("cannot be confirmed twice", async () => {
    const scene = await minted();
    const again = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      scene.attestation.id,
      scene.transactionHash,
    );
    expect(again.ok).toBe(false);
  });

  it("records nothing when the token is not on the contract", async () => {
    const scene = await approved();
    const unrelated = scene.chain.record(scene.issuerAccount, "issue", scene.attestation.id);
    scene.chain.tokens.clear();
    const result = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      scene.attestation.id,
      unrelated,
    );
    expect(result.ok).toBe(false);
    expect((await reload(scene.attestation.id)).attestation.nearAnchorStatus).toBe("awaiting");
  });

  it("records nothing when the digest on the contract is different", async () => {
    const scene = await approved();
    const transactionHash = scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
      organisationId: scene.org.id,
      digest: "0".repeat(64),
    });
    const result = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      scene.attestation.id,
      transactionHash,
    );
    expect(result.ok).toBe(false);
    expect((await reload(scene.attestation.id)).contribution.status).toBe(
      "approved_pending_anchor",
    );
  });

  it("records nothing when another account issued the token", async () => {
    const scene = await approved();
    const transactionHash = scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: "impostor.testnet",
      organisationId: scene.org.id,
      digest: scene.attestation.payloadDigest,
    });
    const result = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      scene.attestation.id,
      transactionHash,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a transaction that is unknown, failed, or about something else", async () => {
    const scene = await approved();
    scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
      organisationId: scene.org.id,
      digest: scene.attestation.payloadDigest,
    });
    const candidates = [
      hash(), // unknown to the network
      scene.chain.record(scene.issuerAccount, "issue", scene.attestation.id, false),
      scene.chain.record(scene.issuerAccount, "issue", randomUUID()),
      scene.chain.record(scene.issuerAccount, "revoke", scene.attestation.id),
      scene.chain.record("impostor.testnet", "issue", scene.attestation.id),
      "not-a-hash",
    ];
    for (const candidate of candidates) {
      const result = await confirmMint(
        db,
        scene.chain,
        "testnet",
        scene.reviewer,
        scene.attestation.id,
        candidate,
      );
      expect(result.ok).toBe(false);
    }
    expect((await reload(scene.attestation.id)).attestation.nearAnchorStatus).toBe("awaiting");
  });

  it("refuses viewers and the contributor, and changes nothing when the network is down", async () => {
    const scene = await approved();
    const transactionHash = scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
      organisationId: scene.org.id,
      digest: scene.attestation.payloadDigest,
    });
    for (const userId of [scene.viewer, scene.contributor]) {
      const result = await confirmMint(
        db,
        scene.chain,
        "testnet",
        userId,
        scene.attestation.id,
        transactionHash,
      );
      expect(result.ok).toBe(false);
    }
    scene.chain.down = true;
    const result = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      scene.attestation.id,
      transactionHash,
    );
    expect(result.ok).toBe(false);
    expect((await reload(scene.attestation.id)).attestation.nearAnchorStatus).toBe("awaiting");
  });
});

describe("revoking", () => {
  it("a record that was never minted is revoked without a wallet", async () => {
    const scene = await approved();
    const prepared = await prepareRevoke(
      db,
      scene.chain,
      scene.owner,
      scene.attestation.id,
      "Issued in error.",
    );
    expect(prepared).toEqual({ ok: true, value: { onChain: false } });
    const result = await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, {
      reason: "Issued in error.",
    });
    expect(result.ok).toBe(true);
    const { attestation, contribution } = await reload(scene.attestation.id);
    expect(attestation.status).toBe("revoked");
    expect(attestation.revocationReason).toBe("Issued in error.");
    expect(attestation.nearRevocationTransactionHash).toBeNull();
    expect(contribution.status).toBe("revoked");
  });

  it("a minted one is revoked only after the contract shows it revoked", async () => {
    const scene = await minted();
    const prepared = await prepareRevoke(db, scene.chain, scene.owner, scene.attestation.id, "x");
    expect(prepared).toEqual({
      ok: true,
      value: { onChain: true, contractId: CONTRACT, tokenId: scene.attestation.id },
    });

    // A revoke transaction hash while the contract still says active: refused.
    const premature = scene.chain.record(scene.issuerAccount, "revoke", scene.attestation.id);
    const early = await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, {
      reason: "The work was not theirs.",
      transactionHash: premature,
    });
    expect(early.ok).toBe(false);
    expect((await reload(scene.attestation.id)).attestation.status).toBe("active");

    const transactionHash = scene.chain.revoke(scene.attestation.id);
    const result = await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, {
      reason: "The work was not theirs.",
      transactionHash,
    });
    expect(result.ok).toBe(true);
    const { attestation, contribution } = await reload(scene.attestation.id);
    expect(attestation.status).toBe("revoked");
    expect(attestation.nearRevocationTransactionHash).toBe(transactionHash);
    expect(attestation.revokedAt).not.toBeNull();
    expect(contribution.status).toBe("revoked");
    const notes = await listNotifications(db, scene.contributor);
    expect(notes.some((note) => note.type === "attestation.revoked")).toBe(true);
  });

  it("needs a transaction when it was minted, and the mint transaction will not do", async () => {
    const scene = await minted();
    scene.chain.revoke(scene.attestation.id);
    for (const transactionHash of [undefined, scene.transactionHash]) {
      const result = await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, {
        reason: "Reason.",
        transactionHash,
      });
      expect(result.ok).toBe(false);
    }
    expect((await reload(scene.attestation.id)).attestation.status).toBe("active");
  });

  it("only owners and admins can revoke, and a reason is required", async () => {
    const scene = await approved();
    for (const userId of [scene.reviewer, scene.viewer, scene.contributor]) {
      const result = await revokeAttestation(db, scene.chain, userId, scene.attestation.id, {
        reason: "Reason.",
      });
      expect(result.ok).toBe(false);
    }
    const noReason = await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, {
      reason: "   ",
    });
    expect(noReason.ok).toBe(false);
    expect((await reload(scene.attestation.id)).attestation.status).toBe("active");
  });

  it("cannot be done twice", async () => {
    const scene = await approved();
    const input = { reason: "Issued in error." };
    expect(
      (await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, input)).ok,
    ).toBe(true);
    expect(
      (await revokeAttestation(db, scene.chain, scene.owner, scene.attestation.id, input)).ok,
    ).toBe(false);
  });
});

describe("public verification", () => {
  it("shows the record, its integrity check and what the contract says", async () => {
    const scene = await minted();
    const view = await getPublicVerification(db, scene.chain, scene.attestation.id);
    expect(view).not.toBeNull();
    expect(view!.recordFailure).toBeNull();
    expect(view!.payload!.claim.title).toBe("Proposal review interface");
    expect(view!.digest).toBe(scene.attestation.payloadDigest);
    expect(view!.issuer.name).toBe("Northstar Test");
    expect(view!.near.transactionHash).toBe(scene.transactionHash);
    expect(view!.chain).toMatchObject({
      state: "found",
      digestMatches: true,
      status: "active",
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
    });
  });

  it("reports the contract's status live, whatever the database says", async () => {
    const scene = await minted();
    scene.chain.revoke(scene.attestation.id);
    const view = await getPublicVerification(db, scene.chain, scene.attestation.id);
    expect(view!.status).toBe("active");
    expect(view!.chain).toMatchObject({ state: "found", status: "revoked" });
  });

  it("says so when the record is not on the contract, or the network is down", async () => {
    const scene = await approved();
    expect((await getPublicVerification(db, scene.chain, scene.attestation.id))!.chain).toEqual({
      state: "missing",
    });
    scene.chain.down = true;
    expect((await getPublicVerification(db, scene.chain, scene.attestation.id))!.chain).toEqual({
      state: "unavailable",
    });
    expect((await getPublicVerification(db, null, scene.attestation.id))!.chain).toEqual({
      state: "not_configured",
    });
  });

  it("hides a private contribution and anything that is not an attestation ID", async () => {
    const scene = await approved({ visibility: "private" });
    expect(await getPublicVerification(db, scene.chain, scene.attestation.id)).toBeNull();
    expect(await getPublicVerification(db, scene.chain, randomUUID())).toBeNull();
    expect(await getPublicVerification(db, scene.chain, "not-an-id")).toBeNull();
  });

  it("does not name a contributor whose profile is private", async () => {
    const scene = await minted();
    await db
      .update(s.userProfiles)
      .set({ visibility: "private" })
      .where(eq(s.userProfiles.userId, scene.contributor));
    const view = await getPublicVerification(db, scene.chain, scene.attestation.id);
    expect(view!.subject).toEqual({ displayName: null, username: null });
  });
});
