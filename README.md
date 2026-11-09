# ProofMe

**Your work should speak for itself. We make it verifiable.**

ProofMe is a portable professional contribution platform. Contributors document specific work
with evidence; the organisation they worked with reviews the claim and issues an attestation;
the attestation digest is anchored on NEAR testnet so anyone can check it.

ProofMe is an independent project.

> **Status:** early build. See [BUILD_STATUS.md](BUILD_STATUS.md) for exactly what works today.
> Nothing here runs on NEAR mainnet.

## Requirements

- Node.js 22 or newer, npm 10 or newer

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run check        # all four
```

Test, seed and deployment commands are added here as those parts are built.

## Documents

- [PRODUCT.md](PRODUCT.md) — what ProofMe is and who it serves
- [DESIGN.md](DESIGN.md) — design system
- [ARCHITECTURE.md](ARCHITECTURE.md) — structure and stack
- [DATA_MODEL.md](DATA_MODEL.md) — entities and the attestation payload
- [SECURITY.md](SECURITY.md) — threats, controls, privacy
- [TEST_PLAN.md](TEST_PLAN.md) — test strategy
- [DECISIONS.md](DECISIONS.md) — decisions and reasons
- [BUILD_STATUS.md](BUILD_STATUS.md) — progress, results, blockers
