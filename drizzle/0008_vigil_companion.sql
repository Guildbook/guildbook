CREATE TABLE "vigil_companion_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"rate_window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"rate_window_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vigil_companion_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "vigil_companion_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vigil_companion_pairings_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "vigil_companion_devices" ADD CONSTRAINT "vigil_companion_devices_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_companion_devices" ADD CONSTRAINT "vigil_companion_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_companion_devices" ADD CONSTRAINT "vigil_companion_devices_membership_fk" FOREIGN KEY ("guild_id","membership_id") REFERENCES "public"."memberships"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_companion_pairings" ADD CONSTRAINT "vigil_companion_pairings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_companion_pairings" ADD CONSTRAINT "vigil_companion_pairings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vigil_companion_pairings" ADD CONSTRAINT "vigil_companion_pairings_membership_fk" FOREIGN KEY ("guild_id","membership_id") REFERENCES "public"."memberships"("guild_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vigil_companion_devices_owner_idx" ON "vigil_companion_devices" USING btree ("guild_id","membership_id");--> statement-breakpoint
CREATE INDEX "vigil_companion_pairings_owner_idx" ON "vigil_companion_pairings" USING btree ("guild_id","membership_id");