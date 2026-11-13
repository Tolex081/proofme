import { describe, expect, it } from "vitest";

import {
  buildAttestationPayloadV2,
  checkSealedAttestation,
  sealAttestation,
  type AttestationPayloadV2Input,
} from "@/lib/attestations/payload";
import {
  publishCredentialDocument,
  referenceHashOf,
  referenceUrl,
} from "@/lib/credentials/publish";

const input: AttestationPayloadV2Input = {
  id: "5d7c1c0e-2f4a-4d53-8f43-0a6f3f1f9b01",
  issuedAt: new Date("2026-11-12T10:00:00Z"),
  issuer: {
    organisationId: "11111111-1111-4111-8111-111111111111",
    name: "Northstar Protocol",
    slug: "northstar-protocol",
  },
  subject: { profileId: "22222222-2222-4222-8222-222222222222" },
  project: null,
  claim: {
    title: "Proposal review interface",
    summary: "Built the reviewer screen.",
    description: "Designed and implemented it.",
    category: "development",
    role: "Frontend engineer",
    skills: ["TypeScript"],
    startDate: null,
    endDate: null,
  },
  evidence: [
    {
      type: "github_pr",
      url: "https://github.com/northstar-demo/portal/pull/42",
      label: "PR #42",
      visibility: "public",
    },
  ],
  evidenceInvestigation: null,
  nonce: "0123456789abcdef0123456789abcdef",
};

describe("the v2 public credential", () => {
  it("names the contributor only by an opaque profile ID and omits the reviewer", async () => {
    const sealed = await sealAttestation(buildAttestationPayloadV2(input));
    expect(sealed.schemaVersion).toBe("proofme.attestation.v2");
    expect(sealed.canonicalPayload).not.toContain('"username"');
    expect(sealed.canonicalPayload).not.toContain('"reviewer"');
    const check = await checkSealedAttestation(sealed.canonicalPayload, sealed.digest);
    expect(check.ok).toBe(true);
  });

  it("refuses private evidence instead of silently publishing or dropping it", () => {
    expect(() =>
      buildAttestationPayloadV2({
        ...input,
        evidence: [{ ...input.evidence[0], visibility: "private" }],
      }),
    ).toThrow();
  });

  it("can cite the Evidence Agent report by ID and digest", async () => {
    const payload = buildAttestationPayloadV2({
      ...input,
      evidenceInvestigation: {
        id: "33333333-3333-4333-8333-333333333333",
        version: 2,
        reportDigest: "a".repeat(64),
      },
    });
    expect(payload.evidenceInvestigation?.version).toBe(2);
  });
});

describe("publishing the credential document", () => {
  it("its reference_hash is the on-chain digest in Base64", async () => {
    const sealed = await sealAttestation(buildAttestationPayloadV2(input));
    expect(referenceHashOf(sealed.canonicalPayload)).toBe(
      Buffer.from(sealed.digest, "hex").toString("base64"),
    );
  });

  it("pins to IPFS when Pinata is configured, sending the exact bytes", async () => {
    const sealed = await sealAttestation(buildAttestationPayloadV2(input));
    let sent = "";
    const published = await publishCredentialDocument({
      attestationId: input.id,
      canonicalPayload: sealed.canonicalPayload,
      appUrl: "https://proofme.example",
      pinataJwt: "test-jwt-not-real-000000",
      send: async (_url, init) => {
        sent = await ((init?.body as FormData).get("file") as Blob).text();
        return new Response(JSON.stringify({ data: { cid: "bafkreiabcdefghijklmnopqrstuvwxyz" } }));
      },
    });
    expect(sent).toBe(sealed.canonicalPayload);
    expect(published).toMatchObject({
      reference: "ipfs://bafkreiabcdefghijklmnopqrstuvwxyz",
      durable: true,
    });
    expect(referenceUrl(published.reference, "https://gw.example")).toBe(
      "https://gw.example/ipfs/bafkreiabcdefghijklmnopqrstuvwxyz",
    );
  });

  it("falls back to this site's copy, marked not durable, without Pinata", async () => {
    const published = await publishCredentialDocument({
      attestationId: input.id,
      canonicalPayload: "{}",
      appUrl: "https://proofme.example/",
      pinataJwt: undefined,
    });
    expect(published).toMatchObject({
      reference: `https://proofme.example/api/credentials/${input.id}`,
      durable: false,
    });
  });

  it("fails loudly when pinning fails", async () => {
    await expect(
      publishCredentialDocument({
        attestationId: input.id,
        canonicalPayload: "{}",
        appUrl: "https://proofme.example",
        pinataJwt: "test-jwt-not-real-000000",
        send: async () => new Response("nope", { status: 401 }),
      }),
    ).rejects.toThrow(/refused/);
  });
});
