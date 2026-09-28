import { eq } from "drizzle-orm";
import { z } from "zod";
import { guilds } from "@/db/schema";
import type { Db } from "@/db/types";
import { type Actor, assertCan } from "@/lib/authz/policy";
import { tabardSchema } from "@/lib/tabard/config";
import { EMBLEM_IDS } from "@/lib/tabard/emblems";
import { guildLook, isOrderLook } from "@/lib/tabard/look";
import { ROLES, SELECTABLE_BASE_IDS, type ThemeOverrides } from "@/lib/tabard/theme";
import { recordAudit } from "@/server/audit";
import { DomainError, NotFoundError } from "@/server/errors";

/** Columns to select wherever a guild's crest is shown (spread into a Drizzle `select`). */
export const guildLookColumns = {
  tabardBackground: guilds.tabardBackground,
  tabardBorder: guilds.tabardBorder,
  tabardBorderStyle: guilds.tabardBorderStyle,
  tabardEmblem: guilds.tabardEmblem,
  tabardEmblemColor: guilds.tabardEmblemColor,
  themeBase: guilds.themeBase,
  themeOverrides: guilds.themeOverrides,
};

const hexOrBlank = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || /^#[0-9a-f]{6}$/.test(v), "Use a hex colour like #a8182f, or leave it blank.");

/**
 * The tabard and theme form. `themeBase` only accepts the selectable styles, so no guild can pick the Order's
 * theme; overrides are optional per role (blank clears one).
 */
export const tabardThemeInput = tabardSchema(EMBLEM_IDS).extend({
  themeBase: z.enum(SELECTABLE_BASE_IDS, { error: "Choose a base style." }),
  overridePrimary: hexOrBlank.optional().default(""),
  overrideTrim: hexOrBlank.optional().default(""),
  overrideHighlight: hexOrBlank.optional().default(""),
});

/** Saves a guild's tabard, base style and site colour overrides. Admins only; the Order's look is locked. */
export async function updateGuildTabard(db: Db, actor: Actor, raw: unknown) {
  assertCan(actor, "guild.settings");
  const input = tabardThemeInput.parse(raw);
  const given = { primary: input.overridePrimary, trim: input.overrideTrim, highlight: input.overrideHighlight };
  const overrides: ThemeOverrides = {};
  for (const role of ROLES) if (given[role]) overrides[role] = given[role];

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(guilds).where(eq(guilds.id, actor.guildId));
    if (!before) throw new NotFoundError("Guild");
    if (isOrderLook(before)) throw new DomainError("The Order of Saint Michael's crest and theme are locked.");
    const [updated] = await tx
      .update(guilds)
      .set({
        tabardBackground: input.background,
        tabardBorder: input.border,
        tabardBorderStyle: input.borderStyle,
        tabardEmblem: input.emblem,
        tabardEmblemColor: input.emblemColor,
        themeBase: input.themeBase,
        themeOverrides: overrides,
      })
      .where(eq(guilds.id, actor.guildId))
      .returning();
    const summary = (g: typeof before) => {
      const look = guildLook(g);
      return { ...look.tabard, themeBase: look.base, overrides: look.overrides };
    };
    await recordAudit(tx, actor, { action: "guild.tabard", targetType: "guild", targetId: actor.guildId, before: summary(before), after: summary(updated!) });
    return guildLook(updated!);
  });
}
