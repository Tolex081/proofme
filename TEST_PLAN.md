# ProofMe — Test plan

Status: Milestone 0. No dedicated testing skill is installed in this environment, so this plan
follows the brief's strategy and current framework documentation.

## Commands

| Check            | Command                                      | Available from |
| ---------------- | -------------------------------------------- | -------------- |
| Format           | `npm run format:check`                       | M0             |
| Lint             | `npm run lint`                               | M0             |
| Typecheck        | `npm run typecheck`                          | M0             |
| Build            | `npm run build`                              | M0             |
| All of the above | `npm run check`                              | M0             |
| Unit             | `npm run test:unit`                          | M2             |
| Integration      | `npm run test:integration`                   | M2             |
| E2E              | `npm run test:e2e`                           | M2             |
| Contract         | `cargo test` in `contracts/proofme-registry` | M6             |

## Layers

**Unit (Vitest, no I/O).** Status transitions for contributions, requests and attestations;
permission helpers for every role × action; evidence URL validation (accepted and rejected
schemes, credentials, malformed input); canonicalisation and digest against fixed fixtures;
visibility filtering; NEAR transaction-result parsing.

**Integration (Vitest + real PostgreSQL).** Migrations apply cleanly; services enforce auth,
membership, ownership; submission creates a request; decisions append reviews; approval freezes
the snapshot and a later update attempt fails; racing decisions resolve to one; revocation and
supersession keep history; audit and notification rows are written; cross-organisation reads and
writes are refused.

**Contract (Rust, near-workspaces sandbox).** Owner registers issuer; non-owner cannot;
registered issuer anchors; unregistered cannot; duplicate ID rejected; wrong issuer cannot revoke;
revoked is not active; digest and state returned correctly; invalid input rejected; events match
state. The sandbox does not run natively on Windows, so these run under WSL locally and on Linux
in CI.

**E2E (Playwright).** The fifteen journeys in brief §14.1, including self-approval refusal,
cross-organisation refusal, and mobile navigation. The wallet-signature step uses a real testnet
wallet in a manual run; the automated run uses a sandbox-backed test signer and is labelled as such.

**Accessibility.** axe checks in Playwright on core screens, plus manual keyboard passes.

**Responsive.** Screenshots at 1440, 1280, 768 and 390 for landing, dashboard, contribution form,
reviewer queue, public profile and verification page, reviewed in one round with one confirmation round.

## Rules

- A result is recorded as passed only if it ran and passed. Skips are listed with the reason.
- Tests are never disabled to get a green run.
- Results for each milestone are written to `BUILD_STATUS.md`.
