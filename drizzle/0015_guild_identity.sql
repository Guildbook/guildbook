CREATE TYPE "public"."ruleset" AS ENUM('normal', 'pvp', 'rp', 'hardcore');--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "admin_notice" text;--> statement-breakpoint
-- One faction per guild. The Order is Alliance; other two-faction guilds take the faction most of their active
-- members' verified characters have, or Alliance, and their admins get a notice asking them to check it.
UPDATE "guilds" SET "faction" = 'alliance' WHERE "faction" IS NULL AND "preset" = 'order';--> statement-breakpoint
UPDATE "guilds" g SET
  "faction" = picked.faction,
  "admin_notice" = 'Guilds on Guildbook now have one faction, as in game. We set this guild to ' || initcap(picked.faction::text) || ' because most of your members'' verified characters are ' || initcap(picked.faction::text) || '. If that''s wrong, change it under Guild Settings.'
FROM (
  SELECT DISTINCT ON (c."guild_id") c."guild_id", c."faction"
  FROM "characters" c
  JOIN "memberships" m ON m."id" = c."membership_id" AND m."status" = 'active'
  WHERE c."verified" AND c."archived_at" IS NULL
  GROUP BY c."guild_id", c."faction"
  ORDER BY c."guild_id", count(*) DESC, c."faction"
) picked
WHERE g."id" = picked."guild_id" AND g."faction" IS NULL;--> statement-breakpoint
UPDATE "guilds" SET
  "faction" = 'alliance',
  "admin_notice" = 'Guilds on Guildbook now have one faction, as in game. We set this guild to Alliance by default. If you''re Horde, change it under Guild Settings.'
WHERE "faction" IS NULL;--> statement-breakpoint
ALTER TABLE "guilds" ALTER COLUMN "faction" SET NOT NULL;--> statement-breakpoint
-- Existing guilds start on the Normal ruleset; new guilds must choose one (no default).
ALTER TABLE "guilds" ADD COLUMN "ruleset" "ruleset" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ALTER COLUMN "ruleset" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_user_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_character_id" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_character_name" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_realm_slug" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verified_via" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verification_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verification_failing_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "verification_result" jsonb;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_verified_user_id_users_id_fk" FOREIGN KEY ("verified_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Names are unique per (name, faction, ruleset), case-insensitively. Existing duplicates (oldest keeps the name, the
-- Order always does) get a numeric suffix first.
UPDATE "guilds" g SET "name" = g."name" || ' (' || d.rn || ')'
FROM (
  SELECT "id", row_number() OVER (
    PARTITION BY lower("name"), "faction", "ruleset"
    ORDER BY ("preset" = 'order') DESC, "created_at", "id"
  ) AS rn
  FROM "guilds"
) d
WHERE d."id" = g."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_identity_key" ON "guilds" USING btree (lower("name"),"faction","ruleset");
