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
