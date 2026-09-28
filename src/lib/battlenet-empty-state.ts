import type { BattlenetExcludedGroup, BattlenetScan } from "@/db/schema";
import { FACTION_LABELS, type Faction } from "@/lib/game";
import { hasLaunched } from "@/lib/showcase";
import { GAME_VERSION_LABELS } from "@/lib/wow-versions";

export interface EmptySnapshotInput {
  battletag: string;
  status: string;
  scan: BattlenetScan | null;
  /** The link's WoW: Forever characters, before the guild's faction and realm filter. */
  foreverCharacters: readonly { faction: Faction }[];
  guildFaction: Faction | null;
  now: Date;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function describeGroup(g: BattlenetExcludedGroup): string {
  const faction = g.faction ? `${FACTION_LABELS[g.faction]} ` : "";
  const where = g.version === "unknown" ? "on other realms" : `in ${GAME_VERSION_LABELS[g.version]}`;
  const names = g.examples.map((e) => `${e.name} on ${e.realmName}`);
  const more = g.count > names.length ? `, and ${g.count - names.length} more` : "";
  return `${plural(g.count, `${faction}character`)} ${where}${names.length > 0 ? ` (${names.join(", ")}${more})` : ""}`;
}

function launchNote(now: Date): string {
  return hasLaunched(now)
    ? "If you've just made your WoW: Forever character, Battle.net can take a while to list it: refresh your characters later."
    : "World of Warcraft: Forever launches on Nov 4, 2026. Once you've made your character there, refresh your characters or reconnect.";
}

/** Why a linked account offers this guild no characters, saying what the account does have. */
export function emptySnapshotMessage(input: EmptySnapshotInput): string {
  const { battletag, status, scan, foreverCharacters, guildFaction, now } = input;
  if (status === "forbidden") {
    return "Battle.net didn't share your character list. Reconnect and allow access to your World of Warcraft profile.";
  }
  if (status === "error") {
    return "Battle.net didn't respond when we read your characters. Try refreshing or reconnecting later.";
  }

  if (foreverCharacters.length > 0) {
    if (guildFaction && foreverCharacters.every((c) => c.faction !== guildFaction)) {
      const other = FACTION_LABELS[guildFaction === "alliance" ? "horde" : "alliance"];
      return `Your WoW: Forever characters on ${battletag} are ${other}; this guild only accepts ${FACTION_LABELS[guildFaction]} characters.`;
    }
    return `None of your WoW: Forever characters on ${battletag} are on this guild's realms.`;
  }

  if (!scan) {
    return `We found no WoW: Forever characters on ${battletag}. Refresh your characters or reconnect Battle.net to see what else is on the account.`;
  }

  const incomplete = scan.namespaces.some((n) => n.status === "error")
    ? " Battle.net didn't answer for every game, so this may be incomplete."
    : "";
  if (scan.excluded.length === 0) {
    return `Battle.net listed no World of Warcraft characters on ${battletag}.${incomplete} ${launchNote(now)}`;
  }
  const found = listJoin(scan.excluded.map(describeGroup));
  return `We found no WoW: Forever characters on ${battletag}. We did find ${found}, but only WoW: Forever characters can be verified.${incomplete} ${launchNote(now)}`;
}
