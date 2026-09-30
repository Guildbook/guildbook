import { describe, expect, it } from "vitest";
import type { BattlenetScan } from "@/db/schema";
import { emptySnapshotMessage, type EmptySnapshotInput, refreshSummary } from "./battlenet-empty-state";

describe("refreshSummary", () => {
  it("counts only the characters this guild accepts, in its game version", () => {
    expect(refreshSummary(0)).toBe("Characters refreshed: no WoW: Forever characters can join this guild.");
    expect(refreshSummary(1)).toBe("Found 1 WoW: Forever character for this guild.");
    expect(refreshSummary(5, "anniversary")).toBe("Found 5 TBC Anniversary characters for this guild.");
  });
});

const beforeLaunch = new Date("2026-09-28T17:18:00Z");
const afterLaunch = new Date("2026-11-10T12:00:00Z");

const namespaces: BattlenetScan["namespaces"] = [
  { namespace: "profile-classic1x-us", status: "empty", httpStatus: 404, characters: 0 },
  { namespace: "profile-classicann-us", status: "ok", httpStatus: 200, characters: 3 },
  { namespace: "profile-classic-us", status: "empty", httpStatus: 404, characters: 0 },
  { namespace: "profile-us", status: "empty", httpStatus: 404, characters: 0 },
];

const anniversaryScan: BattlenetScan = {
  foreverNamespace: "profile-classic1x-us",
  namespaces,
  excluded: [
    {
      version: "anniversary",
      faction: "alliance",
      count: 2,
      examples: [
        { name: "Elowen", realmName: "Dreamscythe" },
        { name: "Tamsin", realmName: "Dreamscythe" },
      ],
    },
    { version: "anniversary", faction: "horde", count: 1, examples: [{ name: "Gorza", realmName: "Nightslayer" }] },
  ],
};

const base: EmptySnapshotInput = {
  battletag: "Pilgrim#1234",
  status: "empty",
  scan: anniversaryScan,
  foreverCharacters: [],
  guildFaction: "alliance",
  now: beforeLaunch,
};

describe("emptySnapshotMessage", () => {
  it("says what was found per game and faction, and why it was left out", () => {
    expect(emptySnapshotMessage(base)).toBe(
      "We found no WoW: Forever characters on Pilgrim#1234. We did find 2 Alliance characters in TBC Anniversary " +
        "(Elowen on Dreamscythe, Tamsin on Dreamscythe) and 1 Horde character in TBC Anniversary (Gorza on Nightslayer), " +
        "but only WoW: Forever characters can join this guild. World of Warcraft: Forever launches on Nov 4, 2026. " +
        "Once you've made your character there, refresh your characters or reconnect.",
    );
  });

  it("asks a link read before Anniversary imports to refresh, on an Anniversary guild", () => {
    const text = emptySnapshotMessage({ ...base, version: "anniversary", guildRegion: "us" });
    expect(text).toContain("were read before Guildbook could import TBC Anniversary characters");
    expect(text).toContain("refresh your characters (or reconnect Battle.net) to import them");
    expect(text).not.toContain("Nov 4");
  });

  it("names the guild's version when its characters are elsewhere", () => {
    const text = emptySnapshotMessage({
      ...base,
      version: "anniversary",
      guildRegion: "eu",
      foreverCharacters: [{ faction: "horde", region: "us" }],
    });
    expect(text).toBe(
      "Your TBC Anniversary characters on Pilgrim#1234 are in the Americas, but this guild is in the Europe region. Regions are separate worlds, so only Europe characters can join it.",
    );
  });

  it("counts characters beyond the examples", () => {
    const scan: BattlenetScan = {
      ...anniversaryScan,
      excluded: [{ version: "era", faction: "alliance", count: 7, examples: [{ name: "A", realmName: "Whitemane" }] }],
    };
    expect(emptySnapshotMessage({ ...base, scan })).toContain("7 Alliance characters in Classic Era (A on Whitemane, and 6 more)");
  });

  it("says nothing was listed when every game was empty, and flags incomplete reads", () => {
    const empty: BattlenetScan = { ...anniversaryScan, excluded: [] };
    expect(emptySnapshotMessage({ ...base, scan: empty })).toMatch(/^Battle.net listed no World of Warcraft characters on Pilgrim#1234\. World/);
    const partial: BattlenetScan = {
      ...empty,
      namespaces: [...namespaces.slice(0, 3), { namespace: "profile-us", status: "error", httpStatus: 503, characters: 0 }],
    };
    expect(emptySnapshotMessage({ ...base, scan: partial })).toContain("didn't answer for every game");
  });

  it("explains a faction mismatch among Forever characters", () => {
    expect(emptySnapshotMessage({ ...base, foreverCharacters: [{ faction: "horde" }] })).toBe(
      "Your WoW: Forever characters on Pilgrim#1234 are Horde; this guild only accepts Alliance characters.",
    );
    expect(emptySnapshotMessage({ ...base, foreverCharacters: [{ faction: "alliance" }] })).toMatch(/realms/);
  });

  it("mentions the guild's region, and explains Forever characters in the other region", () => {
    expect(emptySnapshotMessage({ ...base, guildRegion: "us" })).toMatch(/^We found no WoW: Forever characters in the Americas region on Pilgrim#1234\./);
    expect(emptySnapshotMessage({ ...base, guildRegion: "us", foreverCharacters: [{ faction: "alliance", region: "eu" }] })).toBe(
      "Your WoW: Forever characters on Pilgrim#1234 are in Europe, but this guild is in the Americas region. " +
        "Regions are separate worlds, so only Americas characters can join it.",
    );
    // Characters from snapshots taken before regions are US.
    expect(emptySnapshotMessage({ ...base, guildRegion: "eu", foreverCharacters: [{ faction: "alliance" }] })).toMatch(/are in the Americas, but this guild is in the Europe region/);
    const euDown: BattlenetScan = {
      ...anniversaryScan,
      namespaces: [...namespaces.map((n) => ({ ...n, region: "us" as const })), { namespace: "profile-classic1x-eu", region: "eu", status: "error", httpStatus: 503, characters: 0 }],
    };
    expect(emptySnapshotMessage({ ...base, guildRegion: "eu", scan: euDown })).toContain("didn't answer for every game in Europe");
  });

  it("asks older links, which have no scan, to refresh", () => {
    expect(emptySnapshotMessage({ ...base, scan: null })).toMatch(/Refresh your characters or reconnect/);
  });

  it("keeps the refused and failed messages", () => {
    expect(emptySnapshotMessage({ ...base, status: "forbidden" })).toMatch(/didn't share your character list/);
    expect(emptySnapshotMessage({ ...base, status: "error" })).toMatch(/didn't respond/);
  });

  it("drops the launch-date note after launch", () => {
    const text = emptySnapshotMessage({ ...base, now: afterLaunch });
    expect(text).not.toContain("launches on");
    expect(text).toContain("can take a while to list it");
  });
});
