import type { AttestationPayloadV1 } from "../attestations/payload";

/**
 * A sample attestation record used on the public website to demonstrate the
 * digest check. Everything in it is fictional: the person, the organisation
 * and the project do not exist, and the record is not anchored on NEAR.
 * Wherever it is shown, it is labelled as a sample.
 *
 * It is the same record as tests/fixtures/attestation-v1.canonical.txt, so the
 * digest below was computed independently of the application code.
 */
export const SAMPLE_ATTESTATION: AttestationPayloadV1 = {
  schema: "proofme.attestation.v1",
  id: "3f2b8c1e-5a47-4d09-9c1b-7e6a2d4f8b10",
  issuedAt: "2026-10-05T09:30:00.000Z",
  issuer: {
    organisationId: "8d5e2a90-1c3b-4f6d-8a7e-2b9c0d1e3f45",
    name: "Northstar Protocol (demo)",
    slug: "northstar-protocol",
  },
  subject: { profileId: "a0b1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d", username: "daniel-okafor" },
  project: { id: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e", name: "Open Grants Portal" },
  claim: {
    title: "Proposal review interface",
    summary: "Implemented the proposal review interface.",
    description: "Built the reviewer-facing proposal screen for the Café grants round.",
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
  reviewer: { id: "c7d8e9f0-a1b2-4c3d-9e4f-5a6b7c8d9e0f" },
  nonce: "00112233445566778899aabbccddeeff",
};

export const SAMPLE_ATTESTATION_DIGEST =
  "19a9ef20ce971b2394bf4523796f1508a10809d4598f1731bd9b3f6f886eb58d";

/** The fictional contributor's display name. Not part of the hashed record. */
export const SAMPLE_SUBJECT_DISPLAY_NAME = "Daniel Okafor";
