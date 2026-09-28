import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { contentPages, guilds, ranks } from "@/db/schema";
import type { Faction, Region, Ruleset } from "@/lib/game";
import { DEFAULT_RANK_PRESET, RANK_PRESETS, type RankPresetKey, type RankTemplate } from "@/lib/rank-presets";
import { LORE_MD, LORE_SLUG, LORE_TITLE } from "@/lib/lore";
import { DEFAULT_TABARD, ORDER_TABARD } from "@/lib/tabard/config";

export type GuildPreset = "order" | "standard";

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
export const STANDARD_RANKS: readonly RankTemplate[] = RANK_PRESETS[DEFAULT_RANK_PRESET].ranks;

export const DEFAULT_CONTENT_PAGES = [
  { slug: "charter", title: "Rules of the Order", sortOrder: 1 },
  { slug: "clean-chat", title: "The Clean Chat Standard", sortOrder: 2 },
  { slug: "loot-policy", title: "Loot Policy", sortOrder: 3 },
  { slug: "prayer", title: "Prayer to Saint Michael", sortOrder: 4 },
  { slug: LORE_SLUG, title: LORE_TITLE, sortOrder: 5 },
] as const;

export const STANDARD_CHARTER_MD = `> This is a starter charter for **{name}**. Officers can rewrite it under Admin, then Charter, to say how your guild really works.

### Our rules

1. **Be kind.** No harassment, slurs or drama in public channels. Treat guildmates, pugs and rivals with respect.
2. **Keep your word.** If you sign up for an event, come prepared and on time. If plans change, let an officer know.
3. **Come prepared.** Know what the group needs from you and keep your gear and addons up to date.
4. **Settle disagreements in private.** Take concerns to an officer, not to guild chat.

### Ranks

Our ranks, and what each one can do, are listed at the end of this charter.`;

export const STANDARD_LOOT_MD = `Loot serves the guild's progression first.

- **Loot council** or **soft reserve**: officers announce which system a raid uses before the first pull.
- **Off-spec** rolls happen only after main-spec interest is settled.
- Items no one needs are **disenchanted** for the guild bank.`;

export const STANDARD_STORY_MD = `> This page is a starting point. Officers can replace it under Admin, then Charter.

## Who we are

Tell visitors what the guild is about: how it started, what you value and what a raid night feels like.

## What we play

Raiding, dungeons, PvP or leveling together: say what the guild focuses on and when.

## Joining

Explain who fits in best, and how to reach an officer on Discord.`;

export const STANDARD_CONTENT_PAGES = [
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
  standard: { ...RANK_PRESETS[DEFAULT_RANK_PRESET], pages: STANDARD_CONTENT_PAGES },
} satisfies Record<GuildPreset, unknown>;

/** A starter page's body for this guild, as `createGuildWithDefaults` writes it. */
export const starterBody = (bodyMd: string, guildName: string) => bodyMd.replaceAll("{name}", guildName);

/** The Order preset keeps the Order's locked crest and theme (see migration 0011_guild_tabard). */
const ORDER_LOOK = {
  tabardBackground: ORDER_TABARD.background,
  tabardBorder: ORDER_TABARD.border,
  tabardBorderStyle: ORDER_TABARD.borderStyle,
  tabardEmblem: "cross-pattee",
  tabardEmblemColor: ORDER_TABARD.emblemColor,
  tabardEmblemId: null,
  themeBase: "order",
} as const;

/** Every other guild starts on the default Blizzard emblem (see DEFAULT_TABARD). */
const NEW_GUILD_LOOK = { tabardEmblemId: DEFAULT_TABARD.emblemId };

/**
 * Creates a guild with a rank ladder, application rank defaults and starter pages. The "order" preset is the
 * Order of Saint Michael's Catholic ranks, prayer and lore; new guilds get the neutral "standard" preset with the
 * chosen starter ladder. Published unless `publishedAt` is null (guilds founded on the apex start as drafts).
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
    /** Battle.net region; defaults to the Americas (seeds and the Order). Guilds founded on the apex always choose. */
    region?: Region;
    faction: Faction;
    ruleset: Ruleset;
    preset?: GuildPreset;
    rankPreset?: RankPresetKey;
    directoryListed?: boolean;
    createdByUserId?: string | null;
    publishedAt?: Date | null;
  },
) {
  const { rankPreset, publishedAt, region = "us", ...values } = input;
  const preset =
    input.preset === "order" ? PRESETS.order : { ...RANK_PRESETS[rankPreset ?? DEFAULT_RANK_PRESET], pages: STANDARD_CONTENT_PAGES };
  const look = input.preset === "order" ? ORDER_LOOK : NEW_GUILD_LOOK;
  return db.transaction(async (tx) => {
    const [guild] = await tx
      .insert(guilds)
      .values({ ...values, region, ...look, publishedAt: publishedAt === undefined ? new Date() : publishedAt })
      .returning();
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
      .values(preset.pages.map((p) => ({ ...p, guildId: guild.id, bodyMd: starterBody(p.bodyMd, guild.name) })));
    return { guild: updated!, ranks: rankRows, rankId: byName };
  });
}
