CREATE TYPE "public"."region" AS ENUM('us', 'eu');--> statement-breakpoint
-- Every guild so far is in the Americas (the Order is NA); new guilds must choose a region (no default).
ALTER TABLE "guilds" ADD COLUMN "region" "region" DEFAULT 'us' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ALTER COLUMN "region" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "region" "region";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "region" "region";--> statement-breakpoint
-- Battle.net linking only read US profiles until now, so every verified character and application is US.
UPDATE "characters" SET "region" = 'us' WHERE "bnet_character_id" IS NOT NULL;--> statement-breakpoint
UPDATE "applications" SET "region" = 'us' WHERE "bnet_character_id" IS NOT NULL;--> statement-breakpoint
-- Names are unique per (name, region, faction, ruleset), case-insensitively. The new key is wider than the old one,
-- so existing rows can't collide.
DROP INDEX "guilds_identity_key";--> statement-breakpoint
CREATE UNIQUE INDEX "guilds_identity_key" ON "guilds" USING btree (lower("name"),"region","faction","ruleset");
