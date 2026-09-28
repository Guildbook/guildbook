import type { Faction, Region, Ruleset } from "@/lib/game";
import { SLUG_MAX, slugProblem } from "@/lib/hosts";

/** What tells two guilds with the same name apart; a missing value (not chosen yet) never distinguishes. */
export interface SlugIdentity {
  region?: Region | null;
  faction?: Faction | null;
  ruleset?: Ruleset | null;
}

export const RULESET_SLUG_SUFFIX: Record<Ruleset, string> = { normal: "normal", pvp: "pvp", rp: "rp", hardcore: "hc" };

/** `base` plus `-suffix`, trimming the base so the result fits `SLUG_MAX`. */
export function withSlugSuffix(base: string, suffix: string): string {
  const tail = `-${suffix}`;
  return `${base.slice(0, SLUG_MAX - tail.length).replace(/-+$/, "")}${tail}`;
}

/**
 * Subdomains that describe `subject` where it differs from `holder`, the guild already on `base`: ruleset first, then
 * faction, then region (`oathbound-pvp`, `oathbound-horde`, `oathbound-eu`). Only valid, unreserved slugs.
 */
export function distinguishingSlugs(base: string, subject: SlugIdentity, holder: SlugIdentity | null): string[] {
  const suffixes: string[] = [];
  if (subject.ruleset && subject.ruleset !== holder?.ruleset) suffixes.push(RULESET_SLUG_SUFFIX[subject.ruleset]);
  if (subject.faction && subject.faction !== holder?.faction) suffixes.push(subject.faction);
  if (subject.region && subject.region !== holder?.region) suffixes.push(subject.region);
  return [...new Set(suffixes.map((s) => withSlugSuffix(base, s)))].filter((slug) => slug !== base && !slugProblem(slug));
}

/** Numbered fallbacks `base-2`, `base-3`..., used only when every distinguishing slug is taken. */
export function* numberedSlugs(base: string, from = 2, to = 999): Generator<string> {
  for (let n = from; n <= to; n++) {
    const slug = withSlugSuffix(base, String(n));
    if (!slugProblem(slug)) yield slug;
  }
}
