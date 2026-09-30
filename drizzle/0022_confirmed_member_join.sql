-- Additive only: code from before this migration never reads these columns, and its inserts get the defaults.
-- Set by the daily sync when a character Battle.net had confirmed in the in-game guild is no longer in it; cleared once it is confirmed again.
ALTER TABLE "characters" ADD COLUMN "in_guild_lost_at" timestamp with time zone;--> statement-breakpoint
-- Verified guilds let members Battle.net confirms in the in-game guild join without review; on unless an admin turns it off. Unverified guilds never do.
ALTER TABLE "guilds" ADD COLUMN "auto_approve_in_guild" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- The rank those members join at; null means the accepted-applicant rank (accept_rank_id).
ALTER TABLE "guilds" ADD COLUMN "auto_approve_rank_id" uuid;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_auto_approve_rank_id_ranks_id_fk" FOREIGN KEY ("auto_approve_rank_id") REFERENCES "public"."ranks"("id") ON DELETE set null ON UPDATE no action;
