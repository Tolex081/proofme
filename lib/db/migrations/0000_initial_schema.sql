CREATE TYPE "public"."anchor_status" AS ENUM('awaiting', 'submitted', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."attestation_status" AS ENUM('active', 'revoked', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."contribution_category" AS ENUM('development', 'design', 'research', 'community_management', 'content_documentation', 'product_management', 'project_management', 'mentorship', 'governance', 'hackathon_achievement', 'other');--> statement-breakpoint
CREATE TYPE "public"."contribution_status" AS ENUM('draft', 'self_reported', 'pending', 'needs_information', 'approved_pending_anchor', 'verified', 'rejected', 'revoked', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('github_repo', 'github_pr', 'github_issue', 'website', 'document', 'demo', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."near_issuer_status" AS ENUM('none', 'linked', 'registered', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."near_network" AS ENUM('sandbox', 'testnet');--> statement-breakpoint
CREATE TYPE "public"."onboarding_intent" AS ENUM('contributor', 'organisation', 'both');--> statement-breakpoint
CREATE TYPE "public"."organisation_category" AS ENUM('dao', 'web3_protocol', 'open_source_project', 'startup', 'community', 'hackathon', 'grant_programme', 'other');--> statement-breakpoint
CREATE TYPE "public"."organisation_role" AS ENUM('owner', 'admin', 'reviewer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."platform_verification_status" AS ENUM('unverified', 'pending', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('profile', 'attestation', 'organisation');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deletion_requested');--> statement-breakpoint
CREATE TYPE "public"."verification_request_status" AS ENUM('pending', 'needs_information', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."verification_review_kind" AS ENUM('approve', 'reject', 'request_information', 'contributor_response');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "attestation_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attestation_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"reason" text,
	"actor_user_id" text,
	"near_transaction_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"verification_request_id" uuid NOT NULL,
	"subject_user_id" text NOT NULL,
	"issuer_organisation_id" uuid NOT NULL,
	"reviewer_user_id" text NOT NULL,
	"schema_version" text NOT NULL,
	"canonical_payload" text NOT NULL,
	"payload_digest" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"status" "attestation_status" DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revocation_reason" text,
	"supersedes_attestation_id" uuid,
	"superseded_by_attestation_id" uuid,
	"near_network" "near_network",
	"near_contract_id" text,
	"near_issuer_account_id" text,
	"near_transaction_hash" text,
	"near_revocation_transaction_hash" text,
	"near_anchor_status" "anchor_status" DEFAULT 'awaiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attestations_verification_request_id_unique" UNIQUE("verification_request_id"),
	CONSTRAINT "attestations_payload_digest_unique" UNIQUE("payload_digest"),
	CONSTRAINT "attestations_digest_format" CHECK ("attestations"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "attestations_confirmed_has_transaction" CHECK ("attestations"."near_anchor_status" <> 'confirmed' OR (
        "attestations"."near_transaction_hash" IS NOT NULL AND "attestations"."near_network" IS NOT NULL
        AND "attestations"."near_contract_id" IS NOT NULL AND "attestations"."near_issuer_account_id" IS NOT NULL)),
	CONSTRAINT "attestations_revocation_has_reason" CHECK ("attestations"."status" <> 'revoked' OR (
        "attestations"."revoked_at" IS NOT NULL AND length(btrim(coalesce("attestations"."revocation_reason", ''))) > 0)),
	CONSTRAINT "attestations_superseded_has_successor" CHECK ("attestations"."status" <> 'superseded' OR "attestations"."superseded_by_attestation_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"organisation_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"public_profile_url" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contributor_user_id" text NOT NULL,
	"organisation_id" uuid,
	"project_id" uuid,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" "contribution_category" DEFAULT 'other' NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"start_date" date,
	"end_date" date,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"status" "contribution_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_org_required_after_draft" CHECK ("contributions"."status" IN ('draft', 'self_reported') OR "contributions"."organisation_id" IS NOT NULL),
	CONSTRAINT "contributions_dates_ordered" CHECK ("contributions"."start_date" IS NULL OR "contributions"."end_date" IS NULL OR "contributions"."start_date" <= "contributions"."end_date"),
	CONSTRAINT "contributions_featured_only_verified" CHECK (NOT "contributions"."featured" OR "contributions"."status" = 'verified')
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"type" "evidence_type" NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_url_scheme" CHECK ("evidence"."url" ~ '^https://' OR "evidence"."url" ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/|$)')
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisation_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "organisation_role" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisation_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "organisation_invitations_no_owner" CHECK ("organisation_invitations"."role" <> 'owner')
);
--> statement-breakpoint
CREATE TABLE "organisation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "organisation_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"invited_by" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website_url" text,
	"category" "organisation_category" NOT NULL,
	"contact_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"platform_verification_status" "platform_verification_status" DEFAULT 'unverified' NOT NULL,
	"platform_verification_reviewed_by" text,
	"platform_verification_reviewed_at" timestamp with time zone,
	"platform_verification_reason" text,
	"near_issuer_account_id" text,
	"near_issuer_status" "near_issuer_status" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organisations_slug_format" CHECK ("organisations"."slug" ~ '^[a-z0-9](?:[a-z0-9-]{1,58})[a-z0-9]$'),
	CONSTRAINT "organisations_issuer_account_present" CHECK ("organisations"."near_issuer_status" = 'none' OR "organisations"."near_issuer_account_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"website_url" text,
	"repository_url" text,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_dates_ordered" CHECK ("projects"."start_date" IS NULL OR "projects"."end_date" IS NULL OR "projects"."start_date" <= "projects"."end_date")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" text,
	"target_type" "report_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"location" text,
	"website_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"professional_categories" text[] DEFAULT '{}' NOT NULL,
	"near_account_id" text,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"section_visibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_intent" "onboarding_intent",
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "user_profiles_username_format" CHECK ("user_profiles"."username" ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"submitted_by" text NOT NULL,
	"status" "verification_request_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"assigned_reviewer_id" text,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_request_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"kind" "verification_review_kind" NOT NULL,
	"message" text,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_reviews_message_required" CHECK ("verification_reviews"."kind" = 'approve' OR length(btrim(coalesce("verification_reviews"."message", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "attestation_status_events" ADD CONSTRAINT "attestation_status_events_attestation_id_attestations_id_fk" FOREIGN KEY ("attestation_id") REFERENCES "public"."attestations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestation_status_events" ADD CONSTRAINT "attestation_status_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_verification_request_id_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."verification_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_issuer_organisation_id_organisations_id_fk" FOREIGN KEY ("issuer_organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_contributor_user_id_users_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_platform_verification_reviewed_by_users_id_fk" FOREIGN KEY ("platform_verification_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_assigned_reviewer_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_verification_request_id_verification_requests_id_fk" FOREIGN KEY ("verification_request_id") REFERENCES "public"."verification_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_reviews" ADD CONSTRAINT "verification_reviews_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attestation_status_events_attestation" ON "attestation_status_events" USING btree ("attestation_id");--> statement-breakpoint
CREATE INDEX "attestations_subject" ON "attestations" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "attestations_issuer" ON "attestations" USING btree ("issuer_organisation_id");--> statement-breakpoint
CREATE INDEX "audit_events_org_created" ON "audit_events" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connected_accounts_user_provider" ON "connected_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "contributions_contributor" ON "contributions" USING btree ("contributor_user_id");--> statement-breakpoint
CREATE INDEX "contributions_org_status" ON "contributions" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "evidence_contribution" ON "evidence" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "organisation_invitations_org" ON "organisation_invitations" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "organisation_invitations_email" ON "organisation_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "organisation_members_org_user" ON "organisation_members" USING btree ("organisation_id","user_id");--> statement-breakpoint
CREATE INDEX "organisation_members_user" ON "organisation_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_org" ON "projects" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "reports_status" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verification_requests_org_status" ON "verification_requests" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_requests_one_open" ON "verification_requests" USING btree ("contribution_id") WHERE "verification_requests"."status" IN ('pending', 'needs_information');--> statement-breakpoint
CREATE INDEX "verification_reviews_request" ON "verification_reviews" USING btree ("verification_request_id");