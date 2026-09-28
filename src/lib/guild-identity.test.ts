import { describe, expect, it } from "vitest";
import { cleanGuildName, describeIdentity, sameGuildName, unverifiedName } from "@/lib/guild-identity";
import { createGuildInput } from "@/lib/validation";
import { parseRealmType } from "@/server/blizzard/client";

describe("guild names", () => {
  it("cleans whitespace and typographic apostrophes", () => {
    expect(cleanGuildName("  Knights \u2019 of   Dawn ")).toBe("Knights ' of Dawn");
    expect(cleanGuildName("Ｏｒｄｅｒ")).toBe("Order");
  });

  it("compares case-insensitively after cleaning", () => {
    expect(sameGuildName("The Silver Hand", "the  silver HAND")).toBe(true);
    expect(sameGuildName("Kel\u2019Thuzad Fans", "kel'thuzad fans")).toBe(true);
    expect(sameGuildName("Silver Hand", "Silver Hands")).toBe(false);
  });

  it("names unverified guilds that lost their name", () => {
    expect(unverifiedName("Dawn", 1)).toBe("Dawn (unverified)");
    expect(unverifiedName("Dawn", 3)).toBe("Dawn (unverified 3)");
  });

  it("describes an identity", () => {
    expect(describeIdentity({ region: "eu", faction: "horde", ruleset: "rp" })).toBe("Europe, Horde, Roleplaying");
  });
});

describe("guild creation input", () => {
  const base = { name: "Dawn", slug: "dawn", timezone: "America/New_York", region: "us" };

  it("requires a supported region", () => {
    const { region: _region, ...noRegion } = base;
    expect(createGuildInput.safeParse({ ...noRegion, faction: "horde", ruleset: "normal" }).success).toBe(false);
    expect(createGuildInput.safeParse({ ...base, region: "kr", faction: "horde", ruleset: "normal" }).success).toBe(false);
    expect(createGuildInput.parse({ ...base, region: "eu", faction: "horde", ruleset: "normal" }).region).toBe("eu");
  });

  it("requires one faction and a ruleset", () => {
    expect(createGuildInput.safeParse({ ...base, ruleset: "normal" }).success).toBe(false);
    expect(createGuildInput.safeParse({ ...base, faction: "both", ruleset: "normal" }).success).toBe(false);
    expect(createGuildInput.safeParse({ ...base, faction: "horde" }).success).toBe(false);
    expect(createGuildInput.parse({ ...base, name: " Dawn  Watch ", faction: "horde", ruleset: "pvp" })).toMatchObject({
      name: "Dawn Watch",
      faction: "horde",
      ruleset: "pvp",
    });
  });
});

describe("realm type to ruleset", () => {
  it.each([
    [{ type: { type: "NORMAL" } }, "normal"],
    [{ type: { type: "PVP" } }, "pvp"],
    [{ type: { type: "RP" } }, "rp"],
    [{ type: { type: "NORMAL" }, category: "Hardcore" }, "hardcore"],
    [{ type: { type: "RPPVP" } }, null],
    [{}, null],
  ])("maps %j to %s", (json, ruleset) => {
    expect(parseRealmType(json).ruleset).toBe(ruleset);
  });
});
