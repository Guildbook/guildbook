-- The item cache per game version (it was one row per item ID, whatever version it was fetched for). A new table rather
-- than a new key on wow_items: code deployed before this migration keeps reading and writing wow_items, with
-- ON CONFLICT (item_id), until the rolling deploy finishes. Items it caches meanwhile are looked up again on demand by
-- the new code. A later migration drops wow_items.
CREATE TABLE "wow_version_items" (
	"game_version" "game_version" NOT NULL,
	"item_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_source" "item_data_source" NOT NULL,
	"quality" smallint,
	"icon" text,
	"item_level" smallint,
	"details_source" "item_data_source",
	"blizzard_fetched_at" timestamp with time zone,
	"blizzard_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wow_version_items_pkey" PRIMARY KEY("game_version","item_id"),
	CONSTRAINT "wow_version_items_quality_range" CHECK ("wow_version_items"."quality" between 0 and 7),
	CONSTRAINT "wow_version_items_item_id_positive" CHECK ("wow_version_items"."item_id" > 0)
);
--> statement-breakpoint
CREATE INDEX "wow_version_items_name_idx" ON "wow_version_items" USING btree ("game_version",lower("name"));--> statement-breakpoint
CREATE INDEX "wow_version_items_blizzard_idx" ON "wow_version_items" USING btree ("blizzard_fetched_at");--> statement-breakpoint
-- Every cached item becomes a WoW: Forever item, as the daily refresh read it from Forever's namespace first.
INSERT INTO "wow_version_items" ("game_version", "item_id", "name", "name_source", "quality", "icon", "item_level", "details_source", "blizzard_fetched_at", "blizzard_checked_at", "created_at", "updated_at")
SELECT 'forever', "item_id", "name", "name_source", "quality", "icon", "item_level", "details_source", "blizzard_fetched_at", "blizzard_checked_at", "created_at", "updated_at" FROM "wow_items";--> statement-breakpoint
-- Items in TBC Anniversary guilds' loot are copied for Anniversary too. Names, qualities and icons match across versions;
-- item levels don't, so theirs is left out, and a null check time has Anniversary's namespace looked up on next use.
-- The Blizzard fetch time is kept so the 30-day limit still counts from when the data was fetched.
INSERT INTO "wow_version_items" ("game_version", "item_id", "name", "name_source", "quality", "icon", "item_level", "details_source", "blizzard_fetched_at", "blizzard_checked_at", "created_at", "updated_at")
SELECT 'anniversary', i."item_id", i."name", i."name_source", i."quality", i."icon", NULL, i."details_source", i."blizzard_fetched_at", NULL, i."created_at", i."updated_at"
FROM "wow_items" i
WHERE i."item_id" IN (SELECT e."item_id" FROM "loot_entries" e JOIN "guilds" g ON g."id" = e."guild_id" WHERE g."game_version" = 'anniversary');
