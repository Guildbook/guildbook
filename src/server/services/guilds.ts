import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { contentPages, guilds, ranks } from "@/db/schema";
import type { RankTier } from "@/lib/authz/tiers";
import type { Faction } from "@/lib/game";
import type { Insignia } from "@/lib/insignia";
import { LORE_MD, LORE_SLUG, LORE_TITLE } from "@/lib/lore";
import { ORDER_TABARD } from "@/lib/tabard/config";

export type GuildPreset = "order" | "standard";

type RankTemplate = { name: string; description: string; tier: RankTier; insignia: Insignia; inGame: boolean };

/** The Order of Saint Michael's ranks, modelled on a religious house. */
export const DEFAULT_RANKS: RankTemplate[] = [
  { name: "Grand Master", description: "Guild leader", tier: "admin", insignia: "archangel", inGame: true },
  { name: "Seneschal", description: "Second in command; runs logistics, bank and recruiting", tier: "admin", insignia: "keys", inGame: true },
  { name: "Marshal", description: "Raid leader", tier: "officer", insignia: "banner", inGame: true },
  { name: "Commander", description: "Class or role lead", tier: "officer", insignia: "laurel", inGame: true },
  { name: "Chaplain", description: "Leads prayer, rosary and feast-day events", tier: "officer", insignia: "chalice", inGame: true },
  { name: "Knight", description: "Core raider", tier: "raider", insignia: "cross-pattee", inGame: true },
  { name: "Sergeant", description: "Raider or bench", tier: "raider", insignia: "chevron", inGame: true },
  { name: "Squire", description: "Member, social or leveling", tier: "member", insignia: "helm", inGame: true },
  { name: "Novice", description: "Trial member", tier: "member", insignia: "cross", inGame: true },
  { name: "Postulant", description: "Applicant on the website; not a guild rank in game", tier: "applicant", insignia: "candle", inGame: false },
];

/** Neutral ranks for guilds created on Guildbook. Officers rename them freely. */
export const STANDARD_RANKS: RankTemplate[] = [
  { name: "Guild Master", description: "Guild leader", tier: "admin", insignia: "banner", inGame: true },
  { name: "Officer", description: "Runs raids, recruiting and the guild bank", tier: "officer", insignia: "laurel", inGame: true },
  { name: "Raider", description: "Core raider", tier: "raider", insignia: "helm", inGame: true },
  { name: "Member", description: "Member, social or leveling", tier: "member", insignia: "chevron", inGame: true },
  { name: "Trial", description: "Trial member", tier: "member", insignia: "chevron", inGame: true },
  { name: "Applicant", description: "Applicant on the website; not a guild rank in game", tier: "applicant", insignia: "candle", inGame: false },
];

export const DEFAULT_CONTENT_PAGES = [
  { slug: "charter", title: "Rules of the Order", sortOrder: 1 },
  { slug: "clean-chat", title: "The Clean Chat Standard", sortOrder: 2 },
  { slug: "loot-policy", title: "Loot Policy", sortOrder: 3 },
  { slug: "prayer", title: "Prayer to Saint Michael", sortOrder: 4 },
  { slug: LORE_SLUG, title: LORE_TITLE, sortOrder: 5 },
] as const;

export const STANDARD_CHARTER_MD = `Welcome to **{name}**. This charter is a starting point: officers can edit it under Admin, then Charter.

### Our rules

1. **Be kind.** No harassment, slurs or drama in public channels. Treat guildmates, pugs and rivals with respect.
2. **Keep your word.** If you sign up for a raid, come prepared and on time. If plans change, update your signup.
3. **Come prepared.** Bring consumables, repair, know the fights and keep your addons updated.
4. **Settle disagreements in private.** Take concerns to an officer, not to guild chat.

### Ranks

The Guild Master leads the guild. Officers run raids, recruiting and the bank. Raiders form the raiding core, and Members and Trials are growing into their place.`;

export const STANDARD_LOOT_MD = `Loot serves the guild's progression first.

- **Loot council** or **soft reserve**: officers announce which system a raid uses before the first pull.
- **Off-spec** rolls happen only after main-spec interest is settled.
- Items no one needs are **disenchanted** for the guild bank.`;

export const STANDARD_STORY_MD = `## Who we are

Tell visitors what the guild is about: how it started, what you value and what a raid night feels like.

## What we play

Raiding, dungeons, PvP or leveling together: say what the guild focuses on and when.

## Joining

Explain who fits in best, and how to reach an officer on Discord.`;

const STANDARD_CONTENT_PAGES = [
  { slug: "charter", title: "Guild Charter", sortOrder: 1, bodyMd: STANDARD_CHARTER_MD },
  { slug: "loot-policy", title: "Loot Policy", sortOrder: 2, bodyMd: STANDARD_LOOT_MD },
  { slug: LORE_SLUG, title: "Our Story", sortOrder: 3, bodyMd: STANDARD_STORY_MD },
] as const;

const PRESETS = {
  order: {
    ranks: DEFAULT_RANKS,
    pages: DEFAULT_CONTENT_PAGES.map((p) => ({ ...p, bodyMd: p.slug === LORE_SLUG ? LORE_MD : "" })),
    applicantRank: "Postulant",
    acceptRank: "Squire",
    trialRank: "Novice",
  },
  standard: {
    ranks: STANDARD_RANKS,
    pages: STANDARD_CONTENT_PAGES,
    applicantRank: "Applicant",
    acceptRank: "Member",
    trialRank: "Trial",
  },
} satisfies Record<GuildPreset, unknown>;

/** The Order preset keeps the Order's locked crest and theme (see migration 0011_guild_tabard). */
const ORDER_LOOK = {
  tabardBackground: ORDER_TABARD.background,
  tabardBorder: ORDER_TABARD.border,
  tabardBorderStyle: ORDER_TABARD.borderStyle,
  tabardEmblem: ORDER_TABARD.emblem,
  tabardEmblemColor: ORDER_TABARD.emblemColor,
  themeBase: "order",
} as const;

/**
 * Creates a guild with a rank ladder, application rank defaults and starter pages. The "order" preset is the
 * Order of Saint Michael's Catholic ranks, prayer and lore; new guilds get the neutral "standard" preset.
 */
export async function createGuildWithDefaults(
  db: Db,
  input: {
    slug: string;
    name: string;
    motto?: string | null;
    description?: string;
    timezone?: string;
    realm?: string | null;
    faction?: Faction | null;
    preset?: GuildPreset;
    directoryListed?: boolean;
    createdByUserId?: string | null;
  },
) {
  const preset = PRESETS[input.preset ?? "standard"];
  const look = input.preset === "order" ? ORDER_LOOK : {};
  return db.transaction(async (tx) => {
    const [guild] = await tx.insert(guilds).values({ ...input, ...look }).returning();
    if (!guild) throw new Error("Guild insert failed");
    const rankRows = await tx
      .insert(ranks)
      .values(preset.ranks.map((r, i) => ({ ...r, guildId: guild.id, sortOrder: i + 1 })))
      .returning();
    const byName = (name: string) => rankRows.find((r) => r.name === name)!.id;
    const [updated] = await tx
      .update(guilds)
      .set({ applicantRankId: byName(preset.applicantRank), acceptRankId: byName(preset.acceptRank), trialRankId: byName(preset.trialRank) })
      .where(eq(guilds.id, guild.id))
      .returning();
    await tx
      .insert(contentPages)
      .values(preset.pages.map((p) => ({ ...p, guildId: guild.id, bodyMd: p.bodyMd.replaceAll("{name}", guild.name) })));
    return { guild: updated!, ranks: rankRows, rankId: byName };
  });
}
