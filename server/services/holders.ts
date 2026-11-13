import { eq, inArray } from "drizzle-orm";

import type { Database } from "@/lib/db/client";
import { attestations, contributions, organisations } from "@/lib/db/schema";
import { ChainUnavailableError, type ChainAttestation, type ChainReader } from "@/lib/near/chain";
import { consumeChallenge, type SignedProof } from "./near-identity";

/**
 * Credential-gated access: what a ProofMe NFT lets its holder open elsewhere.
 *
 * The visitor does not need a ProofMe account. Their wallet signs a one-time
 * challenge (NEP-413), which proves they control the account right now; an
 * account typed into the browser is never trusted. The server then asks the
 * contract which credentials that account holds and grants access only for a
 * credential that is:
 *   - active on-chain (not revoked, not superseded);
 *   - issued by an account the contract lists as an active issuer;
 *   - issued by an organisation ProofMe has verified, through its proven,
 *     registered issuer account;
 *   - the same record ProofMe sealed (the on-chain digest matches).
 * The NFT is the key: holding it in the wallet is what opens the page.
 */

export type CredentialCheck = {
  tokenId: string;
  organisation: string | null;
  title: string | null;
  accepted: boolean;
  reason: string;
};

export type HolderAccess =
  | { granted: true; accountId: string; credentials: CredentialCheck[] }
  | { granted: false; accountId: string | null; reason: string; credentials: CredentialCheck[] };

function judge(
  token: ChainAttestation,
  record: { status: string; payloadDigest: string } | undefined,
  organisation:
    | {
        name: string;
        platformVerificationStatus: string;
        nearIssuerAccountId: string | null;
        nearIssuerVerifiedAt: Date | null;
      }
    | undefined,
): { accepted: boolean; reason: string } {
  if (token.status !== "active")
    return { accepted: false, reason: `It is ${token.status} on NEAR.` };
  if (token.issuerStatus !== "active") {
    return { accepted: false, reason: "Its issuer is suspended on the contract." };
  }
  if (!organisation || !record) {
    return { accepted: false, reason: "ProofMe has no record of this credential's issuer." };
  }
  if (organisation.platformVerificationStatus !== "verified") {
    return {
      accepted: false,
      reason: `ProofMe does not currently recognise ${organisation.name} as verified.`,
    };
  }
  if (organisation.nearIssuerAccountId !== token.issuerId || !organisation.nearIssuerVerifiedAt) {
    return {
      accepted: false,
      reason: "It was not issued by the organisation's proven issuer account.",
    };
  }
  if (record.payloadDigest !== token.digest) {
    return { accepted: false, reason: "The digest on NEAR does not match the sealed record." };
  }
  return { accepted: true, reason: `Active credential issued by ${organisation.name}.` };
}

export async function checkHolderAccess(
  db: Database,
  chain: ChainReader | null,
  proof: SignedProof,
): Promise<HolderAccess> {
  const proven = await consumeChallenge(db, chain, proof, { purpose: "holder_access" });
  if (!proven.ok) {
    return {
      granted: false,
      accountId: null,
      reason: proven.errors.form ?? "The signature could not be checked.",
      credentials: [],
    };
  }
  const accountId = proven.value.accountId;
  let tokens: ChainAttestation[];
  try {
    tokens = await chain!.getAttestationsForOwner(accountId);
  } catch (error) {
    if (error instanceof ChainUnavailableError) {
      return {
        granted: false,
        accountId,
        reason: "The NEAR network could not be reached, so access was not granted.",
        credentials: [],
      };
    }
    throw error;
  }

  const ids = tokens.map((token) => token.tokenId).filter((id) => /^[0-9a-f-]{36}$/.test(id));
  const records = ids.length
    ? await db
        .select({
          id: attestations.id,
          status: attestations.status,
          payloadDigest: attestations.payloadDigest,
          organisationId: attestations.issuerOrganisationId,
          title: contributions.title,
          visibility: contributions.visibility,
        })
        .from(attestations)
        .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
        .where(inArray(attestations.id, ids))
    : [];
  const orgIds = [...new Set(records.map((record) => record.organisationId))];
  const orgs = orgIds.length
    ? await db.select().from(organisations).where(inArray(organisations.id, orgIds))
    : [];

  const credentials = tokens.map((token): CredentialCheck => {
    const record = records.find((row) => row.id === token.tokenId);
    const organisation = orgs.find((org) => org.id === record?.organisationId);
    const verdict = judge(token, record, organisation);
    return {
      tokenId: token.tokenId,
      organisation: organisation?.name ?? null,
      title: record?.visibility === "public" ? record.title : null,
      ...verdict,
    };
  });
  if (credentials.some((credential) => credential.accepted)) {
    return { granted: true, accountId, credentials };
  }
  return {
    granted: false,
    accountId,
    reason:
      tokens.length === 0
        ? `${accountId} holds no ProofMe credentials.`
        : `None of the ProofMe credentials in ${accountId} is currently valid.`,
    credentials,
  };
}

/**
 * A published credential's public document, byte for byte, for anyone to
 * fetch and hash. Only for records the contributor agreed to publish, whose
 * contribution is public.
 */
export async function getPublishedDocument(
  db: Database,
  attestationId: string,
): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attestationId)) return null;
  const [row] = await db
    .select({ attestation: attestations, visibility: contributions.visibility })
    .from(attestations)
    .innerJoin(contributions, eq(contributions.id, attestations.contributionId))
    .where(eq(attestations.id, attestationId.toLowerCase()));
  if (!row || row.visibility !== "public" || !row.attestation.subjectConsentedAt) return null;
  return row.attestation.canonicalPayload;
}
