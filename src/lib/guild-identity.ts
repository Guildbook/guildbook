import { FACTION_LABELS, type Faction, REGION_LABELS, type Region, RULESET_INFO, type Ruleset } from "@/lib/game";

/**
 * A guild's identity on Guildbook is (name, region, faction, ruleset): Battle.net regions are separate worlds,
 * WoW: Forever has no realms, each ruleset is its own world, and factions can't share a guild, so the same name can
 * exist once per region, faction and ruleset.
 */
export interface GuildIdentity {
  name: string;
  region: Region;
  faction: Faction;
  ruleset: Ruleset;
}

/** How a guild name is stored: Unicode-normalised, typographic apostrophes straightened, whitespace collapsed. */
export function cleanGuildName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** The comparison key for names: case-insensitive, as the database's unique index on lower(name) is. */
export function normalizeGuildName(name: string): string {
  return cleanGuildName(name).toLowerCase();
}

export function sameGuildName(a: string, b: string): boolean {
  return normalizeGuildName(a) === normalizeGuildName(b);
}

export function describeIdentity(identity: Pick<GuildIdentity, "region" | "faction" | "ruleset">): string {
  return `${REGION_LABELS[identity.region]}, ${FACTION_LABELS[identity.faction]}, ${RULESET_INFO[identity.ruleset].label}`;
}

/** Name used for an unverified guild that lost its name to a verified claim: "Name (unverified)", then "(unverified 2)". */
export function unverifiedName(name: string, attempt: number): string {
  return attempt <= 1 ? `${name} (unverified)` : `${name} (unverified ${attempt})`;
}

/** Days of failed daily checks before a verified guild loses its badge. */
export const VERIFICATION_GRACE_DAYS = 7;
