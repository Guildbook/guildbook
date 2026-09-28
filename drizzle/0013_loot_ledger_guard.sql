-- Composite guild-scoped foreign keys for the loot ledger. When a character, instance, boss or import batch is deleted
-- only the reference column becomes NULL (Postgres 15+ column list); guild_id and the name snapshots stay.
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_character_fk" FOREIGN KEY ("guild_id", "character_id")
  REFERENCES "characters"("guild_id", "id") ON DELETE SET NULL ("character_id");
--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_instance_fk" FOREIGN KEY ("guild_id", "instance_id")
  REFERENCES "instances"("guild_id", "id") ON DELETE SET NULL ("instance_id");
--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_boss_fk" FOREIGN KEY ("guild_id", "boss_id")
  REFERENCES "bosses"("guild_id", "id") ON DELETE SET NULL ("boss_id");
--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_import_batch_fk" FOREIGN KEY ("guild_id", "import_batch_id")
  REFERENCES "loot_import_batches"("guild_id", "id") ON DELETE SET NULL ("import_batch_id");
--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_reverses_fk" FOREIGN KEY ("guild_id", "reverses_entry_id")
  REFERENCES "loot_entries"("guild_id", "id");
--> statement-breakpoint
-- A generic guard for append-only ledgers. Rows may be inserted, never changed or deleted, except:
--   link loss: a column listed in TG_ARGV[0] may become NULL (ON DELETE SET NULL from what it references);
--   redaction: with guildbook.audit_redact = 'on', a text column listed in TG_ARGV[1] may become "Deleted user";
--   guild purge: with guildbook.audit_purge_guild = <guild id>, that guild's rows may be deleted.
-- The two session settings are the ones audit_log_guard uses (drizzle/0010_privacy.sql).
CREATE OR REPLACE FUNCTION append_only_guard() RETURNS trigger AS $$
DECLARE
  nullable text[] := string_to_array(coalesce(TG_ARGV[0], ''), ',');
  redactable text[] := string_to_array(coalesce(TG_ARGV[1], ''), ',');
  old_j jsonb;
  new_j jsonb;
  k text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.guild_id::text = current_setting('guildbook.audit_purge_guild', true) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION '% is append-only; DELETE is not allowed', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  old_j := to_jsonb(OLD);
  new_j := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(old_j) LOOP
    CONTINUE WHEN (old_j -> k) IS NOT DISTINCT FROM (new_j -> k);
    CONTINUE WHEN k = ANY (nullable) AND (new_j -> k) = 'null'::jsonb;
    CONTINUE WHEN k = ANY (redactable)
      AND current_setting('guildbook.audit_redact', true) = 'on'
      AND jsonb_typeof(old_j -> k) = 'string'
      AND (new_j -> k) = '"Deleted user"'::jsonb;
    RAISE EXCEPTION '% is append-only; changing % is not allowed', TG_TABLE_NAME, k
      USING ERRCODE = 'restrict_violation';
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER loot_entries_append_only
  BEFORE UPDATE OR DELETE ON loot_entries
  FOR EACH ROW EXECUTE FUNCTION append_only_guard(
    'character_id,instance_id,boss_id,import_batch_id,recorded_by_user_id',
    'recipient_name,note'
  );
--> statement-breakpoint
-- A reversal must point at an award of the same guild, never at another reversal.
CREATE OR REPLACE FUNCTION loot_entries_check_reversal() RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'reversal' AND NOT EXISTS (
    SELECT 1 FROM loot_entries WHERE guild_id = NEW.guild_id AND id = NEW.reverses_entry_id AND kind = 'award'
  ) THEN
    RAISE EXCEPTION 'a loot reversal must reverse an award' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER loot_entries_reversal_check
  BEFORE INSERT ON loot_entries
  FOR EACH ROW EXECUTE FUNCTION loot_entries_check_reversal();
