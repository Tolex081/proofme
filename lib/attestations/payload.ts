import { z } from "zod";

import { EVIDENCE_TYPES, validateEvidenceUrl } from "../urls/evidence";
import { canonicalize, DIGEST_PATTERN, sha256Hex, type JsonValue } from "./canonical";

/**
 * The Atesta attestation payload, schema version 1.
 *
 * This is the frozen record of what an issuer approved. It is built once at
 * approval, canonicalised, hashed, stored as text and never changed. Only its
 * digest and ID are written to NEAR.
 *
 * It deliberately contains no email address, legal name, reviewer note or
 * private evidence. The random nonce stops anyone confirming a guess about a
 * person by reconstructing the digest from public fields.
 *
 * This is a Atesta attestation with a NEAR anchor. It is not a W3C
 * Verifiable Credential and must not be described as one.
 */
export const ATTESTATION_SCHEMA_V1 = "proofme.attestation.v1";

export const CONTRIBUTION_CATEGORIES = [
  "development",
  "design",
  "research",
  "community_management",
  "content_documentation",
  "product_management",
  "project_management",
  "mentorship",
  "governance",
  "hackathon_achievement",
  "other",
] as const;

export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number];

const uuid = z.uuid();
const text = (max: number) => z.string().min(1).max(max);
const isoDate = z.iso.date();

const evidenceUrl = z
  .string()
  .refine((value) => validateEvidenceUrl(value, { allowLocalHttp: true }).ok, {
    message: "Evidence URL is not an accepted link",
  });

export const attestationPayloadV1Schema = z.strictObject({
  schema: z.literal(ATTESTATION_SCHEMA_V1),
  id: uuid,
  issuedAt: z.iso.datetime(),
  issuer: z.strictObject({
    organisationId: uuid,
    name: text(120),
    slug: text(60),
  }),
  subject: z.strictObject({
    profileId: uuid,
    username: text(30),
  }),
  project: z.strictObject({ id: uuid, name: text(120) }).nullable(),
  claim: z.strictObject({
    title: text(160),
    summary: text(400),
    description: text(8000),
    category: z.enum(CONTRIBUTION_CATEGORIES),
    role: text(120),
    skills: z.array(text(40)).max(20),
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
  }),
  evidence: z
    .array(
      z.strictObject({
        type: z.enum(EVIDENCE_TYPES),
        url: evidenceUrl,
        label: text(160),
      }),
    )
    .min(1)
    .max(20),
  reviewer: z.strictObject({ id: uuid }),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
});

export type AttestationPayloadV1 = z.infer<typeof attestationPayloadV1Schema>;

/**
 * Schema version 2: the public credential.
 *
 * Built for publication: the canonical text is pinned to content-addressed
 * storage and referenced from the NFT (NEP-177 `reference`), so anyone can
 * fetch and check it without Atesta. Compared with v1 it therefore carries
 * less: the contributor appears only as an opaque profile ID (no username),
 * only evidence the contributor marked public is included, and the reviewer's
 * user ID is left out (the issuing organisation is the accountable party). It
 * may cite the Evidence Agent report the reviewer saw, by ID and digest only.
 */
export const ATTESTATION_SCHEMA_V2 = "proofme.attestation.v2";

export const attestationPayloadV2Schema = z.strictObject({
  schema: z.literal(ATTESTATION_SCHEMA_V2),
  id: uuid,
  issuedAt: z.iso.datetime(),
  issuer: z.strictObject({
    organisationId: uuid,
    name: text(120),
    slug: text(60),
  }),
  subject: z.strictObject({ profileId: uuid }),
  project: z.strictObject({ id: uuid, name: text(120) }).nullable(),
  claim: z.strictObject({
    title: text(160),
    summary: text(400),
    description: text(8000),
    category: z.enum(CONTRIBUTION_CATEGORIES),
    role: text(120),
    skills: z.array(text(40)).max(20),
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
  }),
  evidence: z
    .array(
      z.strictObject({
        type: z.enum(EVIDENCE_TYPES),
        url: evidenceUrl,
        label: text(160),
      }),
    )
    .max(20),
  evidenceInvestigation: z
    .strictObject({
      id: uuid,
      version: z.number().int().min(1),
      reportDigest: z.string().regex(/^[0-9a-f]{64}$/),
    })
    .nullable(),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
});

export type AttestationPayloadV2 = z.infer<typeof attestationPayloadV2Schema>;
export type AttestationPayload = AttestationPayloadV1 | AttestationPayloadV2;

export interface AttestationPayloadV2Input {
  id: string;
  issuedAt: Date;
  issuer: { organisationId: string; name: string; slug: string };
  subject: { profileId: string };
  project: { id: string; name: string } | null;
  claim: AttestationPayloadInput["claim"];
  /** Only evidence the contributor marked public. The caller filters; this is checked. */
  evidence: {
    type: (typeof EVIDENCE_TYPES)[number];
    url: string;
    label: string;
    visibility: "public" | "private";
  }[];
  evidenceInvestigation: { id: string; version: number; reportDigest: string } | null;
  nonce: string;
}

export interface AttestationPayloadInput {
  id: string;
  issuedAt: Date;
  issuer: { organisationId: string; name: string; slug: string };
  subject: { profileId: string; username: string };
  project: { id: string; name: string } | null;
  claim: {
    title: string;
    summary: string;
    description: string;
    category: ContributionCategory;
    role: string;
    skills: string[];
    startDate: string | null;
    endDate: string | null;
  };
  evidence: { type: (typeof EVIDENCE_TYPES)[number]; url: string; label: string }[];
  reviewerId: string;
  nonce: string;
}

/** 128 bits of randomness as 32 lowercase hex characters. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Free text is trimmed and put in Unicode NFC so that visually identical input
// always produces the same bytes. Done once, here, before the record is frozen.
function clean(value: string): string {
  return value.normalize("NFC").trim();
}

/**
 * Builds and validates a v1 payload. Throws a ZodError if the input cannot
 * form a valid attestation; callers approve a claim only after this succeeds.
 */
export function buildAttestationPayload(input: AttestationPayloadInput): AttestationPayloadV1 {
  if (Number.isNaN(input.issuedAt.getTime())) {
    throw new TypeError("issuedAt is not a valid date");
  }
  return attestationPayloadV1Schema.parse({
    schema: ATTESTATION_SCHEMA_V1,
    id: input.id,
    issuedAt: input.issuedAt.toISOString(),
    issuer: {
      organisationId: input.issuer.organisationId,
      name: clean(input.issuer.name),
      slug: input.issuer.slug,
    },
    subject: { profileId: input.subject.profileId, username: input.subject.username },
    project: input.project ? { id: input.project.id, name: clean(input.project.name) } : null,
    claim: {
      title: clean(input.claim.title),
      summary: clean(input.claim.summary),
      description: clean(input.claim.description),
      category: input.claim.category,
      role: clean(input.claim.role),
      skills: input.claim.skills.map(clean),
      startDate: input.claim.startDate,
      endDate: input.claim.endDate,
    },
    evidence: input.evidence.map((item) => ({
      type: item.type,
      url: item.url,
      label: clean(item.label),
    })),
    reviewer: { id: input.reviewerId },
    nonce: input.nonce,
  });
}

/**
 * Builds and validates a v2 (public credential) payload. Private evidence is
 * refused rather than silently dropped, so a caller cannot leak it by mistake.
 */
export function buildAttestationPayloadV2(input: AttestationPayloadV2Input): AttestationPayloadV2 {
  if (Number.isNaN(input.issuedAt.getTime())) {
    throw new TypeError("issuedAt is not a valid date");
  }
  if (input.evidence.some((item) => item.visibility !== "public")) {
    throw new TypeError("A public credential cannot include private evidence");
  }
  return attestationPayloadV2Schema.parse({
    schema: ATTESTATION_SCHEMA_V2,
    id: input.id,
    issuedAt: input.issuedAt.toISOString(),
    issuer: {
      organisationId: input.issuer.organisationId,
      name: clean(input.issuer.name),
      slug: input.issuer.slug,
    },
    subject: { profileId: input.subject.profileId },
    project: input.project ? { id: input.project.id, name: clean(input.project.name) } : null,
    claim: {
      title: clean(input.claim.title),
      summary: clean(input.claim.summary),
      description: clean(input.claim.description),
      category: input.claim.category,
      role: clean(input.claim.role),
      skills: input.claim.skills.map(clean),
      startDate: input.claim.startDate,
      endDate: input.claim.endDate,
    },
    evidence: input.evidence.map((item) => ({
      type: item.type,
      url: item.url,
      label: clean(item.label),
    })),
    evidenceInvestigation: input.evidenceInvestigation,
    nonce: input.nonce,
  });
}

export interface SealedAttestation {
  schemaVersion: typeof ATTESTATION_SCHEMA_V1 | typeof ATTESTATION_SCHEMA_V2;
  /** The exact text that was hashed. Stored verbatim and never rewritten. */
  canonicalPayload: string;
  /** SHA-256 of `canonicalPayload`, lowercase hex. */
  digest: string;
}

function schemaFor(value: unknown) {
  const tag =
    typeof value === "object" && value !== null ? (value as { schema?: unknown }).schema : null;
  return tag === ATTESTATION_SCHEMA_V2 ? attestationPayloadV2Schema : attestationPayloadV1Schema;
}

export async function sealAttestation(payload: AttestationPayload): Promise<SealedAttestation> {
  const validated = schemaFor(payload).parse(payload);
  const canonicalPayload = canonicalize(validated as JsonValue);
  return {
    schemaVersion: validated.schema,
    canonicalPayload,
    digest: await sha256Hex(canonicalPayload),
  };
}

export type SealedCheckFailure =
  | "digest_malformed"
  | "digest_mismatch"
  | "payload_not_json"
  | "payload_invalid"
  | "payload_not_canonical";

export type SealedCheckResult =
  | { ok: true; payload: AttestationPayload; digest: string }
  | { ok: false; failure: SealedCheckFailure; computedDigest: string | null };

/**
 * Independently re-checks a stored attestation against a digest obtained from
 * somewhere else (the database column, or the NEAR registry).
 *
 * It recomputes the digest over the stored text, then confirms the text is a
 * valid v1 or v2 payload in canonical form, so a record cannot pass by hashing
 * correctly while carrying extra, reordered or malformed content.
 */
export async function checkSealedAttestation(
  canonicalPayload: string,
  expectedDigest: string,
): Promise<SealedCheckResult> {
  if (!DIGEST_PATTERN.test(expectedDigest)) {
    return { ok: false, failure: "digest_malformed", computedDigest: null };
  }
  const computedDigest = await sha256Hex(canonicalPayload);
  if (computedDigest !== expectedDigest) {
    return { ok: false, failure: "digest_mismatch", computedDigest };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalPayload);
  } catch {
    return { ok: false, failure: "payload_not_json", computedDigest };
  }
  const validated = schemaFor(parsed).safeParse(parsed);
  if (!validated.success) {
    return { ok: false, failure: "payload_invalid", computedDigest };
  }
  if (canonicalize(validated.data as JsonValue) !== canonicalPayload) {
    return { ok: false, failure: "payload_not_canonical", computedDigest };
  }
  return { ok: true, payload: validated.data, digest: computedDigest };
}
