DROP INDEX "characters_unique_name";--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "character_surname" text;--> statement-breakpoint
UPDATE "applications" SET "character_surname" = 'Unknown' WHERE "character_surname" IS NULL;--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "character_surname" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "surname" text;--> statement-breakpoint
UPDATE "characters" SET "surname" = initcap("faction"::text) WHERE "surname" IS NULL;--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "surname" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_unique_full_name" ON "characters" USING btree ("guild_id",lower("name"),lower("surname")) WHERE "characters"."archived_at" is null;
