CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."guild_preset" AS ENUM('order', 'standard');--> statement-breakpoint
CREATE TABLE "guild_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"verification_token" text NOT NULL,
	"last_error" text,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_domains_domain_unique" UNIQUE("domain"),
	CONSTRAINT "guild_domains_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "guild_domains_domain_lowercase" CHECK ("guild_domains"."domain" = lower("guild_domains"."domain"))
);
--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "preset" "guild_preset" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
-- Every guild before Guildbook was created with the Order's ranks and pages.
UPDATE "guilds" SET "preset" = 'order';--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "directory_listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "guild_domains" ADD CONSTRAINT "guild_domains_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_domains" ADD CONSTRAINT "guild_domains_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guild_domains_guild_idx" ON "guild_domains" USING btree ("guild_id");--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guilds_created_by_idx" ON "guilds" USING btree ("created_by_user_id","created_at");