import { describe, expect, it } from "vitest";
import { extractMachineExport, parseVigilSnapshots, snapshotFor, unescapeLuaString } from "@/lib/vigil/saved-variables";

const exportJson = JSON.stringify({
  version: 1,
  addon: "Vigil",
  addonVersion: "0.1.0",
  snapshots: [
    {
      at: 1790550000,
      name: "Rhune",
      realm: "Stormhold",
      class: "WARRIOR",
      level: 12,
      stats: { str: 40, armor: 520 },
      gear: [{ slot: 16, itemId: 2488 }],
      talents: [],
    },
    { at: 1790560000, name: "Rhune", realm: "Stormhold", class: "WARRIOR", level: 13, stats: { str: 44 }, gear: [], talents: [] },
    { at: 1790555000, name: "Tor", class: "PALADIN", level: 8, stats: {}, gear: [], talents: [] },
    { at: "bad", name: "" },
  ],
});

function luaQuoted(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

describe("Vigil SavedVariables parser", () => {
  it("unescapes Lua string contents", () => {
    expect(unescapeLuaString(String.raw`\"hi\"`)).toBe('"hi"');
    expect(unescapeLuaString(String.raw`a\nb\\c`)).toBe("a\nb\\c");
  });

  it("reads snapshots from a SavedVariables file and skips invalid entries", () => {
    const sv = `VigilDB = {\n\t["version"] = 1,\n\t["machineExport"] = "${luaQuoted(exportJson)}",\n}\n`;
    expect(extractMachineExport(sv)).toBe(exportJson);
    const snaps = parseVigilSnapshots(sv);
    expect(snaps.map((s) => `${s.name}:${s.level}`)).toEqual(["Rhune:12", "Tor:8", "Rhune:13"]);
    expect(snaps[0]).toMatchObject({ realm: "Stormhold", stats: { str: 40, armor: 520 }, gear: [{ slot: 16, itemId: 2488 }] });
  });

  it("accepts pasted export JSON", () => {
    expect(parseVigilSnapshots(exportJson)).toHaveLength(3);
  });

  it("returns no snapshots for unrelated text", () => {
    expect(parseVigilSnapshots("SomethingElseDB = {}\n")).toEqual([]);
    expect(parseVigilSnapshots('{"snapshots": 3}')).toEqual([]);
  });

  it("picks the latest snapshot before the fight, else the first after it", () => {
    const snaps = parseVigilSnapshots(exportJson);
    expect(snapshotFor(snaps, "Rhune-Stormhold", 1790565000_000)?.level).toBe(13);
    expect(snapshotFor(snaps, "rhune", 1790552000_000)?.level).toBe(12);
    expect(snapshotFor(snaps, "Rhune", 1790000000_000)?.level).toBe(12);
    expect(snapshotFor(snaps, "Nobody", 1790552000_000)).toBeNull();
  });
});
