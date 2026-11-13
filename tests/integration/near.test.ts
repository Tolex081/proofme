import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
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
import { referenceHashOf } from "@/lib/credentials/publish";
import { nep413SigningHash } from "@/lib/near/nep413";
import { listNotifications } from "@/server/services/account";
import { createContribution } from "@/server/services/contributions";
import {
  consentToPublish,
  confirmMint,
  getPublicVerification,
  prepareMint,
  prepareRevoke,
  refreshIssuerStatus,
  revokeAttestation,
} from "@/server/services/near";
import { createOrganisation } from "@/server/services/organisations";
import { completeOnboarding } from "@/server/services/profile";
import {
  createChallenge,
  proveContributorAccount,
  proveIssuerAccount,
} from "@/server/services/near-identity";
import { checkHolderAccess, getPublishedDocument } from "@/server/services/holders";
import { decide, replaceAttestation, submitForReview } from "@/server/services/verification";
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
  /** account → its full-access public keys */
  keys = new Map<string, Set<string>>();
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
  async hasFullAccessKey(accountId: string, publicKey: string) {
    this.check();
    return this.keys.get(accountId)?.has(publicKey) ?? false;
  }
  async getAttestationsForOwner(accountId: string) {
    this.check();
    return [...this.tokens.values()].filter((token) => token.ownerId === accountId);
  }

  /** Records a successful `issue` as the contract would, and returns its hash. */
  mint(input: {
    tokenId: string;
    ownerId: string;
    issuerId: string;
    organisationId: string;
    digest: string;
    reference?: { reference: string; reference_hash: string } | null;
    /** What the transaction says, when it should differ from what was stored. */
    args?: Record<string, unknown>;
  }) {
    const now = new Date();
    const reference = input.reference ?? null;
    this.tokens.set(input.tokenId, {
      tokenId: input.tokenId,
      ownerId: input.ownerId,
      issuerId: input.issuerId,
      organisationId: input.organisationId,
      digest: input.digest,
      issuerStatus: "active",
      issuedAt: now,
      status: "active",
      statusChangedAt: now,
      supersedes: null,
      supersededBy: null,
      reference: reference?.reference ?? null,
      referenceHash: reference?.reference_hash ?? null,
    });
    return this.record(input.issuerId, "issue", input.tokenId, true, {
      receiver_id: input.ownerId,
      digest: input.digest,
      reference,
      ...input.args,
    });
  }

  revoke(tokenId: string) {
    const token = this.tokens.get(tokenId)!;
    this.tokens.set(tokenId, { ...token, status: "revoked", statusChangedAt: new Date() });
    return this.record(token.issuerId, "revoke", tokenId);
  }

  record(
    signerId: string,
    methodName: string,
    tokenId: string,
    succeeded = true,
    args: Record<string, unknown> = {},
  ) {
    const transactionHash = hash();
    this.transactions.set(transactionHash, {
      hash: transactionHash,
      signerId,
      receiverId: CONTRACT,
      succeeded,
      calls: [{ methodName, args: { token_id: tokenId, ...args } }],
    });
    return transactionHash;
  }
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Buffer): string {
  let number = BigInt("0x" + bytes.toString("hex"));
  let out = "";
  while (number > BigInt(0)) {
    out = ALPHABET[Number(number % BigInt(58))] + out;
    number /= BigInt(58);
  }
  return out;
}

/** A NEAR wallet stand-in for one account: an ed25519 key the fake chain knows. */
function wallet(chain: FakeChain, accountId: string, registerKey = true) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key = `ed25519:${base58(Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url"))}`;
  if (registerKey) {
    const keys = chain.keys.get(accountId) ?? new Set<string>();
    keys.add(key);
    chain.keys.set(accountId, keys);
  }
  return {
    publicKey: key,
    sign(challenge: { challengeId: string; message: string; nonce: string; recipient: string }) {
      const signature = sign(
        null,
        nep413SigningHash({
          message: challenge.message,
          nonce: Buffer.from(challenge.nonce, "base64"),
          recipient: challenge.recipient,
        }),
        privateKey,
      ).toString("base64");
      return { challengeId: challenge.challengeId, accountId, publicKey: key, signature };
    },
  };
}

const RECIPIENT = "proofme.test";

async function proveContributor(chain: FakeChain, userId: string, accountId: string) {
  const challenge = await createChallenge(db, {
    purpose: "contributor_account",
    accountId,
    recipient: RECIPIENT,
    userId,
  });
  if (!challenge.ok) throw new Error("challenge");
  return proveContributorAccount(db, chain, userId, wallet(chain, accountId).sign(challenge.value));
}

async function proveIssuer(
  chain: FakeChain,
  userId: string,
  organisationId: string,
  accountId: string,
) {
  const challenge = await createChallenge(db, {
    purpose: "issuer_account",
    accountId,
    recipient: RECIPIENT,
    userId,
    organisationId,
  });
  if (!challenge.ok) throw new Error("challenge");
  return proveIssuerAccount(
    db,
    chain,
    userId,
    organisationId,
    wallet(chain, accountId).sign(challenge.value),
  );
}

/** Publishes the contributor's consent with a stand-in for the IPFS pin. */
async function consent(userId: string, attestationId: string) {
  return consentToPublish(db, userId, attestationId, async (attestation) => ({
    reference: `ipfs://bafkreitest${attestation.id.replace(/-/g, "").slice(0, 20)}`,
    referenceHash: referenceHashOf(attestation.canonicalPayload),
    durable: true,
  }));
}

async function person(name: string) {
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
    .set({ visibility: "public" })
    .where(eq(s.userProfiles.userId, id));
  return id;
}

/**
 * An organisation whose NEAR account is registered on the fake chain, and a
 * contributor with an approved, not yet minted attestation.
 */
async function approved(options: { visibility?: "public" | "private"; consent?: boolean } = {}) {
  const chain = new FakeChain();
  const tag = short();
  const issuerAccount = `org-${tag}.testnet`;
  const contributorAccount = `dev-${tag}.testnet`;
  const owner = await person("Owner");
  const reviewer = await person("Rita Reviewer");
  const viewer = await person("Vic Viewer");
  const contributor = await person("Daniel Contributor");
  const provenContributor = await proveContributor(chain, contributor, contributorAccount);
  if (!provenContributor.ok) throw new Error(JSON.stringify(provenContributor.errors));

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

  // ProofMe has verified the organisation (admin decision, tested elsewhere).
  await db
    .update(s.organisations)
    .set({ platformVerificationStatus: "verified" })
    .where(eq(s.organisations.id, org.value.id));
  const linked = await proveIssuer(chain, owner, org.value.id, issuerAccount);
  if (!linked.ok) throw new Error(JSON.stringify(linked.errors));
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
  if ((options.visibility ?? "public") === "public" && options.consent !== false) {
    const agreed = await consent(contributor, decision.value.attestationId);
    if (!agreed.ok) throw new Error(JSON.stringify(agreed.errors));
  }
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

function referenceOf(attestation: typeof s.attestations.$inferSelect) {
  return {
    reference: attestation.credentialReference!,
    reference_hash: attestation.credentialReferenceHash!,
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
    reference: referenceOf(scene.attestation),
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
  it("is recorded only after the owner proves control with a wallet signature", async () => {
    const scene = await approved();
    const [org] = await db
      .select()
      .from(s.organisations)
      .where(eq(s.organisations.id, scene.org.id));
    expect(org.nearIssuerAccountId).toBe(scene.issuerAccount);
    expect(org.nearIssuerVerifiedAt).not.toBeNull();
  });

  it("only an owner can prove it", async () => {
    const scene = await approved();
    for (const userId of [scene.reviewer, scene.contributor]) {
      expect((await proveIssuer(scene.chain, userId, scene.org.id, "x.testnet")).ok).toBe(false);
    }
  });

  it("rejects a signature by a key that is not the account's, a reused challenge, and a wrong account", async () => {
    const scene = await approved();
    const challenge = await createChallenge(db, {
      purpose: "issuer_account",
      accountId: "new-issuer.testnet",
      recipient: RECIPIENT,
      userId: scene.owner,
      organisationId: scene.org.id,
    });
    if (!challenge.ok) throw new Error("challenge");
    // The key signs correctly but is not a key of new-issuer.testnet.
    const stranger = wallet(scene.chain, "new-issuer.testnet", false);
    const unregistered = await proveIssuerAccount(
      db,
      scene.chain,
      scene.owner,
      scene.org.id,
      stranger.sign(challenge.value),
    );
    expect(unregistered.ok).toBe(false);

    const real = wallet(scene.chain, "new-issuer.testnet");
    const proof = real.sign(challenge.value);
    expect((await proveIssuerAccount(db, scene.chain, scene.owner, scene.org.id, proof)).ok).toBe(
      true,
    );
    // Single use.
    expect((await proveIssuerAccount(db, scene.chain, scene.owner, scene.org.id, proof)).ok).toBe(
      false,
    );
    // Claiming another account with a challenge issued for this one.
    const second = await createChallenge(db, {
      purpose: "issuer_account",
      accountId: "a.testnet",
      recipient: RECIPIENT,
      userId: scene.owner,
      organisationId: scene.org.id,
    });
    if (!second.ok) throw new Error("challenge");
    const wrong = wallet(scene.chain, "b.testnet").sign(second.value);
    expect(
      (
        await proveIssuerAccount(db, scene.chain, scene.owner, scene.org.id, {
          ...wrong,
          accountId: "b.testnet",
        })
      ).ok,
    ).toBe(false);
  });

  it("a newly proven account must be registered again: the status follows the contract", async () => {
    const scene = await approved();
    const relinked = await proveIssuer(scene.chain, scene.owner, scene.org.id, "other.testnet");
    expect(relinked.ok).toBe(true);
    const first = await refreshIssuerStatus(db, scene.chain, scene.owner, scene.org.id);
    expect(first).toEqual({ ok: true, value: { status: "linked" } });

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

describe("the contributor's NEAR account", () => {
  it("is recorded only with a valid signature by one of the account's full-access keys", async () => {
    const chain = new FakeChain();
    const userId = await person("Pat");
    const challenge = await createChallenge(db, {
      purpose: "contributor_account",
      accountId: "pat.testnet",
      recipient: RECIPIENT,
      userId,
    });
    if (!challenge.ok) throw new Error("challenge");
    const notTheirs = wallet(chain, "pat.testnet", false).sign(challenge.value);
    expect((await proveContributorAccount(db, chain, userId, notTheirs)).ok).toBe(false);
    const [before] = await db
      .select()
      .from(s.userProfiles)
      .where(eq(s.userProfiles.userId, userId));
    expect(before.nearAccountId).toBeNull();

    const proven = await proveContributor(chain, userId, "pat.testnet");
    expect(proven.ok).toBe(true);
    const [after] = await db.select().from(s.userProfiles).where(eq(s.userProfiles.userId, userId));
    expect(after.nearAccountId).toBe("pat.testnet");
    expect(after.nearAccountVerifiedAt).not.toBeNull();
  });

  it("cannot use another person's challenge", async () => {
    const chain = new FakeChain();
    const alice = await person("Alice");
    const mallory = await person("Mallory");
    const challenge = await createChallenge(db, {
      purpose: "contributor_account",
      accountId: "alice.testnet",
      recipient: RECIPIENT,
      userId: alice,
    });
    if (!challenge.ok) throw new Error("challenge");
    const proof = wallet(chain, "alice.testnet").sign(challenge.value);
    expect((await proveContributorAccount(db, chain, mallory, proof)).ok).toBe(false);
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
        method: "issue",
        tokenId: scene.attestation.id,
        oldTokenId: null,
        receiverId: scene.contributorAccount,
        digest: scene.attestation.payloadDigest,
        reference: referenceOf(scene.attestation),
        issuerAccountId: scene.issuerAccount,
      },
    });
    expect(scene.attestation.credentialReferenceHash).toBe(
      Buffer.from(scene.attestation.payloadDigest, "hex").toString("base64"),
    );
  });

  it("refuses viewers, outsiders and the contributor", async () => {
    const scene = await approved();
    for (const userId of [scene.viewer, scene.contributor, await person("Stranger")]) {
      expect((await prepareMint(db, scene.chain, userId, scene.attestation.id)).ok).toBe(false);
    }
  });

  it("refuses when the contributor's account was typed in but never proven", async () => {
    const scene = await approved();
    await db
      .update(s.userProfiles)
      .set({ nearAccountId: "typed.testnet", nearAccountVerifiedAt: null })
      .where(eq(s.userProfiles.userId, scene.contributor));
    const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
    expect(result.ok).toBe(false);
  });

  it("refuses when the organisation is not a registered issuer", async () => {
    const scene = await approved();
    await proveIssuer(scene.chain, scene.owner, scene.org.id, "fresh.testnet");
    const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
    expect(result.ok).toBe(false);
  });

  it("refuses an organisation ProofMe has not verified, or has suspended, even with a registered account", async () => {
    for (const status of ["pending", "unverified", "suspended", "rejected"] as const) {
      const scene = await approved();
      await db
        .update(s.organisations)
        .set({ platformVerificationStatus: status })
        .where(eq(s.organisations.id, scene.org.id));
      const result = await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id);
      expect(result.ok).toBe(false);
    }
  });

  it("refuses until the contributor consents, and a private contribution can never be published", async () => {
    const scene = await approved({ consent: false });
    expect((await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id)).ok).toBe(
      false,
    );
    // Someone else cannot consent for them.
    expect((await consent(scene.reviewer, scene.attestation.id)).ok).toBe(false);
    expect((await consent(scene.contributor, scene.attestation.id)).ok).toBe(true);
    expect((await prepareMint(db, scene.chain, scene.reviewer, scene.attestation.id)).ok).toBe(
      true,
    );

    const hidden = await approved({ visibility: "private" });
    expect((await consent(hidden.contributor, hidden.attestation.id)).ok).toBe(false);
    expect((await prepareMint(db, hidden.chain, hidden.reviewer, hidden.attestation.id)).ok).toBe(
      false,
    );
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

  it("records nothing when the transaction or the token names another receiver, digest or document", async () => {
    const cases: Array<
      (scene: Awaited<ReturnType<typeof approved>>) => Parameters<FakeChain["mint"]>[0]
    > = [
      // The token went to someone else's account.
      (scene) => ({ ...base(scene), ownerId: "someone-else.testnet" }),
      // The transaction's arguments differ from what is stored.
      (scene) => ({ ...base(scene), args: { receiver_id: "someone-else.testnet" } }),
      (scene) => ({ ...base(scene), args: { digest: "1".repeat(64) } }),
      // No reference, or a different document.
      (scene) => ({ ...base(scene), reference: null }),
      (scene) => ({
        ...base(scene),
        reference: {
          reference: "ipfs://bafkreiother",
          reference_hash: referenceOf(scene.attestation).reference_hash,
        },
      }),
    ];
    function base(scene: Awaited<ReturnType<typeof approved>>) {
      return {
        tokenId: scene.attestation.id,
        ownerId: scene.contributorAccount,
        issuerId: scene.issuerAccount,
        organisationId: scene.org.id,
        digest: scene.attestation.payloadDigest,
        reference: referenceOf(scene.attestation),
      };
    }
    for (const make of cases) {
      const scene = await approved();
      const transactionHash = scene.chain.mint(make(scene));
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
    }
  });

  it("records nothing when the token is no longer active on the contract", async () => {
    const scene = await approved();
    const transactionHash = scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
      organisationId: scene.org.id,
      digest: scene.attestation.payloadDigest,
      reference: referenceOf(scene.attestation),
    });
    scene.chain.revoke(scene.attestation.id);
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

  it("records nothing when another account issued the token", async () => {
    const scene = await approved();
    const transactionHash = scene.chain.mint({
      tokenId: scene.attestation.id,
      ownerId: scene.contributorAccount,
      issuerId: "impostor.testnet",
      organisationId: scene.org.id,
      digest: scene.attestation.payloadDigest,
      reference: referenceOf(scene.attestation),
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
      reference: referenceOf(scene.attestation),
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
      reference: referenceOf(scene.attestation),
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

describe("correcting a credential (supersession)", () => {
  const correction = {
    title: "Proposal review interface (corrected)",
    summary: "Built the reviewer-facing proposal screen.",
    description: "Designed and implemented the screen reviewers use to score proposals.",
    role: "Lead frontend engineer",
    startDate: "2026-07-01",
    endDate: "2026-10-15",
    reason: "The role and end date were wrong.",
  };

  it("an unminted record is replaced at once and the two are linked both ways", async () => {
    const scene = await approved();
    const result = await replaceAttestation(db, scene.owner, scene.attestation.id, correction);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.supersededNow).toBe(true);
    const old = (await reload(scene.attestation.id)).attestation;
    const fresh = (await reload(result.value.attestationId)).attestation;
    expect(old.status).toBe("superseded");
    expect(old.supersededByAttestationId).toBe(fresh.id);
    expect(fresh.supersedesAttestationId).toBe(old.id);
    expect(fresh.canonicalPayload).toContain("Lead frontend engineer");
    // The old record's content is untouched.
    expect(old.canonicalPayload).toBe(scene.attestation.canonicalPayload);
    // A correction must be consented to again before it can be minted.
    expect((await prepareMint(db, scene.chain, scene.reviewer, fresh.id)).ok).toBe(false);
  });

  it("a minted record stays active until the contract's supersede call, then both are recorded", async () => {
    const scene = await minted();
    const result = await replaceAttestation(db, scene.owner, scene.attestation.id, correction);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.supersededNow).toBe(false);
    expect((await reload(scene.attestation.id)).attestation.status).toBe("active");
    const newId = result.value.attestationId;
    expect((await consent(scene.contributor, newId)).ok).toBe(true);

    const prepared = await prepareMint(db, scene.chain, scene.reviewer, newId);
    if (!prepared.ok) throw new Error(JSON.stringify(prepared.errors));
    expect(prepared.value.method).toBe("supersede");
    expect(prepared.value.oldTokenId).toBe(scene.attestation.id);

    // What the contract does on supersede.
    const fresh = (await reload(newId)).attestation;
    const old = scene.chain.tokens.get(scene.attestation.id)!;
    scene.chain.tokens.set(old.tokenId, { ...old, status: "superseded", supersededBy: newId });
    const transactionHash = scene.chain.mint({
      tokenId: newId,
      ownerId: scene.contributorAccount,
      issuerId: scene.issuerAccount,
      organisationId: scene.org.id,
      digest: fresh.payloadDigest,
      reference: referenceOf(fresh),
    });
    // Re-label the recorded call as supersede with its real arguments.
    scene.chain.transactions.get(transactionHash)!.calls = [
      {
        methodName: "supersede",
        args: {
          old_token_id: scene.attestation.id,
          token_id: newId,
          digest: fresh.payloadDigest,
          reference: referenceOf(fresh),
        },
      },
    ];
    const confirmed = await confirmMint(
      db,
      scene.chain,
      "testnet",
      scene.reviewer,
      newId,
      transactionHash,
    );
    if (!confirmed.ok) throw new Error(JSON.stringify(confirmed.errors));
    expect((await reload(scene.attestation.id)).attestation.status).toBe("superseded");
    expect((await reload(newId)).attestation.nearAnchorStatus).toBe("confirmed");

    const page = await getPublicVerification(db, scene.chain, scene.attestation.id);
    expect(page?.supersededBy).toBe(newId);
    expect(page?.history.map((event) => event.status)).toEqual(["active", "active", "superseded"]);
    const newPage = await getPublicVerification(db, scene.chain, newId);
    expect(newPage?.supersedes).toBe(scene.attestation.id);
    expect(newPage?.credential?.reference).toBe(fresh.credentialReference);
  });

  it("only owners and admins can correct, a reason is required, and only once at a time", async () => {
    const scene = await approved();
    for (const userId of [scene.reviewer, scene.viewer, scene.contributor]) {
      expect((await replaceAttestation(db, userId, scene.attestation.id, correction)).ok).toBe(
        false,
      );
    }
    expect(
      (
        await replaceAttestation(db, scene.owner, scene.attestation.id, {
          ...correction,
          reason: "",
        })
      ).ok,
    ).toBe(false);
    const minted2 = await minted();
    expect(
      (await replaceAttestation(db, minted2.owner, minted2.attestation.id, correction)).ok,
    ).toBe(true);
    expect(
      (await replaceAttestation(db, minted2.owner, minted2.attestation.id, correction)).ok,
    ).toBe(false);
  });
});

describe("credential-gated access", () => {
  async function holderProof(chain: FakeChain, accountId: string, keyIsTheirs = true) {
    const challenge = await createChallenge(db, {
      purpose: "holder_access",
      accountId,
      recipient: RECIPIENT,
    });
    if (!challenge.ok) throw new Error("challenge");
    return wallet(chain, accountId, keyIsTheirs).sign(challenge.value);
  }

  it("opens for the wallet that holds an active credential from a verified issuer", async () => {
    const scene = await minted();
    const access = await checkHolderAccess(
      db,
      scene.chain,
      await holderProof(scene.chain, scene.contributorAccount),
    );
    expect(access.granted).toBe(true);
    expect(access.credentials[0]).toMatchObject({ tokenId: scene.attestation.id, accepted: true });
  });

  it("stays shut for someone who names the holder's account but cannot sign for it", async () => {
    const scene = await minted();
    const access = await checkHolderAccess(
      db,
      scene.chain,
      await holderProof(scene.chain, scene.contributorAccount, false),
    );
    expect(access.granted).toBe(false);
  });

  it("stays shut for a wallet with no credentials", async () => {
    const scene = await minted();
    const access = await checkHolderAccess(
      db,
      scene.chain,
      await holderProof(scene.chain, "nobody.testnet"),
    );
    expect(access).toMatchObject({ granted: false, accountId: "nobody.testnet" });
  });

  it("stays shut when the credential is revoked or superseded on-chain", async () => {
    for (const status of ["revoked", "superseded"] as const) {
      const scene = await minted();
      const token = scene.chain.tokens.get(scene.attestation.id)!;
      scene.chain.tokens.set(token.tokenId, { ...token, status });
      const access = await checkHolderAccess(
        db,
        scene.chain,
        await holderProof(scene.chain, scene.contributorAccount),
      );
      expect(access.granted).toBe(false);
    }
  });

  it("stays shut when the issuer is suspended on the contract or ProofMe no longer recognises the organisation", async () => {
    const suspendedOnChain = await minted();
    const token = suspendedOnChain.chain.tokens.get(suspendedOnChain.attestation.id)!;
    suspendedOnChain.chain.tokens.set(token.tokenId, { ...token, issuerStatus: "suspended" });
    expect(
      (
        await checkHolderAccess(
          db,
          suspendedOnChain.chain,
          await holderProof(suspendedOnChain.chain, suspendedOnChain.contributorAccount),
        )
      ).granted,
    ).toBe(false);

    const suspendedByProofMe = await minted();
    await db
      .update(s.organisations)
      .set({ platformVerificationStatus: "suspended" })
      .where(eq(s.organisations.id, suspendedByProofMe.org.id));
    expect(
      (
        await checkHolderAccess(
          db,
          suspendedByProofMe.chain,
          await holderProof(suspendedByProofMe.chain, suspendedByProofMe.contributorAccount),
        )
      ).granted,
    ).toBe(false);
  });

  it("serves the published document byte for byte, and nothing unpublished", async () => {
    const scene = await approved();
    expect(await getPublishedDocument(db, scene.attestation.id)).toBe(
      scene.attestation.canonicalPayload,
    );
    const unpublished = await approved({ consent: false });
    expect(await getPublishedDocument(db, unpublished.attestation.id)).toBeNull();
  });
});
