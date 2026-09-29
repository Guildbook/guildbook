import { describe, expect, it } from "vitest";
import { distinguishingSlugs, numberedSlugs, withSlugSuffix } from "@/lib/slug-suggestions";

describe("distinguishingSlugs", () => {
  const holder = { region: "us", faction: "alliance", ruleset: "normal" } as const;

  it("names only what differs from the holder, ruleset then faction then region", () => {
    expect(distinguishingSlugs("oathbound", { region: "eu", faction: "horde", ruleset: "pvp" }, holder)).toEqual([
      "oathbound-pvp",
      "oathbound-horde",
      "oathbound-eu",
    ]);
    expect(distinguishingSlugs("oathbound", { ...holder, ruleset: "hardcore" }, holder)).toEqual(["oathbound-hc"]);
    expect(distinguishingSlugs("oathbound", { ...holder, ruleset: "rp" }, holder)).toEqual(["oathbound-rp"]);
    expect(distinguishingSlugs("oathbound", { region: "us", faction: "horde", ruleset: "pvp" }, { ...holder, ruleset: "pvp" })).toEqual([
      "oathbound-horde",
    ]);
    expect(distinguishingSlugs("oathbound", { ...holder, faction: "alliance" }, { ...holder, faction: "horde" })).toEqual(["oathbound-alliance"]);
    expect(distinguishingSlugs("oathbound", { ...holder, region: "us" }, { ...holder, region: "eu" })).toEqual(["oathbound-us"]);
  });

  it("names the realm first for a guild on a realm, then ruleset, faction and region", () => {
    const forever = { gameVersion: "forever", realmSlug: null, region: "us", faction: "horde", ruleset: "normal" } as const;
    const anniversary = { gameVersion: "anniversary", realmSlug: "dreamscythe", region: "us", faction: "horde", ruleset: "normal" } as const;
    expect(distinguishingSlugs("mirkwood", anniversary, forever)).toEqual(["mirkwood-dreamscythe"]);
    expect(distinguishingSlugs("mirkwood", { ...anniversary, realmSlug: "nightslayer", ruleset: "pvp" }, anniversary)).toEqual([
      "mirkwood-nightslayer",
      "mirkwood-pvp",
    ]);
    expect(distinguishingSlugs("mirkwood", { ...anniversary, faction: "alliance" }, anniversary)).toEqual(["mirkwood-alliance"]);
  });

  it("names the game version for a guild without a realm when the holder is in another version", () => {
    const forever = { gameVersion: "forever", realmSlug: null, region: "us", faction: "horde", ruleset: "normal" } as const;
    const anniversary = { gameVersion: "anniversary", realmSlug: "dreamscythe", region: "us", faction: "horde", ruleset: "normal" } as const;
    expect(distinguishingSlugs("mirkwood", forever, anniversary)).toEqual(["mirkwood-forever"]);
  });

  it("offers nothing for an identical identity or values not chosen yet", () => {
    expect(distinguishingSlugs("oathbound", holder, holder)).toEqual([]);
    expect(distinguishingSlugs("oathbound", {}, holder)).toEqual([]);
  });

  it("keeps suggestions within the subdomain length limit", () => {
    const base = "a".repeat(30);
    const [slug] = distinguishingSlugs(base, { ruleset: "pvp" }, holder);
    expect(slug).toHaveLength(30);
    expect(slug).toMatch(/-pvp$/);
    expect(withSlugSuffix("abc-", "eu")).toBe("abc-eu");
  });

  it("numbers fallbacks from 2", () => {
    const gen = numberedSlugs("oathbound");
    expect([gen.next().value, gen.next().value]).toEqual(["oathbound-2", "oathbound-3"]);
  });
});
