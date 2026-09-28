CREATE TYPE "public"."addon_status" AS ENUM('planned', 'in_development', 'beta', 'released');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('pending', 'accepted', 'trial', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."faction" AS ENUM('alliance', 'horde');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('applicant', 'active', 'former');--> statement-breakpoint
CREATE TYPE "public"."profession" AS ENUM('alchemy', 'blacksmithing', 'enchanting', 'engineering', 'herbalism', 'leatherworking', 'mining', 'skinning', 'tailoring', 'cooking', 'first_aid', 'fishing');--> statement-breakpoint
CREATE TYPE "public"."raid_role" AS ENUM('tank', 'healer', 'melee', 'ranged');--> statement-breakpoint
CREATE TYPE "public"."rank_tier" AS ENUM('applicant', 'member', 'raider', 'officer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."recruitment_priority" AS ENUM('closed', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."wow_class" AS ENUM('warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"status" "addon_status" DEFAULT 'planned' NOT NULL,
	"version" text,
	"download_url" text,
	"source_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addons_guild_slug_key" UNIQUE("guild_id","slug")
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"character_name" text NOT NULL,
	"faction" "faction" NOT NULL,
	"class" "wow_class" NOT NULL,
	"spec" text NOT NULL,
	"role" "raid_role" NOT NULL,
	"level" integer NOT NULL,
	"raid_experience" text NOT NULL,
	"availability" text NOT NULL,
	"why_this_guild" text NOT NULL,
	"discord_handle" text NOT NULL,
	"respects_faith" boolean NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_guild_id_id_key" UNIQUE("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boss_kills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"boss_id" uuid NOT NULL,
	"faction" "faction" NOT NULL,
	"killed_at" timestamp with time zone NOT NULL,
	"wcl_report_code" text,
	"note" text DEFAULT '' NOT NULL,
	"recorded_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bosses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"instance_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bosses_guild_id_id_key" UNIQUE("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "character_professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"profession" "profession" NOT NULL,
	"skill" integer,
	CONSTRAINT "character_professions_unique" UNIQUE("character_id","profession")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"name" text NOT NULL,
	"faction" "faction" NOT NULL,
	"class" "wow_class" NOT NULL,
	"spec" text NOT NULL,
	"role" "raid_role" NOT NULL,
	"level" integer NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"external_ref" text,
	"synced_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "characters_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "characters_level_range" CHECK ("characters"."level" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pages_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "content_pages_guild_slug_key" UNIQUE("guild_id","slug")
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"edited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"motto" text,
	"description" text DEFAULT '' NOT NULL,
	"realm" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"recruitment_open" boolean DEFAULT true NOT NULL,
	"applicant_rank_id" uuid,
	"accept_rank_id" uuid,
	"trial_rank_id" uuid,
	"discord_guild_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guilds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"size" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "instances_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "instances_guild_name_key" UNIQUE("guild_id","name")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"rank_id" uuid NOT NULL,
	"status" "membership_status" NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "memberships_guild_user_key" UNIQUE("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "raid_schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"label" text NOT NULL,
	"faction" "faction",
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "raid_schedule_slots_day_range" CHECK ("raid_schedule_slots"."day_of_week" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "ranks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tier" "rank_tier" NOT NULL,
	"in_game" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranks_guild_id_id_key" UNIQUE("guild_id","id"),
	CONSTRAINT "ranks_guild_name_key" UNIQUE("guild_id","name"),
	CONSTRAINT "ranks_guild_sort_key" UNIQUE("guild_id","sort_order")
);
--> statement-breakpoint
CREATE TABLE "recruitment_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"class" "wow_class" NOT NULL,
	"role" "raid_role" NOT NULL,
	"faction" "faction",
	"priority" "recruitment_priority" DEFAULT 'closed' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "recruitment_needs_unique" UNIQUE NULLS NOT DISTINCT("guild_id","class","role","faction")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"discord_id" text,
	"discord_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_kills" ADD CONSTRAINT "boss_kills_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_kills" ADD CONSTRAINT "boss_kills_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boss_kills" ADD CONSTRAINT "boss_kills_boss_fk" FOREIGN KEY ("guild_id","boss_id") REFERENCES "public"."bosses"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bosses" ADD CONSTRAINT "bosses_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bosses" ADD CONSTRAINT "bosses_instance_fk" FOREIGN KEY ("guild_id","instance_id") REFERENCES "public"."instances"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_professions" ADD CONSTRAINT "character_professions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_professions" ADD CONSTRAINT "character_professions_character_fk" FOREIGN KEY ("guild_id","character_id") REFERENCES "public"."characters"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_membership_fk" FOREIGN KEY ("guild_id","membership_id") REFERENCES "public"."memberships"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_edited_by_user_id_users_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_page_fk" FOREIGN KEY ("guild_id","page_id") REFERENCES "public"."content_pages"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_applicant_rank_id_ranks_id_fk" FOREIGN KEY ("applicant_rank_id") REFERENCES "public"."ranks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_accept_rank_id_ranks_id_fk" FOREIGN KEY ("accept_rank_id") REFERENCES "public"."ranks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_trial_rank_id_ranks_id_fk" FOREIGN KEY ("trial_rank_id") REFERENCES "public"."ranks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_rank_fk" FOREIGN KEY ("guild_id","rank_id") REFERENCES "public"."ranks"("guild_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raid_schedule_slots" ADD CONSTRAINT "raid_schedule_slots_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranks" ADD CONSTRAINT "ranks_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruitment_needs" ADD CONSTRAINT "recruitment_needs_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_one_pending_per_user" ON "applications" USING btree ("guild_id","user_id") WHERE "applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "applications_guild_status_idx" ON "applications" USING btree ("guild_id","status");--> statement-breakpoint
CREATE INDEX "audit_log_guild_created_idx" ON "audit_log" USING btree ("guild_id","created_at");--> statement-breakpoint
CREATE INDEX "boss_kills_boss_idx" ON "boss_kills" USING btree ("boss_id","faction","killed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "characters_one_main_per_member" ON "characters" USING btree ("membership_id") WHERE "characters"."is_main" and "characters"."archived_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_unique_name" ON "characters" USING btree ("guild_id","faction",lower("name")) WHERE "characters"."archived_at" is null;