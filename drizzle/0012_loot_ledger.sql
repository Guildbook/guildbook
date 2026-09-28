CREATE TYPE "public"."item_data_source" AS ENUM('import', 'addon', 'blizzard', 'manual');--> statement-breakpoint
CREATE TYPE "public"."loot_entry_kind" AS ENUM('award', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."loot_import_status" AS ENUM('draft', 'committed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."loot_response" AS ENUM('main_spec', 'off_spec', 'soft_reserve', 'council', 'roll', 'disenchant', 'bank', 'other');--> statement-breakpoint
CREATE TYPE "public"."loot_source" AS ENUM('manual', 'gargul', 'rclc');--> statement-breakpoint
CREATE TABLE "loot_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"kind" "loot_entry_kind" NOT NULL,
	"reverses_entry_id" uuid,
	"item_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"character_id" uuid,
	"recipient_name" text,
	"response" "loot_response" NOT NULL,
	"response_text" text,
	"votes" smallint,
	"instance_id" uuid,
	"instance_name" text,
	"boss_id" uuid,
	"boss_name" text,
	"awarded_at" timestamp with time zone NOT NULL,
	"raid_date" text NOT NULL,
	"source" "loot_source" NOT NULL,
	"external_id" text,
	"import_batch_id" uuid,
	"note" text,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loot_entries_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "loot_entries_reversal_target" CHECK (("loot_entries"."kind" = 'reversal') = ("loot_entries"."reverses_entry_id" is not null)),
	CONSTRAINT "loot_entries_item_id_positive" CHECK ("loot_entries"."item_id" > 0),
	CONSTRAINT "loot_entries_raid_date_format" CHECK ("loot_entries"."raid_date" ~ '^\d{4}-\d{2}-\d{2}$')
);
--> statement-breakpoint
CREATE TABLE "loot_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"parser_id" text NOT NULL,
	"source" "loot_source" NOT NULL,
	"status" "loot_import_status" DEFAULT 'draft' NOT NULL,
	"raw_sha256" text NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"row_count" integer NOT NULL,
	"committed_count" integer,
	"created_by_user_id" text,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loot_import_batches_guild_id_id_key" UNIQUE("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "loot_name_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"character_id" uuid NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loot_name_aliases_guild_alias_key" UNIQUE("guild_id","alias")
);
--> statement-breakpoint
CREATE TABLE "wow_items" (
	"item_id" integer PRIMARY KEY NOT NULL,
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
	CONSTRAINT "wow_items_quality_range" CHECK ("wow_items"."quality" between 0 and 7),
	CONSTRAINT "wow_items_item_id_positive" CHECK ("wow_items"."item_id" > 0)
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "loot_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_entries" ADD CONSTRAINT "loot_entries_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_import_batches" ADD CONSTRAINT "loot_import_batches_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_import_batches" ADD CONSTRAINT "loot_import_batches_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_name_aliases" ADD CONSTRAINT "loot_name_aliases_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_name_aliases" ADD CONSTRAINT "loot_name_aliases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loot_name_aliases" ADD CONSTRAINT "loot_name_aliases_character_fk" FOREIGN KEY ("guild_id","character_id") REFERENCES "public"."characters"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loot_entries_one_reversal" ON "loot_entries" USING btree ("reverses_entry_id") WHERE "loot_entries"."kind" = 'reversal';--> statement-breakpoint
CREATE UNIQUE INDEX "loot_entries_external_award" ON "loot_entries" USING btree ("guild_id","source","external_id") WHERE "loot_entries"."kind" = 'award' and "loot_entries"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "loot_entries_guild_awarded_idx" ON "loot_entries" USING btree ("guild_id","awarded_at");--> statement-breakpoint
CREATE INDEX "loot_entries_character_idx" ON "loot_entries" USING btree ("guild_id","character_id");--> statement-breakpoint
CREATE INDEX "loot_entries_raid_idx" ON "loot_entries" USING btree ("guild_id","raid_date");--> statement-breakpoint
CREATE INDEX "loot_import_batches_guild_idx" ON "loot_import_batches" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "wow_items_name_idx" ON "wow_items" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "wow_items_blizzard_idx" ON "wow_items" USING btree ("blizzard_fetched_at");