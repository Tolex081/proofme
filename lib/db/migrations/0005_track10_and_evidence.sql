CREATE TABLE "evidence_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"contribution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"investigation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"attribution" text NOT NULL,
	"github_user_id" bigint,
	"snapshot" jsonb NOT NULL,
	"snapshot_digest" text NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_claims_attribution" CHECK ("evidence_claims"."attribution" IN ('confirmed', 'contradicted', 'unverified'))
);
--> statement-breakpoint
CREATE TABLE "evidence_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"claim" text NOT NULL,
	"status" text NOT NULL,
	"explanation" text NOT NULL,
	"origin" text NOT NULL,
	"resource_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_findings_status" CHECK ("evidence_findings"."status" IN ('source_confirmed', 'supports_claim', 'contradicts_claim', 'not_found', 'unavailable', 'manual_review')),
	CONSTRAINT "evidence_findings_origin" CHECK ("evidence_findings"."origin" IN ('deterministic', 'ai'))
);
--> statement-breakpoint
CREATE TABLE "evidence_investigations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contribution_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"github_user_id" bigint,
	"github_login_snapshot" text,
	"source_status" text NOT NULL,
	"ai_status" text NOT NULL,
	"ai_model" text,
	"report" jsonb NOT NULL,
	"report_digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_investigations_digest" CHECK ("evidence_investigations"."report_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "evidence_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"resource_type" text NOT NULL,
	"repository_id" bigint NOT NULL,
	"external_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_resources_type" CHECK ("evidence_resources"."resource_type" IN ('repository', 'pull_request', 'commit', 'issue'))
);
--> statement-breakpoint
CREATE TABLE "github_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_user_id" bigint NOT NULL,
	"user_id" text,
	"login" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_identities_status" CHECK ("github_identities"."status" IN ('connected', 'disconnected', 'reserved'))
);
--> statement-breakpoint
CREATE TABLE "github_oauth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code_verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "near_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organisation_id" uuid,
	"purpose" text NOT NULL,
	"account_id" text NOT NULL,
	"nonce" text NOT NULL,
	"message" text NOT NULL,
	"recipient" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "near_challenges_nonce_unique" UNIQUE("nonce"),
	CONSTRAINT "near_challenges_purpose" CHECK ("near_challenges"."purpose" IN ('contributor_account', 'issuer_account', 'holder_access'))
);
--> statement-breakpoint
ALTER TABLE "attestations" ADD COLUMN "near_owner_account_id" text;--> statement-breakpoint
ALTER TABLE "attestations" ADD COLUMN "subject_consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attestations" ADD COLUMN "credential_reference" text;--> statement-breakpoint
ALTER TABLE "attestations" ADD COLUMN "credential_reference_hash" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "near_issuer_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "near_account_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "near_account_public_key" text;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD COLUMN "replaces_attestation_id" uuid;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_resource_id_evidence_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."evidence_resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_claims" ADD CONSTRAINT "evidence_claims_investigation_id_evidence_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."evidence_investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_findings" ADD CONSTRAINT "evidence_findings_investigation_id_evidence_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."evidence_investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_investigations" ADD CONSTRAINT "evidence_investigations_contribution_id_contributions_id_fk" FOREIGN KEY ("contribution_id") REFERENCES "public"."contributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_investigations" ADD CONSTRAINT "evidence_investigations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_identities" ADD CONSTRAINT "github_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_oauth_states" ADD CONSTRAINT "github_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_challenges" ADD CONSTRAINT "near_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "near_challenges" ADD CONSTRAINT "near_challenges_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_claims_resource" ON "evidence_claims" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "evidence_claims_contribution" ON "evidence_claims" USING btree ("contribution_id");--> statement-breakpoint
CREATE INDEX "evidence_findings_investigation" ON "evidence_findings" USING btree ("investigation_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_investigations_version" ON "evidence_investigations" USING btree ("contribution_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_resources_identity" ON "evidence_resources" USING btree ("provider","resource_type","repository_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_identities_github_user" ON "github_identities" USING btree ("github_user_id");--> statement-breakpoint
CREATE INDEX "github_identities_user" ON "github_identities" USING btree ("user_id");--> statement-breakpoint
-- A GitHub identity belongs to one ProofMe user for good. It is never deleted,
-- never moved to another user, and when its owner deletes their ProofMe
-- account it stays reserved (user_id becomes null) instead of being released.
CREATE FUNCTION github_identities_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'github identities are never deleted; disconnect instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.github_user_id IS DISTINCT FROM OLD.github_user_id THEN
    RAISE EXCEPTION 'a github identity cannot change its GitHub account'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NOT NULL AND NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'a github identity cannot move to another ProofMe user'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'a reserved github identity cannot be claimed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.user_id IS NULL THEN
    NEW.status := 'reserved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER github_identities_guard_update BEFORE UPDATE ON github_identities
  FOR EACH ROW EXECUTE FUNCTION github_identities_guard();
--> statement-breakpoint
CREATE TRIGGER github_identities_guard_delete BEFORE DELETE ON github_identities
  FOR EACH ROW EXECUTE FUNCTION github_identities_guard();
--> statement-breakpoint
-- Investigation reports, findings and source snapshots are history: a new
-- investigation is a new version, never an edit of an old one.
CREATE FUNCTION evidence_history_no_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are never updated; run a new investigation instead', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER evidence_investigations_no_update BEFORE UPDATE ON evidence_investigations
  FOR EACH ROW EXECUTE FUNCTION evidence_history_no_update();
--> statement-breakpoint
CREATE TRIGGER evidence_findings_no_update BEFORE UPDATE ON evidence_findings
  FOR EACH ROW EXECUTE FUNCTION evidence_history_no_update();
--> statement-breakpoint
CREATE TRIGGER evidence_claims_no_update BEFORE UPDATE ON evidence_claims
  FOR EACH ROW EXECUTE FUNCTION evidence_history_no_update();
