CREATE TYPE "public"."vigil_visibility" AS ENUM('private', 'officers', 'guild');--> statement-breakpoint
CREATE TABLE "vigil_preferences" (
	"guild_id" uuid NOT NULL,
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"default_visibility" "vigil_visibility" DEFAULT 'private' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vigil_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"character_id" uuid,
	"visibility" "vigil_visibility" DEFAULT 'private' NOT NULL,
	"fight_label" text NOT NULL,
	"fight_kind" text NOT NULL,
	"encounter_name" text,
	"player_name" text NOT NULL,
	"fight_started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"model_id" text,
	"score" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vigil_reports_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "vigil_reports_score_range" CHECK ("vigil_reports"."score" between 0 and 100),
	CONSTRAINT "vigil_reports_fight_kind" CHECK ("vigil_reports"."fight_kind" in ('boss', 'trash'))
);
--> statement-breakpoint
ALTER TABLE "vigil_preferences" ADD CONSTRAINT "vigil_preferences_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_preferences" ADD CONSTRAINT "vigil_preferences_membership_fk" FOREIGN KEY ("guild_id","membership_id") REFERENCES "public"."memberships"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_reports" ADD CONSTRAINT "vigil_reports_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_reports" ADD CONSTRAINT "vigil_reports_membership_fk" FOREIGN KEY ("guild_id","membership_id") REFERENCES "public"."memberships"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_reports" ADD CONSTRAINT "vigil_reports_character_fk" FOREIGN KEY ("guild_id","character_id") REFERENCES "public"."characters"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vigil_reports_owner_idx" ON "vigil_reports" USING btree ("guild_id","membership_id","fight_started_at");--> statement-breakpoint
CREATE INDEX "vigil_reports_shared_idx" ON "vigil_reports" USING btree ("guild_id","visibility","created_at");