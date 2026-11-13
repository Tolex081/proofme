# ProofMe — Data model

Status: Milestone 0 design. The schema and migrations are implemented in Milestone 2 onward;
this document is updated to match what ships.

Conventions: UUID primary keys, `created_at`/`updated_at` timestamps (UTC), foreign keys on every
reference, Postgres enums for status fields, unique constraints stated below.

## Entities

```text
user 1─1 user_profile
user 1─n connected_account
user 1─n organisation_member n─1 organisation
organisation 1─n organisation_invitation
organisation 1─n project
user 1─n contribution n─1 organisation, n─0..1 project
contribution 1─n evidence
contribution 1─n verification_request 1─n verification_review
verification_request 1─0..1 attestation 1─n attestation_status_event
user 1─n notification
audit_event (append-only; actor, optional organisation)
report (reporter optional; target profile or attestation)
```

### user (owned by the auth library, plus)

`id`, `email` (unique), `status` (active | suspended | deletion_requested), `is_platform_admin`
(boolean, server-set only), timestamps. Auth-provider tables (session, account, verification)
are kept separate from profile data.

### user_profile

`user_id` (unique), `username` (unique, lowercase, 3–30 chars, `[a-z0-9-]`), `display_name`,
`bio`, `avatar_url`, `location`, `website_url`, `social_links` (validated JSON), `skills`
(text[]), `professional_categories` (text[]), `near_account_id` (nullable),
`visibility` (public | private), `section_visibility` (JSON), `onboarding_intent`
(contributor | organisation | both), `onboarded_at`.

### organisation

`name`, `slug` (unique), `description`, `logo_url`, `website_url`, `category`, `contact_links`,
`platform_verification_status` (unverified | pending | verified | rejected | suspended),
`platform_verification_reviewed_by`, `..._reviewed_at`, `..._reason`,
`near_issuer_account_id` (nullable), `near_issuer_status` (none | linked | registered | suspended).

Platform verification and NEAR issuer status are separate columns and separate facts.

### organisation_member

`organisation_id`, `user_id`, `role` (owner | admin | reviewer | viewer),
`status` (active | removed), `invited_by`, `joined_at`. Unique (`organisation_id`, `user_id`).
Removing or demoting the last active owner is rejected in the service and guarded in a transaction.

### organisation_invitation

`organisation_id`, `email`, `role`, `token_hash` (SHA-256 of the token; the raw token is shown
once and never stored), `expires_at`, `accepted_at`, `declined_at`, `revoked_at`, `created_by`.

### project

`organisation_id`, `name`, `slug` (unique), `description`, `website_url`, `repository_url`,
`status` (draft | active | completed | archived), `start_date`, `end_date`.

### contribution

`contributor_user_id`, `organisation_id` (nullable while draft), `project_id` (nullable),
`title`, `summary`, `description`, `category`, `role`, `skills` (text[]), `start_date`,
`end_date`, `visibility` (public | private), `featured` (boolean),
`status` (draft | self_reported | pending | needs_information | approved_pending_anchor |
verified | rejected | revoked | superseded).

### evidence

`contribution_id`, `type` (github_repo | github_pr | github_issue | website | document | demo |
video | other), `url` (https only; validated on write), `label`, `description`, `visibility`.

### verification_request

`contribution_id`, `organisation_id`, `submitted_by`, `status` (pending | needs_information |
approved | rejected | withdrawn), `submitted_at`, `resolved_at`, `assigned_reviewer_id`,
`version` (integer, optimistic lock so two racing decisions cannot both apply).
At most one open request per contribution (partial unique index).

### verification_review (append-only)

`verification_request_id`, `author_user_id`, `kind` (approve | reject | request_information |
contributor_response), `message`, `internal_note` (reviewer-only, never returned to contributor
or public), `created_at`.

### attestation

`id` (UUID; also the public and on-chain ID), `contribution_id`, `verification_request_id`
(unique: one attestation per approved request), `subject_user_id`, `issuer_organisation_id`,
`reviewer_user_id`, `schema_version`, `canonical_payload` (text, exact bytes hashed),
`payload_digest` (hex SHA-256), `status` (active | revoked | superseded), `issued_at`,
`revoked_at`, `revocation_reason`, `supersedes_attestation_id`, `superseded_by_attestation_id`,
`near_network`, `near_contract_id`, `near_issuer_account_id`, `near_transaction_hash`,
`near_revocation_transaction_hash`, `near_anchor_status` (awaiting | submitted | confirmed |
failed), `created_at`.

`canonical_payload`, `payload_digest`, `schema_version` and the subject/issuer columns are never
updated after insert. This is enforced in the service and by a database trigger.

### attestation_status_event (append-only)

`attestation_id`, `previous_status`, `new_status`, `reason`, `actor_user_id`,
`near_transaction_hash`, `created_at`.

### notification

`user_id`, `type`, `title`, `body`, `href`, `read_at`, `created_at`.

### audit_event (append-only)

`actor_user_id`, `organisation_id`, `action`, `entity_type`, `entity_id`, `metadata` (no secrets,
no PII beyond IDs), `created_at`.

### connected_account

`user_id`, `provider`, `provider_account_id`, `public_profile_url`, `connected_at`,
`disconnected_at`. No OAuth tokens are stored: the first release only needs public URLs.

### report

`reporter_user_id` (nullable), `target_type` (profile | attestation | organisation), `target_id`,
`reason`, `details`, `status` (open | reviewed | dismissed), `resolved_by`, `resolved_at`.

## Canonical attestation payload (schema `proofme.attestation.v1`)

Planned shape; fixed with test fixtures in Milestone 5.

```json
{
  "schema": "proofme.attestation.v1",
  "id": "<attestation uuid>",
  "issuedAt": "<ISO 8601 UTC>",
  "issuer": { "organisationId": "<uuid>", "name": "...", "slug": "..." },
  "subject": { "profileId": "<uuid>", "username": "..." },
  "project": { "id": "<uuid>", "name": "..." },
  "claim": {
    "title": "...",
    "summary": "...",
    "description": "...",
    "category": "...",
    "role": "...",
    "skills": ["..."],
    "startDate": "...",
    "endDate": "..."
  },
  "evidence": [{ "type": "...", "url": "...", "label": "..." }],
  "reviewer": { "id": "<reviewer profile uuid, never an account id>" },
  "nonce": "<128-bit random, hex>"
}
```

Canonicalisation: RFC 8785 (JSON Canonicalization Scheme) — keys sorted, no insignificant
whitespace, UTF-8. Digest: SHA-256 over those bytes, lowercase hex. The nonce keeps the digest
from being guessable from public fields alone. No email, legal name or reviewer note is included.
Only the digest and the attestation ID go on-chain.

This is a ProofMe attestation with a NEAR anchor. It is shaped so it can later map onto W3C VC
Data Model 2.0, but it is not a conforming verifiable credential and is not described as one.

## Future: AI-agent attestations

`subject` is modelled as a typed reference (`subject_user_id` today). Adding an `agent` subject
type with operator, model/version and oversight fields is a new schema version and new columns,
not a rewrite. Nothing in the first release claims this exists.

## Added for Track 10 and the Evidence Agent (migration 0005)

| Table or column                                                     | Purpose                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `user_profiles.near_account_verified_at`, `near_account_public_key` | Set only by a NEP-413 proof; credentials go only to a proven account                       |
| `organisations.near_issuer_verified_at`                             | Set only when an owner proves control of the issuer account                                |
| `attestations.subject_consented_at`                                 | The contributor agreed to publish the credential                                           |
| `attestations.credential_reference`, `credential_reference_hash`    | NEP-177 reference (`ipfs://` CID) and its Base64 SHA-256                                   |
| `attestations.near_owner_account_id`                                | The NFT's owner as read back from the contract                                             |
| `verification_requests.replaces_attestation_id`                     | A correction: approving it supersedes that attestation                                     |
| `near_challenges`                                                   | Single-use NEP-413 challenges (purpose, account, user, nonce, expiry, used)                |
| `github_identities`                                                 | GitHub numeric ID (unique) → ProofMe user. Never deleted; reserved on account deletion     |
| `github_oauth_states`                                               | SHA-256 of the OAuth state, its user and PKCE verifier; single use, 10 minutes             |
| `evidence_resources`                                                | A GitHub resource by provider, type, repository ID and number or SHA (unique)              |
| `evidence_investigations`                                           | One versioned Evidence Agent run: report JSON, digest, source and AI status. Never updated |
| `evidence_findings`                                                 | Claim-by-claim findings: status, explanation, origin (deterministic or ai), resources      |
| `evidence_claims`                                                   | A person's relationship to a resource for a contribution (role, attribution, snapshot)     |

### Attestation payload, schema version 2 (`proofme.attestation.v2`)

The public credential. Same as v1 except: `subject` is `{ profileId }` only (no username);
`evidence` holds only items the contributor marked public (0 to 20); there is no `reviewer`;
and `evidenceInvestigation` is `{ id, version, reportDigest }` or null. Its canonical text is
the document published to IPFS, so its SHA-256 is both the on-chain `digest` and, in Base64,
the NFT's `reference_hash`. Version 1 records remain verifiable unchanged.

### Finding statuses

`source_confirmed` (a fact the source states directly; source checks only), `supports_claim`,
`contradicts_claim`, `not_found`, `unavailable` (the source could not be checked; never an
accusation) and `manual_review`. There is no score.
