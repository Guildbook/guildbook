import { describe, expect, it } from "vitest";
import { isActivePath } from "./nav";

describe("isActivePath", () => {
  it("matches a section and its children", () => {
    expect(isActivePath("/roster", "/roster", "osm")).toBe(true);
    expect(isActivePath("/roster/abc", "/roster", "osm")).toBe(true);
    expect(isActivePath("/rosters", "/roster", "osm")).toBe(false);
    expect(isActivePath("/charter", "/roster", "osm")).toBe(false);
  });

  it("matches index routes exactly", () => {
    expect(isActivePath("/admin", "/admin", "osm", true)).toBe(true);
    expect(isActivePath("/admin/ranks", "/admin", "osm", true)).toBe(false);
    expect(isActivePath("/admin/ranks", "/admin", "osm")).toBe(true);
  });

  it("keeps admin and public sections with the same name apart", () => {
    expect(isActivePath("/admin/progression", "/progression", "osm")).toBe(false);
    expect(isActivePath("/progression", "/admin/progression", "osm")).toBe(false);
  });

  it("compares multi-guild, single-guild and rewritten paths the same way", () => {
    expect(isActivePath("/osm/roster/abc", "/osm/roster", "osm")).toBe(true);
    expect(isActivePath("/osm/roster", "/roster", "osm")).toBe(true);
    expect(isActivePath("/roster", "/osm/roster", "osm")).toBe(true);
    expect(isActivePath("/osm/admin", "/osm/admin", "osm", true)).toBe(true);
    expect(isActivePath("/osm", "/osm/roster", "osm")).toBe(false);
  });

  it("ignores trailing slashes, queries and hashes", () => {
    expect(isActivePath("/roster/", "/roster?x=1", "osm")).toBe(true);
    expect(isActivePath("/charter", "/charter#ranks", "osm")).toBe(true);
  });
});
