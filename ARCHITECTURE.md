# ProofMe — Architecture

Status: 13 November 2026. Describes the code as built.

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
                              └─ proofme-attestations contract (NEP-171 NFT)
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
| near          | Contract reads, transaction confirmation, mint checks         |
| near identity | NEP-413 challenges, proven accounts, the issuer trust policy  |
| holders       | Credential-gated access and the published credential document |
| github        | OAuth linking, identity reservation, read-only API client     |
| evidence      | The Evidence Agent: source checks, AI analysis, reports       |
| notifications | In-app notifications                                          |
| audit         | Append-only audit events                                      |
| public        | Read models for public profile, verification and explore      |
| admin         | Organisation review, reports, issuer status, audit viewing    |

## Stack

| Concern          | Choice                                                                     | State     |
| ---------------- | -------------------------------------------------------------------------- | --------- |
| Language         | TypeScript 5.x (strict)                                                    | installed |
| Framework        | Next.js 16.4.6 App Router, React 19.3                                      | installed |
| Styling          | Tailwind CSS 4.3                                                           | installed |
| Validation       | Zod 4.6.7                                                                  | installed |
| Lint / format    | ESLint 9 (eslint-config-next), Prettier 3.9.10                             | installed |
| Database         | PostgreSQL (Neon hosted; PGlite locally and in tests)                      | in use    |
| ORM/migrations   | Drizzle ORM + drizzle-kit, plus hand-written integrity triggers            | in use    |
| Auth             | Better Auth (email and password)                                           | in use    |
| Unit/integration | Vitest                                                                     | in use    |
| E2E              | Playwright                                                                 | in use    |
| Contract         | Rust, `near-sdk`                                                           | in use    |
| Contract tests   | Unit tests against the SDK's mock runtime                                  | in use    |
| Wallet           | NEAR Connect (`@hot-labs/near-connect`): transactions and NEP-413 messages | in use    |
| Hosting          | Vercel (migrations and demo seed run in its build)                         | in use    |
| Storage          | IPFS through Pinata for published credential documents                     | in use    |
| AI               | NEAR AI Cloud (OpenAI-compatible), optional, for the Evidence Agent        | in use    |

Exact versions are pinned at install time and listed in `DECISIONS.md`.

## Proving accounts

```text
wallet connects → server issues a challenge (32-byte nonce, purpose, account, user, 10 minutes)
  → wallet signs it (NEP-413; not a transaction)
  → server: signature valid? key is a full-access key of that account (RPC view_access_key)?
     challenge unused, unexpired, this user's and this purpose's? → use it up atomically
  → record the account (contributor) or the issuer account (organisation owner)
```

## The attestation path

```text
approve (reviewer, server-checked)
  → freeze claim snapshot → build canonical payload (versioned schema)
  → SHA-256 over canonical bytes = digest
  → attestation row: status active, anchor status awaiting (schema v2: no username, public evidence only)
contributor agrees to publish → document pinned to IPFS → reference + Base64 SHA-256 stored
issuer policy checked (verified organisation, proven issuer account, registered on contract)
issuer opens wallet → signs issue(token_id, receiver_id = proven account, digest, reference)
  → the contract mints a non-transferable NFT to the contributor's NEAR account
  → client reports tx hash → server fetches tx result from RPC
  → server checks: success, contract, signer, and the exact args (token, receiver, digest, reference)
  → reads the token back: owner = proven account, active, same digest and reference, our issuer
  → only then: anchor status confirmed, contribution verified
public verify page
  → load canonical payload → recompute digest → view call verify(token_id, digest) → show result
```

A correction creates a new sealed record linked to the old one; if the old one is on NEAR, the
issuer signs `supersede(old_token_id, token_id, digest, reference)` and the server records both.

## The Evidence Agent

```text
contributor links GitHub (OAuth, no scopes, state + PKCE) → identity = GitHub numeric ID (unique)
contributor presses "Investigate with ProofMe"
  → each evidence link parsed (github.com only) → read-only calls to api.github.com
  → layer A: existence, author / committer / reviewer / merger / assignee, attribution against the
     linked numeric ID, signature, duplicate and conflicting use of the same resource
  → layer B (if NEAR AI is configured): claim-by-claim analysis of the claim text against the facts,
     with GitHub text passed as untrusted data; output validated, never "source_confirmed"
  → versioned report with digest; findings, resources and per-person relationships stored
reviewer sees the report beside the claim and decides; the agent never approves or mints
```

The contract is in `contracts/proofme-attestations`; its README lists every method and the
threats it answers. Review state and anchor state are separate columns. If a transaction succeeds
but the server update fails, a reconcile action re-reads the contract by attestation ID and
repairs the row; it never mints a second token (the contract rejects duplicate IDs).

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
contracts/proofme-attestations  (no dependency on the web app)
```

`lib/` never imports from `server/` or `app/`. `contracts/` is a separate Rust crate.
