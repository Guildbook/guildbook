ALTER TABLE "ranks" ADD COLUMN "insignia" text;--> statement-breakpoint
UPDATE "ranks" SET "insignia" = CASE "name"
  WHEN 'Grand Master' THEN 'archangel'
  WHEN 'Seneschal' THEN 'keys'
  WHEN 'Marshal' THEN 'banner'
  WHEN 'Commander' THEN 'laurel'
  WHEN 'Chaplain' THEN 'chalice'
  WHEN 'Knight' THEN 'cross-pattee'
  WHEN 'Sergeant' THEN 'chevron'
  WHEN 'Squire' THEN 'helm'
  WHEN 'Novice' THEN 'cross'
  WHEN 'Postulant' THEN 'candle'
END WHERE "insignia" IS NULL;
