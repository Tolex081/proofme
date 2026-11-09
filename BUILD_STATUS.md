# ProofMe — Build status

Last updated: 9 November 2026

## Where things stand

**Milestone 0 is complete except for one item: loading the Impeccable skill.** No product
features exist yet. Milestone 1 (design system and public website) cannot start until Impeccable
is installed, because it requires a direction-selection step before any UI code.

## Milestone 0 — Project setup and product/architecture context

| Task                                                                                    | State                                                                                                                                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `proofme` directory and Git repository                                              | Done (local repository, `main`; no GitHub remote yet)                                                                                                                       |
| Inspect runtimes, package managers, tooling                                             | Done (see below)                                                                                                                                                            |
| Verify current stable versions                                                          | Done from the npm registry; recorded in `DECISIONS.md`                                                                                                                      |
| Load Impeccable                                                                         | **Blocked** — not installed; install was denied by the permission system                                                                                                    |
| Load other relevant skills                                                              | None are installed (no React, testing, Playwright, accessibility, auth or NEAR skill). The built-in `security-review` and `code-review` skills exist and will be used in M8 |
| PRODUCT, DESIGN, ARCHITECTURE, DATA_MODEL, SECURITY, TEST_PLAN, BUILD_STATUS, DECISIONS | Done. `DESIGN.md` holds only the brief's constraints until Impeccable runs                                                                                                  |
| Architecture and dependency map                                                         | Done (`ARCHITECTURE.md`)                                                                                                                                                    |
| Format, lint, typecheck, CI                                                             | Done (`.github/workflows/ci.yml`; not yet run on GitHub)                                                                                                                    |
| `.env.example`                                                                          | Done                                                                                                                                                                        |

### Acceptance

| Criterion                              | Result                                                          |
| -------------------------------------- | --------------------------------------------------------------- |
| Independent from CrewPass              | Yes. Fresh directory; nothing read from or shared with CrewPass |
| Architecture and data model documented | Yes                                                             |
| No secrets committed                   | Yes. `.env*` ignored except `.env.example`                      |
| Local application boots                | Yes. `next start` returned HTTP 200 with the boot page          |
| Typecheck / lint / build baseline      | Yes (results below)                                             |

### Check results (run 9 Nov 2026)

| Command                                   | Result                                                                                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                    | Passed                                                                                                                                                                                                                     |
| `npm run lint`                            | Passed, no warnings                                                                                                                                                                                                        |
| `npm run typecheck`                       | Passed                                                                                                                                                                                                                     |
| `npm run build`                           | Passed (routes: `/`, `/_not-found`)                                                                                                                                                                                        |
| `npm audit`                               | 8 moderate, 0 high/critical. All trace to `minimatch` (GHSA-g3hv-75wg-m249) inside the ESLint toolchain — development-only, not shipped. The offered fix is a breaking downgrade; left as is and re-checked each milestone |
| Unit / integration / E2E / contract tests | Not applicable yet — no test suites exist                                                                                                                                                                                  |

## Environment found

| Tool              | State                                                    |
| ----------------- | -------------------------------------------------------- |
| Node / npm        | 22.17.1 / 10.9.2                                         |
| Git, GitHub CLI   | Installed; `gh` is signed in                             |
| Rust              | 1.87.0; `wasm32-unknown-unknown` target not installed    |
| WSL               | Ubuntu (WSL 2) available — needed for NEAR sandbox tests |
| Docker            | Installed, daemon not running                            |
| PostgreSQL client | Not installed                                            |
| NEAR CLI          | Not installed                                            |
| FFmpeg            | Not installed (needed for the videos)                    |
| Vercel CLI        | Installed; login state not checked                       |

## Blockers and things needed from the user

1. **Impeccable skill (blocks Milestone 1).** Install it, for example with
   `npx skills add pbakaus/impeccable`, then start a new session so it loads.
2. **PostgreSQL (Milestone 2).** Either start Docker Desktop, or approve PGlite for local use.
   A hosted database for preview needs an account (for example Neon).
3. **NEAR testnet accounts (Milestone 6).** A testnet account to own the contract and one to act
   as the demo organisation's issuer. Their transactions must be signed in the user's wallet.
4. **GitHub remote and Vercel project (Milestone 9).** Creating a repository and deploying are
   outward-facing and wait for the user's go-ahead.
5. **FFmpeg and narration (Milestone 9).** Needed to encode the two videos.

## Known risks

- Next.js 16 has breaking changes from earlier versions; bundled docs are consulted before use.
- NEAR sandbox does not run natively on Windows; contract tests depend on WSL and CI.
- The automated E2E run cannot drive a real wallet approval; that step is manual on testnet.

## Next step

Install Impeccable, then begin Milestone 1 with its context and direction-selection workflow.
