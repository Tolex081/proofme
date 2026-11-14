/**
 * Atesta database schema (PostgreSQL, Drizzle).
 *
 * Immutability and append-only guarantees are not left to application code
 * alone: the triggers in the `*_integrity_triggers.sql` migration enforce
 * them in the database as well.
 *
 * The `users` table holds the columns the authentication library needs plus
 * Atesta's own flags. Session, account and verification-token tables are
 * added with authentication in Milestone 2.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { CONTRIBUTION_CATEGORIES } from "../attestations/payload";
import {
  ANCHOR_STATUSES,
  ATTESTATION_STATUSES,
  CONTRIBUTION_STATUSES,
  VERIFICATION_REQUEST_STATUSES,
} from "../domain/status";
import { ORGANISATION_ROLES } from "../permissions/organisation";
import { EVIDENCE_TYPES } from "../urls/evidence";

// ── Enums ────────────────────────────────────────────────────────────────────

export const userStatus = pgEnum("user_status", ["active", "suspended", "deletion_requested"]);
export const visibility = pgEnum("visibility", ["public", "private"]);
export const onboardingIntent = pgEnum("onboarding_intent", [
  "contributor",
  "organisation",
  "both",
]);
export const organisationCategory = pgEnum("organisation_category", [
  "dao",
  "web3_protocol",
  "open_source_project",
  "startup",
  "community",
  "hackathon",
  "grant_programme",
  "other",
]);
export const platformVerificationStatus = pgEnum("platform_verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
  "suspended",
]);
export const nearIssuerStatus = pgEnum("near_issuer_status", [
  "none",
  "linked",
  "registered",
  "suspended",
]);
export const organisationRole = pgEnum("organisation_role", ORGANISATION_ROLES);
export const membershipStatus = pgEnum("membership_status", ["active", "removed"]);
export const projectStatus = pgEnum("project_status", ["draft", "active", "completed", "archived"]);
export const contributionCategory = pgEnum("contribution_category", CONTRIBUTION_CATEGORIES);
export const contributionStatus = pgEnum("contribution_status", CONTRIBUTION_STATUSES);
export const evidenceType = pgEnum("evidence_type", EVIDENCE_TYPES);
export const verificationRequestStatus = pgEnum(
  "verification_request_status",
  VERIFICATION_REQUEST_STATUSES,
);
export const verificationReviewKind = pgEnum("verification_review_kind", [
  "approve",
  "reject",
  "request_information",
  "contributor_response",
]);
export const attestationStatus = pgEnum("attestation_status", ATTESTATION_STATUSES);
export const anchorStatus = pgEnum("anchor_status", ANCHOR_STATUSES);
export const nearNetwork = pgEnum("near_network", ["sandbox", "testnet"]);
export const reportTargetType = pgEnum("report_target_type", [
  "profile",
  "attestation",
  "organisation",
]);
export const reportStatus = pgEnum("report_status", ["open", "reviewed", "dismissed"]);

// ── Shared columns ───────────────────────────────────────────────────────────

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const instant = (name: string) => timestamp(name, { withTimezone: true });

// ── Users and profiles ───────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  status: userStatus("status").notNull().default("active"),
  // Set only by a server-side setup script. Never writable from a request.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    location: text("location"),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
    skills: text("skills").array().notNull().default([]),
    professionalCategories: text("professional_categories").array().notNull().default([]),
    nearAccountId: text("near_account_id"),
    // Set only after a NEP-413 signature by a full-access key of nearAccountId.
    nearAccountVerifiedAt: instant("near_account_verified_at"),
    nearAccountPublicKey: text("near_account_public_key"),
    visibility: visibility("visibility").notNull().default("private"),
    sectionVisibility: jsonb("section_visibility")
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    onboardingIntent: onboardingIntent("onboarding_intent"),
    onboardedAt: instant("onboarded_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "user_profiles_username_format",
      sql`${table.username} ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$'`,
    ),
  ],
);

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    publicProfileUrl: text("public_profile_url"),
    connectedAt: instant("connected_at").notNull().defaultNow(),
    disconnectedAt: instant("disconnected_at"),
  },
  (table) => [uniqueIndex("connected_accounts_user_provider").on(table.userId, table.provider)],
);

// ── Organisations ────────────────────────────────────────────────────────────

export const organisations = pgTable(
  "organisations",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    logoUrl: text("logo_url"),
    websiteUrl: text("website_url"),
    category: organisationCategory("category").notNull(),
    contactLinks: jsonb("contact_links").$type<Record<string, string>>().notNull().default({}),
    // Platform review and NEAR issuer registration are separate facts.
    platformVerificationStatus: platformVerificationStatus("platform_verification_status")
      .notNull()
      .default("unverified"),
    platformVerificationReviewedBy: text("platform_verification_reviewed_by").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    platformVerificationReviewedAt: instant("platform_verification_reviewed_at"),
    platformVerificationReason: text("platform_verification_reason"),
    nearIssuerAccountId: text("near_issuer_account_id"),
    nearIssuerStatus: nearIssuerStatus("near_issuer_status").notNull().default("none"),
    // Set only after a NEP-413 signature by a full-access key of nearIssuerAccountId.
    nearIssuerVerifiedAt: instant("near_issuer_verified_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "organisations_slug_format",
      sql`${table.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$'`,
    ),
    // An issuer status other than `none` is meaningless without an account.
    check(
      "organisations_issuer_account_present",
      sql`${table.nearIssuerStatus} = 'none' OR ${table.nearIssuerAccountId} IS NOT NULL`,
    ),
  ],
);

export const organisationMembers = pgTable(
  "organisation_members",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: organisationRole("role").notNull(),
    status: membershipStatus("status").notNull().default("active"),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    joinedAt: instant("joined_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("organisation_members_org_user").on(table.organisationId, table.userId),
    index("organisation_members_user").on(table.userId),
  ],
);

export const organisationInvitations = pgTable(
  "organisation_invitations",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: organisationRole("role").notNull(),
    // SHA-256 of the invitation token. The token itself is never stored.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    acceptedAt: instant("accepted_at"),
    declinedAt: instant("declined_at"),
    revokedAt: instant("revoked_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    index("organisation_invitations_org").on(table.organisationId),
    index("organisation_invitations_email").on(table.email),
    // Ownership is never granted by invitation.
    check("organisation_invitations_no_owner", sql`${table.role} <> 'owner'`),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    websiteUrl: text("website_url"),
    repositoryUrl: text("repository_url"),
    status: projectStatus("status").notNull().default("draft"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("projects_org").on(table.organisationId),
    check(
      "projects_dates_ordered",
      sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.startDate} <= ${table.endDate}`,
    ),
  ],
);

// ── Contributions and evidence ───────────────────────────────────────────────

export const contributions = pgTable(
  "contributions",
  {
    id: id(),
    contributorUserId: text("contributor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Null only while the claim is still a draft.
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    category: contributionCategory("category").notNull().default("other"),
    role: text("role").notNull().default(""),
    skills: text("skills").array().notNull().default([]),
    startDate: date("start_date"),
    endDate: date("end_date"),
    visibility: visibility("visibility").notNull().default("private"),
    featured: boolean("featured").notNull().default(false),
    status: contributionStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("contributions_contributor").on(table.contributorUserId),
    index("contributions_org_status").on(table.organisationId, table.status),
    check(
      "contributions_org_required_after_draft",
      sql`${table.status} IN ('draft', 'self_reported') OR ${table.organisationId} IS NOT NULL`,
    ),
    check(
      "contributions_dates_ordered",
      sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.startDate} <= ${table.endDate}`,
    ),
    // Only a currently verified contribution can be featured.
    check(
      "contributions_featured_only_verified",
      sql`NOT ${table.featured} OR ${table.status} = 'verified'`,
    ),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: id(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    type: evidenceType("type").notNull(),
    url: text("url").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    visibility: visibility("visibility").notNull().default("public"),
    // The order the contributor listed the links in.
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [
    index("evidence_contribution").on(table.contributionId, table.position),
    // Defence in depth behind the application's URL validation.
    check(
      "evidence_url_scheme",
      sql`${table.url} ~ '^https://' OR ${table.url} ~ '^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?(/|$)'`,
    ),
  ],
);

// ── Verification ─────────────────────────────────────────────────────────────

export const verificationRequests = pgTable(
  "verification_requests",
  {
    id: id(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    submittedBy: text("submitted_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: verificationRequestStatus("status").notNull().default("pending"),
    submittedAt: instant("submitted_at").notNull().defaultNow(),
    resolvedAt: instant("resolved_at"),
    assignedReviewerId: text("assigned_reviewer_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Optimistic lock: a decision applies only if the version it read is still current.
    version: integer("version").notNull().default(0),
    // A correction: approving this request replaces (supersedes) that attestation.
    replacesAttestationId: uuid("replaces_attestation_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("verification_requests_org_status").on(table.organisationId, table.status),
    // At most one open request per contribution.
    uniqueIndex("verification_requests_one_open")
      .on(table.contributionId)
      .where(sql`${table.status} IN ('pending', 'needs_information')`),
  ],
);

/** Append-only. See the integrity triggers migration. */
export const verificationReviews = pgTable(
  "verification_reviews",
  {
    id: id(),
    verificationRequestId: uuid("verification_request_id")
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "restrict" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: verificationReviewKind("kind").notNull(),
    // Shown to the contributor.
    message: text("message"),
    // Visible only to members of the reviewing organisation.
    internalNote: text("internal_note"),
    createdAt: createdAt(),
  },
  (table) => [
    index("verification_reviews_request").on(table.verificationRequestId),
    check(
      "verification_reviews_message_required",
      sql`${table.kind} = 'approve' OR length(btrim(coalesce(${table.message}, ''))) > 0`,
    ),
  ],
);

// ── Attestations ─────────────────────────────────────────────────────────────

/**
 * The frozen columns (everything describing what was approved) can never be
 * updated, and rows can never be deleted. See the integrity triggers migration.
 */
export const attestations = pgTable(
  "attestations",
  {
    // Also the public identifier and the key in the NEAR registry.
    id: id(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "restrict" }),
    verificationRequestId: uuid("verification_request_id")
      .notNull()
      .unique()
      .references(() => verificationRequests.id, { onDelete: "restrict" }),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    issuerOrganisationId: uuid("issuer_organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    schemaVersion: text("schema_version").notNull(),
    canonicalPayload: text("canonical_payload").notNull(),
    payloadDigest: text("payload_digest").notNull().unique(),
    issuedAt: instant("issued_at").notNull(),

    status: attestationStatus("status").notNull().default("active"),
    revokedAt: instant("revoked_at"),
    revocationReason: text("revocation_reason"),
    supersedesAttestationId: uuid("supersedes_attestation_id"),
    supersededByAttestationId: uuid("superseded_by_attestation_id"),

    nearNetwork: nearNetwork("near_network"),
    nearContractId: text("near_contract_id"),
    nearIssuerAccountId: text("near_issuer_account_id"),
    nearTransactionHash: text("near_transaction_hash"),
    nearRevocationTransactionHash: text("near_revocation_transaction_hash"),
    nearAnchorStatus: anchorStatus("near_anchor_status").notNull().default("awaiting"),
    // The account the NFT was minted to, read back from the contract.
    nearOwnerAccountId: text("near_owner_account_id"),
    // The contributor agreed to publish this record as a public NFT credential.
    subjectConsentedAt: instant("subject_consented_at"),
    // NEP-177 reference: the public credential document and its Base64 SHA-256.
    credentialReference: text("credential_reference"),
    credentialReferenceHash: text("credential_reference_hash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("attestations_subject").on(table.subjectUserId),
    index("attestations_issuer").on(table.issuerOrganisationId),
    check("attestations_digest_format", sql`${table.payloadDigest} ~ '^[0-9a-f]{64}$'`),
    // "Confirmed" must always be backed by a real transaction reference.
    check(
      "attestations_confirmed_has_transaction",
      sql`${table.nearAnchorStatus} <> 'confirmed' OR (
        ${table.nearTransactionHash} IS NOT NULL AND ${table.nearNetwork} IS NOT NULL
        AND ${table.nearContractId} IS NOT NULL AND ${table.nearIssuerAccountId} IS NOT NULL)`,
    ),
    check(
      "attestations_revocation_has_reason",
      sql`${table.status} <> 'revoked' OR (
        ${table.revokedAt} IS NOT NULL AND length(btrim(coalesce(${table.revocationReason}, ''))) > 0)`,
    ),
    check(
      "attestations_superseded_has_successor",
      sql`${table.status} <> 'superseded' OR ${table.supersededByAttestationId} IS NOT NULL`,
    ),
  ],
);

/** Append-only. */
export const attestationStatusEvents = pgTable(
  "attestation_status_events",
  {
    id: id(),
    attestationId: uuid("attestation_id")
      .notNull()
      .references(() => attestations.id, { onDelete: "restrict" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    reason: text("reason"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    nearTransactionHash: text("near_transaction_hash"),
    createdAt: createdAt(),
  },
  (table) => [index("attestation_status_events_attestation").on(table.attestationId)],
);

/**
 * One-time challenges for NEP-413 signed messages. A challenge is bound to a
 * purpose, an account and (for signed-in purposes) a user, expires quickly and
 * can be used once.
 */
export const nearChallenges = pgTable(
  "near_challenges",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    purpose: text("purpose").notNull(),
    accountId: text("account_id").notNull(),
    /** Base64 of 32 random bytes. */
    nonce: text("nonce").notNull().unique(),
    message: text("message").notNull(),
    recipient: text("recipient").notNull(),
    expiresAt: instant("expires_at").notNull(),
    usedAt: instant("used_at"),
    createdAt: createdAt(),
  },
  (table) => [
    check(
      "near_challenges_purpose",
      sql`${table.purpose} IN ('contributor_account', 'issuer_account', 'holder_access')`,
    ),
  ],
);

// ── GitHub identity and evidence investigations ──────────────────────────────

/**
 * A GitHub account linked to a Atesta user, keyed by GitHub's numeric user
 * ID. The unique index on github_user_id is the final authority that one
 * GitHub account belongs to one Atesta user. Rows are never deleted:
 * disconnecting keeps the reservation, and deleting the Atesta account keeps
 * it too (user_id becomes null, status "reserved"), so the identity is never
 * silently released to someone else.
 */
export const githubIdentities = pgTable(
  "github_identities",
  {
    id: id(),
    githubUserId: bigint("github_user_id", { mode: "number" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Display only. Usernames change; the numeric ID does not. */
    login: text("login").notNull(),
    status: text("status").notNull().default("connected"),
    connectedAt: instant("connected_at").notNull().defaultNow(),
    disconnectedAt: instant("disconnected_at"),
    lastVerifiedAt: instant("last_verified_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("github_identities_github_user").on(table.githubUserId),
    index("github_identities_user").on(table.userId),
    check(
      "github_identities_status",
      sql`${table.status} IN ('connected', 'disconnected', 'reserved')`,
    ),
  ],
);

/** Single-use OAuth state, bound to the signed-in user, with its PKCE verifier. */
export const githubOauthStates = pgTable("github_oauth_states", {
  /** SHA-256 of the state value; the raw value only travels in the redirect. */
  stateHash: text("state_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeVerifier: text("code_verifier").notNull(),
  expiresAt: instant("expires_at").notNull(),
  usedAt: instant("used_at"),
  createdAt: createdAt(),
});

/** An external resource (a GitHub PR, commit, issue or repository), by stable IDs. */
export const evidenceResources = pgTable(
  "evidence_resources",
  {
    id: id(),
    provider: text("provider").notNull(),
    resourceType: text("resource_type").notNull(),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    /** PR or issue number, commit SHA, or the repository ID again. */
    externalId: text("external_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    firstSeenAt: instant("first_seen_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("evidence_resources_identity").on(
      table.provider,
      table.resourceType,
      table.repositoryId,
      table.externalId,
    ),
    check(
      "evidence_resources_type",
      sql`${table.resourceType} IN ('repository', 'pull_request', 'commit', 'issue')`,
    ),
  ],
);

/** One run of the Evidence Agent for a contribution. Versioned, never overwritten. */
export const evidenceInvestigations = pgTable(
  "evidence_investigations",
  {
    id: id(),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    githubUserId: bigint("github_user_id", { mode: "number" }),
    githubLoginSnapshot: text("github_login_snapshot"),
    /** completed: every source answered; partial: some could not be checked. */
    sourceStatus: text("source_status").notNull(),
    /** completed, not_configured, unavailable or rejected (output failed validation). */
    aiStatus: text("ai_status").notNull(),
    aiModel: text("ai_model"),
    report: jsonb("report").notNull(),
    /** SHA-256 of the canonical report, so a credential can cite it. */
    reportDigest: text("report_digest").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("evidence_investigations_version").on(table.contributionId, table.version),
    check("evidence_investigations_digest", sql`${table.reportDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** One claim-by-claim finding in an investigation. */
export const evidenceFindings = pgTable(
  "evidence_findings",
  {
    id: id(),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => evidenceInvestigations.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    claim: text("claim").notNull(),
    status: text("status").notNull(),
    explanation: text("explanation").notNull(),
    /** deterministic (from source data) or ai (model interpretation). */
    origin: text("origin").notNull(),
    resourceIds: uuid("resource_ids").array().notNull().default([]),
    createdAt: createdAt(),
  },
  (table) => [
    index("evidence_findings_investigation").on(table.investigationId, table.position),
    check(
      "evidence_findings_status",
      sql`${table.status} IN ('source_confirmed', 'supports_claim', 'contradicts_claim', 'not_found', 'unavailable', 'manual_review')`,
    ),
    check("evidence_findings_origin", sql`${table.origin} IN ('deterministic', 'ai')`),
  ],
);

/**
 * How one person relates to one resource, as the source establishes it, for
 * one contribution. Many people can relate to the same resource in different
 * roles; nobody owns a resource by submitting it first.
 */
export const evidenceClaims = pgTable(
  "evidence_claims",
  {
    id: id(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => evidenceResources.id, { onDelete: "restrict" }),
    contributionId: uuid("contribution_id")
      .notNull()
      .references(() => contributions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    investigationId: uuid("investigation_id")
      .notNull()
      .references(() => evidenceInvestigations.id, { onDelete: "cascade" }),
    /** The contributor's relationship to the resource per the source. */
    role: text("role").notNull(),
    /** confirmed: the source names the linked account; contradicted: it names someone else. */
    attribution: text("attribution").notNull(),
    githubUserId: bigint("github_user_id", { mode: "number" }),
    snapshot: jsonb("snapshot").notNull(),
    snapshotDigest: text("snapshot_digest").notNull(),
    retrievedAt: instant("retrieved_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("evidence_claims_resource").on(table.resourceId),
    index("evidence_claims_contribution").on(table.contributionId),
    check(
      "evidence_claims_attribution",
      sql`${table.attribution} IN ('confirmed', 'contradicted', 'unverified')`,
    ),
  ],
);

// ── Notifications, audit, reports ────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: instant("read_at"),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_created").on(table.userId, table.createdAt)],
);

/** Append-only. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    // Identifiers and state names only. No secrets, tokens or personal details.
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_events_org_created").on(table.organisationId, table.createdAt),
    index("audit_events_entity").on(table.entityType, table.entityId),
    // Per-person rate limits count recent events by actor (server/services/limits.ts).
    index("audit_events_actor_created").on(table.actorUserId, table.createdAt),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: id(),
    reporterUserId: text("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: reportTargetType("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: instant("resolved_at"),
    createdAt: createdAt(),
  },
  (table) => [index("reports_status").on(table.status)],
);

// ── Authentication (Better Auth) ─────────────────────────────────────────────
// Column sets follow the tables the installed Better Auth version expects.
// Kept apart from profile data: nothing here is ever shown publicly.

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("sessions_user").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    // A salted hash produced by the authentication library. Never a plain password.
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_user").on(table.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("verifications_identifier").on(table.identifier)],
);

export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
