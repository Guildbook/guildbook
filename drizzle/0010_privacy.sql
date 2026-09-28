-- Discord OAuth tokens are no longer stored (see src/server/auth-adapter.ts); clear the ones already saved.
UPDATE "accounts" SET "access_token" = NULL, "refresh_token" = NULL, "id_token" = NULL, "expires_at" = NULL;
--> statement-breakpoint
-- True when new_v equals old_v except that some string values were replaced with the "Deleted user" tombstone.
CREATE OR REPLACE FUNCTION audit_json_redacted(old_v jsonb, new_v jsonb) RETURNS boolean AS $$
DECLARE
  k text;
  i int;
BEGIN
  IF old_v IS NULL OR new_v IS NULL THEN
    RETURN old_v IS NOT DISTINCT FROM new_v;
  END IF;
  IF new_v = old_v THEN
    RETURN true;
  END IF;
  IF new_v = '"Deleted user"'::jsonb THEN
    RETURN jsonb_typeof(old_v) = 'string';
  END IF;
  IF jsonb_typeof(old_v) <> jsonb_typeof(new_v) THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(old_v) = 'object' THEN
    IF (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(old_v) x)
       IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM jsonb_object_keys(new_v) x) THEN
      RETURN false;
    END IF;
    FOR k IN SELECT jsonb_object_keys(old_v) LOOP
      IF NOT audit_json_redacted(old_v -> k, new_v -> k) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;
  IF jsonb_typeof(old_v) = 'array' THEN
    IF jsonb_array_length(old_v) <> jsonb_array_length(new_v) THEN
      RETURN false;
    END IF;
    FOR i IN 0 .. jsonb_array_length(old_v) - 1 LOOP
      IF NOT audit_json_redacted(old_v -> i, new_v -> i) THEN
        RETURN false;
      END IF;
    END LOOP;
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
--> statement-breakpoint
-- audit_log stays append-only with two narrow, transaction-scoped exceptions:
--   guildbook.audit_redact = 'on': identity may be replaced with the "Deleted user" tombstone (actor becomes the
--     deleted-user sentinel or NULL, target_id may become 'deleted-user', JSON strings may become "Deleted user").
--     The action, target type, guild and timestamp can never change.
--   guildbook.audit_purge_guild = <guild id>: rows of that one guild may be deleted along with the guild.
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.guild_id::text = current_setting('guildbook.audit_purge_guild', true) THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND current_setting('guildbook.audit_redact', true) = 'on' THEN
    IF NEW.id = OLD.id
       AND NEW.guild_id = OLD.guild_id
       AND NEW.action = OLD.action
       AND NEW.target_type = OLD.target_type
       AND NEW.created_at = OLD.created_at
       AND (NEW.actor_user_id IS NOT DISTINCT FROM OLD.actor_user_id OR NEW.actor_user_id IS NULL OR NEW.actor_user_id = 'deleted-user')
       AND (NEW.target_id IS NOT DISTINCT FROM OLD.target_id OR NEW.target_id = 'deleted-user')
       AND audit_json_redacted(OLD.before, NEW.before)
       AND audit_json_redacted(OLD.after, NEW.after) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'audit_log redaction may only replace identity with the Deleted user tombstone'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_guard();
