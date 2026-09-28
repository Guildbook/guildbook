CREATE TABLE "battlenet_links" (
	"user_id" text PRIMARY KEY NOT NULL,
	"battlenet_id" text NOT NULL,
	"battletag" text NOT NULL,
	"region" text NOT NULL,
	"access_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"characters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"snapshot_status" text DEFAULT 'ok' NOT NULL,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battlenet_links_battlenet_id_unique" UNIQUE("battlenet_id")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "bnet_character_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "realm_slug" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "realm_name" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "battletag" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "bnet_snapshot_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "bnet_character_id" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "realm_slug" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "realm_name" text;--> statement-breakpoint
ALTER TABLE "battlenet_links" ADD CONSTRAINT "battlenet_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_unique_bnet_character" ON "characters" USING btree ("guild_id","bnet_character_id") WHERE "characters"."bnet_character_id" is not null and "characters"."archived_at" is null;