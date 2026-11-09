# ProofMe — Security and privacy

Status: Milestone 0. This is the control plan. Each control is marked done only when it is
implemented and tested; the table is updated every milestone.

## Threats that matter most

| Threat                                             | Control                                                                                                    | State     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| Contributor approves their own claim               | Service rejects any review where reviewer = contributor, regardless of role                                | planned   |
| Non-member or wrong-role user reviews              | Membership + role checked in the service on every review action                                            | planned   |
| Organisation A reads/mutates Organisation B's data | Every query scoped by organisation ID resolved from membership, never from the URL alone                   | planned   |
| IDOR on contributions, requests, notifications     | Ownership/membership check on every read and write by ID                                                   | planned   |
| Role escalation via request body                   | Roles only settable by owner/admin through the membership service; never read from client input elsewhere  | planned   |
| Racing reviewers produce conflicting decisions     | Optimistic lock on the request row inside a transaction                                                    | planned   |
| Approved claim edited after the fact               | Frozen canonical payload; service refuses updates; database trigger blocks them                            | planned   |
| Fake "on-chain verified" status                    | Server confirms the transaction on RPC (success, contract, signer, digest) before recording it             | planned   |
| Duplicate anchor after a retry                     | Attestation ID is the on-chain key; contract rejects duplicates; reconcile reads instead of re-sending     | planned   |
| Unsafe evidence URLs                               | https-only allow-list; reject `javascript:`, `data:`, `file:`, credentials in URL; no server-side fetching | planned   |
| Admin forges or edits an attestation               | No admin code path writes attestation content; admin actions limited to organisation state and reports     | planned   |
| Invitation token theft from the database           | Only a SHA-256 hash stored; tokens expire and are single-use                                               | planned   |
| Brute force / abuse                                | Rate limits on auth, invitations, submissions, reviews, public endpoints                                   | planned   |
| Secrets in the repo                                | `.env*` ignored (except `.env.example`); no keys in code; CI has read-only permissions                     | done      |
| Server-held wallet keys                            | None exist. All NEAR writes are signed in the user's wallet                                                | by design |

## Platform controls

- Sessions through a maintained auth library; HTTP-only, secure, same-site cookies.
- CSRF: mutations go through server actions / same-origin checks provided by the framework and
  auth library; verified in Milestone 8.
- Security headers and a Content Security Policy, added and tested in Milestone 8.
- Errors shown to users never include stack traces or internal identifiers.
- `npm audit` reviewed each milestone; critical findings investigated.

## Privacy

- Private profiles, drafts and pending claims are never returned by public queries.
- Reviewer internal notes are returned only to members of the reviewing organisation.
- On-chain data is limited to: attestation ID (random UUID), digest, issuer account, timestamps,
  revocation flag. No names, emails, URLs or free text.
- The digest includes a random nonce so it cannot be reproduced from public fields by guessing.
- Account export and deletion request are provided. Issued attestations are retained after
  account deletion in the minimal form needed to keep the public record resolvable; this is
  explained to the user. A revoked record stays visible as revoked; chain history cannot be erased.
- No third-party analytics or tracking.

## Mainnet gate

Mainnet is not enabled. Environment validation rejects it. Enabling it requires the user's
separate approval, a contract review, an ownership/upgrade plan, issuer onboarding and suspension
policy, an incident plan, and a privacy review of every on-chain field.

## Known gaps at this milestone

Everything marked planned. No application features exist yet.

## Reporting

Security issues: contact the repository owner privately. Do not open a public issue.
