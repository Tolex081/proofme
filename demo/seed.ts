/**
 * Local editorial fixture for the public Atesta verification demo.
 *
 * These values mirror the already minted public testnet sample so the narration
 * does not invent a new claim. The people, project, and issuer are fictional.
 * This fixture is never written to production or used to mint an NFT.
 */
export const demoSeed = {
  attestationId: "11cd86ff-7936-4ee1-9927-2e1cf4e027ca",
  project: "VitaRecall",
  claimant: "Daniel Okafor",
  role: "Sole Developer",
  workType: "Hackathon achievement",
  issuer: "Northstar Protocol",
  tokenStatus: "active",
  transferable: false,
  network: "NEAR testnet",
  contract: "proofme-attest-1113.testnet",
  transaction:
    "https://testnet.nearblocks.io/txns/9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW",
  verificationUrl:
    "https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca",
  sampleDisclosure:
    "The sample people, project, and issuer are fictional. The NEAR testnet token and mint transaction are real.",
} as const;
