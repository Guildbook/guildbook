import type { Faction, Region } from "@/lib/game";
import { BlizzardClient } from "@/server/blizzard/client";
import { blizzardConfigFromEnv } from "@/server/blizzard/config";

export interface FakeCharacter {
  id: number;
  name: string;
  realm: string;
  faction: Faction;
  /** Battle.net region; unset means US, and the snapshot leaves it out as snapshots from before regions did. */
  region?: Region;
  /** Set for TBC Anniversary characters; unset means WoW: Forever. */
  version?: "anniversary";
  guild?: { name: string; realm: string; faction: Faction };
}

/**
 * A tiny Battle.net: character profiles (per region, from the API host), realm types and guild rosters, served
 * through the client's fetch.
 */
export class FakeBattlenet {
  characters = new Map<string, FakeCharacter>();
  /** API regions that character profiles were requested from. */
  profileRegions: string[] = [];
  /** Namespaces that character profiles were requested in. */
  profileNamespaces: string[] = [];
  realmTypes = new Map<string, string>();
  /** Guild roster by `realm/name-slug`: member ranks by character id, or an HTTP status to answer with. */
  rosters = new Map<string, Map<number, number> | number>();
  down = false;

  character(c: FakeCharacter) {
    this.characters.set(`${c.region ?? "us"}/${c.realm}/${c.name.toLowerCase()}`, c);
    return c;
  }

  roster(realm: string, guildName: string, ranks: Array<[number, number]> | number) {
    this.rosters.set(`${realm}/${guildName.toLowerCase().replace(/\s+/g, "-")}`, typeof ranks === "number" ? ranks : new Map(ranks));
  }

  fetch = async (url: string): Promise<Response> => {
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const u = new URL(url);
    if (u.pathname === "/token") return json({ access_token: "app-token", expires_in: 86400 });
    if (this.down) return json({}, 503);

    let m = u.pathname.match(/^\/profile\/wow\/character\/([^/]+)\/([^/]+)$/);
    if (m) {
      const region = u.hostname.split(".")[0]!;
      this.profileRegions.push(region);
      this.profileNamespaces.push(u.searchParams.get("namespace") ?? "");
      const c = this.characters.get(`${region}/${decodeURIComponent(m[1]!)}/${decodeURIComponent(m[2]!)}`);
      if (!c) return json({}, 404);
      return json({
        id: c.id,
        name: c.name,
        level: 60,
        realm: { slug: c.realm },
        faction: { type: c.faction.toUpperCase() },
        character_class: { id: 2 },
        guild: c.guild
          ? {
              key: { href: `https://us.api.blizzard.com/data/wow/guild/${c.guild.realm}/${c.guild.name.toLowerCase().replace(/\s+/g, "-")}?namespace=profile-classic1x-us` },
              name: c.guild.name,
              realm: { slug: c.guild.realm },
              faction: { type: c.guild.faction.toUpperCase() },
            }
          : undefined,
      });
    }
    m = u.pathname.match(/^\/data\/wow\/realm\/([^/]+)$/);
    if (m) {
      const type = this.realmTypes.get(m[1]!);
      return type ? json({ slug: m[1], type: { type } }) : json({}, 404);
    }
    m = u.pathname.match(/^\/data\/wow\/guild\/([^/]+)\/([^/]+)\/roster$/);
    if (m) {
      const roster = this.rosters.get(`${m[1]}/${decodeURIComponent(m[2]!)}`);
      if (roster === undefined) return json({}, 404);
      if (typeof roster === "number") return json({}, roster);
      return json({
        members: [...roster].map(([id, rank]) => {
          const c = [...this.characters.values()].find((x) => x.id === id)!;
          return { character: { id, name: c.name, realm: { slug: c.realm }, level: 60, playable_class: { id: 2 } }, rank };
        }),
      });
    }
    return json({}, 404);
  };

  client() {
    const config = { ...blizzardConfigFromEnv({ BATTLENET_CLIENT_ID: "id", BATTLENET_CLIENT_SECRET: "secret" }), mock: false };
    return new BlizzardClient(config, this.fetch);
  }
}
