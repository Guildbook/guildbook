import { describe, expect, it } from "vitest";
import { BlizzardClient, type FetchLike, parseAccountCharacters } from "./client";
import { blizzardConfigFromEnv } from "./config";
import { decryptToken, encryptToken, tokenKeyFromEnv } from "./crypto";
import { charactersForGuild } from "./filter";
import { createMockFetch } from "./mock";

const config = { ...blizzardConfigFromEnv({}), clientId: "id", clientSecret: "secret" };

function fetchReturning(status: number, body: unknown = {}): FetchLike {
  return async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("blizzardConfigFromEnv", () => {
  it("defaults to the US Classic Era profile namespace and substitutes the region", () => {
    expect(blizzardConfigFromEnv({}).profileNamespace).toBe("profile-classic1x-us");
    const eu = blizzardConfigFromEnv({ BATTLENET_REGION: "EU", BATTLENET_PROFILE_NAMESPACE: "profile-{region}" });
    expect(eu).toMatchObject({ region: "eu", profileNamespace: "profile-eu" });
  });

  it("parses realm filters and refuses mock mode in production", () => {
    expect(blizzardConfigFromEnv({ BATTLENET_REALMS: " Crusaders-Reach, silverpine ," }).realmSlugs).toEqual([
      "crusaders-reach",
      "silverpine",
    ]);
    expect(() => blizzardConfigFromEnv({ BATTLENET_MOCK: "1", VERCEL_ENV: "production" })).toThrow(/production/);
  });
});

describe("BlizzardClient.getAccountCharacters", () => {
  it("parses the account list, dropping classes WoW: Forever doesn't have, and reads guilds from profiles", async () => {
    const client = new BlizzardClient({ ...config, mock: true }, createMockFetch());
    const { accessToken } = await client.exchangeCode("mock-someone", "http://localhost/cb");
    const result = await client.getAccountCharacters(accessToken);
    expect(result.status).toBe("ok");
    expect(result.characters.map((c) => c.name)).toEqual(["Aldric", "Brenna", "Corwin", "Grukk"]);
    expect(result.characters[0]).toMatchObject({
      level: 60,
      wowClass: "paladin",
      faction: "alliance",
      race: "Human",
      realmSlug: "crusaders-reach",
      realmName: "Crusader's Reach",
      guildName: "Order of Saint Michael",
      surname: null,
    });
  });

  it("sends the configured namespace and locale", async () => {
    const urls: string[] = [];
    const client = new BlizzardClient({ ...config, profileNamespace: "profile-classic-us" }, async (url) => {
      urls.push(url);
      return new Response("{}", { status: 404 });
    });
    await client.getAccountCharacters("token");
    expect(urls[0]).toBe("https://us.api.blizzard.com/profile/user/wow?namespace=profile-classic-us&locale=en_US");
  });

  it.each([
    [403, {}, "forbidden"],
    [401, {}, "forbidden"],
    [404, {}, "empty"],
    [200, { wow_accounts: [] }, "empty"],
    [200, {}, "empty"],
    [500, {}, "error"],
  ] as const)("maps HTTP %i %j to %s", async (status, body, expected) => {
    const client = new BlizzardClient(config, fetchReturning(status, body));
    expect(await client.getAccountCharacters("token")).toEqual({ status: expected, characters: [] });
  });

  it("reports a network failure as an error, not a crash", async () => {
    const client = new BlizzardClient(config, async () => {
      throw new Error("offline");
    });
    expect((await client.getAccountCharacters("token")).status).toBe("error");
  });

  it("reads localized names and falls back to race for faction", () => {
    const [c] = parseAccountCharacters({
      wow_accounts: [
        {
          characters: [
            {
              id: 7,
              name: { en_US: "Elowen" },
              level: 12,
              realm: { slug: "silverpine", name: { en_US: "Silverpine" } },
              playable_class: { id: 8 },
              playable_race: { id: 7, name: { en_US: "Gnome" } },
            },
          ],
        },
      ],
    });
    expect(c).toMatchObject({ id: "7", name: "Elowen", realmName: "Silverpine", wowClass: "mage", faction: "alliance", race: "Gnome" });
  });
});

describe("charactersForGuild", () => {
  const chars = parseAccountCharacters({
    wow_accounts: [
      {
        characters: [
          { id: 1, name: "Aldric", level: 60, realm: { slug: "a" }, playable_class: { id: 2 }, playable_race: { id: 1 } },
          { id: 2, name: "Corwin", level: 27, realm: { slug: "b" }, playable_class: { id: 11 }, playable_race: { id: 4 } },
          { id: 3, name: "Grukk", level: 60, realm: { slug: "a" }, playable_class: { id: 1 }, playable_race: { id: 2 } },
        ],
      },
    ],
  });

  it("keeps only the guild's faction", () => {
    expect(charactersForGuild(chars, { faction: "alliance", realmSlugs: [] }).map((c) => c.name)).toEqual(["Aldric", "Corwin"]);
    expect(charactersForGuild(chars, { faction: "horde", realmSlugs: [] }).map((c) => c.name)).toEqual(["Grukk"]);
    expect(charactersForGuild(chars, { faction: null, realmSlugs: [] })).toHaveLength(3);
  });

  it("applies the realm filter when configured", () => {
    expect(charactersForGuild(chars, { faction: "alliance", realmSlugs: ["a"] }).map((c) => c.name)).toEqual(["Aldric"]);
  });
});

describe("token encryption", () => {
  const key = Buffer.alloc(32, 3);

  it("round-trips and never stores the plaintext", () => {
    const enc = encryptToken("secret-token", key);
    expect(enc).not.toContain("secret-token");
    expect(decryptToken(enc, key)).toBe("secret-token");
    expect(encryptToken("secret-token", key)).not.toBe(enc);
  });

  it("rejects a tampered token or the wrong key", () => {
    const enc = encryptToken("secret-token", key);
    const parts = enc.split(".");
    parts[3] = Buffer.from("xxxxxxxxxxxx").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(enc, Buffer.alloc(32, 4))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => tokenKeyFromEnv({})).toThrow(/not set/);
    expect(() => tokenKeyFromEnv({ BATTLENET_TOKEN_KEY: Buffer.alloc(16).toString("base64") })).toThrow(/32 bytes/);
    expect(tokenKeyFromEnv({ BATTLENET_TOKEN_KEY: key.toString("base64") })).toEqual(key);
  });
});

describe("item lookups", () => {
  it("uses the configurable static namespace", () => {
    expect(blizzardConfigFromEnv({}).staticNamespace).toBe("static-classic1x-us");
    expect(blizzardConfigFromEnv({ BATTLENET_REGION: "eu", BATTLENET_STATIC_NAMESPACE: "static-{region}" }).staticNamespace).toBe("static-eu");
  });

  it("reads an item and its icon, and reports missing items", async () => {
    const urls: string[] = [];
    const client = new BlizzardClient(config, async (url) => {
      urls.push(url);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.includes("/token")) return json({ access_token: "app", expires_in: 3600 });
      if (url.includes("/data/wow/media/item/19019")) {
        return json({ assets: [{ key: "icon", value: "https://render.worldofwarcraft.com/classic1x-us/icons/56/INV_Sword_39.jpg" }] });
      }
      if (url.includes("/data/wow/item/19019")) {
        return json({ id: 19019, name: "Thunderfury, Blessed Blade of the Windseeker", quality: { type: "LEGENDARY" }, level: 80 });
      }
      return json({ code: 404 }, 404);
    });
    expect(await client.getItem(19019)).toEqual({
      status: "ok",
      item: { itemId: 19019, name: "Thunderfury, Blessed Blade of the Windseeker", quality: 5, itemLevel: 80, icon: "inv_sword_39" },
    });
    expect(urls.find((u) => u.includes("/data/wow/item/"))).toContain("namespace=static-classic1x-us");
    expect(await client.getItem(1)).toEqual({ status: "missing" });
  });
});
