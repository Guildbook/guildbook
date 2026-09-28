import type { BattlenetCharacterSnapshot, BattlenetExcludedGroup, BattlenetNamespaceScan, BattlenetScan } from "@/db/schema";
import { type Faction, RULESET_BY_REALM_TYPE, type Ruleset, type WowClass } from "@/lib/game";
import { isForeverCharacter, knownGameVersion } from "@/lib/wow-versions";
import { apiHost, type BlizzardConfig, oauthHost } from "./config";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type SnapshotStatus = "ok" | "empty" | "forbidden" | "error";

export interface CharacterListResult {
  status: SnapshotStatus;
  /** WoW: Forever characters only. */
  characters: BattlenetCharacterSnapshot[];
  scan: BattlenetScan;
}

const MAX_EXCLUDED_EXAMPLES = 5;

export interface CharacterProfile {
  id: string;
  name: string;
  surname: string | null;
  level: number;
  wowClass: WowClass | null;
  faction: Faction | null;
  guildName: string | null;
  /** The character's in-game guild, from the profile summary's `guild` object. */
  guild: ProfileGuild | null;
  realmSlug: string | null;
}

export interface ProfileGuild {
  name: string;
  realmSlug: string;
  /** Path segment for `/data/wow/guild/{realmSlug}/{nameSlug}`: from `guild.key.href` when present. */
  nameSlug: string;
  faction: Faction | null;
}

export interface RosterMember {
  id: string;
  name: string;
  realmSlug: string;
  level: number;
  wowClass: WowClass | null;
  /** Guild rank index; 0 is the Guild Master. */
  rank: number | null;
}

export type ProfileLookup = { status: "ok"; profile: CharacterProfile } | { status: "missing" } | { status: "error" };
export type RosterLookup =
  | { status: "ok"; members: RosterMember[] }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "error" };
export type RealmRulesetLookup = { status: "ok"; ruleset: Ruleset | null; realmType: string | null } | { status: "error" };

export interface BlizzardItem {
  itemId: number;
  name: string;
  quality: number | null;
  itemLevel: number | null;
  /** Icon file name (e.g. `inv_sword_39`), from the item media endpoint. */
  icon: string | null;
}

export type ItemLookup = { status: "ok"; item: BlizzardItem } | { status: "missing" } | { status: "error" };

const QUALITY_BY_TYPE: Record<string, number> = {
  POOR: 0,
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  ARTIFACT: 6,
  HEIRLOOM: 7,
};

/** `https://render.worldofwarcraft.com/classic1x-us/icons/56/inv_sword_39.jpg` to `inv_sword_39`. */
export function iconNameFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(/\/icons\/\d+\/([a-z0-9_\-]+)\.(?:jpg|png)$/i);
  return m ? m[1]!.toLowerCase() : null;
}

export function parseItem(json: unknown, media: unknown): BlizzardItem | null {
  const raw = obj(json);
  const itemId = num(raw?.id);
  const name = localized(raw?.name);
  if (!raw || !itemId || !name) return null;
  const qualityType = obj(raw.quality)?.type;
  const assets = obj(media)?.assets;
  const icon = Array.isArray(assets) ? assets.map(obj).find((a) => a?.key === "icon")?.value : null;
  return {
    itemId,
    name,
    quality: typeof qualityType === "string" ? (QUALITY_BY_TYPE[qualityType] ?? null) : null,
    itemLevel: num(raw.level),
    icon: iconNameFromUrl(icon),
  };
}

export class BlizzardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BlizzardApiError";
  }
}

/** Blizzard playable class IDs. Classes that don't exist in WoW: Forever map to nothing and are skipped. */
const CLASS_BY_ID: Record<number, WowClass> = {
  1: "warrior",
  2: "paladin",
  3: "hunter",
  4: "rogue",
  5: "priest",
  7: "shaman",
  8: "mage",
  9: "warlock",
  11: "druid",
};

/** Fallback when a response omits `faction`: the original eight playable races. */
const FACTION_BY_RACE_ID: Record<number, Faction> = {
  1: "alliance",
  3: "alliance",
  4: "alliance",
  7: "alliance",
  2: "horde",
  5: "horde",
  6: "horde",
  8: "horde",
};

/** Profile names arrive as a string when a locale is requested, or as a locale map otherwise. */
function localized(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const map = value as Record<string, unknown>;
    const pick = map.en_US ?? Object.values(map).find((v) => typeof v === "string");
    return typeof pick === "string" ? pick : null;
  }
  return null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function factionOf(faction: unknown, raceId: number | null): Faction | null {
  const type = obj(faction)?.type;
  if (type === "ALLIANCE") return "alliance";
  if (type === "HORDE") return "horde";
  return raceId != null ? (FACTION_BY_RACE_ID[raceId] ?? null) : null;
}

/** Surnames are new in WoW: Forever; read one if the API ever exposes it, otherwise the applicant types it. */
function surnameOf(raw: Record<string, unknown>): string | null {
  const value = localized(raw.surname) ?? localized(raw.last_name);
  return value && /^\p{L}{2,12}$/u.test(value) ? value : null;
}

/** One `wow_accounts[].characters[]` entry, before the WoW: Forever class and faction checks. */
interface AccountEntry {
  id: number;
  name: string;
  realmSlug: string;
  realmName: string;
  level: number | null;
  classId: number | null;
  raceName: string;
  faction: Faction | null;
  surname: string | null;
}

/** Every character of every WoW account (licence) in a `GET /profile/user/wow` response. */
function parseAccountEntries(json: unknown): AccountEntry[] {
  const accounts = obj(json)?.wow_accounts;
  if (!Array.isArray(accounts)) return [];
  const out: AccountEntry[] = [];
  for (const account of accounts) {
    const characters = obj(account)?.characters;
    if (!Array.isArray(characters)) continue;
    for (const entry of characters) {
      const c = obj(entry);
      if (!c) continue;
      const id = num(c.id);
      const name = localized(c.name);
      const realm = obj(c.realm);
      const realmSlug = typeof realm?.slug === "string" ? realm.slug : null;
      if (id == null || !name || !realmSlug) continue;
      const race = obj(c.playable_race);
      out.push({
        id,
        name,
        realmSlug,
        realmName: localized(realm?.name) ?? realmSlug,
        level: num(c.level),
        classId: num(obj(c.playable_class)?.id),
        raceName: localized(race?.name) ?? "",
        faction: factionOf(c.faction, num(race?.id)),
        surname: surnameOf(c),
      });
    }
  }
  return out;
}

function toSnapshot(e: AccountEntry): BattlenetCharacterSnapshot | null {
  const wowClass = e.classId != null ? CLASS_BY_ID[e.classId] : undefined;
  if (e.level == null || e.level < 1 || !wowClass || !e.faction) return null;
  return {
    id: String(e.id),
    name: e.name,
    surname: e.surname,
    realmSlug: e.realmSlug,
    realmName: e.realmName,
    level: e.level,
    wowClass,
    race: e.raceName,
    faction: e.faction,
    guildName: null,
  };
}

/** Parses `GET /profile/user/wow`. Characters of classes WoW: Forever doesn't have are dropped. */
export function parseAccountCharacters(json: unknown): BattlenetCharacterSnapshot[] {
  return parseAccountEntries(json).flatMap((e) => toSnapshot(e) ?? []);
}

interface NamespaceRead extends BattlenetNamespaceScan {
  entries: AccountEntry[];
}

/** One-line, count-only summary of a scan for the server log (no names, IDs or tokens). */
export function describeScanForLog(scan: BattlenetScan, foreverCount: number): string {
  const parts = scan.namespaces.map((n) => `${n.namespace}=${n.httpStatus}:${n.characters}`);
  return `${parts.join(" ")} forever=${foreverCount} excluded=${scan.excluded.reduce((sum, g) => sum + g.count, 0)}`;
}

/** Blizzard's guild name slug: lowercase, spaces to hyphens (used only when the response has no `key.href`). */
export function guildNameSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseProfileGuild(value: unknown, fallbackRealm: string | null): ProfileGuild | null {
  const g = obj(value);
  const name = localized(g?.name);
  if (!g || !name) return null;
  const href = obj(g.key)?.href;
  const fromHref = typeof href === "string" ? href.match(/\/data\/wow\/guild\/([^/?#]+)\/([^/?#]+)/) : null;
  const realm = obj(g.realm);
  const realmSlug = typeof realm?.slug === "string" ? realm.slug : fromHref ? decodeURIComponent(fromHref[1]!) : fallbackRealm;
  if (!realmSlug) return null;
  return {
    name,
    realmSlug,
    nameSlug: fromHref ? decodeURIComponent(fromHref[2]!) : guildNameSlug(name),
    faction: factionOf(g.faction, null),
  };
}

export function parseCharacterProfile(json: unknown): CharacterProfile | null {
  const c = obj(json);
  const id = num(c?.id);
  const name = localized(c?.name);
  const level = num(c?.level);
  if (!c || id == null || !name || level == null) return null;
  const classId = num(obj(c.character_class)?.id);
  const realmSlug = obj(c.realm)?.slug;
  const guild = parseProfileGuild(c.guild, typeof realmSlug === "string" ? realmSlug : null);
  return {
    id: String(id),
    name,
    surname: surnameOf(c),
    level,
    wowClass: classId != null ? (CLASS_BY_ID[classId] ?? null) : null,
    faction: factionOf(c.faction, num(obj(c.race)?.id)),
    guildName: guild?.name ?? localized(obj(c.guild)?.name),
    guild,
    realmSlug: typeof realmSlug === "string" ? realmSlug : null,
  };
}

/** A Game Data realm's type (`NORMAL`, `PVP`, `RP`...) as a WoW: Forever ruleset; null when it doesn't map to one. */
export function parseRealmType(json: unknown): { ruleset: Ruleset | null; realmType: string | null } {
  const raw = obj(json);
  const type = obj(raw?.type)?.type;
  const category = localized(raw?.category);
  const realmType = typeof type === "string" ? type.toUpperCase() : null;
  if (category && /hardcore/i.test(category)) return { ruleset: "hardcore", realmType };
  return { ruleset: realmType ? (RULESET_BY_REALM_TYPE[realmType] ?? null) : null, realmType };
}

export function parseGuildRoster(json: unknown): RosterMember[] {
  const members = obj(json)?.members;
  if (!Array.isArray(members)) return [];
  const out: RosterMember[] = [];
  for (const m of members) {
    const c = obj(obj(m)?.character);
    const id = num(c?.id);
    const name = localized(c?.name);
    const realmSlug = obj(c?.realm)?.slug;
    const level = num(c?.level);
    if (!c || id == null || !name || typeof realmSlug !== "string" || level == null) continue;
    const classId = num(obj(c.playable_class)?.id);
    out.push({
      id: String(id),
      name,
      realmSlug,
      level,
      wowClass: classId != null ? (CLASS_BY_ID[classId] ?? null) : null,
      rank: num(obj(m)?.rank),
    });
  }
  return out;
}

/** Profile API paths take lowercase names; realm slugs are already URL-safe. */
function characterPath(realmSlug: string, name: string): string {
  return `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}`;
}

const MAX_PROFILE_ENRICH = 20;

/**
 * Battle.net OAuth and WoW Profile API. All network access goes through `fetchImpl`, so tests and mock
 * mode never reach Blizzard.
 */
export class BlizzardClient {
  private clientToken: { token: string; expiresAt: number } | null = null;
  private readonly realmRulesets = new Map<string, { ruleset: Ruleset | null; realmType: string | null }>();

  constructor(
    readonly config: BlizzardConfig,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
  ) {}

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL("/authorize", oauthHost(this.config.region));
    url.searchParams.set("client_id", this.config.clientId ?? "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "wow.profile");
    url.searchParams.set("state", state);
    return url.toString();
  }

  private async tokenRequest(body: URLSearchParams): Promise<{ accessToken: string; expiresAt: Date }> {
    const { clientId, clientSecret } = this.config;
    if (!this.config.mock && (!clientId || !clientSecret)) {
      throw new BlizzardApiError("BATTLENET_CLIENT_ID and BATTLENET_CLIENT_SECRET are not set", 0);
    }
    const res = await this.fetchImpl(`${oauthHost(this.config.region)}/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId ?? ""}:${clientSecret ?? ""}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
    if (!res.ok) throw new BlizzardApiError(`Battle.net token request failed (${res.status})`, res.status);
    const json = obj(await res.json());
    const accessToken = json?.access_token;
    const expiresIn = num(json?.expires_in) ?? 0;
    if (typeof accessToken !== "string") throw new BlizzardApiError("Battle.net returned no access token", res.status);
    return { accessToken, expiresAt: new Date(Date.now() + expiresIn * 1000) };
  }

  exchangeCode(code: string, redirectUri: string) {
    return this.tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }));
  }

  private async appToken(): Promise<string> {
    if (this.clientToken && this.clientToken.expiresAt > Date.now() + 60_000) return this.clientToken.token;
    const { accessToken, expiresAt } = await this.tokenRequest(new URLSearchParams({ grant_type: "client_credentials" }));
    this.clientToken = { token: accessToken, expiresAt: expiresAt.getTime() };
    return accessToken;
  }

  async getUserInfo(accessToken: string): Promise<{ id: string; battletag: string }> {
    const res = await this.fetchImpl(`${oauthHost(this.config.region)}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) throw new BlizzardApiError(`Battle.net user info failed (${res.status})`, res.status);
    const json = obj(await res.json());
    const id = num(json?.id) ?? (typeof json?.id === "string" ? json.id : null);
    const battletag = typeof json?.battletag === "string" ? json.battletag : null;
    if (id == null) throw new BlizzardApiError("Battle.net user info had no account ID", res.status);
    return { id: String(id), battletag: battletag ?? `Account ${id}` };
  }

  private profileUrl(path: string, namespace = this.config.profileNamespace): string {
    const url = new URL(path, apiHost(this.config.region));
    url.searchParams.set("namespace", namespace);
    url.searchParams.set("locale", this.config.locale);
    return url.toString();
  }

  private get(path: string, token: string, namespace?: string): Promise<Response> {
    return this.fetchImpl(this.profileUrl(path, namespace), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  }

  /**
   * The account's characters in one namespace. 404 (no characters in this game) and an empty list are "empty";
   * 401/403 (scope not granted, or a namespace Blizzard doesn't serve) is "forbidden".
   */
  private async readNamespace(namespace: string, accessToken: string): Promise<NamespaceRead> {
    const result = (status: NamespaceRead["status"], httpStatus: number, entries: AccountEntry[] = []): NamespaceRead => ({
      namespace,
      status,
      httpStatus,
      characters: entries.length,
      entries,
    });
    let res: Response;
    try {
      res = await this.get("/profile/user/wow", accessToken, namespace);
    } catch {
      return result("error", 0);
    }
    if (res.status === 404) return result("empty", 404);
    if (res.status === 401 || res.status === 403) return result("forbidden", res.status);
    if (!res.ok) return result("error", res.status);
    try {
      const entries = parseAccountEntries(await res.json());
      return result(entries.length > 0 ? "ok" : "empty", res.status, entries);
    } catch {
      return result("error", res.status);
    }
  }

  /**
   * Reads every scan namespace and keeps the WoW: Forever characters (see `isForeverCharacter`). The rest are
   * summarised by game and faction in `scan`, so an empty result can say what the account does have. The status
   * follows the Forever namespace, except that "forbidden" needs every namespace refused: a 403 on the Forever
   * namespace alone means Blizzard doesn't serve it (yet), not that access was denied.
   */
  async getAccountCharacters(accessToken: string): Promise<CharacterListResult> {
    const forever = { namespace: this.config.profileNamespace, realmSlugs: this.config.realmSlugs };
    const namespaces = [...new Set([forever.namespace, ...this.config.scanNamespaces])];
    const reads = await Promise.all(namespaces.map((ns) => this.readNamespace(ns, accessToken)));

    const characters: BattlenetCharacterSnapshot[] = [];
    const excluded = new Map<string, BattlenetExcludedGroup>();
    for (const read of reads) {
      for (const entry of read.entries) {
        if (isForeverCharacter({ namespace: read.namespace, realmSlug: entry.realmSlug }, forever)) {
          const snapshot = toSnapshot(entry);
          if (snapshot) characters.push(snapshot);
          continue;
        }
        const version = knownGameVersion(read.namespace, entry.realmSlug);
        const key = `${version}:${entry.faction ?? "none"}`;
        const group = excluded.get(key) ?? { version, faction: entry.faction, count: 0, examples: [] };
        group.count++;
        if (group.examples.length < MAX_EXCLUDED_EXAMPLES) group.examples.push({ name: entry.name, realmName: entry.realmName });
        excluded.set(key, group);
      }
    }
    const scan: BattlenetScan = {
      foreverNamespace: forever.namespace,
      namespaces: reads.map(({ entries: _entries, ...n }) => n),
      excluded: [...excluded.values()].sort((a, b) => b.count - a.count),
    };

    const foreverRead = reads.find((r) => r.namespace === forever.namespace);
    if (characters.length === 0) {
      const status: SnapshotStatus = reads.every((r) => r.status === "forbidden")
        ? "forbidden"
        : foreverRead?.status === "error"
          ? "error"
          : "empty";
      return { status, characters, scan };
    }

    // The account list has no guild (or surname); the character profile does. Best effort only.
    await Promise.all(
      characters.slice(0, MAX_PROFILE_ENRICH).map(async (c, i) => {
        const profile = await this.getCharacterProfile(c.realmSlug, c.name, accessToken).catch(() => null);
        if (profile && profile.id === c.id) {
          characters[i] = { ...c, guildName: profile.guildName, surname: c.surname ?? profile.surname };
        }
      }),
    );
    // Which ruleset each realm is, so a guild only offers characters from its own ruleset. Best effort only.
    const realms = [...new Set(characters.map((c) => c.realmSlug.toLowerCase()))].slice(0, MAX_PROFILE_ENRICH);
    const rulesets = new Map<string, Ruleset | null>();
    await Promise.all(
      realms.map(async (slug) => {
        const lookup = await this.getRealmRuleset(slug).catch(() => null);
        rulesets.set(slug, lookup?.status === "ok" ? lookup.ruleset : null);
      }),
    );
    for (const [i, c] of characters.entries()) characters[i] = { ...c, ruleset: rulesets.get(c.realmSlug.toLowerCase()) ?? null };
    return { status: "ok", characters, scan };
  }

  /** A public character profile. Null when it doesn't exist, isn't public, or the request fails. */
  async getCharacterProfile(realmSlug: string, name: string, accessToken?: string): Promise<CharacterProfile | null> {
    const token = accessToken ?? (await this.appToken());
    const res = await this.get(characterPath(realmSlug, name), token);
    if (!res.ok) return null;
    return parseCharacterProfile(await res.json().catch(() => null));
  }

  /** Like `getCharacterProfile` with an app token, but tells "gone or private" (404/403) apart from a failed request. */
  async lookupCharacterProfile(realmSlug: string, name: string): Promise<ProfileLookup> {
    try {
      const res = await this.get(characterPath(realmSlug, name), await this.appToken());
      if (res.status === 404 || res.status === 403) return { status: "missing" };
      if (!res.ok) return { status: "error" };
      const profile = parseCharacterProfile(await res.json().catch(() => null));
      return profile ? { status: "ok", profile } : { status: "error" };
    } catch {
      return { status: "error" };
    }
  }

  /**
   * The ruleset of a realm: `BATTLENET_REALM_RULESETS` first, then the Game Data realm's type
   * (`/data/wow/realm/{realmSlug}` in the dynamic namespace). Cached for the life of the client.
   */
  async getRealmRuleset(realmSlug: string): Promise<RealmRulesetLookup> {
    const slug = realmSlug.toLowerCase();
    const configured = this.config.realmRulesets[slug];
    if (configured) return { status: "ok", ruleset: configured, realmType: null };
    const cached = this.realmRulesets.get(slug);
    if (cached) return { status: "ok", ...cached };
    try {
      const res = await this.get(`/data/wow/realm/${encodeURIComponent(slug)}`, await this.appToken(), this.config.dynamicNamespace);
      if (res.status === 404) {
        const unknown = { ruleset: null, realmType: null };
        this.realmRulesets.set(slug, unknown);
        return { status: "ok", ...unknown };
      }
      if (!res.ok) return { status: "error" };
      const parsed = parseRealmType(await res.json().catch(() => null));
      this.realmRulesets.set(slug, parsed);
      return { status: "ok", ...parsed };
    } catch {
      return { status: "error" };
    }
  }

  /** The in-game guild roster with ranks. Blizzard answers 403 for some existing Classic guilds, so that is its own status. */
  async lookupGuildRoster(realmSlug: string, nameSlug: string): Promise<RosterLookup> {
    try {
      const res = await this.get(
        `/data/wow/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(nameSlug)}/roster`,
        await this.appToken(),
      );
      if (res.status === 404) return { status: "not_found" };
      if (res.status === 401 || res.status === 403) return { status: "forbidden" };
      if (!res.ok) return { status: "error" };
      const json = await res.json().catch(() => null);
      if (!obj(json)) return { status: "error" };
      return { status: "ok", members: parseGuildRoster(json) };
    } catch {
      return { status: "error" };
    }
  }

  /** An item's name, quality, level and icon from the Game Data API, in the configured static namespace. */
  async getItem(itemId: number): Promise<ItemLookup> {
    try {
      const token = await this.appToken();
      const url = (path: string) => {
        const u = new URL(path, apiHost(this.config.region));
        u.searchParams.set("namespace", this.config.staticNamespace);
        u.searchParams.set("locale", this.config.locale);
        return u.toString();
      };
      const init = { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" as const };
      const res = await this.fetchImpl(url(`/data/wow/item/${itemId}`), init);
      if (res.status === 404) return { status: "missing" };
      if (!res.ok) return { status: "error" };
      const json = await res.json().catch(() => null);
      const mediaRes = await this.fetchImpl(url(`/data/wow/media/item/${itemId}`), init);
      const media = mediaRes.ok ? await mediaRes.json().catch(() => null) : null;
      const item = parseItem(json, media);
      return item ? { status: "ok", item } : { status: "error" };
    } catch {
      return { status: "error" };
    }
  }

  /** The in-game guild roster: one request covers every member's level. Null if the guild isn't found. */
  async getGuildRoster(realmSlug: string, guildSlug: string): Promise<RosterMember[] | null> {
    const token = await this.appToken();
    const res = await this.get(
      `/data/wow/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(guildSlug)}/roster`,
      token,
    );
    if (!res.ok) return null;
    return parseGuildRoster(await res.json().catch(() => null));
  }
}
