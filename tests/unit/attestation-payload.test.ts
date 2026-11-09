import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { canonicalize, CanonicalizationError, sha256Hex } from "@/lib/attestations/canonical";
import {
  ATTESTATION_SCHEMA_V1,
  buildAttestationPayload,
  checkSealedAttestation,
  generateNonce,
  sealAttestation,
  type AttestationPayloadInput,
} from "@/lib/attestations/payload";

// Written by hand, not produced by the code under test. Its digest was computed
// independently with `sha256sum`.
const FIXTURE_CANONICAL = readFileSync(
  fileURLToPath(new URL("../fixtures/attestation-v1.canonical.txt", import.meta.url)),
  "utf8",
);
const FIXTURE_DIGEST = "19a9ef20ce971b2394bf4523796f1508a10809d4598f1731bd9b3f6f886eb58d";

function fixtureInput(): AttestationPayloadInput {
  return {
    id: "3f2b8c1e-5a47-4d09-9c1b-7e6a2d4f8b10",
    issuedAt: new Date("2026-10-05T09:30:00Z"),
    issuer: {
      organisationId: "8d5e2a90-1c3b-4f6d-8a7e-2b9c0d1e3f45",
      name: "Northstar Protocol (demo)",
      slug: "northstar-protocol",
    },
    subject: { profileId: "a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d", username: "daniel-okafor" },
    project: { id: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e", name: "Open Grants Portal" },
    claim: {
      title: "  Proposal review interface ",
      summary: "Implemented the proposal review interface.",
      // "é" supplied as "e" + combining acute accent; must be stored precomposed.
      description: "Built the reviewer-facing proposal screen for the Café grants round.",
      category: "development",
      role: "Frontend engineer",
      skills: ["TypeScript", "React"],
      startDate: "2026-07-01",
      endDate: "2026-09-30",
    },
    evidence: [
      {
        type: "github_pr",
        url: "https://github.com/northstar-demo/open-grants-portal/pull/42",
        label: "Pull request #42",
      },
    ],
    reviewerId: "c7d8e9f0-a1b2-4c3d-9e4f-5a6b7c8d9e0f",
    nonce: "00112233445566778899aabbccddeeff",
  };
}

describe("canonicalize (RFC 8785)", () => {
  it("sorts keys by UTF-16 code units, as in the RFC's sorting example", () => {
    const input = {
      "€": "Euro Sign",
      "\r": "Carriage Return",
      דּ: "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      "😀": "Emoji: Grinning Face",
      "\u0080": "Control",
      ö: "Latin Small Letter O With Diaeresis",
    };
    const keysInOutput = Object.keys(JSON.parse(canonicalize(input)));
    expect(keysInOutput).toEqual(["1", "\r", "\u0080", "ö", "€", "😀", "דּ"]);
    expect(canonicalize(input).startsWith('{"\\r":"Carriage Return","1":"One"')).toBe(true);
  });

  it("serialises numbers and literals as the RFC's example does", () => {
    const input = {
      numbers: [333333333.3333333, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
      string: '€$\u000f\nA\'B"\\\\"/',
      literals: [null, true, false],
    };
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        '"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    );
  });

  it("is independent of key insertion order and emits no whitespace", () => {
    const a = canonicalize({ b: 1, a: { d: [1, 2], c: null } });
    const b = canonicalize({ a: { c: null, d: [1, 2] }, b: 1 });
    expect(a).toBe('{"a":{"c":null,"d":[1,2]},"b":1}');
    expect(b).toBe(a);
  });

  it("keeps array order, because order in an array is meaningful", () => {
    expect(canonicalize(["b", "a"])).toBe('["b","a"]');
  });

  it("rejects values that have no canonical JSON form", () => {
    const bad: unknown[] = [
      { a: undefined },
      { a: Number.NaN },
      { a: Number.POSITIVE_INFINITY },
      { a: new Date(0) },
      { a: new Map() },
      { a: () => 1 },
      { a: BigInt(10) },
      { a: "lone surrogate \ud800" },
      { "\udc00": 1 },
      { a: [1, , 3] },
    ];
    for (const value of bad) {
      expect(() => canonicalize(value as never)).toThrow(CanonicalizationError);
    }
  });
});

describe("sha256Hex", () => {
  it("matches published SHA-256 test vectors", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes UTF-8 bytes, agreeing with an independent implementation", async () => {
    const text = "Café — 証明";
    expect(await sha256Hex(text)).toBe(createHash("sha256").update(text, "utf8").digest("hex"));
  });
});

describe("attestation payload v1", () => {
  it("produces exactly the hand-written canonical text and its known digest", async () => {
    const sealed = await sealAttestation(buildAttestationPayload(fixtureInput()));
    expect(sealed.schemaVersion).toBe(ATTESTATION_SCHEMA_V1);
    expect(sealed.canonicalPayload).toBe(FIXTURE_CANONICAL);
    expect(sealed.digest).toBe(FIXTURE_DIGEST);
  });

  it("gives the same digest every time for the same approved record", async () => {
    const first = await sealAttestation(buildAttestationPayload(fixtureInput()));
    const second = await sealAttestation(buildAttestationPayload(fixtureInput()));
    expect(second).toEqual(first);
  });

  it("trims text and normalises it to NFC before freezing", () => {
    const payload = buildAttestationPayload(fixtureInput());
    expect(payload.claim.title).toBe("Proposal review interface");
    expect(payload.claim.description).toContain("Café");
    expect(payload.claim.description).not.toContain("́");
  });

  it("changes the digest when any part of the claim changes", async () => {
    const base = await sealAttestation(buildAttestationPayload(fixtureInput()));
    const variants: ((input: AttestationPayloadInput) => void)[] = [
      (input) => (input.claim.title = "Proposal review interface v2"),
      (input) => (input.claim.role = "Lead engineer"),
      (input) => (input.claim.skills = ["React", "TypeScript"]),
      (input) =>
        (input.evidence[0].url = "https://github.com/northstar-demo/open-grants-portal/pull/43"),
      (input) => (input.issuer.name = "Northstar Protocol"),
      (input) => (input.subject.username = "someone-else"),
      (input) => (input.project = null),
      (input) => (input.issuedAt = new Date("2026-10-05T09:30:00.001Z")),
      (input) => (input.nonce = "ffeeddccbbaa99887766554433221100"),
    ];
    for (const mutate of variants) {
      const input = fixtureInput();
      mutate(input);
      const sealed = await sealAttestation(buildAttestationPayload(input));
      expect(sealed.digest).not.toBe(base.digest);
    }
  });

  it("refuses input that cannot form a valid attestation", () => {
    const cases: ((input: AttestationPayloadInput) => void)[] = [
      (input) => (input.id = "not-a-uuid"),
      (input) => (input.claim.title = "   "),
      (input) => (input.evidence = []),
      (input) => (input.evidence[0].url = "javascript:alert(1)"),
      (input) => (input.evidence[0].url = "http://example.com/"),
      (input) => (input.claim.category = "wizardry" as never),
      (input) => (input.claim.startDate = "July 2026"),
      (input) => (input.nonce = "short"),
      (input) => (input.nonce = "00112233445566778899AABBCCDDEEFF"),
    ];
    for (const mutate of cases) {
      const input = fixtureInput();
      mutate(input);
      expect(() => buildAttestationPayload(input)).toThrow();
    }
    const badDate = fixtureInput();
    badDate.issuedAt = new Date("nonsense");
    expect(() => buildAttestationPayload(badDate)).toThrow(TypeError);
  });

  it("never carries private fields, even if a caller passes extra data", () => {
    const input = {
      ...fixtureInput(),
      email: "daniel@example.com",
      internalNote: "reviewer-only note",
    };
    const payload = buildAttestationPayload(input);
    const text = JSON.stringify(payload);
    expect(text).not.toContain("daniel@example.com");
    expect(text).not.toContain("reviewer-only note");
  });

  it("generates 128-bit lowercase hex nonces that differ each time", () => {
    const first = generateNonce();
    const second = generateNonce();
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
    expect(first).not.toBe(second);
  });
});

describe("checkSealedAttestation", () => {
  it("accepts the stored text when the digest matches", async () => {
    const result = await checkSealedAttestation(FIXTURE_CANONICAL, FIXTURE_DIGEST);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.claim.title).toBe("Proposal review interface");
      expect(result.digest).toBe(FIXTURE_DIGEST);
    }
  });

  it("reports a mismatch when the stored text was altered", async () => {
    const tampered = FIXTURE_CANONICAL.replace("Frontend engineer", "Principal engineer");
    const result = await checkSealedAttestation(tampered, FIXTURE_DIGEST);
    expect(result).toMatchObject({ ok: false, failure: "digest_mismatch" });
  });

  it("reports a mismatch when the expected digest is a different record's", async () => {
    const other = await sha256Hex("something else");
    const result = await checkSealedAttestation(FIXTURE_CANONICAL, other);
    expect(result).toMatchObject({ ok: false, failure: "digest_mismatch" });
  });

  it("rejects malformed digests without hashing", async () => {
    for (const digest of ["", "abc", FIXTURE_DIGEST.toUpperCase(), `0x${FIXTURE_DIGEST}`]) {
      const result = await checkSealedAttestation(FIXTURE_CANONICAL, digest);
      expect(result).toEqual({ ok: false, failure: "digest_malformed", computedDigest: null });
    }
  });

  it("rejects text that hashes correctly but is not a canonical v1 payload", async () => {
    const notJson = "this is not json";
    expect(await checkSealedAttestation(notJson, await sha256Hex(notJson))).toMatchObject({
      ok: false,
      failure: "payload_not_json",
    });

    const wrongShape = '{"schema":"proofme.attestation.v1"}';
    expect(await checkSealedAttestation(wrongShape, await sha256Hex(wrongShape))).toMatchObject({
      ok: false,
      failure: "payload_invalid",
    });

    const extraField = FIXTURE_CANONICAL.replace('{"claim":', '{"admin":true,"claim":');
    expect(await checkSealedAttestation(extraField, await sha256Hex(extraField))).toMatchObject({
      ok: false,
      failure: "payload_invalid",
    });

    const reformatted = JSON.stringify(JSON.parse(FIXTURE_CANONICAL), null, 2);
    expect(await checkSealedAttestation(reformatted, await sha256Hex(reformatted))).toMatchObject({
      ok: false,
      failure: "payload_not_canonical",
    });
  });
});
