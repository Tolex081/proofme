# ProofMe — Build status

Last updated: 11 November 2026

## Where things stand

- **Milestones 0, 2, 3 and 4** are complete.
- **Milestone 1** is complete except Impeccable's finish review, which has not run.
- **Next:** Milestone 5 (verification workflow, audit, notifications). There is no review
  workflow or NEAR integration yet.

## Redesign (10 Nov 2026)

The first design ("The Credits") was rejected by the user. After research on Dribbble (Pinterest
needed a login and was not used), three full-colour directions were built and the user chose
**People first**, asking for a dark mode and the blue-and-white checkmark logo. The public site
was rebuilt in it:

- Light and dark themes. Dark follows the system setting; a switch in the header overrides it and
  is remembered on the device, with no flash on load.
- New logo (white check on a blue rounded square) and favicon.
- Landing page with a sample profile timeline, the working digest check, the four steps, what a
  record proves and does not prove, and paths for contributors and organisations.
- How it works, For contributors, For organisations, Privacy and Terms restyled through shared parts.
- Sign-in and registration pages.
- Inspected at 1440 and 375 wide in both themes; no horizontal overflow. DESIGN.md and
  .impeccable/design.json rewritten for the new system.
- Impeccable detector: 29 advisories, no errors (font sizes, two radii and one colour that are not
  named steps in DESIGN.md). Not yet resolved.

## Milestone 4 — Organisations, projects and team roles (complete)

| Task                                                 | State                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create an organisation, public profile `/org/[slug]` | Done. Created from the existing account; the creator becomes owner                                                                                                                                                                                                                                                      |
| Platform verification request state                  | Done. Starts "Not reviewed by ProofMe"; owners and admins can ask for review once it has a description and website, which moves it to pending. Only an administrator can approve (Milestone 7). Request fields that try to set verified or issuer status are ignored                                                    |
| Membership and invitations                           | Done. Invitations by secure single-use link (only a SHA-256 hash is stored), valid 7 days, usable only by the invited email address. Accept, decline, cancel, and a new invitation replaces an open one. The invitee gets an in-app notification if they already have an account; the inviter is notified of the answer |
| Roles owner, admin, reviewer, viewer                 | Done, from the permission matrix: owners and admins manage; reviewers and viewers see a "your role cannot" page instead of forms                                                                                                                                                                                        |
| Projects                                             | Done: create, edit, status (draft, active, completed, archived); public `/project/[slug]` for active and completed only                                                                                                                                                                                                 |
| Organisation dashboard and contributors page         | Done. Contributors are listed once claims can be sent (Milestone 5)                                                                                                                                                                                                                                                     |
| Server-side organisation isolation                   | Done. Every lookup goes through the actor's membership; non-members see "not found"                                                                                                                                                                                                                                     |
| Your organisations                                   | `/dashboard/organisations` lists every organisation the account belongs to                                                                                                                                                                                                                                              |

Email is not configured, so the inviter is shown the link once to send themselves. The page says so.

### Acceptance

| Criterion                                         | Result                                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create an organisation without a second account   | Yes: integration test checks a single user row; browser test reaches both workspaces with one account                                                                          |
| Owner can create projects and invite team members | Yes, browser tests                                                                                                                                                             |
| Permissions enforced by the server                | Yes: 18 integration tests across roles; browser test shows a reviewer refused settings, projects and invitations                                                               |
| Cross-organisation access tests pass              | Yes: integration test of every read and write against another organisation; browser test of six URLs including another organisation's project ID through your own organisation |

### Problems found and fixed

- Public pages read the database straight after the URL, and Next.js flagged the database driver's
  clock reads as unstable during prerendering. `getDb()` now marks every database read as
  request-time.
- Someone signed in with the wrong account had no way to switch on the invitation page. It now
  says who is signed in and offers sign out.

## Milestone 3 — Contributions and evidence (complete)

| Task                                   | State                                                                                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create, save, edit, view contributions | Done: `/dashboard/contributions`, `/new`, `/[id]`, `/[id]/edit`                                                                                                                                                                                  |
| Categories and skills                  | Done (eleven categories from the brief)                                                                                                                                                                                                          |
| Evidence links with validation         | Done: up to ten links per contribution, kept in the order given, https only, public hosts only, no credentials, no duplicates; each with a kind and a description. The server never fetches them                                                 |
| List with status filters, and detail   | Done                                                                                                                                                                                                                                             |
| Portfolio preview                      | Done: shows exactly what a visitor would see, including contributions                                                                                                                                                                            |
| Status and visibility rules            | Done. Drafts are private to their owner. A complete draft can be marked self-reported; it then appears on a public profile only if both the profile and the contribution are public, under a separate "Self-reported" heading, never as verified |
| Deleting drafts                        | Done, after confirmation; anything past draft keeps its history                                                                                                                                                                                  |

Sending a contribution to an organisation needs organisations (Milestone 4) and the review
workflow (Milestone 5); the detail page says so instead of offering a button that does nothing.

### Acceptance

| Criterion                                                 | Result                                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create, save, edit and view contributions                 | Yes, browser test                                                                                                                                         |
| Multiple evidence URLs persist and validate               | Yes: 19 integration tests and a browser test that fixes a rejected `javascript:` link without losing what was typed                                       |
| Draft and self-reported records do not appear as verified | Yes, integration and browser tests                                                                                                                        |
| Private content not publicly exposed                      | Yes: private contributions, drafts and private evidence are filtered on the server; another user opening a contribution's address gets the not-found page |
| Tests pass                                                | Yes (see check results)                                                                                                                                   |

### Problems found and fixed by the tests

- Evidence order was not stored (links saved together share a timestamp). Added a `position`
  column and migration 0003.
- An impossible date such as 31 February passed validation and reached the database as a raw
  error. Dates are now checked by round trip.
- The public header was replaced once the page address was known, which could close a phone menu
  that had just been opened. Only the link lists stream in now.

## Milestone 2 — Database, authentication and contributor identity (complete)

| Task                                                                        | State                                                                                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL configured                                                       | Done. Hosted PostgreSQL through `DATABASE_URL`; embedded PGlite in `.pglite/` locally and in memory for tests. A hosted database for preview still needs the user's account |
| Schema and migrations                                                       | Done: 20 tables, three migrations, integrity triggers                                                                                                                       |
| Authentication and sessions                                                 | Done with Better Auth: email and password, HttpOnly session cookies, database-backed rate limits outside local development                                                  |
| Onboarding with contributor / organisation / both                           | Done                                                                                                                                                                        |
| Profile, unique username, public/private visibility, per-section visibility | Done                                                                                                                                                                        |
| External account links and NEAR account field                               | Done. Self-declared and labelled so; wallet proof comes in Milestone 6                                                                                                      |
| Protected routes and server-side helpers                                    | Done: proxy redirect plus a database check on every private page and server action                                                                                          |
| Signed-in workspace shell                                                   | Done, in the layout the user chose (top bar, side navigation)                                                                                                               |
| Public profile `/u/[username]`                                              | Done (basic; contributions are added in Milestone 7)                                                                                                                        |
| Data export and account closure                                             | Done                                                                                                                                                                        |
| Notifications page                                                          | Done (list, unread count, mark all read); nothing creates notifications until Milestone 5                                                                                   |
| Email verification, password reset and change                               | **Blocked**: needs an email provider                                                                                                                                        |
| Google sign-in                                                              | Not configured: needs OAuth credentials                                                                                                                                     |

### Acceptance

| Criterion                                             | Result                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sign up, sign in, sign out, access account            | Yes, covered by browser tests                                                                   |
| One account can hold several roles                    | Yes: onboarding records a starting preference only; organisation membership is a separate table |
| Profile data persists after refresh and a new session | Yes, browser test                                                                               |
| Unauthenticated users cannot reach private routes     | Yes, browser test for all six private routes                                                    |
| Tests cover auth and profile permissions              | Yes: 49 integration tests for profile and account services, 16 browser tests                    |

### Problems found and fixed by the tests

- **Credentials in the URL.** Pressing "Sign in" before the page's script loaded let the browser
  submit the form itself, putting the email and password in the address. Every form now posts and
  keeps its button disabled until the page is ready.
- **Typed sign-in details discarded.** The sign-in page swapped its form after load. It now has a
  single form that reads the return address when submitted.
- Two main headings on the portfolio page; a sideways-scrolling phone menu that could hide links;
  inputs out of line where only one field had a hint; a slow first request (the database now
  warms at server start).

### Known limitation

A private or missing profile shows the not-found page with `noindex`, but the HTTP status is 200.
With Cache Components the response has started before the database can be checked; Next.js
documents this, and a true 404 would need the proxy to query the database. Private and missing
profiles still look identical.

### Still open from Milestone 1

Impeccable's finish review has not run. Review screenshots of every screen, in both themes and
both sizes, are now captured by `npm run capture:screens` into `.impeccable/review/`.

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

## Check results (run 11 Nov 2026)

| Command                                            | Result                         |
| -------------------------------------------------- | ------------------------------ |
| `npm run format:check`                             | Passed                         |
| `npm run lint`                                     | Passed, no warnings            |
| `npm run typecheck`                                | Passed                         |
| `npm run test` (unit and integration)              | 271 passed, 0 failed           |
| `npm run build`                                    | Passed, no warnings            |
| `npm run test:e2e` (Playwright, desktop and phone) | 16 passed, 0 failed            |
| Contract tests                                     | Do not exist yet (Milestone 6) |
| CI on GitHub                                       | Never run; there is no remote  |

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

Milestone 5: verification workflow, audit and notifications.
