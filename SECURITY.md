# ProofMe — Security and privacy

Status: 13 November 2026 (Track 10 and Evidence Agent work). Each control is marked done only when it is implemented
and tested; the table is updated every milestone.

## Threats that matter most

| Threat                                             | Control                                                                                                         | State     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| Contributor approves their own claim               | Service rejects any review where reviewer = contributor, regardless of role                                     | done      |
| Non-member or wrong-role user reviews              | Membership + role checked in the service on every review action                                                 | done      |
| Organisation A reads/mutates Organisation B's data | Every query scoped by organisation ID resolved from membership, never from the URL alone                        | done      |
| IDOR on contributions, requests, notifications     | Ownership/membership check on every read and write by ID                                                        | done      |
| Role escalation via request body                   | Roles only settable by owner/admin through the membership service; never read from client input elsewhere       | done      |
| Racing reviewers produce conflicting decisions     | Optimistic lock on the request row inside a transaction                                                         | done¹     |
| Approved claim edited after the fact               | Frozen canonical payload; service refuses updates; database trigger blocks them                                 | done      |
| Fake "on-chain verified" status                    | Server confirms the transaction on RPC (success, contract, signer, digest) before recording it                  | done²     |
| Duplicate anchor after a retry                     | Attestation ID is the on-chain key; contract rejects duplicates; reconcile reads instead of re-sending          | partly³   |
| Unsafe evidence URLs                               | https-only allow-list; reject `javascript:`, `data:`, `file:`, credentials in URL; no server-side fetching      | done      |
| Admin forges or edits an attestation               | No admin code path writes attestation content; admin actions limited to organisation state and reports          | done      |
| Invitation token theft from the database           | Only a SHA-256 hash stored; tokens expire and are single-use                                                    | done      |
| Brute force / abuse                                | Rate limits on auth, invitations, submissions, reviews, public endpoints                                        | partly⁴   |
| Secrets in the repo                                | `.env*` ignored (except `.env.example`); no keys in code; CI has read-only permissions                          | done      |
| Server-held wallet keys                            | None exist. All NEAR writes are signed in the user's wallet                                                     | by design |
| Naming someone else's NEAR account                 | NEP-413 signed challenge (single-use, 10 min, bound to user and purpose); key checked as full-access on-chain   | done      |
| Unverified organisation issuing credentials        | Issuer policy: ProofMe-verified + wallet-proven issuer account + registered on contract, checked at mint        | done      |
| Credential minted to the wrong account or digest   | Mint confirmation compares transaction args and the token read back: receiver, owner, digest, reference, status | done      |
| Private data in a public credential                | v2 credential: no username or reviewer, public evidence only, private evidence refused; consent required        | done      |
| Linking another person's GitHub account            | OAuth with session-bound single-use state and PKCE; identity = GitHub numeric ID from GitHub; unique index      | done      |
| GitHub identity reassigned or released             | Triggers block delete, transfer and re-claim; account deletion leaves it reserved                               | done      |
| Server-side request forgery via evidence URLs      | GitHub links parsed to owner/repo/number/SHA; requests built to api.github.com only, redirects refused          | done      |
| Prompt injection through GitHub content            | GitHub text passed as quoted untrusted data; AI output schema-validated; no tools; cannot confirm or approve    | done      |
| Evidence reused or claimed by someone else         | Resource identity by repository ID + number/SHA; reuse and conflicting authorship flagged for the reviewer      | done      |

1. A row lock and a version check inside one transaction. Not exercised with truly concurrent
   requests, because the test database (PGlite) has a single connection.
2. Tested in the service against a stand-in chain; not yet run with a real wallet on testnet.
3. The contract rejects a second token with the same ID. Reconciliation (finding a token whose
   confirmation never reached the server) is not built yet.
4. Sign-in and sign-up are rate-limited by the auth library outside local development. Creating
   claims, sending them for review, deciding, inviting, creating organisations and projects, and
   reporting are limited per person (`server/services/limits.ts`). Public pages have no
   application limit; that is left to the hosting platform's protection.

## Platform controls

- Sessions through Better Auth: HTTP-only, SameSite=Lax cookies, `Secure` outside local
  development. Suspending an account deletes its sessions.
- CSRF: server actions accept only POST and Next.js rejects them when the Origin and Host headers
  differ; Better Auth checks the origin of its own endpoints. The one route handler
  (`/api/account/export`) is a GET that only reads the caller's own data.
- Security headers on every response (`lib/security/headers.ts`, unit-tested): a Content
  Security Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a permissions
  policy, and HSTS outside local development. Why the policy allows inline scripts and HTTPS
  connections is in DECISIONS.md (D36). The browser suite fails on any policy violation; the
  wallet picker is checked under the policy with `PROOFME_NETWORK_TESTS=1`.
- Errors shown to users never include messages or stack traces: `app/error.tsx` shows only the
  reference code that matches the server log entry.
- Environment validation refuses hosted environments without a real database, on a local or
  plain-http address, or on any NEAR network but testnet. Values never appear in its errors.
- `npm audit` (11 Nov 2026): 4 moderate findings, all in the esbuild copy bundled with
  `drizzle-kit`, the migration generator. It is a development tool that is never deployed; the
  fix requires a breaking major upgrade, so it is left for now.

## Privacy

- Private profiles, drafts and pending claims are never returned by public queries.
- Reviewer internal notes are returned only to members of the reviewing organisation.
- On-chain data is limited to: attestation ID (random UUID), digest, issuer account, timestamps,
  revocation flag. No names, emails, URLs or free text.
- The digest includes a random nonce so it cannot be reproduced from public fields by guessing.
- A published (v2) credential names the contributor only by an opaque profile ID, includes only
  evidence they marked public, and leaves out the reviewer. It is published to IPFS only after
  the contributor agrees, and never for a private contribution. Publication cannot be undone.
- GitHub OAuth requests no scopes. The access token is used once to read the account and then
  discarded; it is never stored or sent to the browser. Only the numeric ID and login are kept.
- Evidence reports store public GitHub facts and short snapshots. They are shown to the
  contributor and the reviewing organisation, not published. A credential cites a report only
  by ID and digest.
- Account export and deletion request are provided. Issued attestations are retained after
  account deletion in the minimal form needed to keep the public record resolvable; this is
  explained to the user. A revoked record stays visible as revoked; chain history cannot be erased.
- No third-party analytics or tracking.

## Mainnet gate

Mainnet is not enabled. Environment validation rejects it. Enabling it requires the user's
separate approval, a contract review, an ownership/upgrade plan, issuer onboarding and suspension
policy, an incident plan, and a privacy review of every on-chain field.

## Known gaps

- No nonce-based script policy (pages are prerendered; see D36).
- No email provider: email verification and password reset are off.
- Reconciliation of NEAR tokens is not built (see note 3).
- No uploads exist, so no upload controls are needed yet.

## Reporting

Security issues: contact the repository owner privately. Do not open a public issue.
