import { RULESETS, type Ruleset } from "@/lib/game";

export const REGIONS = ["us", "eu", "kr", "tw", "cn"] as const;
export type Region = (typeof REGIONS)[number];

export interface BlizzardConfig {
  region: Region;
  /**
   * Profile API namespace WoW: Forever characters are read from. Blizzard hasn't published one yet: likely
   * `profile-classic1x-us` (shared with Classic Era), possibly `profile-classic-us`. `{region}` is substituted.
   * Characters here on a known pre-Forever realm are never treated as Forever characters (see `isForeverCharacter`).
   */
  profileNamespace: string;
  /**
   * Every profile namespace read when linking, so an account without Forever characters can be told what it does
   * have. Always includes `profileNamespace`.
   */
  scanNamespaces: string[];
  /**
   * Game Data namespace for item names and icons. Classic Era uses `static-classic1x-{region}`; WoW: Forever's is
   * unknown until launch. Item data is only a gap-filler behind imports and the addon.
   */
  staticNamespace: string;
  locale: string;
  /**
   * WoW: Forever realm slugs. When set, only characters on these realms (in `profileNamespace`) count as Forever
   * characters, even realms otherwise known as Classic ones. Empty means any realm that isn't a known Classic one.
   */
  realmSlugs: string[];
  /**
   * Game Data namespace for realm lookups (realm type to ruleset). Defaults to the profile namespace's `dynamic-`
   * twin, e.g. `profile-classic1x-us` to `dynamic-classic1x-us`.
   */
  dynamicNamespace: string;
  /** Explicit realm slug to ruleset map (BATTLENET_REALM_RULESETS), checked before Blizzard's realm type. */
  realmRulesets: Record<string, Ruleset>;
  /** In-game guild used for one-request roster syncs, when both are set. */
  guildRealmSlug: string | null;
  guildSlug: string | null;
  clientId: string | null;
  clientSecret: string | null;
  /** Serve fixture characters instead of calling Blizzard (dev and e2e). */
  mock: boolean;
}

const DEFAULT_NAMESPACE = "profile-classic1x-{region}";
const DEFAULT_STATIC_NAMESPACE = "static-classic1x-{region}";
const DEFAULT_SCAN_NAMESPACES = [
  "profile-classic1x-{region}",
  "profile-classicann-{region}",
  "profile-classic-{region}",
  "profile-{region}",
];

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** `realm-a:pvp,realm-b:normal` to a map; unknown rulesets are ignored. */
function realmRulesetMap(value: string | undefined): Record<string, Ruleset> {
  const out: Record<string, Ruleset> = {};
  for (const pair of list(value)) {
    const [slug, ruleset] = pair.split(":").map((s) => s.trim());
    if (slug && ruleset && (RULESETS as readonly string[]).includes(ruleset)) out[slug] = ruleset as Ruleset;
  }
  return out;
}

export function blizzardConfigFromEnv(env: Record<string, string | undefined> = process.env): BlizzardConfig {
  const rawRegion = (env.BATTLENET_REGION ?? "us").trim().toLowerCase();
  const region = (REGIONS as readonly string[]).includes(rawRegion) ? (rawRegion as Region) : "us";
  const mock = env.BATTLENET_MOCK === "1";
  if (mock && env.VERCEL_ENV === "production") {
    throw new Error("BATTLENET_MOCK must never be enabled in production.");
  }
  const profileNamespace = (env.BATTLENET_PROFILE_NAMESPACE?.trim() || DEFAULT_NAMESPACE).replaceAll("{region}", region);
  const scan = list(env.BATTLENET_SCAN_NAMESPACES);
  return {
    region,
    profileNamespace,
    scanNamespaces: [
      ...new Set([profileNamespace, ...(scan.length > 0 ? scan : DEFAULT_SCAN_NAMESPACES).map((ns) => ns.replaceAll("{region}", region))]),
    ],
    staticNamespace: (env.BATTLENET_STATIC_NAMESPACE?.trim() || DEFAULT_STATIC_NAMESPACE).replaceAll("{region}", region),
    locale: env.BATTLENET_LOCALE?.trim() || "en_US",
    realmSlugs: list(env.BATTLENET_REALMS),
    dynamicNamespace: (env.BATTLENET_DYNAMIC_NAMESPACE?.trim() || profileNamespace.replace(/^profile-/, "dynamic-")).replaceAll(
      "{region}",
      region,
    ),
    realmRulesets: realmRulesetMap(env.BATTLENET_REALM_RULESETS),
    guildRealmSlug: env.BATTLENET_GUILD_REALM?.trim().toLowerCase() || null,
    guildSlug: env.BATTLENET_GUILD_SLUG?.trim().toLowerCase() || null,
    clientId: env.BATTLENET_CLIENT_ID?.trim() || null,
    clientSecret: env.BATTLENET_CLIENT_SECRET?.trim() || null,
    mock,
  };
}

export function oauthHost(region: Region): string {
  return region === "cn" ? "https://oauth.battlenet.com.cn" : "https://oauth.battle.net";
}

export function apiHost(region: Region): string {
  return region === "cn" ? "https://gateway.battlenet.com.cn" : `https://${region}.api.blizzard.com`;
}

/** Whether Battle.net linking can work at all: real credentials, or mock mode. */
export function battlenetEnabled(config: BlizzardConfig): boolean {
  return config.mock || Boolean(config.clientId && config.clientSecret);
}
