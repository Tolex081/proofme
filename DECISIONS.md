# ProofMe — Decisions

Newest last. "Planned" means chosen but not yet exercised by code; it is confirmed or revised
when implemented.

## D1 — Next.js 16.4.6 (App Router), React 19.3, TypeScript, npm

**Why:** the brief's baseline; current stable release; first-class on Vercel, which the user
already uses. npm because it is installed and pnpm is not; no reason to add a tool.
**Alternatives:** Remix/React Router, SvelteKit — no advantage that justifies leaving the baseline.
**Note:** Next 16 differs from older versions (the scaffold's `AGENTS.md` says so). Its bundled
docs in `node_modules/next/dist/docs/` are read before using any framework API.

## D2 — Tailwind CSS 4.3, no component kit by default

**Why:** tokens-first styling that the design system can own. Accessible primitives are added
selectively where building them by hand would be worse (dialogs, menus), decided in Milestone 1.

## D3 — PostgreSQL + Drizzle ORM (planned, M2)

**Why:** relational data with real constraints; Drizzle keeps SQL visible and migrations versioned.
**Alternatives:** Prisma — heavier runtime, no benefit here. One ORM only.
**Open point:** local Postgres. Docker Desktop is installed but its daemon was not running on
9 Nov 2026, and `psql` is not installed. Options are starting Docker, or PGlite (Postgres in
WASM) for local development and tests. Hosted preview/production needs a managed Postgres
(for example Neon), which requires the user's account. Decided in M2.

## D4 — Better Auth (planned, M2)

**Why:** maintained, self-hosted in our own database, email/password out of the box, Google when
credentials exist, no per-user cost, no third-party user store.
**Alternatives:** Clerk — faster to start but adds an external service and account.

## D5 — NEAR contract in Rust with `near-sdk` (planned, M6)

**Why:** the officially supported SDK with the most current tooling. `near-sdk-js` was last
published in June 2024, so it is not a safe base.
**Constraint:** the NEAR sandbox has no native Windows build. Contract integration tests run
under WSL (Ubuntu is installed) and on Linux in CI. The `wasm32-unknown-unknown` Rust target is
not installed yet.

## D6 — The server holds no NEAR keys

**Why:** the brief forbids silent signing and stored keys. Every NEAR write is signed in the
organisation's wallet; the server only verifies results over RPC. This also means a compromised
server cannot issue or revoke attestations on-chain.

## D7 — Digest = SHA-256 over RFC 8785 canonical JSON, with a random nonce (planned, M5)

**Why:** a published, unambiguous canonicalisation instead of ad-hoc concatenation; the nonce
prevents confirming a guess about a person from public fields.

## D8 — Called a "ProofMe attestation with a NEAR anchor", not a W3C Verifiable Credential

**Why:** VC 2.0 conformance needs a real securing mechanism and verification process. Field names
alone do not make one. The payload is shaped to migrate later.

## D9 — Mainnet rejected by environment validation

**Why:** brief §13.5. `NEAR_NETWORK` accepts only `sandbox` and `testnet`.

## D10 — Milestone 0 boot page is deliberately undesigned

**Why:** Impeccable requires direction selection before any UI code. The boot page is plain text
that proves the app runs; it is replaced, not evolved, in Milestone 1.

## Pinned versions (installed)

next 16.4.6 · react 19.3.0 · tailwindcss 4.3.3 · zod 4.6.7 · prettier 3.9.10 ·
eslint 9.x with eslint-config-next 16.4.6 · typescript 5.x (as installed by create-next-app; see
`package-lock.json` for exact resolutions).

## Versions checked for later milestones (npm registry, 9 Nov 2026)

drizzle-orm 0.45.4 · better-auth 1.7.18 · vitest 5.1.0 · @playwright/test 1.65.0 ·
near-api-js 7.4.0 · @near-wallet-selector/core 10.1.4 · @hot-labs/near-connect 0.12.0 ·
near-workspaces (npm) 5.0.0 · @electric-sql/pglite 0.5.16.

## D16 — Better Auth, email and password first

**Why:** maintained, stores users in our own database, no per-user cost. Google sign-in is not set up:
it needs OAuth credentials from the user. Fields a request must never set (`status`,
`isPlatformAdmin`) are declared `input: false` and tested.

## D17 — Every form posts and waits for hydration

**Why:** a form submitted before its script runs is sent by the browser as a GET, which put a
password in the URL during testing. Forms declare `method="post"` and disable submit until hydrated.

## D18 — Not-found profiles return 200 with noindex

**Why:** with Cache Components the response starts before the database is read (documented by
Next.js). A request-time 404 would need the proxy to query the database. Private and missing
profiles render identically, so nothing leaks.

## D19 — PGlite warmed at server start

**Why:** opening the embedded database and applying migrations on the first request made that
request slow enough to time out. `instrumentation.ts` does it at start.

## D20 — Invitations are single-use links tied to an email address

**Why:** no email provider is configured. The inviter copies a link shown once; only its SHA-256
hash is stored. The link only works for an account with the invited address, so a forwarded link
is useless to anyone else.

## D21 — Non-members see "not found" for organisation workspaces

**Why:** saying "forbidden" would confirm that a private organisation page or project exists.
Members whose role is too low see an explicit "your role cannot" page instead.

## D22 — `getDb()` calls `connection()`

**Why:** with Cache Components, a page that reads only route parameters and then the database is
treated as prerenderable, and the database driver's clock reads are flagged. Marking every
request-time database read in one place prevents this for every current and future page.

## D23 — Every form with fields submits without React's automatic reset

**Why:** React 19 resets a `<form action>` after the action finishes. After a validation error,
radios and selects returned to their defaults while still looking chosen; in testing a reviewer's
"ask for more" became an approval. `useFormAction` submits through `onSubmit` instead, and
`tests/unit/form-reset-guard.test.ts` fails if a form with fields uses the resetting pattern.

## D24 — The attestation names the reviewer by profile ID

**Why:** the payload is public and permanent. Account IDs are internal and belong to the
authentication library; the profile ID is a stable UUID that identifies the reviewer without
exposing account internals.

## D25 — Decisions are serialised by a row lock and a version check

**Why:** two reviewers deciding at once must not both succeed or issue two attestations. The
request row is locked `FOR UPDATE` and the update requires the version the reviewer saw; a stale
view is told to reload.

## D26 — Each attestation is a non-transferable NFT, not only an anchored digest

**Why:** ProofMe is entered in the NEAR Hackathon's track 10, "NFTs That Do Something", which asks
for NFTs that carry credentials and have behaviour. A plain digest registry would not be an NFT
project. The contract (`contracts/proofme-attestations`) implements NEP-171, NEP-177 and NEP-181
by hand rather than through `near-contract-standards`, because the standard implementation is
built around transfer and approval, which this contract refuses. The trade-off: a contributor
needs a NEAR account to receive the token (principle 6 in `PRODUCT.md` was changed to say so).

## D27 — The track's "NFT as an account" idea is left out

**Why:** making each token control its own NEAR sub-account has no SDK yet and adds nothing a
work record needs. With submissions closing on 14 November 2026 it was not worth the risk.

## D28 — Contract toolchain pinned to Rust 1.95.0, near-sdk 5.30.1

**Why:** near-sdk 5.30.1 (crates.io, checked 11 Nov 2026) requires Rust 1.95; the machine's
default was 1.87. The contract folder pins its own toolchain so nothing else on the machine
changes. Its test-only dependencies need the NASM assembler on Windows, so
`.cargo/config.toml` selects the prebuilt objects instead.
