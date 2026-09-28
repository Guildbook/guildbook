import { createHash } from "node:crypto";
import type { FetchLike } from "./client";

/**
 * BATTLENET_MOCK=1: a fake Battle.net for dev and e2e. It answers the same URLs the real client calls, so the
 * parsing and filtering code runs unchanged. Each linking user gets their own account (derived from the
 * `mock-<seed>` authorization code) holding the fixture characters below, with account-unique character IDs.
 */

interface MockRealm {
  id: number;
  slug: string;
  name: string;
}

const CRUSADERS_REACH: MockRealm = { id: 6101, slug: "crusaders-reach", name: "Crusader's Reach" };
const SILVERPINE: MockRealm = { id: 6102, slug: "silverpine", name: "Silverpine" };

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
}

export const MOCK_CHARACTERS: readonly MockCharacter[] = [
  { name: "Aldric", level: 60, currentLevel: 60, classId: 2, className: "Paladin", raceId: 1, race: "Human", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: "Order of Saint Michael" },
  { name: "Brenna", level: 42, currentLevel: 44, classId: 5, className: "Priest", raceId: 3, race: "Dwarf", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: null },
  { name: "Corwin", level: 27, currentLevel: 27, classId: 11, className: "Druid", raceId: 4, race: "Night Elf", faction: "ALLIANCE", realm: SILVERPINE, guild: null },
  { name: "Grukk", level: 60, currentLevel: 60, classId: 1, className: "Warrior", raceId: 2, race: "Orc", faction: "HORDE", realm: CRUSADERS_REACH, guild: null },
  // Not a WoW: Forever class: the client drops it.
  { name: "Mortis", level: 58, currentLevel: 58, classId: 6, className: "Death Knight", raceId: 1, race: "Human", faction: "ALLIANCE", realm: CRUSADERS_REACH, guild: null },
];

const DREAMSCYTHE: MockRealm = { id: 6225, slug: "dreamscythe", name: "Dreamscythe" };

/** On a Classic Anniversary realm, served from `profile-classicann-*`: listed on the account but never importable. */
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
const ANNIVERSARY_INDEX = 90;

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

const key = (realmSlug: string, name: string) => `${realmSlug}/${name.toLowerCase()}`;

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

/**
 * The fixture characters live in `foreverNamespace` (the configured profile namespace); one Anniversary character
 * lives in `profile-classicann-*`; every other namespace answers 404, as Blizzard does for a game with no characters.
 */
export function createMockFetch(foreverNamespace = "profile-classic1x-us"): FetchLike {
  return async (url, init) => {
    const u = new URL(url);
    const path = u.pathname;

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
      const namespace = u.searchParams.get("namespace") ?? "";
      if (namespace.startsWith("profile-classicann-") && namespace !== foreverNamespace) {
        const characters = [characterJson(seed, MOCK_ANNIVERSARY_CHARACTER, ANNIVERSARY_INDEX)];
        return json({ id: Number(mockAccountId(seed)), wow_accounts: [{ id: 2, characters }] });
      }
      if (namespace !== foreverNamespace) return json({ code: 404, detail: "Not Found" }, 404);
      const characters = MOCK_CHARACTERS.map((c, i) => {
        registry.set(key(c.realm.slug, c.name), mockCharacterId(seed, i));
        return characterJson(seed, c, i);
      });
      return json({ id: Number(mockAccountId(seed)), wow_accounts: [{ id: 1, characters }] });
    }

    const profile = path.match(/^\/profile\/wow\/character\/([^/]+)\/([^/]+)$/);
    if (profile) {
      const [, realmSlug, name] = profile.map(decodeURIComponent) as [string, string, string];
      const index = MOCK_CHARACTERS.findIndex((c) => c.realm.slug === realmSlug && c.name.toLowerCase() === name);
      const c = MOCK_CHARACTERS[index];
      const seed = userSeed(token);
      const id = seed ? mockCharacterId(seed, index) : registry.get(key(realmSlug, name));
      if (!c || !id) return json({ code: 404 }, 404);
      return json({
        id: Number(id),
        name: c.name,
        level: c.currentLevel,
        character_class: { id: c.classId, name: c.className },
        race: { id: c.raceId, name: c.race },
        faction: { type: c.faction },
        realm: { slug: c.realm.slug, name: c.realm.name },
        ...(c.guild ? { guild: { name: c.guild } } : {}),
      });
    }

    return json({ code: 404, detail: "Not Found" }, 404);
  };
}
