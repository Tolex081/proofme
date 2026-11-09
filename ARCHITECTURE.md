# ProofMe — Architecture

Status: Milestone 0 plan. Items marked _planned_ are decisions not yet exercised by code; they
are confirmed or revised in the milestone that implements them, and `DECISIONS.md` is updated.

## Shape

A modular monolith: one Next.js application, one PostgreSQL database, one NEAR contract.

```text
Browser ──────────────► Next.js (App Router)
  │                       ├─ app/            routes, server components, server actions
  │                       ├─ server/services domain rules, permissions, transactions
  │                       ├─ lib/            pure helpers (validation, canonicalisation, NEAR parsing)
  │                       └─ lib/db          Drizzle schema + queries ──► PostgreSQL
  │
  └─ wallet (user signs) ─► NEAR testnet ◄── server reads (RPC view calls, tx status)
                              └─ proofme-registry contract
```

Two rules shape everything else:

1. **The server never holds a NEAR key.** Issuer registration requests, anchoring and revocation
   are signed in the organisation's own wallet. The server only reads the chain to confirm what
   happened before it records anything.
2. **Authorisation lives in services.** Routes and components call services; services
   authenticate, validate, check membership/role/ownership, apply the transition, write audit
   events, and return a safe shape. UI hiding is a convenience, never the control.

## Modules

| Module        | Owns                                                          |
| ------------- | ------------------------------------------------------------- |
| auth          | Sessions, sign-in, current-user helpers                       |
| profiles      | Contributor profile, visibility, connected account references |
| organisations | Organisation identity, platform verification state            |
| membership    | Roles, invitations, last-owner protection                     |
| projects      | Projects under an organisation                                |
| contributions | Claims, evidence, contributor-side lifecycle                  |
| verification  | Requests, append-only reviews, decision transitions           |
| attestations  | Frozen snapshot, canonical payload, digest, status events     |
| near          | Contract client, transaction confirmation, reconciliation     |
| notifications | In-app notifications                                          |
| audit         | Append-only audit events                                      |
| public        | Read models for public profile, verification and explore      |
| admin         | Organisation review, reports, issuer status, audit viewing    |

## Stack

| Concern          | Choice                                                                     | State          |
| ---------------- | -------------------------------------------------------------------------- | -------------- |
| Language         | TypeScript 5.x (strict)                                                    | installed      |
| Framework        | Next.js 16.4.6 App Router, React 19.3                                      | installed      |
| Styling          | Tailwind CSS 4.3                                                           | installed      |
| Validation       | Zod 4.6.7                                                                  | installed      |
| Lint / format    | ESLint 9 (eslint-config-next), Prettier 3.9.10                             | installed      |
| Database         | PostgreSQL                                                                 | _planned_ (M2) |
| ORM/migrations   | Drizzle ORM + drizzle-kit                                                  | _planned_ (M2) |
| Auth             | Better Auth (email/password; Google when configured)                       | _planned_ (M2) |
| Unit/integration | Vitest                                                                     | _planned_ (M2) |
| E2E              | Playwright                                                                 | _planned_ (M2) |
| Contract         | Rust, `near-sdk`                                                           | _planned_ (M6) |
| Contract tests   | `near-workspaces` (Rust) against a local sandbox                           | _planned_ (M6) |
| Wallet           | Maintained NEAR wallet connector, chosen in M6 after checking current docs | _planned_ (M6) |
| Hosting          | Vercel, its own project                                                    | _planned_ (M9) |

Exact versions are pinned at install time and listed in `DECISIONS.md`.

## The attestation path

```text
approve (reviewer, server-checked)
  → freeze claim snapshot → build canonical payload (versioned schema)
  → SHA-256 over canonical bytes = digest
  → attestation row: status approved, anchor status awaiting
issuer opens wallet → signs issue(attestation_id, digest) on the registry
  → client reports tx hash → server fetches tx result from RPC
  → server checks: success, correct contract, correct signer, digest matches
  → only then: anchor status confirmed, contribution verified
public verify page
  → load canonical payload → recompute digest → view call to registry → compare → show result
```

Review state and anchor state are separate columns. If a transaction succeeds but the server
update fails, a reconcile action re-reads the registry by attestation ID and repairs the row; it
never issues a second anchor (the contract rejects duplicate IDs).

## Environments

| Environment | App            | Database             | NEAR                                     |
| ----------- | -------------- | -------------------- | ---------------------------------------- |
| Local       | `next dev`     | local PostgreSQL     | testnet or sandbox                       |
| CI          | build + tests  | ephemeral PostgreSQL | sandbox                                  |
| Preview     | Vercel preview | separate preview DB  | testnet                                  |
| Production  | Vercel prod    | production DB        | testnet until a mainnet decision is made |

Mainnet is rejected by environment validation in this build.

## Dependency map

```text
routes ─► services ─► db
             │  └────► lib (validation, permissions, canonicalisation)  [pure, unit-tested]
             └───────► near client ─► NEAR RPC
contracts/proofme-registry  (no dependency on the web app)
```

`lib/` never imports from `server/` or `app/`. `contracts/` is a separate Rust crate.
