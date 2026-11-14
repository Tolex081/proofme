import { asc, eq } from "drizzle-orm";

import {
  checkSealedAttestation,
  type AttestationPayload,
  type SealedCheckFailure,
} from "@/lib/attestations/payload";
import { PublishError, referenceHashOf, type PublishedReference } from "@/lib/credentials/publish";
import type { Database } from "@/lib/db/client";
import {
  attestationStatusEvents,
  attestations,
  auditEvents,
  contributions,
  organisations,
  userProfiles,
} from "@/lib/db/schema";
import {
  transitionAnchor,
  transitionAttestation,
  transitionContribution,
} from "@/lib/domain/status";
import {
  ChainUnavailableError,
  isValidTransactionHash,
  type ChainAttestation,
  type ChainReader,
} from "@/lib/near/chain";
import { canAnchorAttestation, canInOrganisation } from "@/lib/permissions/organisation";
import { notify } from "./account";
import { issuerEligibility } from "./near-identity";
import { getMembership } from "./organisations";

/**
 * Putting attestations on NEAR as NFTs, and taking the organisation's word back.
 *
 * The server never signs. The organisation's own wallet signs `issue` or
 * `revoke` on the contract; the browser then reports the transaction hash, and
 * the functions here read the contract and the transaction before recording
 * anything. A hash alone proves nothing: what counts is what the contract says.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (form: string) => ({ ok: false as const, errors: { form } });
const NOT_FOUND = fail("That does not exist, or you do not have access to it.");
const NOT_CONFIGURED = fail("NEAR is not set up on this site yet, so nothing can be minted.");
const UNREACHABLE = fail("The NEAR network could not be reached. Nothing was changed; try again.");

export type NearNetwork = "testnet" | "sandbox";

async function audit(
  db: Database,
  actorUserId: string,
  organisationId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db
    .insert(auditEvents)
    .values({ actorUserId, organisationId, action, entityType, entityId, metadata });
}

// ── The organisation's issuer account ────────────────────────────────────────

/**
 * Records which NEAR account speaks for the organisation. Owner only. This is
 * a claim until the contract confirms it: the account can mint only once
 * Atesta has registered it on-chain, which `refreshIssuerStatus` checks.
 */
/**
 * Asks the contract whether the organisation's account is a registered
 * issuer for this organisation, and stores the answer. Any member may ask.
 */
export async function refreshIssuerStatus(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  organisationId: string,
): Promise<Result<{ status: "none" | "linked" | "registered" | "suspended" }>> {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "organisation.view_workspace").allowed) {
    return NOT_FOUND;
  }
  const [organisation] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  if (!organisation.nearIssuerAccountId) return { ok: true, value: { status: "none" } };
  if (!chain) return NOT_CONFIGURED;

  let status: "linked" | "registered" | "suspended" = "linked";
  try {
    const issuer = await chain.getIssuer(organisation.nearIssuerAccountId);
    // Registered for a different organisation counts as not registered here.
    if (issuer && issuer.organisationId === organisation.id) {
      status = issuer.status === "active" ? "registered" : "suspended";
    }
  } catch (error) {
    if (error instanceof ChainUnavailableError) return UNREACHABLE;
    throw error;
  }
  if (status !== organisation.nearIssuerStatus) {
    await db
      .update(organisations)
      .set({ nearIssuerStatus: status })
      .where(eq(organisations.id, organisationId));
    await audit(
      db,
      userId,
      organisationId,
      "issuer.status_checked",
      "organisation",
      organisationId,
      {
        from: organisation.nearIssuerStatus,
        to: status,
      },
    );
  }
  return { ok: true, value: { status } };
}

// ── Minting ──────────────────────────────────────────────────────────────────

async function loadForIssuer(db: Database, userId: string, attestationId: string) {
  if (!UUID.test(attestationId)) return null;
  const [row] = await db
    .select({ attestation: attestations, organisation: organisations, contribution: contributions })
    .from(attestations)
    .innerJoin(organisations, eq(organisations.id, attestations.issuerOrganisationId))
    .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
    .where(eq(attestations.id, attestationId));
  if (!row) return null;
  const membership = await getMembership(db, userId, row.organisation.id);
  if (membership?.status !== "active") return null;
  const [subject] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, row.attestation.subjectUserId));
  return { ...row, membership, subject: subject ?? null };
}

export interface MintRequest {
  contractId: string;
  /** "issue" for a first credential, "supersede" for a correction of a minted one. */
  method: "issue" | "supersede";
  tokenId: string;
  /** The token being replaced, for "supersede". */
  oldTokenId: string | null;
  receiverId: string;
  digest: string;
  reference: { reference: string; reference_hash: string };
  issuerAccountId: string;
}

/** Why a credential cannot be minted yet, or null when everything is in place. */
export function mintBlocker(input: {
  organisation: Parameters<typeof issuerEligibility>[0];
  attestation: Pick<
    typeof attestations.$inferSelect,
    "status" | "nearAnchorStatus" | "subjectConsentedAt" | "credentialReference"
  >;
  contributionVisibility: "public" | "private";
  subject: Pick<typeof userProfiles.$inferSelect, "nearAccountId" | "nearAccountVerifiedAt"> | null;
}): string | null {
  const { organisation, attestation, contributionVisibility, subject } = input;
  if (attestation.status !== "active") return "Only an active attestation can be minted.";
  if (attestation.nearAnchorStatus === "confirmed") return "This is already on NEAR.";
  const issuer = issuerEligibility(organisation);
  if (!issuer.eligible) return issuer.reason;
  if (contributionVisibility !== "public") {
    return "The contributor keeps this contribution private, so it cannot become a public credential.";
  }
  if (!attestation.subjectConsentedAt || !attestation.credentialReference) {
    return "The contributor has not agreed to publish this credential yet.";
  }
  if (!subject?.nearAccountId || !subject.nearAccountVerifiedAt) {
    return "The contributor has not proved a NEAR account with their wallet yet, so there is nowhere to send it.";
  }
  if (subject.nearAccountId === organisation.nearIssuerAccountId) {
    return "The contributor's NEAR account is the organisation's own. It must be their own.";
  }
  return null;
}

/**
 * What the organisation's wallet must sign to mint an attestation, after
 * checking that this person may issue it and that everything is in place.
 */
export async function prepareMint(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  attestationId: string,
): Promise<Result<MintRequest>> {
  const found = await loadForIssuer(db, userId, attestationId);
  if (!found) return NOT_FOUND;
  const { attestation, organisation, membership, subject, contribution } = found;
  const allowed = canAnchorAttestation(membership, attestation);
  if (!allowed.allowed) return fail(allowed.reason);
  if (!chain) return NOT_CONFIGURED;
  const blocker = mintBlocker({
    organisation,
    attestation,
    contributionVisibility: contribution.visibility,
    subject,
  });
  if (blocker) return fail(blocker);

  let method: MintRequest["method"] = "issue";
  let oldTokenId: string | null = null;
  if (attestation.supersedesAttestationId) {
    const [old] = await db
      .select()
      .from(attestations)
      .where(eq(attestations.id, attestation.supersedesAttestationId));
    if (old && old.nearAnchorStatus === "confirmed" && old.status === "active") {
      // The contract replaces the old token and mints the new one in one call,
      // to the old token's owner.
      if (old.nearOwnerAccountId && old.nearOwnerAccountId !== subject!.nearAccountId) {
        return fail(
          `The record being corrected is held by ${old.nearOwnerAccountId}; the contributor's proven account is now ${subject!.nearAccountId}. Revoke the old one and issue afresh instead.`,
        );
      }
      method = "supersede";
      oldTokenId = old.id;
    }
  }

  return {
    ok: true,
    value: {
      contractId: chain.contractId,
      method,
      tokenId: attestation.id,
      oldTokenId,
      receiverId: subject!.nearAccountId!,
      digest: attestation.payloadDigest,
      reference: {
        reference: attestation.credentialReference!,
        reference_hash: attestation.credentialReferenceHash!,
      },
      issuerAccountId: organisation.nearIssuerAccountId!,
    },
  };
}

type ChainCheck = { ok: true; onChain: ChainAttestation } | { ok: false; reason: string };

/**
 * Confirms from the network that `transactionHash` is a successful call of one
 * of `methods`, signed by the issuer, on our contract, whose arguments match
 * `expectedArgs` exactly, and returns the token as the contract now holds it.
 */
async function checkOnChain(
  chain: ChainReader,
  input: {
    tokenId: string;
    issuerAccountId: string;
    transactionHash: string;
    methods: string[];
    expectedArgs?: Record<string, unknown>;
  },
): Promise<ChainCheck> {
  const transaction = await chain.getTransaction(input.transactionHash, input.issuerAccountId);
  if (!transaction) return { ok: false, reason: "The network does not know that transaction." };
  const call = transaction.calls.find(
    (candidate) =>
      input.methods.includes(candidate.methodName) &&
      typeof candidate.args === "object" &&
      candidate.args !== null &&
      (candidate.args as Record<string, unknown>).token_id === input.tokenId,
  );
  if (
    !transaction.succeeded ||
    transaction.signerId !== input.issuerAccountId ||
    transaction.receiverId !== chain.contractId ||
    !call
  ) {
    return { ok: false, reason: "That transaction is not a successful call for this attestation." };
  }
  const args = call.args as Record<string, unknown>;
  for (const [key, expected] of Object.entries(input.expectedArgs ?? {})) {
    if (JSON.stringify(args[key] ?? null) !== JSON.stringify(expected)) {
      return {
        ok: false,
        reason: `The transaction's ${key} does not match this record. Nothing was recorded.`,
      };
    }
  }
  const onChain = await chain.getAttestation(input.tokenId);
  if (!onChain) {
    return { ok: false, reason: "The contract has no record of this attestation yet." };
  }
  return { ok: true, onChain };
}

/**
 * Records a mint, but only after reading it back from the contract. The
 * transaction must be the issuer's call with exactly this token ID, receiver,
 * digest and reference; the token must now exist, be active, hold the same
 * digest and reference, be owned by the contributor's proven account and be
 * issued by this organisation's registered account. A correction ("supersede")
 * also marks the replaced record as superseded.
 */
export async function confirmMint(
  db: Database,
  chain: ChainReader | null,
  network: NearNetwork,
  userId: string,
  attestationId: string,
  transactionHash: unknown,
): Promise<Result<{ ownerId: string }>> {
  if (typeof transactionHash !== "string" || !isValidTransactionHash(transactionHash)) {
    return fail("That is not a NEAR transaction hash.");
  }
  const prepared = await prepareMint(db, chain, userId, attestationId);
  if (!prepared.ok) return prepared;
  if (!chain) return NOT_CONFIGURED;
  const request = prepared.value;
  const found = await loadForIssuer(db, userId, attestationId);
  if (!found) return NOT_FOUND;
  const { attestation, organisation } = found;
  const anchorStep = transitionAnchor(attestation.nearAnchorStatus, "confirm");
  if (!anchorStep.ok) return fail("This is already recorded as on NEAR.");

  const expectedArgs: Record<string, unknown> =
    request.method === "supersede"
      ? { old_token_id: request.oldTokenId, digest: request.digest, reference: request.reference }
      : { receiver_id: request.receiverId, digest: request.digest, reference: request.reference };

  let check: ChainCheck;
  try {
    check = await checkOnChain(chain, {
      tokenId: attestation.id,
      issuerAccountId: request.issuerAccountId,
      transactionHash,
      methods: [request.method],
      expectedArgs,
    });
  } catch (error) {
    if (error instanceof ChainUnavailableError) return UNREACHABLE;
    throw error;
  }
  if (!check.ok) return fail(check.reason);
  const { onChain } = check;
  const problem =
    onChain.digest !== attestation.payloadDigest
      ? "The digest on NEAR does not match this record."
      : onChain.issuerId !== request.issuerAccountId || onChain.organisationId !== organisation.id
        ? "The token on NEAR was not issued by this organisation."
        : onChain.ownerId !== request.receiverId
          ? `The token on NEAR is owned by ${onChain.ownerId}, not the contributor's proven account ${request.receiverId}.`
          : onChain.status !== "active"
            ? `The token on NEAR is ${onChain.status}, not active.`
            : onChain.reference !== request.reference.reference ||
                onChain.referenceHash !== request.reference.reference_hash
              ? "The token on NEAR does not point at this credential's published document."
              : null;
  if (problem) return fail(`${problem} Nothing was recorded.`);

  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await tx
      .update(attestations)
      .set({
        nearNetwork: network,
        nearContractId: chain.contractId,
        nearIssuerAccountId: onChain.issuerId,
        nearOwnerAccountId: onChain.ownerId,
        nearTransactionHash: transactionHash,
        nearAnchorStatus: anchorStep.status,
      })
      .where(eq(attestations.id, attestation.id));
    const [contribution] = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.id, attestation.contributionId));
    const step = transitionContribution(contribution.status, "anchor_confirmed");
    if (step.ok) {
      await tx
        .update(contributions)
        .set({ status: step.status })
        .where(eq(contributions.id, contribution.id));
    }
    await tx.insert(attestationStatusEvents).values({
      attestationId: attestation.id,
      previousStatus: attestation.status,
      newStatus: attestation.status,
      reason:
        request.method === "supersede"
          ? "Minted on NEAR as the corrected replacement of an earlier credential."
          : "Minted on NEAR as a non-transferable NFT.",
      actorUserId: userId,
      nearTransactionHash: transactionHash,
    });
    if (request.method === "supersede" && request.oldTokenId) {
      await tx
        .update(attestations)
        .set({ status: "superseded", supersededByAttestationId: attestation.id })
        .where(eq(attestations.id, request.oldTokenId));
      await tx.insert(attestationStatusEvents).values({
        attestationId: request.oldTokenId,
        previousStatus: "active",
        newStatus: "superseded",
        reason: "Replaced by a corrected credential.",
        actorUserId: userId,
        nearTransactionHash: transactionHash,
      });
    }
    await audit(t, userId, organisation.id, "attestation.minted", "attestation", attestation.id, {
      transactionHash,
      ownerId: onChain.ownerId,
      method: request.method,
    });
  });
  await notify(db, {
    userId: attestation.subjectUserId,
    type: "attestation.minted",
    title: `${organisation.name} issued your credential on NEAR`,
    body: `It is in ${onChain.ownerId} as an NFT that cannot be transferred.`,
    href: `/dashboard/contributions/${attestation.contributionId}`,
  });
  return { ok: true, value: { ownerId: onChain.ownerId } };
}

// ── Publishing (contributor consent) ─────────────────────────────────────────

/**
 * The contributor agrees to publish an approved record as a public NFT
 * credential. Only then is its document published (IPFS when configured) and
 * only then can the organisation mint it. Refused for private contributions,
 * for records that are no longer active, and for v1 records (which name the
 * contributor's username and may include private evidence).
 */
export async function consentToPublish(
  db: Database,
  userId: string,
  attestationId: string,
  publish: (attestation: typeof attestations.$inferSelect) => Promise<PublishedReference>,
): Promise<Result<{ reference: string; durable: boolean }>> {
  if (!UUID.test(attestationId)) return NOT_FOUND;
  const [row] = await db
    .select({ attestation: attestations, contribution: contributions })
    .from(attestations)
    .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
    .where(eq(attestations.id, attestationId));
  if (!row || row.attestation.subjectUserId !== userId) return NOT_FOUND;
  const { attestation, contribution } = row;
  if (attestation.status !== "active") return fail("Only an active record can be published.");
  if (contribution.visibility !== "public") {
    return fail(
      "Make the contribution public first. A private record cannot become a public credential.",
    );
  }
  if (attestation.schemaVersion !== "proofme.attestation.v2") {
    return fail(
      "This record was approved before public credentials existed. Ask the organisation to issue a corrected one.",
    );
  }
  if (attestation.subjectConsentedAt && attestation.credentialReference) {
    return {
      ok: true,
      value: {
        reference: attestation.credentialReference,
        durable: attestation.credentialReference.startsWith("ipfs://"),
      },
    };
  }
  let published: PublishedReference;
  try {
    published = await publish(attestation);
  } catch (error) {
    if (error instanceof PublishError) return fail(error.message);
    throw error;
  }
  if (published.referenceHash !== referenceHashOf(attestation.canonicalPayload)) {
    return fail("The published document does not match the record. Nothing was recorded.");
  }
  await db
    .update(attestations)
    .set({
      subjectConsentedAt: new Date(),
      credentialReference: published.reference,
      credentialReferenceHash: published.referenceHash,
    })
    .where(eq(attestations.id, attestation.id));
  await audit(
    db,
    userId,
    attestation.issuerOrganisationId,
    "attestation.publish_consented",
    "attestation",
    attestation.id,
    { reference: published.reference },
  );
  return { ok: true, value: { reference: published.reference, durable: published.durable } };
}

// ── Revoking ─────────────────────────────────────────────────────────────────

function cleanReason(reason: unknown): string {
  return typeof reason === "string" ? reason.normalize("NFC").trim() : "";
}

/**
 * Whether revoking needs a wallet signature. A record that was never minted
 * is revoked in the database alone; a minted one must be revoked on-chain first.
 */
export async function prepareRevoke(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  attestationId: string,
  reason: unknown,
): Promise<Result<{ onChain: false } | { onChain: true; contractId: string; tokenId: string }>> {
  const found = await loadForIssuer(db, userId, attestationId);
  if (!found) return NOT_FOUND;
  const { attestation, organisation, membership } = found;
  const allowed = canInOrganisation(membership, organisation.id, "attestation.revoke");
  if (!allowed.allowed) return fail("Only an owner or admin can revoke an attestation.");
  if (!transitionAttestation(attestation.status, "revoke").ok) {
    return fail("Only an active attestation can be revoked.");
  }
  const text = cleanReason(reason);
  if (text.length === 0) return { ok: false, errors: { reason: "Say why it is being revoked." } };
  if (text.length > 500) return { ok: false, errors: { reason: "Keep it under 500 characters." } };
  if (attestation.nearAnchorStatus !== "confirmed") return { ok: true, value: { onChain: false } };
  if (!chain) return NOT_CONFIGURED;
  return {
    ok: true,
    value: { onChain: true, contractId: chain.contractId, tokenId: attestation.id },
  };
}

/**
 * Revokes an attestation. If it was minted, the contract must already show it
 * as revoked by the reported transaction. The reason is kept here, off-chain.
 */
export async function revokeAttestation(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  attestationId: string,
  input: { reason: unknown; transactionHash?: unknown },
): Promise<Result<null>> {
  const prepared = await prepareRevoke(db, chain, userId, attestationId, input.reason);
  if (!prepared.ok) return prepared;
  const found = await loadForIssuer(db, userId, attestationId);
  if (!found) return NOT_FOUND;
  const { attestation, organisation } = found;
  const reason = cleanReason(input.reason);

  let transactionHash: string | null = null;
  if (prepared.value.onChain) {
    if (!chain) return NOT_CONFIGURED;
    if (
      typeof input.transactionHash !== "string" ||
      !isValidTransactionHash(input.transactionHash)
    ) {
      return fail("That is not a NEAR transaction hash.");
    }
    if (!attestation.nearIssuerAccountId) return fail("The issuing account is not recorded.");
    try {
      const check = await checkOnChain(chain, {
        tokenId: attestation.id,
        issuerAccountId: attestation.nearIssuerAccountId,
        transactionHash: input.transactionHash,
        methods: ["revoke"],
      });
      if (!check.ok) return fail(check.reason);
      if (check.onChain.status !== "revoked") {
        return fail("The contract does not show this attestation as revoked yet.");
      }
    } catch (error) {
      if (error instanceof ChainUnavailableError) return UNREACHABLE;
      throw error;
    }
    transactionHash = input.transactionHash;
  }

  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await tx
      .update(attestations)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revocationReason: reason,
        nearRevocationTransactionHash: transactionHash,
      })
      .where(eq(attestations.id, attestation.id));
    const [contribution] = await tx
      .select()
      .from(contributions)
      .where(eq(contributions.id, attestation.contributionId));
    const step = transitionContribution(contribution.status, "revoke");
    if (step.ok) {
      await tx
        .update(contributions)
        // Only a verified contribution may be featured.
        .set({ status: step.status, featured: false })
        .where(eq(contributions.id, contribution.id));
    }
    await tx.insert(attestationStatusEvents).values({
      attestationId: attestation.id,
      previousStatus: attestation.status,
      newStatus: "revoked",
      reason,
      actorUserId: userId,
      nearTransactionHash: transactionHash,
    });
    await audit(t, userId, organisation.id, "attestation.revoked", "attestation", attestation.id, {
      transactionHash,
    });
  });
  await notify(db, {
    userId: attestation.subjectUserId,
    type: "attestation.revoked",
    title: `${organisation.name} revoked an attestation`,
    body: reason,
    href: `/dashboard/contributions/${attestation.contributionId}`,
  });
  return { ok: true, value: null };
}

// ── Public verification ──────────────────────────────────────────────────────

export type ChainView =
  | { state: "not_configured" }
  | { state: "unavailable" }
  | { state: "missing" }
  | {
      state: "found";
      digestMatches: boolean;
      status: ChainAttestation["status"];
      ownerId: string;
      issuerId: string;
      issuerStatus: ChainAttestation["issuerStatus"];
      issuedAt: Date;
      statusChangedAt: Date;
    };

export interface PublicVerification {
  id: string;
  /** Null when the stored record fails its own integrity check. */
  payload: AttestationPayload | null;
  recordFailure: SealedCheckFailure | null;
  digest: string;
  status: "active" | "revoked" | "superseded";
  issuedAt: Date;
  revokedAt: Date | null;
  issuer: { name: string; slug: string; reviewedByAtesta: boolean };
  /** Null when the contributor keeps their profile private. */
  subject: { displayName: string | null; username: string | null };
  near: {
    contractId: string | null;
    transactionHash: string | null;
    revocationTransactionHash: string | null;
    ownerAccountId: string | null;
  };
  /** The published public document (NEP-177 reference) and its Base64 SHA-256. */
  credential: { reference: string; referenceHash: string } | null;
  /** The record this one corrected, and the record that corrected this one. */
  supersedes: string | null;
  supersededBy: string | null;
  /** Every status change, oldest first. Reasons for revocation are the issuer's own words. */
  history: { at: Date; status: string; reason: string | null; transactionHash: string | null }[];
  chain: ChainView;
}

/**
 * Everything a stranger needs to check an attestation, with no account.
 * Only records whose contributor made the contribution public are shown;
 * anything else looks exactly like an ID that does not exist.
 *
 * The record is re-hashed here and the contract is read live, so the page
 * never repeats a stored "verified" flag.
 */
export async function getPublicVerification(
  db: Database,
  chain: ChainReader | null,
  attestationId: string,
): Promise<PublicVerification | null> {
  if (!UUID.test(attestationId)) return null;
  const [row] = await db
    .select({
      attestation: attestations,
      organisation: organisations,
      contribution: contributions,
      profile: userProfiles,
    })
    .from(attestations)
    .innerJoin(organisations, eq(organisations.id, attestations.issuerOrganisationId))
    .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
    .innerJoin(userProfiles, eq(userProfiles.userId, attestations.subjectUserId))
    .where(eq(attestations.id, attestationId.toLowerCase()));
  if (!row || row.contribution.visibility !== "public") return null;
  const { attestation, organisation, profile } = row;

  const sealed = await checkSealedAttestation(
    attestation.canonicalPayload,
    attestation.payloadDigest,
  );
  const history = await db
    .select()
    .from(attestationStatusEvents)
    .where(eq(attestationStatusEvents.attestationId, attestation.id))
    .orderBy(asc(attestationStatusEvents.createdAt));

  let chainView: ChainView;
  if (!chain) {
    chainView = { state: "not_configured" };
  } else {
    try {
      const onChain = await chain.getAttestation(attestation.id);
      chainView = onChain
        ? {
            state: "found",
            digestMatches: onChain.digest === attestation.payloadDigest,
            status: onChain.status,
            ownerId: onChain.ownerId,
            issuerId: onChain.issuerId,
            issuerStatus: onChain.issuerStatus,
            issuedAt: onChain.issuedAt,
            statusChangedAt: onChain.statusChangedAt,
          }
        : { state: "missing" };
    } catch {
      chainView = { state: "unavailable" };
    }
  }

  return {
    id: attestation.id,
    payload: sealed.ok ? sealed.payload : null,
    recordFailure: sealed.ok ? null : sealed.failure,
    digest: attestation.payloadDigest,
    status: attestation.status,
    issuedAt: attestation.issuedAt,
    revokedAt: attestation.revokedAt,
    issuer: {
      name: organisation.name,
      slug: organisation.slug,
      reviewedByAtesta: organisation.platformVerificationStatus === "verified",
    },
    // A private profile stays private here too: no name and no username, from
    // the record or anywhere else.
    subject: {
      displayName: profile.visibility === "public" ? profile.displayName : null,
      username: profile.visibility === "public" ? profile.username : null,
    },
    near: {
      contractId: attestation.nearContractId,
      transactionHash: attestation.nearTransactionHash,
      revocationTransactionHash: attestation.nearRevocationTransactionHash,
      ownerAccountId: attestation.nearOwnerAccountId,
    },
    credential:
      attestation.credentialReference && attestation.credentialReferenceHash
        ? {
            reference: attestation.credentialReference,
            referenceHash: attestation.credentialReferenceHash,
          }
        : null,
    supersedes: attestation.supersedesAttestationId,
    supersededBy: attestation.supersededByAttestationId,
    history: history.map((event) => ({
      at: event.createdAt,
      status: event.newStatus,
      reason: event.reason,
      transactionHash: event.nearTransactionHash,
    })),
    chain: chainView,
  };
}
