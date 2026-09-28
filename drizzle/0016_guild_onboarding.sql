ALTER TABLE "guilds" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "setup" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
-- Guilds that exist before drafts are grandfathered as published, so the Order and live guilds stay visible.
UPDATE "guilds" SET "published_at" = "created_at";--> statement-breakpoint
-- The Order is long set up: its admins don't need the setup checklist on the admin home.
UPDATE "guilds" SET "setup" = jsonb_build_object('dismissedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) WHERE "preset" = 'order';
