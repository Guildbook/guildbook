-- Guilds belong to one game version (WoW: Forever, TBC Anniversary...). Every enum value is created now: ALTER TYPE ... ADD VALUE can't be used in the transaction that adds it, and migrations run batched. The app only accepts the supported ones.
CREATE TYPE "public"."game_version" AS ENUM('forever', 'anniversary', 'era', 'seasonal', 'progression');--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "game_version" "game_version" DEFAULT 'forever' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "realm_slug" text;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_realm_by_version" CHECK (("game_version" = 'forever') = ("realm_slug" is null));--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_order_forever" CHECK ("preset" <> 'order' or "game_version" = 'forever');--> statement-breakpoint
DROP INDEX "guilds_identity_key";--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_identity_key" ON "guilds" USING btree ("game_version",lower("name"),"region",coalesce("realm_slug", ''),"faction","ruleset");--> statement-breakpoint
CREATE INDEX "guilds_directory_version_idx" ON "guilds" USING btree ("game_version","directory_listed");--> statement-breakpoint
-- The version Vigil detected from the log; null when it couldn't tell (1.x builds are Forever or Classic Era).
ALTER TABLE "vigil_reports" ADD COLUMN "game_version" "game_version";--> statement-breakpoint
-- Set when the detected version differs from the guild's (accepted with a warning until WoW: Forever launches).
ALTER TABLE "vigil_reports" ADD COLUMN "version_mismatch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "vigil_reports" SET "game_version" = 'anniversary' WHERE "summary"->'log'->>'build' LIKE '2.%';--> statement-breakpoint
UPDATE "vigil_reports" SET "version_mismatch" = true FROM "guilds" WHERE "guilds"."id" = "vigil_reports"."guild_id" AND "vigil_reports"."game_version" IS NOT NULL AND "vigil_reports"."game_version" <> "guilds"."game_version";
