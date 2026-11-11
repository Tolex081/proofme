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

## First run

```bash
npx playwright install chromium   # once, for the browser tests
```

Locally the app uses an embedded PostgreSQL stored in `.pglite/`, created and migrated on first
start. Stop the dev server before running any `db:` command: only one process can open it.

## Data

```bash
npm run db:seed      # load the fictional demo scenario (refuses production)
npm run db:reset     # delete the local database (local embedded database only)
npm run db:migrate   # apply migrations (local, or the hosted database in DATABASE_URL)
npm run db:generate  # create a migration after changing lib/db/schema.ts
npm run admin:grant -- someone@example.org            # make an account a platform administrator
npm run admin:grant -- someone@example.org --revoke   # remove it
```

The seed creates fictional, clearly labelled accounts (Daniel Okafor, Sam Adeyemi, Priya Raman)
and organisation (Northstar Protocol, not a real partner), one verified and one self-reported
contribution, and, locally, a demo administrator. It prints the shared password once, or uses
`DEMO_PASSWORD` if set. Its attestation is not minted: that needs a testnet wallet.

Locally, accounts that sign up with an email listed in `PROOFME_LOCAL_ADMIN_EMAIL` become
administrators.

## Checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:integration   # runs migrations on an in-memory PostgreSQL
npm run check              # everything above
npm run test:e2e           # Playwright, desktop and phone (builds the app first)
npm run capture:screens    # review screenshots into .impeccable/review/
PROOFME_NETWORK_TESTS=1 npx playwright test tests/e2e/wallet-csp.spec.ts   # needs internet
```

The NFT contract's tests run with `cargo test` in `contracts/proofme-attestations`.

## Production configuration

Set these in the hosting platform's secret store, separately for preview and production. Never
commit them.

| Variable              | Preview and production                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| `APP_ENV`             | `preview` or `production`                                                     |
| `NEXT_PUBLIC_APP_URL` | The site's public `https://` address                                          |
| `DATABASE_URL`        | A hosted PostgreSQL connection string; a different database for each          |
| `BETTER_AUTH_SECRET`  | 32+ random characters; a different value for each (`openssl rand -base64 32`) |
| `NEAR_NETWORK`        | `testnet` (nothing else is accepted)                                          |
| `NEAR_CONTRACT_ID`    | The deployed `proofme-attestations` testnet contract, once deployed           |
| `NEAR_RPC_URL`        | Optional; defaults to a public testnet RPC                                    |

The app refuses to start a hosted environment without a database, on a local or plain-http
address, or on a network other than testnet. Before the first deployment and after each schema
change, run `npm run db:migrate` with that environment's `DATABASE_URL`; the app never migrates a
hosted database by itself. Grant the first administrator with `npm run admin:grant`.
`PROOFME_LOCAL_ADMIN_EMAIL` and `npm run db:reset` have no effect outside local development, and
`npm run db:seed` refuses production.

Security headers, including the Content Security Policy and HSTS, are set by `next.config.ts`;
see SECURITY.md.

## Documents

- [PRODUCT.md](PRODUCT.md) — what ProofMe is and who it serves
- [DESIGN.md](DESIGN.md) — design system
- [ARCHITECTURE.md](ARCHITECTURE.md) — structure and stack
- [DATA_MODEL.md](DATA_MODEL.md) — entities and the attestation payload
- [SECURITY.md](SECURITY.md) — threats, controls, privacy
- [TEST_PLAN.md](TEST_PLAN.md) — test strategy
- [DECISIONS.md](DECISIONS.md) — decisions and reasons
- [BUILD_STATUS.md](BUILD_STATUS.md) — progress, results, blockers
