"use server";

import { refresh } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getChainReader, getNearConfig } from "@/lib/near/server";
import {
  confirmMint,
  linkIssuerAccount,
  prepareMint,
  prepareRevoke,
  refreshIssuerStatus,
  revokeAttestation,
  type MintRequest,
} from "@/server/services/near";

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

export async function linkIssuerAction(
  organisationId: string,
  slug: string,
  accountId: string,
): Promise<NearActionResult<{ status: string }>> {
  const user = await requireUser(path(slug));
  const db = await getDb();
  const linked = await linkIssuerAccount(db, user.id, organisationId, accountId);
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
