# ProofMe — Build status

Last updated: 10 November 2026

## Where things stand

- **Milestone 0** is complete.
- **Milestone 1** (design system and public website) is built, with three parts open: the
  signed-in app shell, account calls to action, and Impeccable's finish review. See below.
- **Server-side groundwork** for Milestones 2–5 exists as rules and schema only. There are no
  services, authentication, signed-in screens or NEAR integration yet.

## Milestone 1 — Product identity, design system and public website

| Task                                                                       | State                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impeccable greenfield direction workflow                                   | Done: context command, three questions answered by the user, concept roll, decision page, direction chosen by the user ("The Credits", code-led), direction contract recorded in `.impeccable/surfaces/` |
| Design tokens, type, colour, spacing, component rules, responsive patterns | Done in `app/globals.css`; documented in `DESIGN.md` and `.impeccable/design.json`                                                                                                                       |
| Landing page                                                               | Done, with a working in-browser digest check on a labelled sample record                                                                                                                                 |
| Public explanatory pages                                                   | Done: `/how-it-works`, `/for-contributors`, `/for-organisations`, `/privacy`, `/terms`                                                                                                                   |
| Navigation, footer, responsive layout                                      | Done, including a small-screen menu and a skip link                                                                                                                                                      |
| Truthful copy                                                              | Done. No partners, statistics, testimonials or real attestations are shown. Sample content is labelled. Privacy and terms say they are unreviewed drafts                                                 |
| Early signed-in app shell                                                  | **Not done.** Deferred to Milestone 2, where it can be built behind real authentication instead of as an unprotected mock route                                                                          |

### Acceptance

| Criterion                                           | Result                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing and public pages work on desktop and mobile | Yes. Inspected at 1440×900 and 375×812; no horizontal overflow, no console errors                                                                   |
| Main CTA routes work                                | Yes for everything shown. There are no sign-up or sign-in calls to action yet, because those routes do not exist; the pages say sign-up is not open |
| All links have real destinations                    | Yes. Every header, footer and in-page link points to a built route                                                                                  |
| Brand and design decisions documented               | Yes, `DESIGN.md`                                                                                                                                    |
| Impeccable craft floor met                          | Detector run over `app` and `components`: no findings. The shipped finish review has **not** run (see below)                                        |

### What was verified by use

- The digest check: the untouched sample gives "Match" with the recorded digest; changing the
  role gives "No match" and a different digest; "Restore the original" appears after an edit.
- The small-screen menu opens and reports its state to assistive technology.
- A unit test proves the digest shown on the page is the real digest of the sample record.

### Open items from Impeccable's process

- **The concept roll ran degraded.** Its service was unreachable from the shell, so no outside
  "challenger" directions were dealt; the user chose between two grounded directions and the
  category standard.
- **Decision cards were text-only**, because no image generation is available here.
- **The finish review has not run.** It needs screenshot files, and nothing here can save
  screenshots to disk until Playwright is installed in Milestone 2. Inspection so far was done
  live in the browser pane. Until that review runs, Milestone 1 is not finished by
  Impeccable's own definition.
- **`DESIGN.md` was merged, not replaced:** the brief's status vocabulary was kept and the built
  system written around it. The user was not asked to choose between refresh, overwrite and merge.
- Tablet (768) and laptop (1280) widths have not been inspected yet.
- Keyboard-only and screen-reader passes have not been done yet.

## Check results (run 10 Nov 2026, `npm run check`)

| Command                    | Result                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run format:check`     | Passed                                                                                                |
| `npm run lint`             | Passed, no warnings                                                                                   |
| `npm run typecheck`        | Passed                                                                                                |
| `npm run test:unit`        | 183 passed, 0 failed                                                                                  |
| `npm run test:integration` | 39 passed, 0 failed (in-memory PostgreSQL via PGlite)                                                 |
| `npm run build`            | Passed. Routes: `/`, `/how-it-works`, `/for-contributors`, `/for-organisations`, `/privacy`, `/terms` |
| Impeccable detector        | No findings                                                                                           |
| `npm audit`                | Not re-triaged since Milestone 0 (then: 8 moderate, development tooling only)                         |
| E2E / contract tests       | Do not exist yet                                                                                      |
| CI on GitHub               | Never run; there is no remote                                                                         |

## Built ahead of order (belongs to Milestones 2–5)

| Piece                                                      | Where                             |
| ---------------------------------------------------------- | --------------------------------- |
| Evidence URL validation                                    | `lib/urls/evidence.ts`            |
| Canonical JSON (RFC 8785), SHA-256, attestation payload v1 | `lib/attestations/`               |
| Lifecycle rules                                            | `lib/domain/status.ts`            |
| Organisation permissions                                   | `lib/permissions/organisation.ts` |
| Database schema (16 tables) and integrity triggers         | `lib/db/`                         |

## Environment

| Tool             | State                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Node / npm       | 22.17.1 / 10.9.2                                                            |
| Git, GitHub CLI  | Installed; `gh` signed in                                                   |
| Impeccable       | 4.8.2 in `.agents/skills/impeccable` (not committed; `skills-lock.json` is) |
| Rust             | 1.87.0; `wasm32-unknown-unknown` target not installed                       |
| WSL              | Ubuntu (WSL 2) available — needed for NEAR sandbox tests                    |
| Docker           | Installed, daemon not running                                               |
| NEAR CLI, FFmpeg | Not installed                                                               |
| Vercel CLI       | Installed; login state not checked                                          |

## Needed from the user

1. A hosted PostgreSQL for preview deployment (local work uses PGlite).
2. NEAR testnet accounts and wallet signatures (Milestone 6).
3. Go-ahead for a GitHub repository and Vercel project (Milestone 9).
4. FFmpeg and a narration choice (Milestone 9).

## Known risks

- Next.js 16 has breaking changes from earlier versions; bundled docs are consulted before use.
- The `users` table is shaped for Better Auth from memory; it must be reconciled when
  authentication is added.
- Racing reviewers are not tested, because PGlite is single-connection.
- NEAR sandbox does not run natively on Windows; contract tests depend on WSL and CI.
- The automated E2E run cannot drive a real wallet approval; that step is manual on testnet.

## Next step

Milestone 2: authentication, the runtime database connection, onboarding, profiles and the
signed-in app shell. Install Playwright there, capture the public pages, and run Impeccable's
finish review to close Milestone 1.
