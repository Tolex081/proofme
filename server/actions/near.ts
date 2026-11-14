"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getChainReader, getNearConfig } from "@/lib/near/server";
import { publishCredentialDocument } from "@/lib/credentials/publish";
import { getEnv } from "@/lib/env";
import {
  consentToPublish,
  confirmMint,
  prepareMint,
  prepareRevoke,
  refreshIssuerStatus,
  revokeAttestation,
  type MintRequest,
} from "@/server/services/near";
import {
  createChallenge,
  proveContributorAccount,
  proveIssuerAccount,
  removeContributorAccount,
  type Challenge,
  type SignedProof,
} from "@/server/services/near-identity";
import { replaceAttestation } from "@/server/services/verification";
import { checkHolderAccess, type HolderAccess } from "@/server/services/holders";
import { HOLDER_CONTENT, type HolderContent } from "@/lib/holders/content";

export type HolderView = HolderAccess & { content: HolderContent | null };

/**
 * Server actions for the NEAR steps. The browser signs in the organisation's
 * wallet and reports back; each action authenticates itself and the service
 * re-checks everything against the contract before recording anything.
 */

export type NearActionResult<T = null> = { ok: true; value: T } | { ok: false; message: string };

const failed = (errors: Record<string, string>) => ({
  ok: false as const,
  message: errors.form ?? Object.values(errors)[0] ?? "That did not work.",
});

const path = (slug: string) => `/org/${slug}/attestations`;

/** The NEP-413 recipient: this site's host name. */
function recipient(): string {
  return new URL(getEnv().NEXT_PUBLIC_APP_URL).host;
}

export async function issuerChallengeAction(
  organisationId: string,
  slug: string,
  accountId: string,
): Promise<NearActionResult<Challenge>> {
  const user = await requireUser(path(slug));
  const result = await createChallenge(await getDb(), {
    purpose: "issuer_account",
    accountId,
    recipient: recipient(),
    userId: user.id,
    organisationId,
  });
  return result.ok ? result : failed(result.errors);
}

export async function proveIssuerAction(
  organisationId: string,
  slug: string,
  proof: SignedProof,
): Promise<NearActionResult<{ status: string }>> {
  const user = await requireUser(path(slug));
  const db = await getDb();
  const linked = await proveIssuerAccount(db, getChainReader(), user.id, organisationId, proof);
  if (!linked.ok) return failed(linked.errors);
  // See straight away whether the contract already knows this account.
  const checked = await refreshIssuerStatus(db, getChainReader(), user.id, organisationId);
  refresh();
  return { ok: true, value: { status: checked.ok ? checked.value.status : "linked" } };
}

export async function refreshIssuerAction(
  organisationId: string,
  slug: string,
): Promise<NearActionResult<{ status: string }>> {
  const user = await requireUser(path(slug));
  const result = await refreshIssuerStatus(
    await getDb(),
    getChainReader(),
    user.id,
    organisationId,
  );
  if (!result.ok) return failed(result.errors);
  refresh();
  return { ok: true, value: result.value };
}

export async function prepareMintAction(
  attestationId: string,
  slug: string,
): Promise<NearActionResult<MintRequest>> {
  const user = await requireUser(path(slug));
  const result = await prepareMint(await getDb(), getChainReader(), user.id, attestationId);
  return result.ok ? result : failed(result.errors);
}

export async function confirmMintAction(
  attestationId: string,
  slug: string,
  transactionHash: string,
): Promise<NearActionResult<{ ownerId: string }>> {
  const user = await requireUser(path(slug));
  const config = getNearConfig();
  const result = await confirmMint(
    await getDb(),
    getChainReader(),
    config?.network ?? "testnet",
    user.id,
    attestationId,
    transactionHash,
  );
  if (!result.ok) return failed(result.errors);
  refresh();
  return result;
}

export async function prepareRevokeAction(
  attestationId: string,
  slug: string,
  reason: string,
): Promise<
  NearActionResult<{ onChain: false } | { onChain: true; contractId: string; tokenId: string }>
> {
  const user = await requireUser(path(slug));
  const result = await prepareRevoke(
    await getDb(),
    getChainReader(),
    user.id,
    attestationId,
    reason,
  );
  return result.ok ? result : failed(result.errors);
}

export async function revokeAction(
  attestationId: string,
  slug: string,
  reason: string,
  transactionHash: string | null,
): Promise<NearActionResult> {
  const user = await requireUser(path(slug));
  const result = await revokeAttestation(await getDb(), getChainReader(), user.id, attestationId, {
    reason,
    transactionHash: transactionHash ?? undefined,
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return result;
}

// ── The contributor's own NEAR account and consent ──────────────────────────

export async function contributorChallengeAction(
  accountId: string,
): Promise<NearActionResult<Challenge>> {
  const user = await requireUser("/dashboard/identity");
  const result = await createChallenge(await getDb(), {
    purpose: "contributor_account",
    accountId,
    recipient: recipient(),
    userId: user.id,
  });
  return result.ok ? result : failed(result.errors);
}

export async function proveContributorAction(
  proof: SignedProof,
): Promise<NearActionResult<{ accountId: string }>> {
  const user = await requireUser("/dashboard/identity");
  const result = await proveContributorAccount(await getDb(), getChainReader(), user.id, proof);
  if (!result.ok) return failed(result.errors);
  refresh();
  return result;
}

export async function removeContributorAccountAction(): Promise<NearActionResult> {
  const user = await requireUser("/dashboard/identity");
  await removeContributorAccount(await getDb(), user.id);
  refresh();
  return { ok: true, value: null };
}

export async function consentToPublishAction(
  attestationId: string,
  contributionId: string,
): Promise<NearActionResult<{ reference: string; durable: boolean }>> {
  const user = await requireUser(`/dashboard/contributions/${contributionId}`);
  const env = getEnv();
  const result = await consentToPublish(await getDb(), user.id, attestationId, (attestation) =>
    publishCredentialDocument({
      attestationId: attestation.id,
      canonicalPayload: attestation.canonicalPayload,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      pinataJwt: env.PINATA_JWT,
    }),
  );
  if (!result.ok) return failed(result.errors);
  refresh();
  return result;
}

export async function correctAttestationAction(
  attestationId: string,
  slug: string,
  input: {
    title: string;
    summary: string;
    description: string;
    role: string;
    startDate: string;
    endDate: string;
    reason: string;
  },
): Promise<NearActionResult<{ attestationId: string; supersededNow: boolean }>> {
  const user = await requireUser(path(slug));
  const result = await replaceAttestation(await getDb(), user.id, attestationId, {
    ...input,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
  });
  if (!result.ok) return failed(result.errors);
  refresh();
  return result;
}

// ── Credential-gated access (no Atesta account needed) ─────────────────────

export async function holderChallengeAction(
  accountId: string,
): Promise<NearActionResult<Challenge>> {
  const result = await createChallenge(await getDb(), {
    purpose: "holder_access",
    accountId,
    recipient: recipient(),
  });
  return result.ok ? result : failed(result.errors);
}

export async function holderAccessAction(proof: SignedProof): Promise<HolderView> {
  const access = await checkHolderAccess(await getDb(), getChainReader(), proof);
  // The gated content leaves the server only when access is granted.
  return access.granted ? { ...access, content: HOLDER_CONTENT } : { ...access, content: null };
}
