import { createHash } from "node:crypto";
import type { Region } from "@/lib/game";
import type { FetchLike } from "./client";
import { namespaceFor, namespaceTemplate } from "./config";

/**
 * BATTLENET_MOCK=1: a fake Battle.net for dev and e2e. It answers the same URLs the real client calls, on both the
 * US and EU API hosts, so the parsing and filtering code runs unchanged. Each linking user gets their own account
 * (derived from the `mock-<seed>` authorization code) holding the fixture characters below: the US ones, plus one EU
 * character, with account-unique character IDs. A seed containing `eu-forbidden` gets 403 on every EU profile read,
 * as for an account without a European licence.
 *
 * TBC Anniversary lives in `profile-classicann-*` / `dynamic-classicann-*`. Every account holds Elowen (no guild); a
 * seed containing `ann-gm`, `ann-member` or `ann-realm` adds a character that is Guild Master of <Mirkwood> on
 * Dreamscythe, a rank 3 member of it, or Guild Master of another <Mirkwood> on Nightslayer; `ann-guild-<tag>` names
 * that guild <Mirkwood tag> instead, so repeated runs don't collide on one guild identity. In mock mode the link
 * route's seed is `<user id>.<discord id>`, so an e2e run picks these through the Discord ID it signs in with.
 */

interface MockRealm {
  id: number;
  slug: string;
  name: string;
  /** Game Data realm `type.type`, which maps to a WoW: Forever ruleset. */
  type: string;
}

const CRUSADERS_REACH: MockRealm = { id: 6101, slug: "crusaders-reach", name: "Crusader's Reach", type: "NORMAL" };
const SILVERPINE: MockRealm = { id: 6102, slug: "silverpine", name: "Silverpine", type: "NORMAL" };

interface MockCharacter {
  name: string;
  level: number;
  /** Level the character profile reports, so a sync visibly updates it. */
  currentLevel: number;
  classId: number;
  className: string;
  raceId: number;
  race: string;
  faction: "ALLIANCE" | "HORDE";
  realm: MockRealm;
  guild: string | null;
  /** Rank in `guild`; 0 is the Guild Master. */
  guildRank?: number;
}

export const MOCK_CHARACTERS: readonly MockCharacter[] = [
  { name: "Aldric", level: 60, currentLevel: 60, classId: 2, className: "Paladin", raceId: 1, race: "Human", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: "Order of Saint Michael", guildRank: 0 },
  { name: "Brenna", level: 42, currentLevel: 44, classId: 5, className: "Priest", raceId: 3, race: "Dwarf", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: null },
  { name: "Corwin", level: 27, currentLevel: 27, classId: 11, className: "Druid", raceId: 4, race: "Night Elf", faction: "ALLIANCE", realm: SILVERPINE, guild: null },
  { name: "Grukk", level: 60, currentLevel: 60, classId: 1, className: "Warrior", raceId: 2, race: "Orc", faction: "HORDE", realm: CRUSADERS_REACH, guild: null },
  // Not a WoW: Forever class: the client drops it.
  { name: "Mortis", level: 58, currentLevel: 58, classId: 6, className: "Death Knight", raceId: 1, race: "Human", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: null },
];

const DREAMSCYTHE: MockRealm = { id: 6225, slug: "dreamscythe", name: "Dreamscythe", type: "NORMAL" };
const NIGHTSLAYER: MockRealm = { id: 6226, slug: "nightslayer", name: "Nightslayer", type: "PVP" };
const THUNDERSTRIKE: MockRealm = { id: 6409, slug: "thunderstrike", name: "Thunderstrike", type: "NORMAL" };
const HOLLOWMERE: MockRealm = { id: 7101, slug: "hollowmere", name: "Hollowmere", type: "NORMAL" };
const REALMS: Record<Region, MockRealm[]> = { us: [CRUSADERS_REACH, SILVERPINE, DREAMSCYTHE], eu: [HOLLOWMERE] };
/** The `dynamic-classicann-*` realm index. */
const ANNIVERSARY_REALMS: Record<Region, MockRealm[]> = { us: [DREAMSCYTHE, NIGHTSLAYER], eu: [THUNDERSTRIKE] };

/** On an EU Forever realm: listed for EU guilds only. */
export const MOCK_EU_CHARACTERS: readonly MockCharacter[] = [
  { name: "Isolde", level: 52, currentLevel: 52, classId: 2, className: "Paladin", raceId: 3, race: "Dwarf", faction: "ALLIANCE", realm: HOLLOWMERE, guild: null },
];
const EU_INDEX = 50;

const charactersIn = (region: Region) => (region === "us" ? MOCK_CHARACTERS : MOCK_EU_CHARACTERS);
const indexOffset = (region: Region) => (region === "us" ? 0 : EU_INDEX);

const mockGuildSlug = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/** In-game tabards by guild name, as the guild endpoint's `crest` (the game's colour ids and RGBA). */
export const MOCK_GUILD_CRESTS: Record<string, unknown> = {
  "Order of Saint Michael": {
    emblem: { id: 97, media: { id: 97 }, color: { id: 14, rgba: { r: 177, g: 184, b: 177, a: 1 } } },
    border: { id: 0, media: { id: 0 }, color: { id: 3, rgba: { r: 103, g: 86, b: 0, a: 1 } } },
    background: { color: { id: 2, rgba: { r: 158, g: 0, b: 54, a: 1 } } },
  },
  Mirkwood: {
    emblem: { id: 31, media: { id: 31 }, color: { id: 6, rgba: { r: 62, g: 142, b: 60, a: 1 } } },
    border: { id: 2, media: { id: 2 }, color: { id: 1, rgba: { r: 44, g: 36, b: 22, a: 1 } } },
    background: { color: { id: 40, rgba: { r: 22, g: 58, b: 33, a: 1 } } },
  },
};

/** On a TBC Anniversary realm, served from `profile-classicann-*`: every account holds her. */
export const MOCK_ANNIVERSARY_CHARACTER: MockCharacter = {
  name: "Elowen",
  level: 24,
  currentLevel: 24,
  classId: 8,
  className: "Mage",
  raceId: 7,
  race: "Gnome",
  faction: "ALLIANCE",
  realm: DREAMSCYTHE,
  guild: null,
};

/** TBC Anniversary characters an account holds when its seed contains the key (see the header comment). */
export const MOCK_ANNIVERSARY_ROLES: Record<"ann-gm" | "ann-member" | "ann-realm", MockCharacter> = {
  "ann-gm": { name: "Thranduil", level: 70, currentLevel: 70, classId: 2, className: "Paladin", raceId: 10, race: "Blood Elf", faction: "HORDE", realm: DREAMSCYTHE, guild: "Mirkwood", guildRank: 0 },
  "ann-member": { name: "Mattaeis", level: 68, currentLevel: 70, classId: 3, className: "Hunter", raceId: 10, race: "Blood Elf", faction: "HORDE", realm: DREAMSCYTHE, guild: "Mirkwood", guildRank: 3 },
  "ann-realm": { name: "Galadhon", level: 70, currentLevel: 70, classId: 1, className: "Warrior", raceId: 2, race: "Orc", faction: "HORDE", realm: NIGHTSLAYER, guild: "Mirkwood", guildRank: 0 },
};
const ANNIVERSARY_ALL: readonly MockCharacter[] = [MOCK_ANNIVERSARY_CHARACTER, ...Object.values(MOCK_ANNIVERSARY_ROLES)];
const ANNIVERSARY_INDEX = 90;

function anniversaryCharactersFor(seed: string): MockCharacter[] {
  return [MOCK_ANNIVERSARY_CHARACTER, ...Object.entries(MOCK_ANNIVERSARY_ROLES).flatMap(([k, c]) => (seed.includes(k) ? [c] : []))];
}

/** The in-game guild of an account's Anniversary role characters (see the header comment). */
function anniversaryGuildName(seed: string): string {
  const tag = seed.match(/ann-guild-([a-z0-9]+)/i)?.[1];
  return tag ? `Mirkwood ${tag}` : "Mirkwood";
}

/** Index of an Anniversary fixture, stable across accounts, so IDs don't depend on which roles an account holds. */
const anniversaryIndex = (c: MockCharacter) => ANNIVERSARY_INDEX + ANNIVERSARY_ALL.indexOf(c);

function hashNumber(seed: string, digits: number): number {
  return parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 12), 16) % 10 ** digits;
}

export function mockAccountId(seed: string): string {
  return String(100_000_000 + hashNumber(seed, 8));
}

function mockCharacterId(seed: string, index: number): string {
  return `${mockAccountId(seed)}${String(index + 1).padStart(2, "0")}`;
}

/** Character IDs handed out so far, keyed by realm/name, for app-token profile lookups (which carry no account). */
const registry: Map<string, string> = ((globalThis as { __bnetMockRegistry?: Map<string, string> }).__bnetMockRegistry ??=
  new Map());

/** The guild name each listed Anniversary role character was handed out with, keyed like `registry`. */
const anniversaryGuilds: Map<string, string> = ((globalThis as { __bnetMockAnnGuilds?: Map<string, string> }).__bnetMockAnnGuilds ??=
  new Map());

const key = (region: Region, realmSlug: string, name: string, anniversary = false) =>
  `${anniversary ? "classicann/" : ""}${region}/${realmSlug}/${name.toLowerCase()}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bearer(init?: RequestInit): string | null {
  const header = new Headers(init?.headers).get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function userSeed(token: string | null): string | null {
  return token?.startsWith("mock-user.") ? token.slice("mock-user.".length) : null;
}

function characterJson(seed: string, c: MockCharacter, index: number) {
  return {
    id: Number(mockCharacterId(seed, index)),
    name: c.name,
    realm: { id: c.realm.id, slug: c.realm.slug, name: c.realm.name },
    playable_class: { id: c.classId, name: c.className },
    playable_race: { id: c.raceId, name: c.race },
    faction: { type: c.faction, name: c.faction === "ALLIANCE" ? "Alliance" : "Horde" },
    level: c.level,
  };
}

/** `https://eu.api.blizzard.com/...` to `eu`; the OAuth host and anything else to `us`. */
function regionOf(u: URL): Region {
  return u.hostname.startsWith("eu.") ? "eu" : "us";
}

/**
 * The fixture characters live in the configured profile namespace (a template or concrete name, see
 * `namespaceTemplate`) of their region; one Anniversary character lives in `profile-classicann-us`; every other
 * namespace answers 404, as Blizzard does for a game with no characters.
 */
export function createMockFetch(profileNamespace = "profile-classic1x-{region}"): FetchLike {
  const template = namespaceTemplate(profileNamespace);
  return async (url, init) => {
    const u = new URL(url);
    const path = u.pathname;
    const region = regionOf(u);
    const foreverNamespace = namespaceFor(template, region);
    const namespace = u.searchParams.get("namespace") ?? "";
    const anniversary = namespace.includes("classicann") && namespace !== foreverNamespace;
    const offset = anniversary ? 0 : indexOffset(region);
    const fixtures: readonly MockCharacter[] = anniversary ? (region === "us" ? ANNIVERSARY_ALL : []) : charactersIn(region);
    const indexOf = (c: MockCharacter) => (anniversary ? anniversaryIndex(c) : offset + fixtures.indexOf(c));
    const guildNamespace = anniversary ? namespace : foreverNamespace;
    /** An Anniversary role character in the guild of `seed`'s account, or of whoever last listed it. */
    const inGuild = (c: MockCharacter, seed: string | null): MockCharacter => {
      if (!anniversary || !c.guild) return c;
      const name = seed ? anniversaryGuildName(seed) : anniversaryGuilds.get(key(region, c.realm.slug, c.name, true));
      return name ? { ...c, guild: name } : c;
    };

    if (path.endsWith("/token")) {
      const body = new URLSearchParams(typeof init?.body === "string" ? init.body : (init?.body as URLSearchParams | undefined));
      if (body.get("grant_type") === "client_credentials") return json({ access_token: "mock-app", expires_in: 86399 });
      const code = body.get("code") ?? "";
      if (!code.startsWith("mock-")) return json({ error: "invalid_grant" }, 400);
      return json({ access_token: `mock-user.${code.slice(5)}`, token_type: "bearer", expires_in: 86399 });
    }

    const token = bearer(init);
    if (path === "/userinfo") {
      const seed = userSeed(token);
      if (!seed) return json({ error: "invalid_token" }, 401);
      return json({ id: Number(mockAccountId(seed)), battletag: `Pilgrim#${1000 + hashNumber(seed, 4) % 9000}` });
    }

    if (path === "/profile/user/wow") {
      const seed = userSeed(token);
      if (!seed) return json({}, 401);
      if (region === "eu" && seed.includes("eu-forbidden")) return json({ code: 403, detail: "Forbidden" }, 403);
      if (region === "us" && anniversary) {
        const characters = anniversaryCharactersFor(seed).map((c) => {
          registry.set(key(region, c.realm.slug, c.name, true), mockCharacterId(seed, anniversaryIndex(c)));
          if (c.guild) anniversaryGuilds.set(key(region, c.realm.slug, c.name, true), anniversaryGuildName(seed));
          return characterJson(seed, c, anniversaryIndex(c));
        });
        return json({ id: Number(mockAccountId(seed)), wow_accounts: [{ id: 2, characters }] });
      }
      if (namespace !== foreverNamespace) return json({ code: 404, detail: "Not Found" }, 404);
      const characters = fixtures.map((c, i) => {
        registry.set(key(region, c.realm.slug, c.name), mockCharacterId(seed, offset + i));
        return characterJson(seed, c, offset + i);
      });
      return json({ id: Number(mockAccountId(seed)), wow_accounts: [{ id: 1, characters }] });
    }

    const profile = path.match(/^\/profile\/wow\/character\/([^/]+)\/([^/]+)$/);
    if (profile) {
      const [, realmSlug, name] = profile.map(decodeURIComponent) as [string, string, string];
      const seed = userSeed(token);
      const found = fixtures.find((x) => x.realm.slug === realmSlug && x.name.toLowerCase() === name);
      const c = found && inGuild(found, seed);
      const id = !found ? null : seed ? mockCharacterId(seed, indexOf(found)) : registry.get(key(region, realmSlug, name, anniversary));
      if (!c || !id) return json({ code: 404 }, 404);
      return json({
        id: Number(id),
        name: c.name,
        level: c.currentLevel,
        character_class: { id: c.classId, name: c.className },
        race: { id: c.raceId, name: c.race },
        faction: { type: c.faction },
        realm: { slug: c.realm.slug, name: c.realm.name },
        ...(c.guild
          ? {
              guild: {
                key: { href: `${u.origin}/data/wow/guild/${c.realm.slug}/${mockGuildSlug(c.guild)}?namespace=${guildNamespace}` },
                name: c.guild,
                realm: { slug: c.realm.slug, name: c.realm.name },
                faction: { type: c.faction },
              },
            }
          : {}),
      });
    }

    const realm = path.match(/^\/data\/wow\/realm\/([^/]+)$/);
    if (realm) {
      const r = (anniversary ? ANNIVERSARY_REALMS : REALMS)[region].find((x) => x.slug === decodeURIComponent(realm[1]!));
      if (!r) return json({ code: 404 }, 404);
      return json({ id: r.id, slug: r.slug, name: r.name, type: { type: r.type, name: r.type === "PVP" ? "PvP" : "Normal" } });
    }

    const roster = path.match(/^\/data\/wow\/guild\/([^/]+)\/([^/]+)\/roster$/);
    if (roster) {
      const [, realmSlug, guildSlug] = roster.map(decodeURIComponent) as [string, string, string];
      const listed = fixtures.map((c) => inGuild(c, null));
      const members = listed.flatMap((c) => {
        if (!c.guild || c.realm.slug !== realmSlug || mockGuildSlug(c.guild) !== guildSlug) return [];
        const id = registry.get(key(region, c.realm.slug, c.name, anniversary));
        if (!id) return [];
        return [
          {
            character: {
              id: Number(id),
              name: c.name,
              level: c.currentLevel,
              realm: { slug: c.realm.slug },
              playable_class: { id: c.classId },
              playable_race: { id: c.raceId },
            },
            rank: c.guildRank ?? 5,
          },
        ];
      });
      if (members.length === 0) return json({ code: 404 }, 404);
      return json({ guild: { name: listed.find((c) => c.guild && mockGuildSlug(c.guild) === guildSlug)?.guild }, members });
    }

    const guild = path.match(/^\/data\/wow\/guild\/([^/]+)\/([^/]+)$/);
    if (guild) {
      const [, realmSlug, guildSlug] = guild.map(decodeURIComponent) as [string, string, string];
      const member = fixtures.map((c) => inGuild(c, null)).find((c) => c.guild && c.realm.slug === realmSlug && mockGuildSlug(c.guild) === guildSlug);
      if (!member?.guild) return json({ code: 404 }, 404);
      const crest = MOCK_GUILD_CRESTS[member.guild] ?? (member.guild.startsWith("Mirkwood") ? MOCK_GUILD_CRESTS.Mirkwood : undefined);
      return json({
        name: member.guild,
        realm: { slug: member.realm.slug, name: member.realm.name },
        faction: { type: member.faction },
        ...(crest ? { crest } : {}),
      });
    }

    return json({ code: 404, detail: "Not Found" }, 404);
  };
}
