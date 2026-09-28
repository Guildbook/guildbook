-- Blizzard's tabard emblem ids replace the drawn emblems. Every guild with the generic crest moves to the closest real
-- emblem to its drawn one (LEGACY_EMBLEM_MATCH in src/lib/tabard/crest.ts), anything else to the lion (128). The
-- emblem is required from here on except on the Order preset, whose locked hand-drawn crest uses no Blizzard parts.
-- tabard_border_id is the in-game border shape from the last "Import your in-game tabard": stored, never drawn.
-- tabard_emblem (the drawn slug) is no longer read and can be dropped once no deployed code selects it.
ALTER TABLE "guilds" ADD COLUMN "tabard_emblem_id" smallint;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "tabard_border_id" smallint;--> statement-breakpoint
UPDATE "guilds" SET "tabard_emblem_id" = CASE "tabard_emblem" WHEN 'cross-pattee' THEN 97 WHEN 'cross' THEN 97 WHEN 'cross-fleury' THEN 97 WHEN 'celtic-cross' THEN 171 WHEN 'sword' THEN 39 WHEN 'crossed-swords' THEN 119 WHEN 'shield' THEN 38 WHEN 'lion' THEN 128 WHEN 'eagle' THEN 12 WHEN 'dragon' THEN 42 WHEN 'wolf' THEN 193 WHEN 'skull' THEN 24 WHEN 'tree' THEN 34 WHEN 'sun' THEN 100 WHEN 'moon' THEN 99 WHEN 'star' THEN 8 WHEN 'crown' THEN 11 WHEN 'flame' THEN 21 WHEN 'axe' THEN 23 WHEN 'hammer' THEN 22 WHEN 'bow' THEN 31 WHEN 'anvil' THEN 29 WHEN 'book' THEN 32 WHEN 'raven' THEN 91 WHEN 'fleur-de-lis' THEN 18 WHEN 'rose' THEN 74 WHEN 'keys' THEN 76 WHEN 'chalice' THEN 35 WHEN 'tower' THEN 115 WHEN 'griffin' THEN 12 ELSE 128 END WHERE "theme_base" <> 'order' AND "tabard_emblem_id" IS NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_crest_ids" CHECK ("guilds"."tabard_emblem_id" >= 0 and "guilds"."tabard_border_id" >= 0);--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_emblem_required" CHECK ("guilds"."preset" = 'order' or "guilds"."tabard_emblem_id" is not null);--> statement-breakpoint
ALTER TABLE "guilds" ADD CONSTRAINT "guilds_tabard_order_drawn" CHECK ("guilds"."theme_base" <> 'order' or ("guilds"."tabard_emblem_id" is null and "guilds"."tabard_border_id" is null));
