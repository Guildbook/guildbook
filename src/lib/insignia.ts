import type { RankTier } from "@/lib/authz/tiers";

export const INSIGNIA = [
  "archangel",
  "keys",
  "banner",
  "laurel",
  "chalice",
  "cross-pattee",
  "chevron",
  "helm",
  "cross",
  "candle",
] as const;
export type Insignia = (typeof INSIGNIA)[number];

export const INSIGNIA_INFO: Record<Insignia, { label: string; meaning: string }> = {
  archangel: { label: "Archangel", meaning: "Crowned sword of Saint Michael between his wings" },
  keys: { label: "Crossed keys", meaning: "The steward who holds the keys of the house, under the cross" },
  banner: { label: "Sword and banner", meaning: "Carries the Order's banner and leads the host in the field" },
  laurel: { label: "Sword and laurel", meaning: "Commands a company" },
  chalice: { label: "Chalice and host", meaning: "Keeper of the Order's prayer life" },
  "cross-pattee": { label: "Cross pattée", meaning: "The cross of the knightly orders" },
  chevron: { label: "Chevron", meaning: "The mark of a sergeant-at-arms" },
  helm: { label: "Helm", meaning: "Bears the helm and arms of a knight" },
  cross: { label: "Cross", meaning: "Beginning formation in the Order" },
  candle: { label: "Candle", meaning: "Seeking entry, a light in the window" },
};

/** The meanings above are the Order's; other guilds read these where the Order's mention it. */
const GENERIC_MEANINGS: Partial<Record<Insignia, string>> = {
  archangel: "A crowned sword between two wings",
  keys: "The steward who holds the keys of the house",
  banner: "Carries the guild's banner and leads the host in the field",
  chalice: "Keeper of the guild's fellowship and traditions",
  "cross-pattee": "The mark of the raiding core",
  chevron: "A mark of steady service",
  helm: "Bears the helm and arms of a raider",
  cross: "Taking the first steps in the guild",
};

export function insigniaMeaning(insignia: Insignia, guild: { preset: string }) {
  return (guild.preset !== "order" && GENERIC_MEANINGS[insignia]) || INSIGNIA_INFO[insignia].meaning;
}

/** Used when a rank has no insignia chosen. */
export const DEFAULT_INSIGNIA_BY_TIER: Record<RankTier, Insignia> = {
  admin: "archangel",
  officer: "banner",
  raider: "cross-pattee",
  member: "cross",
  applicant: "candle",
};

export function insigniaFor(rank: { insignia: string | null; tier: RankTier }): Insignia {
  return (INSIGNIA as readonly string[]).includes(rank.insignia ?? "")
    ? (rank.insignia as Insignia)
    : DEFAULT_INSIGNIA_BY_TIER[rank.tier];
}
