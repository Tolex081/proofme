import { eq } from "drizzle-orm";

import {
  checkSealedAttestation,
  type AttestationPayloadV1,
  type SealedCheckFailure,
} from "@/lib/attestations/payload";
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
  isValidAccountId,
  isValidTransactionHash,
  type ChainAttestation,
  type ChainReader,
} from "@/lib/near/chain";
import { canAnchorAttestation, canInOrganisation } from "@/lib/permissions/organisation";
import { notify } from "./account";
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
 * ProofMe has registered it on-chain, which `refreshIssuerStatus` checks.
 */
export async function linkIssuerAccount(
  db: Database,
  userId: string,
  organisationId: string,
  accountId: unknown,
): Promise<Result<{ accountId: string }>> {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "issuer.configure").allowed) {
    return membership?.status === "active"
      ? fail("Only an owner can choose the organisation's NEAR account.")
      : NOT_FOUND;
  }
  const value = typeof accountId === "string" ? accountId.trim().toLowerCase() : "";
  if (!isValidAccountId(value)) return fail("That is not a valid NEAR account.");

  await db
    .update(organisations)
    .set({ nearIssuerAccountId: value, nearIssuerStatus: "linked" })
    .where(eq(organisations.id, organisationId));
  await audit(db, userId, organisationId, "issuer.linked", "organisation", organisationId, {
    accountId: value,
  });
  return { ok: true, value: { accountId: value } };
}

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
    .select({ attestation: attestations, organisation: organisations })
    .from(attestations)
    .innerJoin(organisations, eq(organisations.id, attestations.issuerOrganisationId))
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
  tokenId: string;
  receiverId: string;
  digest: string;
  issuerAccountId: string;
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
  const { attestation, organisation, membership, subject } = found;
  const allowed = canAnchorAttestation(membership, attestation);
  if (!allowed.allowed) return fail(allowed.reason);
  if (attestation.status !== "active") return fail("Only an active attestation can be minted.");
  if (attestation.nearAnchorStatus === "confirmed") return fail("This is already on NEAR.");
  if (!chain) return NOT_CONFIGURED;
  if (organisation.nearIssuerStatus !== "registered" || !organisation.nearIssuerAccountId) {
    return fail(
      "The organisation's NEAR account is not a registered issuer yet. An owner sets this up under Attestations.",
    );
  }
  if (!subject?.nearAccountId || !isValidAccountId(subject.nearAccountId)) {
    return fail(
      "The contributor has not added a NEAR account to their profile yet, so there is nowhere to send it.",
    );
  }
  if (subject.nearAccountId === organisation.nearIssuerAccountId) {
    return fail("The contributor's NEAR account is the organisation's own. It must be their own.");
  }
  return {
    ok: true,
    value: {
      contractId: chain.contractId,
      tokenId: attestation.id,
      receiverId: subject.nearAccountId,
      digest: attestation.payloadDigest,
      issuerAccountId: organisation.nearIssuerAccountId,
    },
  };
}

type ChainCheck = { ok: true; onChain: ChainAttestation } | { ok: false; reason: string };

/**
 * Confirms from the network that `transactionHash` is a successful call of one
 * of `methods` for this token, signed by the issuer, on our contract.
 */
async function checkOnChain(
  chain: ChainReader,
  input: {
    tokenId: string;
    issuerAccountId: string;
    transactionHash: string;
    methods: string[];
  },
): Promise<ChainCheck> {
  const onChain = await chain.getAttestation(input.tokenId);
  if (!onChain) {
    return { ok: false, reason: "The contract has no record of this attestation yet." };
  }
  const transaction = await chain.getTransaction(input.transactionHash, input.issuerAccountId);
  if (!transaction) return { ok: false, reason: "The network does not know that transaction." };
  const matches =
    transaction.succeeded &&
    transaction.signerId === input.issuerAccountId &&
    transaction.receiverId === chain.contractId &&
    transaction.calls.some(
      (call) =>
        input.methods.includes(call.methodName) &&
        typeof call.args === "object" &&
        call.args !== null &&
        (call.args as Record<string, unknown>).token_id === input.tokenId,
    );
  if (!matches) {
    return { ok: false, reason: "That transaction is not a successful call for this attestation." };
  }
  return { ok: true, onChain };
}

/**
 * Records a mint, but only after reading it back from the contract: the token
 * must exist with the same digest, issued by the organisation's registered
 * account, and the reported transaction must be the one that did it.
 */
export async function confirmMint(
  db: Database,
  chain: ChainReader | null,
  network: NearNetwork,
  userId: string,
  attestationId: string,
  transactionHash: unknown,
): Promise<Result<{ ownerId: string }>> {
  const found = await loadForIssuer(db, userId, attestationId);
  if (!found) return NOT_FOUND;
  const { attestation, organisation, membership } = found;
  const allowed = canAnchorAttestation(membership, attestation);
  if (!allowed.allowed) return fail(allowed.reason);
  if (!chain) return NOT_CONFIGURED;
  if (typeof transactionHash !== "string" || !isValidTransactionHash(transactionHash)) {
    return fail("That is not a NEAR transaction hash.");
  }
  if (!organisation.nearIssuerAccountId) return fail("The organisation has no NEAR account.");
  const anchorStep = transitionAnchor(attestation.nearAnchorStatus, "confirm");
  if (!anchorStep.ok) return fail("This is already recorded as on NEAR.");

  let check: ChainCheck;
  try {
    check = await checkOnChain(chain, {
      tokenId: attestation.id,
      issuerAccountId: organisation.nearIssuerAccountId,
      transactionHash,
      methods: ["issue", "supersede"],
    });
  } catch (error) {
    if (error instanceof ChainUnavailableError) return UNREACHABLE;
    throw error;
  }
  if (!check.ok) return fail(check.reason);
  const { onChain } = check;
  if (onChain.digest !== attestation.payloadDigest) {
    return fail("The digest on NEAR does not match this record. Nothing was recorded.");
  }
  if (
    onChain.issuerId !== organisation.nearIssuerAccountId ||
    onChain.organisationId !== organisation.id
  ) {
    return fail("The token on NEAR was not issued by this organisation. Nothing was recorded.");
  }

  await db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await tx
      .update(attestations)
      .set({
        nearNetwork: network,
        nearContractId: chain.contractId,
        nearIssuerAccountId: onChain.issuerId,
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
      reason: "Minted on NEAR as a non-transferable NFT.",
      actorUserId: userId,
      nearTransactionHash: transactionHash,
    });
    await audit(t, userId, organisation.id, "attestation.minted", "attestation", attestation.id, {
      transactionHash,
      ownerId: onChain.ownerId,
    });
  });
  await notify(db, {
    userId: attestation.subjectUserId,
    type: "attestation.minted",
    title: `${organisation.name} issued your attestation on NEAR`,
    body: `It is in ${onChain.ownerId} as an NFT that cannot be transferred.`,
    href: `/dashboard/contributions/${attestation.contributionId}`,
  });
  return { ok: true, value: { ownerId: onChain.ownerId } };
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
  payload: AttestationPayloadV1 | null;
  recordFailure: SealedCheckFailure | null;
  digest: string;
  status: "active" | "revoked" | "superseded";
  issuedAt: Date;
  revokedAt: Date | null;
  issuer: { name: string; slug: string; reviewedByProofMe: boolean };
  /** Null when the contributor keeps their profile private. */
  subject: { displayName: string | null; username: string | null };
  near: {
    contractId: string | null;
    transactionHash: string | null;
    revocationTransactionHash: string | null;
  };
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
      reviewedByProofMe: organisation.platformVerificationStatus === "verified",
    },
    subject: {
      displayName: profile.visibility === "public" ? profile.displayName : null,
      username: profile.visibility === "public" ? profile.username : null,
    },
    near: {
      contractId: attestation.nearContractId,
      transactionHash: attestation.nearTransactionHash,
      revocationTransactionHash: attestation.nearRevocationTransactionHash,
    },
    chain: chainView,
  };
}
