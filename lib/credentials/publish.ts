import { createHash } from "node:crypto";

/**
 * Publishing a credential's public document so it can be checked without
 * ProofMe.
 *
 * The document is the attestation's canonical text, byte for byte. Its
 * SHA-256 is therefore the digest already stored on NEAR, and the NEP-177
 * `reference_hash` is that same hash in Base64. Anyone holding the NFT can
 * fetch `reference`, hash it, compare with `reference_hash` and the on-chain
 * digest, and read the claim.
 */

export interface PublishedReference {
  /** `ipfs://<cid>` when pinned, else this site's https copy. */
  reference: string;
  /** Base64 SHA-256 of the exact bytes at `reference`. */
  referenceHash: string;
  durable: boolean;
}

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

/** Base64 SHA-256 of the canonical text: the NEP-177 reference_hash. */
export function referenceHashOf(canonicalPayload: string): string {
  return createHash("sha256").update(canonicalPayload, "utf8").digest("base64");
}

type Fetch = typeof fetch;

/**
 * Pins the document to IPFS through Pinata (public network) and returns its
 * `ipfs://` reference. Without a Pinata key, returns the site's own copy at
 * `/api/credentials/<id>`, marked not durable.
 */
export async function publishCredentialDocument(input: {
  attestationId: string;
  canonicalPayload: string;
  appUrl: string;
  pinataJwt: string | undefined;
  send?: Fetch;
}): Promise<PublishedReference> {
  const referenceHash = referenceHashOf(input.canonicalPayload);
  if (!input.pinataJwt) {
    return {
      reference: `${input.appUrl.replace(/\/$/, "")}/api/credentials/${input.attestationId}`,
      referenceHash,
      durable: false,
    };
  }
  const send = input.send ?? fetch;
  const form = new FormData();
  form.append("network", "public");
  form.append("name", `proofme-credential-${input.attestationId}.json`);
  form.append(
    "file",
    new Blob([input.canonicalPayload], { type: "application/json" }),
    `${input.attestationId}.json`,
  );
  let response: Response;
  try {
    response = await send("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { authorization: `Bearer ${input.pinataJwt}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new PublishError("IPFS pinning could not be reached. Nothing was published.");
  }
  if (!response.ok) {
    throw new PublishError(`IPFS pinning refused the upload (status ${response.status}).`);
  }
  const body = (await response.json().catch(() => null)) as { data?: { cid?: unknown } } | null;
  const cid = body?.data?.cid;
  if (typeof cid !== "string" || !/^[a-z0-9]{20,100}$/i.test(cid)) {
    throw new PublishError("IPFS pinning gave no content address. Nothing was published.");
  }
  return { reference: `ipfs://${cid}`, referenceHash, durable: true };
}

/** An https URL a browser can open for a reference. */
export function referenceUrl(reference: string, gateway: string): string {
  return reference.startsWith("ipfs://")
    ? `${gateway.replace(/\/$/, "")}/ipfs/${reference.slice("ipfs://".length)}`
    : reference;
}
