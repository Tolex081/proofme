import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { auditEvents, nearChallenges, organisations, userProfiles } from "@/lib/db/schema";
import { ChainUnavailableError, isValidAccountId, type ChainReader } from "@/lib/near/chain";
import { verifyNep413Signature } from "@/lib/near/nep413";
import { canInOrganisation } from "@/lib/permissions/organisation";
import { getMembership } from "./organisations";

/**
 * Proving control of a NEAR account with a NEP-413 signed message.
 *
 * Atesta never trusts an account ID typed into a form or reported by the
 * browser. The server issues a one-time challenge for one account and one
 * purpose; the wallet signs it; the server checks the signature and then asks
 * the network whether the signing key is a full-access key of that account.
 * Only then is the account recorded.
 */

export type ChallengePurpose = "contributor_account" | "issuer_account" | "holder_access";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

const fail = (form: string) => ({ ok: false as const, errors: { form } });
const CHALLENGE_TTL_MS = 10 * 60 * 1000;

async function audit(
  db: Database,
  actorUserId: string,
  organisationId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await db
    .insert(auditEvents)
    .values({ actorUserId, organisationId, action, entityType, entityId, metadata });
}

export interface Challenge {
  challengeId: string;
  accountId: string;
  message: string;
  /** Base64 of the 32-byte nonce the wallet must sign. */
  nonce: string;
  recipient: string;
}

export interface SignedProof {
  challengeId: unknown;
  accountId: unknown;
  publicKey: unknown;
  signature: unknown;
}

const PURPOSE_TEXT: Record<ChallengePurpose, string> = {
  contributor_account: "receive Atesta credentials",
  issuer_account: "issue Atesta credentials for an organisation",
  holder_access: "open a page for Atesta credential holders",
};

/** A fresh, single-use challenge for `accountId`. */
export async function createChallenge(
  db: Database,
  input: {
    purpose: ChallengePurpose;
    accountId: unknown;
    recipient: string;
    userId?: string | null;
    organisationId?: string | null;
  },
): Promise<Result<Challenge>> {
  const accountId = typeof input.accountId === "string" ? input.accountId.trim() : "";
  if (!isValidAccountId(accountId)) return fail("That is not a valid NEAR account.");
  const nonce = randomBytes(32).toString("base64");
  const message =
    `Atesta: I control ${accountId} and want to ${PURPOSE_TEXT[input.purpose]}. ` +
    `This signature is not a transaction and moves no funds.`;
  const [row] = await db
    .insert(nearChallenges)
    .values({
      userId: input.userId ?? null,
      organisationId: input.organisationId ?? null,
      purpose: input.purpose,
      accountId,
      nonce,
      message,
      recipient: input.recipient,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning();
  return {
    ok: true,
    value: { challengeId: row.id, accountId, message, nonce, recipient: input.recipient },
  };
}

/**
 * Checks a signed challenge and uses it up. Succeeds only if the challenge is
 * this user's, for this purpose and account, unexpired and unused; the
 * signature is valid; and the key is a full-access key of the account now.
 */
export async function consumeChallenge(
  db: Database,
  chain: ChainReader | null,
  proof: SignedProof,
  expected: {
    purpose: ChallengePurpose;
    userId?: string | null;
    organisationId?: string | null;
  },
): Promise<Result<{ accountId: string; publicKey: string }>> {
  if (!chain) return fail("NEAR is not set up on this site yet.");
  const { challengeId, accountId, publicKey, signature } = proof;
  if (
    typeof challengeId !== "string" ||
    typeof accountId !== "string" ||
    typeof publicKey !== "string" ||
    typeof signature !== "string" ||
    !/^[0-9a-f-]{36}$/.test(challengeId)
  ) {
    return fail("The signed message is incomplete.");
  }
  const [challenge] = await db
    .select()
    .from(nearChallenges)
    .where(eq(nearChallenges.id, challengeId));
  const sameOwner =
    challenge &&
    challenge.purpose === expected.purpose &&
    (challenge.userId ?? null) === (expected.userId ?? null) &&
    (challenge.organisationId ?? null) === (expected.organisationId ?? null);
  if (!challenge || !sameOwner) return fail("That challenge is not valid. Start again.");
  if (challenge.usedAt) return fail("That challenge was already used. Start again.");
  if (challenge.expiresAt.getTime() <= Date.now())
    return fail("That challenge expired. Start again.");
  if (challenge.accountId !== accountId) {
    return fail(
      `The wallet signed as ${accountId}, but the challenge was for ${challenge.accountId}.`,
    );
  }

  const valid = verifyNep413Signature({
    payload: {
      message: challenge.message,
      nonce: Buffer.from(challenge.nonce, "base64"),
      recipient: challenge.recipient,
    },
    publicKey,
    signature,
  });
  if (!valid) return fail("The signature does not match the challenge.");

  try {
    if (!(await chain.hasFullAccessKey(accountId, publicKey))) {
      return fail(`The signing key is not a full-access key of ${accountId}.`);
    }
  } catch (error) {
    if (error instanceof ChainUnavailableError) {
      return fail("The NEAR network could not be reached. Try again in a moment.");
    }
    throw error;
  }

  // Single use, even if two requests race with the same signature.
  const used = await db
    .update(nearChallenges)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(nearChallenges.id, challenge.id),
        isNull(nearChallenges.usedAt),
        gt(nearChallenges.expiresAt, new Date()),
      ),
    )
    .returning({ id: nearChallenges.id });
  if (used.length === 0) return fail("That challenge was already used. Start again.");
  return { ok: true, value: { accountId, publicKey } };
}

/** Records the contributor's NEAR account, proven by a signed challenge. */
export async function proveContributorAccount(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  proof: SignedProof,
): Promise<Result<{ accountId: string }>> {
  const checked = await consumeChallenge(db, chain, proof, {
    purpose: "contributor_account",
    userId,
  });
  if (!checked.ok) return checked;
  const updated = await db
    .update(userProfiles)
    .set({
      nearAccountId: checked.value.accountId,
      nearAccountPublicKey: checked.value.publicKey,
      nearAccountVerifiedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId))
    .returning({ id: userProfiles.id });
  if (updated.length === 0) return fail("Set up your profile first.");
  await audit(db, userId, null, "near_account.verified", "user", userId, {
    accountId: checked.value.accountId,
  });
  return { ok: true, value: { accountId: checked.value.accountId } };
}

/** Removes the contributor's NEAR account. Credentials already minted stay where they are. */
export async function removeContributorAccount(db: Database, userId: string): Promise<void> {
  await db
    .update(userProfiles)
    .set({ nearAccountId: null, nearAccountPublicKey: null, nearAccountVerifiedAt: null })
    .where(eq(userProfiles.userId, userId));
  await audit(db, userId, null, "near_account.removed", "user", userId, {});
}

/**
 * Records the organisation's issuer account, proven by a signed challenge.
 * Only an owner may do this. Choosing a different account resets the issuer
 * status: Atesta must register the new account on the contract again.
 */
export async function proveIssuerAccount(
  db: Database,
  chain: ChainReader | null,
  userId: string,
  organisationId: string,
  proof: SignedProof,
): Promise<Result<{ accountId: string }>> {
  const membership = await getMembership(db, userId, organisationId);
  if (!canInOrganisation(membership, organisationId, "issuer.configure").allowed) {
    return fail("Only an owner can choose the organisation's NEAR account.");
  }
  const checked = await consumeChallenge(db, chain, proof, {
    purpose: "issuer_account",
    userId,
    organisationId,
  });
  if (!checked.ok) return checked;
  const [current] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId));
  const sameAccount = current?.nearIssuerAccountId === checked.value.accountId;
  await db
    .update(organisations)
    .set({
      nearIssuerAccountId: checked.value.accountId,
      nearIssuerVerifiedAt: new Date(),
      nearIssuerStatus: sameAccount ? current.nearIssuerStatus : "linked",
    })
    .where(eq(organisations.id, organisationId));
  await audit(db, userId, organisationId, "issuer.linked", "organisation", organisationId, {
    accountId: checked.value.accountId,
    provenBySignature: true,
  });
  return { ok: true, value: { accountId: checked.value.accountId } };
}

export type IssuerEligibility =
  | { eligible: true }
  | { eligible: false; reason: string; step: "verify_organisation" | "prove_account" | "register" };

/**
 * The issuer trust policy in one place. An organisation may issue recognised
 * credentials only when all three hold:
 *   1. Atesta has verified the organisation (platform status "verified");
 *   2. an owner proved control of the issuer account with a signed message;
 *   3. the contract lists that account as this organisation's active issuer.
 * A linked NEAR account on its own is never enough.
 */
export function issuerEligibility(organisation: {
  platformVerificationStatus: string;
  nearIssuerAccountId: string | null;
  nearIssuerVerifiedAt: Date | null;
  nearIssuerStatus: string;
}): IssuerEligibility {
  if (organisation.platformVerificationStatus !== "verified") {
    return {
      eligible: false,
      step: "verify_organisation",
      reason:
        organisation.platformVerificationStatus === "suspended"
          ? "Atesta has suspended this organisation, so it cannot issue credentials."
          : "Atesta has not verified this organisation yet, so it cannot issue credentials.",
    };
  }
  if (!organisation.nearIssuerAccountId || !organisation.nearIssuerVerifiedAt) {
    return {
      eligible: false,
      step: "prove_account",
      reason:
        "An owner must connect the issuer account and sign to prove the organisation controls it.",
    };
  }
  if (organisation.nearIssuerStatus !== "registered") {
    return {
      eligible: false,
      step: "register",
      reason:
        organisation.nearIssuerStatus === "suspended"
          ? "The contract lists the issuer account as suspended."
          : "The contract does not list the issuer account as an active issuer yet.",
    };
  }
  return { eligible: true };
}

/** Whether a challenge for this account was created recently enough to reuse. Test helper. */
export async function pendingChallenges(db: Database, accountId: string) {
  return db
    .select()
    .from(nearChallenges)
    .where(and(eq(nearChallenges.accountId, accountId), isNull(nearChallenges.usedAt)));
}
