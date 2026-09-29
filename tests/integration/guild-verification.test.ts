import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, battlenetLinks, type BattlenetCharacterSnapshot, guilds, memberships } from "@/db/schema";
import type { Db } from "@/db/types";
import type { Faction, Region } from "@/lib/game";
import { BlizzardClient } from "@/server/blizzard/client";
import { blizzardConfigFromEnv } from "@/server/blizzard/config";
import { DomainError } from "@/server/errors";
import {
  claimGuildName,
  claimGuildSlug,
  getSlugClaim,
  recheckVerifiedGuilds,
  verifyGuild,
} from "@/server/services/guild-verification";
import { updateGuildSettings } from "@/server/services/ranks";
import { createGuild, createMember, createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

const AFTER_LAUNCH = new Date("2026-12-01T12:00:00Z");
const PRE_LAUNCH = new Date("2026-10-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

interface FakeCharacter {
  id: number;
  name: string;
  realm: string;
  faction: Faction;
  /** Battle.net region; unset means US, and the snapshot leaves it out as snapshots from before regions did. */
  region?: Region;
  guild?: { name: string; realm: string; faction: Faction };
}

/**
 * A tiny Battle.net: character profiles (per region, from the API host), realm types and guild rosters, served
 * through the client's fetch.
 */
class FakeBattlenet {
  characters = new Map<string, FakeCharacter>();
  /** API regions that character profiles were requested from. */
  profileRegions: string[] = [];
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

let seq = 1000;

/** A guild whose Grand Master has linked Battle.net with `characters` in their snapshot. */
async function setup(
  opts: { name?: string; region?: Region; faction?: Faction; ruleset?: "normal" | "pvp" | "rp"; characters?: FakeCharacter[] } = {},
) {
  const guild = await createGuild(db, {
    name: opts.name ?? `Guild ${++seq}`,
    region: opts.region ?? "us",
    faction: opts.faction ?? "alliance",
    ruleset: opts.ruleset ?? "normal",
  });
  const gm = await createMember(db, guild, "Grand Master");
  if (opts.characters) await link(gm.userId, opts.characters);
  return { guild: guild.guild, gm };
}

async function link(userId: string, characters: FakeCharacter[]) {
  const snapshot: BattlenetCharacterSnapshot[] = characters.map((c) => ({
    id: String(c.id),
    name: c.name,
    surname: null,
    realmSlug: c.realm,
    realmName: c.realm,
    level: 60,
    wowClass: "paladin",
    race: "human",
    faction: c.faction,
    guildName: c.guild?.name ?? null,
    ...(c.region ? { region: c.region } : {}),
  }));
  await db.insert(battlenetLinks).values({ userId, battlenetId: `bnet-${++seq}`, battletag: `Tester#${seq}`, region: "us", characters: snapshot });
}

async function row(id: string) {
  const [g] = await db.select().from(guilds).where(eq(guilds.id, id));
  return g!;
}

async function actions(guildId: string) {
  return (await db.select({ action: auditLog.action }).from(auditLog).where(eq(auditLog.guildId, guildId))).map((r) => r.action);
}

/** A Guild Master character (rank 0) of `guildName` on a Normal realm. */
function guildMaster(
  bnet: FakeBattlenet,
  guildName: string,
  opts: { faction?: Faction; realm?: string; rank?: number; region?: Region } = {},
) {
  const realm = opts.realm ?? "forever-normal";
  const faction = opts.faction ?? "alliance";
  bnet.realmTypes.set(realm, bnet.realmTypes.get(realm) ?? "NORMAL");
  const c = bnet.character({ id: ++seq, name: `Leader${seq}`, realm, faction, region: opts.region, guild: { name: guildName, realm, faction } });
  bnet.roster(realm, guildName, [[c.id, opts.rank ?? 0]]);
  return c;
}

describe("verifying a guild", () => {
  it("verifies when an admin's character is rank 0 of the in-game guild with the same name, faction and ruleset", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Dawn Wardens");
    const { guild, gm } = await setup({ name: "Dawn Wardens", characters: [char] });

    const { state, result } = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(state).toBe("verified");
    expect(result).toMatchObject({ verified: true, characterName: char.name });
    expect(await row(guild.id)).toMatchObject({
      verifiedAt: AFTER_LAUNCH,
      verifiedUserId: gm.userId,
      verifiedCharacterId: String(char.id),
      verifiedCharacterName: char.name,
      verifiedRealmSlug: "forever-normal",
      verifiedVia: "battlenet",
      verificationCheckedAt: AFTER_LAUNCH,
    });
    expect(await actions(guild.id)).toContain("guild.verify");
  });

  it("matches names case- and whitespace-insensitively", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "the  silver  HAND");
    const { gm } = await setup({ name: "The Silver Hand", characters: [char] });
    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).state).toBe("verified");
  });

  it("explains pre-launch: no Forever characters exist yet", async () => {
    const bnet = new FakeBattlenet();
    const { guild, gm } = await setup({ characters: [] });
    const { state, result } = await verifyGuild(db, gm, bnet.client(), PRE_LAUNCH);
    expect(state).toBe("unverified");
    expect(result).toMatchObject({ verified: false, reason: "prelaunch" });
    expect(result.message).toMatch(/Forever launches on Nov 4, 2026/);
    expect((await row(guild.id)).verifiedAt).toBeNull();

    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).result.reason).toBe("no_forever_characters");
  });

  it("explains when no admin has linked Battle.net", async () => {
    const { gm } = await setup();
    const { result } = await verifyGuild(db, gm, new FakeBattlenet().client(), AFTER_LAUNCH);
    expect(result).toMatchObject({ reason: "no_link" });
  });

  it("refuses a character that isn't rank 0", async () => {
    const bnet = new FakeBattlenet();
    const officer = guildMaster(bnet, "Oathsworn", { rank: 1 });
    const { guild, gm } = await setup({ name: "Oathsworn", characters: [officer] });
    const { state, result } = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(state).toBe("unverified");
    expect(result).toMatchObject({ reason: "not_guild_master", conclusive: true });
    expect(result.message).toMatch(/isn't its Guild Master \(rank 1\)/);
    expect((await row(guild.id)).verifiedAt).toBeNull();
  });

  it("refuses a faction or ruleset mismatch", async () => {
    const bnet = new FakeBattlenet();
    const horde = guildMaster(bnet, "Red Banner", { faction: "horde", realm: "forever-normal-h" });
    const { gm } = await setup({ name: "Red Banner", faction: "alliance", characters: [horde] });
    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).result.reason).toBe("faction_mismatch");

    bnet.realmTypes.set("forever-pvp", "PVP");
    const pvp = guildMaster(bnet, "Grey Watch", { realm: "forever-pvp" });
    const other = await setup({ name: "Grey Watch", ruleset: "normal", characters: [pvp] });
    const { result } = await verifyGuild(db, other.gm, bnet.client(), AFTER_LAUNCH);
    expect(result.reason).toBe("ruleset_mismatch");
    expect(result.message).toMatch(/on the PvP ruleset, but this guild is Normal/);
  });

  it("checks an EU guild against the EU API with its EU characters", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Nordwacht", { region: "eu" });
    const { guild, gm } = await setup({ name: "Nordwacht", region: "eu", characters: [char] });
    const { state, result } = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(state).toBe("verified");
    expect(result.message).toMatch(/\(Europe, Alliance, Normal\)/);
    expect(bnet.profileRegions).toEqual(["eu"]);
    expect((await row(guild.id)).verifiedCharacterName).toBe(char.name);

    // The daily re-check runs in the guild's region too.
    bnet.profileRegions = [];
    await recheckVerifiedGuilds(db, bnet.client(), new Date(AFTER_LAUNCH.getTime() + DAY));
    expect(bnet.profileRegions).toContain("eu");
    expect(await row(guild.id)).toMatchObject({ verificationFailingSince: null, verificationResult: expect.objectContaining({ verified: true }) });
  });

  it("only counts characters in the guild's region", async () => {
    const bnet = new FakeBattlenet();
    // Guild Master of a same-named guild, but in Europe: never checked for an Americas guild.
    const euLeader = guildMaster(bnet, "Twin Crowns", { region: "eu" });
    const { guild, gm } = await setup({ name: "Twin Crowns", region: "us", characters: [euLeader] });
    const { state, result } = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(state).toBe("unverified");
    expect(result).toMatchObject({ verified: false, reason: "region_mismatch", conclusive: true });
    expect(result.message).toMatch(/this guild is in the Americas region/);
    expect(bnet.profileRegions).toEqual([]);
    expect((await row(guild.id)).verifiedAt).toBeNull();

    // And the other way round: a Europe guild whose admin only has Americas characters.
    const usLinked = await setup({ name: "Twin Crowns West", region: "eu", characters: [{ ...euLeader, region: "us" }] });
    expect((await verifyGuild(db, usLinked.gm, bnet.client(), AFTER_LAUNCH)).result.reason).toBe("region_mismatch");
  });

  it("treats a hidden roster or Blizzard outage as inconclusive", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Quiet Ones");
    bnet.roster("forever-normal", "Quiet Ones", 403);
    const { gm } = await setup({ name: "Quiet Ones", characters: [char] });
    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).result).toMatchObject({ reason: "roster_unavailable", conclusive: false });

    bnet.down = true;
    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).result).toMatchObject({ reason: "blizzard_error", conclusive: false });
  });

  it("only lets admins verify", async () => {
    const bnet = new FakeBattlenet();
    const created = await createGuild(db);
    const knight = await createMember(db, created, "Knight");
    await expect(verifyGuild(db, knight, bnet.client(), AFTER_LAUNCH)).rejects.toThrow();
  });
});

describe("claiming a guild name", () => {
  it("renames the unverified holder and verifies the claimant", async () => {
    const bnet = new FakeBattlenet();
    const holder = await createGuild(db, { name: "Knights of Dawn" });
    const char = guildMaster(bnet, "Knights of Dawn");
    const { guild, gm } = await setup({ name: "Knights of Dawn Temp", characters: [char] });

    const check = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(check.result).toMatchObject({ reason: "name_mismatch", claim: { name: "Knights of Dawn", holderName: "Knights of Dawn", holderVerified: false } });

    const claimed = await claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(claimed).toEqual({ renamedHolder: "Knights of Dawn (unverified)", name: "Knights of Dawn" });
    expect(await row(guild.id)).toMatchObject({ name: "Knights of Dawn", verifiedAt: AFTER_LAUNCH, verifiedCharacterName: char.name });

    const renamed = await row(holder.guild.id);
    expect(renamed.name).toBe("Knights of Dawn (unverified)");
    expect(renamed.slug).toBe(holder.guild.slug);
    expect(renamed.adminNotice).toMatch(/A verified guild claimed the name "Knights of Dawn"/);
    expect(await actions(holder.guild.id)).toContain("guild.name_claimed");
    expect(await actions(guild.id)).toEqual(expect.arrayContaining(["guild.claim_name", "guild.verify"]));
  });

  it("numbers the unverified name when it's taken", async () => {
    const bnet = new FakeBattlenet();
    await createGuild(db, { name: "Lions Pride (unverified)" });
    const holder = await createGuild(db, { name: "Lions Pride" });
    const char = guildMaster(bnet, "Lions Pride");
    const { gm } = await setup({ name: "Lions Pride Placeholder", characters: [char] });
    expect((await claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH)).renamedHolder).toBe("Lions Pride (unverified 2)");
    expect((await row(holder.guild.id)).name).toBe("Lions Pride (unverified 2)");
  });

  it("never takes the name from a verified guild", async () => {
    const bnet = new FakeBattlenet();
    const holder = await createGuild(db, { name: "Sworn Shield" });
    await db.update(guilds).set({ verifiedAt: new Date(), verifiedVia: "battlenet" }).where(eq(guilds.id, holder.guild.id));
    const char = guildMaster(bnet, "Sworn Shield");
    const { guild, gm } = await setup({ name: "Sworn Shield Two", characters: [char] });

    await expect(claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH)).rejects.toThrow(/verified guild's name can't be claimed/);
    expect((await row(holder.guild.id)).name).toBe("Sworn Shield");
    expect(await row(guild.id)).toMatchObject({ name: "Sworn Shield Two", verifiedAt: null });
  });

  it("only renames a holder in the same region", async () => {
    const bnet = new FakeBattlenet();
    const otherRegion = await createGuild(db, { name: "Vale Guard", region: "eu" });
    const char = guildMaster(bnet, "Vale Guard");
    const { guild, gm } = await setup({ name: "Vale Guard Temp", characters: [char] });
    expect((await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH)).result.claim).toMatchObject({ holderName: null });
    expect(await claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH)).toEqual({ renamedHolder: null, name: "Vale Guard" });
    expect((await row(otherRegion.guild.id)).name).toBe("Vale Guard");
    expect((await row(guild.id)).name).toBe("Vale Guard");
  });

  it("refuses a claim when the admin isn't the in-game Guild Master", async () => {
    const bnet = new FakeBattlenet();
    await createGuild(db, { name: "Iron Pact" });
    const officer = guildMaster(bnet, "Iron Pact", { rank: 2 });
    const { gm } = await setup({ name: "Iron Pact Alt", characters: [officer] });
    await expect(claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH)).rejects.toThrow(DomainError);
  });
});

describe("claiming a subdomain", () => {
  it("moves an unverified holder to a subdomain naming what sets it apart", async () => {
    const holder = await createGuild(db, { slug: "oathbound", name: "Oathbound", faction: "horde", ruleset: "pvp", region: "eu" });
    await createGuild(db, { slug: "oathbound-pvp", name: "Someone On Pvp" });
    const { guild, gm } = await setup({ name: "Oathbound" });
    await db.update(guilds).set({ verifiedAt: new Date(), verifiedVia: "battlenet" }).where(eq(guilds.id, guild.id));

    expect(await getSlugClaim(db, await row(guild.id))).toMatchObject({ slug: "oathbound", holderName: "Oathbound", holderMovesTo: "oathbound-horde" });
    const moved = await claimGuildSlug(db, gm, AFTER_LAUNCH);
    expect(moved).toEqual({ slug: "oathbound", previousSlug: guild.slug, movedHolderTo: "oathbound-horde" });
    expect((await row(holder.guild.id)).slug).toBe("oathbound-horde");
    expect((await row(holder.guild.id)).adminNotice).toMatch(/subdomain is now "oathbound-horde"/);
  });

  it("falls back to a numbered subdomain when nothing sets the holder apart", async () => {
    const holder = await createGuild(db, { slug: "morning-star", name: "Somebody Else" });
    const { guild, gm } = await setup({ name: "Morning Star" });
    await db.update(guilds).set({ verifiedAt: new Date(), verifiedVia: "battlenet" }).where(eq(guilds.id, guild.id));

    const moved = await claimGuildSlug(db, gm, AFTER_LAUNCH);
    expect(moved).toEqual({ slug: "morning-star", previousSlug: guild.slug, movedHolderTo: "morning-star-2" });
    expect((await row(guild.id)).slug).toBe("morning-star");
    expect(await row(holder.guild.id)).toMatchObject({ slug: "morning-star-2", name: "Somebody Else" });
    expect((await row(holder.guild.id)).adminNotice).toMatch(/claimed the subdomain "morning-star"/);
    expect(await actions(holder.guild.id)).toContain("guild.slug_claimed");
  });

  it("refuses unverified claimants and verified holders", async () => {
    const holder = await createGuild(db, { slug: "evening-star", name: "Held" });
    const { guild, gm } = await setup({ name: "Evening Star" });
    await expect(claimGuildSlug(db, gm, AFTER_LAUNCH)).rejects.toThrow(/Only verified guilds/);

    await db.update(guilds).set({ verifiedAt: new Date() }).where(eq(guilds.id, guild.id));
    await db.update(guilds).set({ verifiedAt: new Date() }).where(eq(guilds.id, holder.guild.id));
    await expect(claimGuildSlug(db, gm, AFTER_LAUNCH)).rejects.toThrow(/verified guild uses that subdomain/);
  });
});

describe("daily re-check", () => {
  it("keeps the badge for a 7-day grace period, then removes it, auditing each step", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Grace Keepers");
    const { guild, gm } = await setup({ name: "Grace Keepers", characters: [char] });
    await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);

    // Still Guild Master: stays verified.
    let summary = await recheckVerifiedGuilds(db, bnet.client(), new Date(AFTER_LAUNCH.getTime() + DAY));
    expect(summary.verified).toBeGreaterThanOrEqual(1);
    expect((await row(guild.id)).verificationFailingSince).toBeNull();

    // Handed the guild over in game.
    bnet.roster("forever-normal", "Grace Keepers", [[char.id, 1]]);
    const firstFail = new Date(AFTER_LAUNCH.getTime() + 2 * DAY);
    summary = await recheckVerifiedGuilds(db, bnet.client(), firstFail);
    expect(summary.failing).toBeGreaterThanOrEqual(1);
    expect(await row(guild.id)).toMatchObject({ verificationFailingSince: firstFail, verifiedCharacterName: char.name });
    expect((await row(guild.id)).verifiedAt).not.toBeNull();

    // Blizzard down during the grace period: doesn't count either way.
    bnet.down = true;
    await recheckVerifiedGuilds(db, bnet.client(), new Date(firstFail.getTime() + 3 * DAY));
    expect((await row(guild.id)).verificationFailingSince).toEqual(firstFail);
    bnet.down = false;

    await recheckVerifiedGuilds(db, bnet.client(), new Date(firstFail.getTime() + 6 * DAY));
    expect((await row(guild.id)).verifiedAt).not.toBeNull();

    summary = await recheckVerifiedGuilds(db, bnet.client(), new Date(firstFail.getTime() + 7 * DAY));
    expect(summary.lapsed).toBeGreaterThanOrEqual(1);
    expect(await row(guild.id)).toMatchObject({ verifiedAt: null, verifiedCharacterId: null, verificationFailingSince: null });

    const log = await actions(guild.id);
    expect(log.filter((a) => a === "guild.verification.failing")).toHaveLength(1);
    expect(log).toContain("guild.verification.lapse");
  });

  it("clears the grace period when the check passes again", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Second Wind");
    const { guild, gm } = await setup({ name: "Second Wind", characters: [char] });
    await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);

    bnet.roster("forever-normal", "Second Wind", [[char.id, 3]]);
    await recheckVerifiedGuilds(db, bnet.client(), new Date(AFTER_LAUNCH.getTime() + DAY));
    expect((await row(guild.id)).verificationFailingSince).not.toBeNull();

    bnet.roster("forever-normal", "Second Wind", [[char.id, 0]]);
    await recheckVerifiedGuilds(db, bnet.client(), new Date(AFTER_LAUNCH.getTime() + 2 * DAY));
    expect(await row(guild.id)).toMatchObject({ verificationFailingSince: null, verifiedAt: AFTER_LAUNCH });
  });

  it("starts the grace period when the verifying admin leaves the guild", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Wandering Blade");
    const { guild, gm } = await setup({ name: "Wandering Blade", characters: [char] });
    await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);

    await db.update(memberships).set({ status: "former" }).where(and(eq(memberships.guildId, guild.id), eq(memberships.userId, gm.userId)));
    await recheckVerifiedGuilds(db, bnet.client(), new Date(AFTER_LAUNCH.getTime() + DAY));
    expect(await row(guild.id)).toMatchObject({ verificationResult: expect.objectContaining({ reason: "gm_left" }) });
    expect((await row(guild.id)).verificationFailingSince).not.toBeNull();
  });
});

describe("changing a verified guild's identity", () => {
  it("removes the verification", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Steadfast");
    const { guild, gm } = await setup({ name: "Steadfast", characters: [char] });
    await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);

    const settings = { name: "Steadfast", timezone: "America/New_York", region: "us", faction: "alliance", ruleset: "normal", motto: "Hold" };
    expect(await updateGuildSettings(db, gm, settings)).toMatchObject({ unverified: false });
    expect((await row(guild.id)).verifiedAt).not.toBeNull();

    expect(await updateGuildSettings(db, gm, { ...settings, ruleset: "pvp" })).toMatchObject({ unverified: true });
    expect((await row(guild.id)).verifiedAt).toBeNull();
    expect(await actions(guild.id)).toContain("guild.verification.remove");
  });

  it("removes the verification when the region changes", async () => {
    const bnet = new FakeBattlenet();
    const char = guildMaster(bnet, "Far Shore");
    const { guild, gm } = await setup({ name: "Far Shore", characters: [char] });
    await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect((await row(guild.id)).verifiedAt).not.toBeNull();

    const settings = { name: "Far Shore", timezone: "Europe/Berlin", region: "eu", faction: "alliance", ruleset: "normal" };
    expect(await updateGuildSettings(db, gm, settings)).toMatchObject({ unverified: true });
    expect(await row(guild.id)).toMatchObject({ region: "eu", verifiedAt: null, verifiedCharacterId: null });
    expect(await actions(guild.id)).toContain("guild.verification.remove");
  });
});

describe("guilds in other game versions", () => {
  it("says TBC Anniversary verification is coming soon, without calling Battle.net or failing", async () => {
    const bnet = new FakeBattlenet();
    const guild = await createGuild(db, { name: "Mirkwood", faction: "horde", gameVersion: "anniversary", realmSlug: "dreamscythe" });
    const gm = await createMember(db, guild, "Guild Master");
    const { state, result } = await verifyGuild(db, gm, bnet.client(), AFTER_LAUNCH);
    expect(state).toBe("unverified");
    expect(result).toMatchObject({ verified: false, reason: "version_unsupported", conclusive: false });
    expect(result.message).toMatch(/verification for TBC Anniversary guilds is coming soon/);
    expect(bnet.profileRegions).toEqual([]);
    await expect(claimGuildName(db, gm, bnet.client(), AFTER_LAUNCH)).rejects.toThrow(/coming soon/);
  });

  it("never lapses an Anniversary guild in the daily re-check", async () => {
    const bnet = new FakeBattlenet();
    const guild = await createGuild(db, { name: "Kept Seal", faction: "horde", gameVersion: "anniversary", realmSlug: "nightslayer", ruleset: "pvp" });
    await db.update(guilds).set({ verifiedAt: AFTER_LAUNCH, verificationFailingSince: new Date(AFTER_LAUNCH.getTime() - 30 * DAY) }).where(eq(guilds.id, guild.guild.id));
    const summary = await recheckVerifiedGuilds(db, bnet.client(), AFTER_LAUNCH);
    expect(summary.inconclusive).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(guilds).where(eq(guilds.id, guild.guild.id));
    expect(row!.verifiedAt).toEqual(AFTER_LAUNCH);
  });
});
