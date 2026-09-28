import { describe, expect, it } from "vitest";
import { isForeverCharacter, knownGameVersion, namespaceFamily } from "./wow-versions";

describe("namespaceFamily", () => {
  it.each([
    ["profile-classic1x-us", "classic1x"],
    ["profile-classicann-eu", "classicann"],
    ["profile-classic-us", "classic"],
    ["profile-us", "retail"],
    ["dynamic-classic1x-kr", "classic1x"],
    ["profile-classicforever-us", "other"],
    ["nonsense", "other"],
  ] as const)("%s is %s", (namespace, family) => {
    expect(namespaceFamily(namespace)).toBe(family);
  });
});

describe("knownGameVersion", () => {
  it.each([
    ["profile-classicann-us", "dreamscythe", "anniversary"],
    ["profile-classicann-us", "nightslayer", "anniversary"],
    ["profile-classic1x-us", "whitemane", "era"],
    ["profile-classic1x-us", "skull-rock", "hardcore"],
    ["profile-classic1x-eu", "stitches", "hardcore"],
    ["profile-classic1x-us", "crusader-strike", "seasonal"],
    ["profile-classic-us", "whitemane", "progression"],
    ["profile-us", "area-52", "retail"],
    ["profile-classic1x-us", "some-new-realm", "unknown"],
  ] as const)("%s on %s is %s", (namespace, realm, version) => {
    expect(knownGameVersion(namespace, realm)).toBe(version);
  });
});

describe("isForeverCharacter", () => {
  const forever = { namespace: "profile-classic1x-us", realmSlugs: [] as string[] };

  it("needs the Forever namespace", () => {
    expect(isForeverCharacter({ namespace: "profile-classicann-us", realmSlug: "new-realm" }, forever)).toBe(false);
  });

  it("without an allowlist, rejects known Classic realms and accepts unknown ones", () => {
    expect(isForeverCharacter({ namespace: "profile-classic1x-us", realmSlug: "whitemane" }, forever)).toBe(false);
    expect(isForeverCharacter({ namespace: "profile-classic1x-us", realmSlug: "Skull-Rock" }, forever)).toBe(false);
    expect(isForeverCharacter({ namespace: "profile-classic1x-us", realmSlug: "new-realm" }, forever)).toBe(true);
  });

  it("never accepts retail without an allowlist", () => {
    expect(isForeverCharacter({ namespace: "profile-us", realmSlug: "area-52" }, { namespace: "profile-us", realmSlugs: [] })).toBe(false);
  });

  it("with an allowlist, accepts exactly the listed realms", () => {
    const listed = { namespace: "profile-classicann-us", realmSlugs: ["dreamscythe"] };
    expect(isForeverCharacter({ namespace: "profile-classicann-us", realmSlug: "dreamscythe" }, listed)).toBe(true);
    expect(isForeverCharacter({ namespace: "profile-classicann-us", realmSlug: "nightslayer" }, listed)).toBe(false);
  });
});
