CREATE TYPE "public"."guild_theme_base" AS ENUM('order', 'tome', 'parchment', 'modern');--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_background" smallint DEFAULT 32 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_border" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_border_style" text DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_emblem" text DEFAULT 'star' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_emblem_color" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "theme_base" "guild_theme_base" DEFAULT 'tome' NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "theme_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_theme_order_only" CHECK ("guilds"."theme_base" <> 'order' or "guilds"."preset" = 'order');--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_background_range" CHECK ("guilds"."tabard_background" between 0 and 50);--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_border_range" CHECK ("guilds"."tabard_border" between 0 and 16);--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_emblem_color_range" CHECK ("guilds"."tabard_emblem_color" between 0 and 16);--> statement-breakpoint
-- Guilds with the Order preset keep the Order's locked crest and theme; their stored tabard is crimson, gold and a white cross pattee.
UPDATE "guilds" SET "tabard_background" = 2, "tabard_border" = 3, "tabard_border_style" = 'plain', "tabard_emblem" = 'cross-pattee', "tabard_emblem_color" = 14, "theme_base" = 'order' WHERE "preset" = 'order';