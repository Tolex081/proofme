# ProofMe — Build status

Last updated: 9 November 2026

## Where things stand

- **Milestone 0** is complete.
- **Milestone 1** (design system and public website) has not started. Impeccable is now present
  in `.agents/skills/impeccable`, so it is no longer blocked. See the note on skill files below.
- **Server-side groundwork** was built ahead of order, at the user's request, while Impeccable
  was unavailable. It covers rules and schema only. There are no services, routes, screens,
  authentication or NEAR integration yet.

## Built ahead of order (belongs to Milestones 2–5)

| Piece                                                                                  | Where                                           | Tested by                                                              |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Evidence URL validation                                                                | `lib/urls/evidence.ts`                          | `tests/unit/evidence-url.test.ts`                                      |
| Canonical JSON (RFC 8785) and SHA-256                                                  | `lib/attestations/canonical.ts`                 | `tests/unit/attestation-payload.test.ts`                               |
| Attestation payload v1, sealing, re-checking                                           | `lib/attestations/payload.ts`                   | same, with a hand-written fixture and an independently computed digest |
| Lifecycle rules (contribution, request, attestation, anchor)                           | `lib/domain/status.ts`                          | `tests/unit/status.test.ts`                                            |
| Organisation permission matrix, no-self-review, last-owner rule                        | `lib/permissions/organisation.ts`               | `tests/unit/organisation-permissions.test.ts`                          |
| Database schema, 16 tables                                                             | `lib/db/schema.ts`, `lib/db/migrations/0000_*`  | `tests/integration/schema.test.ts`                                     |
| Triggers: frozen attestation content, final revocation and anchor, append-only history | `lib/db/migrations/0001_integrity_triggers.sql` | same                                                                   |

Not yet done from those milestones: authentication and its tables, the runtime database
connection, every service, every route and screen, notifications, audit writing, E2E tests.

## Check results (run 9 Nov 2026, `npm run check`)

| Command                    | Result                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | Passed                                                                                                     |
| `npm run lint`             | Passed, no warnings                                                                                        |
| `npm run typecheck`        | Passed                                                                                                     |
| `npm run test:unit`        | 182 passed, 0 failed                                                                                       |
| `npm run test:integration` | 39 passed, 0 failed (in-memory PostgreSQL via PGlite)                                                      |
| `npm run build`            | Passed (routes: `/`, `/_not-found`)                                                                        |
| `npm audit`                | Not re-triaged after adding Drizzle and Vitest; at Milestone 0 it was 8 moderate, development tooling only |
| E2E / contract tests       | Do not exist yet                                                                                           |
| CI on GitHub               | Never run; there is no remote                                                                              |

## Skill files: one thing to fix

Impeccable and `design-taste-frontend` were installed into `.agents/skills` while a formatting
command was running. That command (`prettier --write .`) rewrote 573 of their files
(Markdown, JSON, JS, CSS, HTML). The changes are formatting only, but the files no longer match
what was published. **Reinstall both skills to restore them** before Milestone 1. The folder is
now excluded from Prettier, ESLint, TypeScript and Git, so it cannot happen again;
`skills-lock.json` is committed.

The skills live in `.agents/skills`, which this Claude Code session does not load as skills.
They can be read and followed as files, or installed for Claude Code so they load properly.

## Milestone 0 — complete

Repository, tooling, CI workflow, `.env.example`, and the product, architecture, data model,
security, test plan and decisions documents. App boots (`next start`, HTTP 200).
`DESIGN.md` still holds only the brief's constraints.

## Environment

| Tool            | State                                                    |
| --------------- | -------------------------------------------------------- |
| Node / npm      | 22.17.1 / 10.9.2                                         |
| Git, GitHub CLI | Installed; `gh` signed in                                |
| Rust            | 1.87.0; `wasm32-unknown-unknown` target not installed    |
| WSL             | Ubuntu (WSL 2) available — needed for NEAR sandbox tests |
| Docker          | Installed, daemon not running                            |
| NEAR CLI        | Not installed                                            |
| FFmpeg          | Not installed (needed for the videos)                    |
| Vercel CLI      | Installed; login state not checked                       |

## Needed from the user

1. Reinstall the two design skills (see above).
2. A hosted PostgreSQL for preview deployment (Milestone 2 onward; local work uses PGlite).
3. NEAR testnet accounts and wallet signatures (Milestone 6).
4. Go-ahead for a GitHub repository and Vercel project (Milestone 9).
5. FFmpeg and a narration choice (Milestone 9).

## Decisions made in this round

- PGlite for tests and local development: real PostgreSQL semantics with nothing to install.
  It is single-connection, so racing-reviewer behaviour is not tested on it yet.
- Integrity rules live in the database as well as the code (triggers and check constraints).
- Read-only viewers cannot see verification requests, because a request holds a contributor's
  unpublished claim and reviewers' private notes.
- Revocation is limited to owners and admins. A rejected claim can be revised and resubmitted
  as a new request; the rejected one stays in history.
- Agent skills (`.agents/`, about 1,700 third-party files) are not committed.

Installed versions added: vitest 5.1.0, drizzle-orm 0.45.4, drizzle-kit 0.31.11,
@electric-sql/pglite 0.5.16.

## Known risks

- Next.js 16 has breaking changes from earlier versions; bundled docs are consulted before use.
- The `users` table is shaped for Better Auth from memory of its core schema; it must be
  reconciled with the installed version when authentication is added.
- NEAR sandbox does not run natively on Windows; contract tests depend on WSL and CI.
- The automated E2E run cannot drive a real wallet approval; that step is manual on testnet.

## Next step

Restore the skill files, then start Milestone 1 with Impeccable's context and
direction-selection workflow.
