import { expansionOf, type GuildVersion } from "@/lib/game-versions";
import { type ItemQuality, qualityFromHex } from "./constants";

/** `|cffa335ee|Hitem:19019:...|h[Thunderfury, Blessed Blade of the Windseeker]|h|r` (pipes may be doubled when escaped). */
const ITEM_LINK = /(?:\|\|?c(?:ff)?([0-9a-f]{6}))?\|\|?Hitem:(\d+)[^|]*\|\|?h\[([^\]]+)\]/i;

/** Icons are hotlinked from Blizzard's render CDN, never stored or re-hosted. Icon names are the same in every version. */
export function itemIconUrl(icon: string): string {
  return `https://render.worldofwarcraft.com/us/icons/56/${encodeURIComponent(icon)}.jpg`;
}

/** Wowhead's database for the version's expansion, where the item has that expansion's stats. */
export function wowheadItemUrl(itemId: number, version: GuildVersion = "forever"): string {
  return `https://www.wowhead.com/${expansionOf(version) === "tbc" ? "tbc" : "classic"}/item=${itemId}`;
}

export function placeholderItemName(itemId: number): string {
  return `Item #${itemId}`;
}

export interface ItemLinkParts {
  itemId: number;
  name: string;
  quality: ItemQuality | null;
}

export function parseItemLink(text: string | null | undefined): ItemLinkParts | null {
  if (!text) return null;
  const m = text.match(ITEM_LINK);
  if (!m) return null;
  return { itemId: Number(m[2]), name: m[3]!.trim(), quality: qualityFromHex(m[1]) };
}

/** "[Name]" as RCLootCouncil writes it; plain names pass through. */
export function stripBrackets(name: string | null | undefined): string | null {
  const v = name?.trim().replace(/^\[(.*)\]$/, "$1").trim();
  return v ? v : null;
}

export function positiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * What an officer typed to identify an item: an item ID, a Wowhead URL (`item=19019`), an in-game link, or a name
 * (looked up in the item cache by the caller).
 */
export function parseItemRef(text: string): { itemId: number; name: string | null } | { itemId: null; name: string } | null {
  const v = text.trim();
  if (!v) return null;
  const link = parseItemLink(v);
  if (link) return { itemId: link.itemId, name: link.name };
  const id = positiveInt(v);
  if (id) return { itemId: id, name: null };
  const url = v.match(/item[=/](\d+)/i);
  if (url) return { itemId: Number(url[1]), name: null };
  const named = v.match(/^(.*\S)\s*\(#?(\d+)\)$/);
  if (named) return { itemId: Number(named[2]), name: named[1]!.trim() };
  return { itemId: null, name: v };
}
