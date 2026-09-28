import type { BattlenetCharacterSnapshot } from "@/db/schema";
import type { Faction, WowClass } from "@/lib/game";
import { apiHost, type BlizzardConfig, oauthHost } from "./config";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type SnapshotStatus = "ok" | "empty" | "forbidden" | "error";

export interface CharacterListResult {
  status: SnapshotStatus;
  characters: BattlenetCharacterSnapshot[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  surname: string | null;
  level: number;
  wowClass: WowClass | null;
  faction: Faction | null;
  guildName: string | null;
}

export interface RosterMember {
  id: string;
  name: string;
  realmSlug: string;
  level: number;
  wowClass: WowClass | null;
}

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

/** Parses `GET /profile/user/wow`. Characters of classes WoW: Forever doesn't have are dropped. */
export function parseAccountCharacters(json: unknown): BattlenetCharacterSnapshot[] {
  const accounts = obj(json)?.wow_accounts;
  if (!Array.isArray(accounts)) return [];
  const out: BattlenetCharacterSnapshot[] = [];
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
      const level = num(c.level);
      const classId = num(obj(c.playable_class)?.id);
      const wowClass = classId != null ? CLASS_BY_ID[classId] : undefined;
      const race = obj(c.playable_race);
      const raceId = num(race?.id);
      const faction = factionOf(c.faction, raceId);
      if (id == null || !name || !realmSlug || level == null || level < 1 || !wowClass || !faction) continue;
      out.push({
        id: String(id),
        name,
        surname: surnameOf(c),
        realmSlug,
        realmName: localized(realm?.name) ?? realmSlug,
        level,
        wowClass,
        race: localized(race?.name) ?? "",
        faction,
        guildName: null,
      });
    }
  }
  return out;
}

export function parseCharacterProfile(json: unknown): CharacterProfile | null {
  const c = obj(json);
  const id = num(c?.id);
  const name = localized(c?.name);
  const level = num(c?.level);
  if (!c || id == null || !name || level == null) return null;
  const classId = num(obj(c.character_class)?.id);
  return {
    id: String(id),
    name,
    surname: surnameOf(c),
    level,
    wowClass: classId != null ? (CLASS_BY_ID[classId] ?? null) : null,
    faction: factionOf(c.faction, num(obj(c.race)?.id)),
    guildName: localized(obj(c.guild)?.name),
  };
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
    out.push({ id: String(id), name, realmSlug, level, wowClass: classId != null ? (CLASS_BY_ID[classId] ?? null) : null });
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

  private profileUrl(path: string): string {
    const url = new URL(path, apiHost(this.config.region));
    url.searchParams.set("namespace", this.config.profileNamespace);
    url.searchParams.set("locale", this.config.locale);
    return url.toString();
  }

  private get(path: string, token: string): Promise<Response> {
    return this.fetchImpl(this.profileUrl(path), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  }

  /**
   * The account's characters in the configured namespace. 404 (no characters in this game) and an empty
   * list are "empty"; 403 (scope not granted, or the namespace is off limits) is "forbidden".
   */
  async getAccountCharacters(accessToken: string): Promise<CharacterListResult> {
    let res: Response;
    try {
      res = await this.get("/profile/user/wow", accessToken);
    } catch {
      return { status: "error", characters: [] };
    }
    if (res.status === 404) return { status: "empty", characters: [] };
    if (res.status === 401 || res.status === 403) return { status: "forbidden", characters: [] };
    if (!res.ok) return { status: "error", characters: [] };
    let characters: BattlenetCharacterSnapshot[];
    try {
      characters = parseAccountCharacters(await res.json());
    } catch {
      return { status: "error", characters: [] };
    }
    if (characters.length === 0) return { status: "empty", characters: [] };

    // The account list has no guild (or surname); the character profile does. Best effort only.
    await Promise.all(
      characters.slice(0, MAX_PROFILE_ENRICH).map(async (c, i) => {
        const profile = await this.getCharacterProfile(c.realmSlug, c.name, accessToken).catch(() => null);
        if (profile && profile.id === c.id) {
          characters[i] = { ...c, guildName: profile.guildName, surname: c.surname ?? profile.surname };
        }
      }),
    );
    return { status: "ok", characters };
  }

  /** A public character profile. Null when it doesn't exist, isn't public, or the request fails. */
  async getCharacterProfile(realmSlug: string, name: string, accessToken?: string): Promise<CharacterProfile | null> {
    const token = accessToken ?? (await this.appToken());
    const res = await this.get(characterPath(realmSlug, name), token);
    if (!res.ok) return null;
    return parseCharacterProfile(await res.json().catch(() => null));
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
