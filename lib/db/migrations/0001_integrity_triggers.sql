-- Integrity guarantees enforced by the database itself, so they hold even if
-- application code has a bug or someone runs SQL by hand.

-- 1. An attestation's approved content is frozen, and rows are never deleted.
CREATE FUNCTION attestations_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'attestations are never deleted; revoke or supersede instead'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.contribution_id IS DISTINCT FROM OLD.contribution_id
    OR NEW.verification_request_id IS DISTINCT FROM OLD.verification_request_id
    OR NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id
    OR NEW.issuer_organisation_id IS DISTINCT FROM OLD.issuer_organisation_id
    OR NEW.reviewer_user_id IS DISTINCT FROM OLD.reviewer_user_id
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.canonical_payload IS DISTINCT FROM OLD.canonical_payload
    OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
    OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'the approved content of an attestation cannot be changed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Revocation and supersession are final.
  IF OLD.status <> 'active' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'a % attestation cannot change status', OLD.status
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'revoked' AND (
    NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason
  ) THEN
    RAISE EXCEPTION 'revocation details cannot be rewritten'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- A confirmed anchor and its transaction reference are final.
  IF OLD.near_anchor_status = 'confirmed' AND (
    NEW.near_anchor_status IS DISTINCT FROM OLD.near_anchor_status
    OR NEW.near_transaction_hash IS DISTINCT FROM OLD.near_transaction_hash
    OR NEW.near_network IS DISTINCT FROM OLD.near_network
    OR NEW.near_contract_id IS DISTINCT FROM OLD.near_contract_id
    OR NEW.near_issuer_account_id IS DISTINCT FROM OLD.near_issuer_account_id
  ) THEN
    RAISE EXCEPTION 'a confirmed NEAR anchor cannot be changed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER attestations_guard_update BEFORE UPDATE ON attestations
  FOR EACH ROW EXECUTE FUNCTION attestations_guard();
--> statement-breakpoint
CREATE TRIGGER attestations_guard_delete BEFORE DELETE ON attestations
  FOR EACH ROW EXECUTE FUNCTION attestations_guard();
--> statement-breakpoint

-- 2. Review history is append-only: no edits, no deletions.
CREATE FUNCTION forbid_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER verification_reviews_append_only BEFORE UPDATE OR DELETE ON verification_reviews
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
--> statement-breakpoint

-- 3. Audit and attestation status events are append-only. The single permitted
--    update is clearing a reference to a deleted user or organisation, which
--    the foreign keys do with ON DELETE SET NULL.
CREATE FUNCTION append_only_except_unlinking() RETURNS trigger AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  IF (new_row - 'actor_user_id' - 'organisation_id') IS DISTINCT FROM
     (old_row - 'actor_user_id' - 'organisation_id')
    OR (new_row->>'actor_user_id' IS NOT NULL
        AND new_row->>'actor_user_id' IS DISTINCT FROM old_row->>'actor_user_id')
    OR (new_row->>'organisation_id' IS NOT NULL
        AND new_row->>'organisation_id' IS DISTINCT FROM old_row->>'organisation_id')
  THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION append_only_except_unlinking();
--> statement-breakpoint
CREATE TRIGGER attestation_status_events_append_only BEFORE UPDATE OR DELETE ON attestation_status_events
  FOR EACH ROW EXECUTE FUNCTION append_only_except_unlinking();
