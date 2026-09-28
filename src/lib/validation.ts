import { z } from "zod";
import { RANK_TIERS } from "@/lib/authz/tiers";
import { SLUG_MAX, SLUG_MIN, type SlugProblem, slugProblem } from "@/lib/hosts";
import { INSIGNIA } from "@/lib/insignia";
import { LOOT_RESPONSES, MAX_IMPORT_BYTES, NO_RECIPIENT_RESPONSES } from "@/lib/loot/constants";
import {
  CLASSES,
  FACTIONS,
  isValidSpec,
  MAX_LEVEL,
  MAX_PROFESSION_SKILL,
  PROFESSIONS,
  ROLES,
  RULESETS,
  WOWF_LAUNCH_DATE,
} from "@/lib/game";
import { cleanGuildName } from "@/lib/guild-identity";

const trimmed = (max: number) => z.string().trim().max(max);
const required = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : null));
const checkbox = z
  .unknown()
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);
const uuid = z.uuid();

/** One part of a WoW: Forever name: letters only (accents allowed), 2–12 characters. */
const namePart = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(12, `${label} must be at most 12 characters`)
    .regex(/^\p{L}+$/u, `${label} may only contain letters`);
export const characterName = namePart("Name");
export const characterSurname = namePart("Surname");

const level = z.coerce.number().int().min(1).max(MAX_LEVEL);
const optionalFaction = z
  .enum([...FACTIONS, ""])
  .optional()
  .transform((v) => (v ? v : null));

const classSpecShape = {
  faction: optionalFaction,
  wowClass: z.enum(CLASSES),
  spec: required("Spec", 40),
  role: z.enum(ROLES),
};

function refineSpec<T extends { wowClass: (typeof CLASSES)[number]; spec: string }>(v: T, ctx: z.RefinementCtx) {
  if (!isValidSpec(v.wowClass, v.spec)) {
    ctx.addIssue({ code: "custom", path: ["spec"], message: "Spec does not belong to that class" });
  }
}

// --- Applications ----------------------------------------------------------

export const applicationInput = z
  .object({
    characterName,
    characterSurname,
    ...classSpecShape,
    level,
    raidExperience: required("Raid experience", 2000),
    availability: required("Availability", 1000),
    whyThisGuild: required("This answer", 2000),
    discordHandle: required("Discord handle", 64),
    respectsFaith: checkbox.refine((v) => v, "You must agree to respect the faith and the charter"),
  })
  .superRefine(refineSpec);
export type ApplicationInput = z.infer<typeof applicationInput>;

export const applicationDecision = z.object({
  applicationId: uuid,
  decision: z.enum(["accepted", "trial", "declined"]),
  note: optionalText(1000),
});

// --- Characters ------------------------------------------------------------

export const professionEntry = z.object({
  profession: z.enum(PROFESSIONS),
  skill: z.coerce.number().int().min(1).max(MAX_PROFESSION_SKILL).nullable(),
});

export const characterInput = z
  .object({
    name: characterName,
    surname: characterSurname,
    ...classSpecShape,
    level,
    isMain: checkbox,
    professions: z
      .array(professionEntry)
      .max(4, "At most 4 professions")
      .refine((list) => new Set(list.map((p) => p.profession)).size === list.length, "Duplicate profession"),
  })
  .superRefine(refineSpec);
export type CharacterInput = z.infer<typeof characterInput>;

/** Blizzard character IDs are numeric; we keep them as strings. */
export const bnetCharacterId = z.string().trim().regex(/^\d{1,20}$/, "Choose one of your Battle.net characters");

/** Importing a Battle.net character: name, class and level come from Blizzard; the rest is the member's. */
export const importCharacterInput = z.object({
  bnetCharacterId,
  surname: characterSurname.optional(),
  spec: required("Spec", 40),
  role: z.enum(ROLES),
  isMain: checkbox,
});

// --- Ranks & members -------------------------------------------------------

export const rankInput = z.object({
  name: required("Name", 40),
  description: trimmed(300).default(""),
  tier: z.enum(RANK_TIERS),
  insignia: z
    .enum([...INSIGNIA, ""])
    .optional()
    .transform((v) => (v ? v : null)),
  inGame: checkbox,
});
export type RankInput = z.infer<typeof rankInput>;

export const rankDefaultsInput = z.object({
  applicantRankId: uuid,
  acceptRankId: uuid,
  trialRankId: uuid,
});

export const assignRankInput = z.object({ membershipId: uuid, rankId: uuid });

// --- Guild settings --------------------------------------------------------

function isDiscordInvite(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "discord.gg" || url.pathname.startsWith("/invite/");
  } catch {
    return false;
  }
}

const discordInviteUrl = z
  .union([
    z
      .url({ protocol: /^https$/, hostname: /^(discord\.gg|(www\.)?discord\.com)$/ })
      .refine(isDiscordInvite, { message: "Use a discord.gg or discord.com/invite link" }),
    z.literal(""),
  ])
  .optional()
  .transform((v) => (v ? v : null));

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown timezone");

const guildName = (max: number) => required("Name", max).transform(cleanGuildName).pipe(z.string().min(1, "Name is required"));
const guildFaction = z.enum(FACTIONS, "Choose your guild's faction");
const guildRuleset = z.enum(RULESETS, "Choose your guild's ruleset");

export const guildSettingsInput = z.object({
  name: guildName(80),
  motto: optionalText(120),
  description: trimmed(2000).default(""),
  timezone,
  faction: guildFaction,
  ruleset: guildRuleset,
  discordInviteUrl,
  recruitmentOpen: checkbox,
  directoryListed: checkbox,
  lootPublic: checkbox,
});

// --- Guildbook platform ------------------------------------------------------

export const SLUG_MESSAGES: Record<SlugProblem, string> = {
  length: `Use ${SLUG_MIN} to ${SLUG_MAX} characters`,
  characters: "Use lowercase letters, numbers and single hyphens, starting and ending with a letter or number",
  reserved: "That name is reserved",
};

export const guildSlug = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((slug, ctx) => {
    const problem = slugProblem(slug);
    if (problem) ctx.addIssue({ code: "custom", message: SLUG_MESSAGES[problem] });
  });

export const createGuildInput = z.object({
  name: guildName(60),
  slug: guildSlug,
  faction: guildFaction,
  ruleset: guildRuleset,
  timezone,
  motto: optionalText(120),
  directoryListed: checkbox,
});

/** A bare hostname such as `orderofsaintmichael.org` or `www.example.com`; a pasted URL is reduced to its host. */
export const customDomainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, ""))
    .pipe(
      z
        .string()
        .max(253, "Domain is too long")
        .regex(
          /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
          "Enter a domain like example.org",
        ),
    ),
});

// --- Content ---------------------------------------------------------------

export const contentPageInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: required("Title", 120),
  bodyMd: trimmed(50_000),
});

// --- Schedule & recruitment ------------------------------------------------

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const scheduleSlotInput = z.object({
  id: uuid.optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: hhmm,
  endTime: hhmm,
  label: required("Label", 80),
  faction: optionalFaction,
});

export const recruitmentNeedInput = z.object({
  wowClass: z.enum(CLASSES),
  role: z.enum(ROLES),
  faction: optionalFaction,
  priority: z.enum(["closed", "low", "medium", "high"]),
  note: trimmed(200).default(""),
});

// --- Progression -----------------------------------------------------------

export const instanceInput = z.object({
  name: required("Name", 80),
  shortName: required("Short name", 12),
  size: z.coerce.number().int().refine((n) => [10, 20, 25, 40].includes(n), "Size must be 10, 20, 25 or 40"),
});

/** Today's date in the furthest-ahead time zone (UTC+14), so a kill from tonight is never "in the future" for any guild. */
function latestCalendarDate(): string {
  return new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const bossInput = z.object({ instanceId: uuid, name: required("Name", 80) });

export const bossKillInput = z.object({
  bossId: uuid,
  faction: optionalFaction,
  killedOn: z.iso
    .date("Use a valid date")
    .refine((d) => d >= WOWF_LAUNCH_DATE, "Kills can't be dated before World of Warcraft: Forever launched on Nov 4, 2026")
    .refine((d) => d <= latestCalendarDate(), "Kills can't be dated in the future"),
  note: trimmed(300).default(""),
});

// --- Addons ----------------------------------------------------------------

const optionalUrl = z
  .union([z.url({ protocol: /^https$/ }), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

export const addonInput = z.object({
  id: uuid.optional(),
  name: required("Name", 80),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and dashes only").max(60),
  summary: required("Summary", 200),
  descriptionMd: trimmed(10_000).default(""),
  status: z.enum(["planned", "in_development", "beta", "released"]),
  version: optionalText(20),
  downloadUrl: optionalUrl,
  sourceUrl: optionalUrl,
});

export const idInput = z.object({ id: uuid });

// --- Loot ------------------------------------------------------------------

const optionalUuid = z
  .union([uuid, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

export const lootAwardInput = z
  .object({
    item: required("Item", 300),
    characterId: optionalUuid,
    response: z.enum(LOOT_RESPONSES, "Choose why the item was awarded"),
    bossId: optionalUuid,
    awardedOn: z.iso
      .date("Use a valid date")
      .refine((d) => d >= WOWF_LAUNCH_DATE, "Loot can't be dated before World of Warcraft: Forever launched on Nov 4, 2026")
      .refine((d) => d <= latestCalendarDate(), "Loot can't be dated in the future"),
    note: optionalText(300),
  })
  .refine((v) => v.characterId || NO_RECIPIENT_RESPONSES.has(v.response), {
    path: ["characterId"],
    message: "Choose who received the item",
  });

export const lootReverseInput = z.object({
  entryId: uuid,
  reason: required("Reason", 300),
});

export const lootImportInput = z.object({
  raw: z
    .string()
    .trim()
    .min(1, "Paste an export first")
    .max(MAX_IMPORT_BYTES, "That export is too large; import one raid at a time"),
  parserId: optionalText(40),
  template: optionalText(200),
});

/** For each unmatched import name: a guild character (`char:<id>`), keep the name only (`name`), or leave it out (`skip`). */
export const lootNameDecision = z.string().regex(/^(char:[0-9a-f-]{36}|name|skip)$/, "Choose what to do with this name");

export const lootCommitInput = z.object({
  batchId: uuid,
  decisions: z.record(z.string().max(120), lootNameDecision).default({}),
  remember: checkbox,
});
