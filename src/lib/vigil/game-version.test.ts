import { describe, expect, it } from "vitest";
import { detectGameVersion, flavorFromPath, reportGameVersion } from "./game-version";

describe("detectGameVersion", () => {
  it("reads TBC Anniversary from the header alone", () => {
    expect(detectGameVersion({ projectId: 5, build: "2.5.6" })).toEqual({ version: "anniversary", source: "header" });
    expect(detectGameVersion({ projectId: null, build: "2.5.5" })).toEqual({ version: "anniversary", source: "header" });
    expect(detectGameVersion({ projectId: 5, build: null, flavor: "_classic_era_" }).version).toBe("anniversary");
  });

  it("reads WoW: Forever from its project id (18) or its 1.60 build", () => {
    expect(detectGameVersion({ projectId: 18, build: "1.60.1" })).toEqual({ version: "forever", source: "header" });
    expect(detectGameVersion({ projectId: null, build: "1.60.1" })).toEqual({ version: "forever", source: "header" });
    expect(detectGameVersion({ projectId: 18, build: "1.60.1", flavor: "_classic_era_" }).version).toBe("forever");
    expect(detectGameVersion({ projectId: 2, build: "1.60.1" }).version).toBeNull();
    expect(detectGameVersion({ projectId: 2, build: "1.15.7", flavor: "_classic_era_" }).version).toBe("era");
  });

  it("needs the install folder to tell a 1.15 Forever beta from Classic Era", () => {
    expect(detectGameVersion({ projectId: 2, build: "1.15.7" })).toEqual({ version: null, source: null });
    expect(detectGameVersion({ projectId: 2, build: "1.15.7", flavor: "_classic_era_" })).toEqual({ version: "era", source: "folder" });
    expect(detectGameVersion({ projectId: 2, build: "1.15.8", flavor: "_classic_beta_" })).toEqual({ version: "forever", source: "folder" });
    expect(detectGameVersion({ projectId: 7, build: "1.16.0", flavor: "_classic_forever_" }).version).toBe("forever");
  });

  it("uses the folder for logs without a header", () => {
    expect(detectGameVersion({ flavor: "_anniversary_" })).toEqual({ version: "anniversary", source: "folder" });
    expect(detectGameVersion({ flavor: "_classic_era_" }).version).toBe("era");
    expect(detectGameVersion({})).toEqual({ version: null, source: null });
  });

  it("does not trust a folder that contradicts the build", () => {
    expect(detectGameVersion({ build: "1.15.7", flavor: "_anniversary_" }).version).toBeNull();
    expect(detectGameVersion({ projectId: 2, build: "1.15.7", flavor: "_classic_" }).version).toBeNull();
  });

  it("leaves retail and later Classic branches unknown", () => {
    expect(detectGameVersion({ projectId: 1, build: "12.1.5", flavor: "_retail_" }).version).toBeNull();
    expect(detectGameVersion({ projectId: 19, build: "5.5.1", flavor: "_classic_" }).version).toBeNull();
    expect(detectGameVersion({ build: "3.4.3", flavor: "_classic_era_" }).version).toBeNull();
  });
});

describe("flavorFromPath", () => {
  it("finds the flavor folder on macOS and Windows paths", () => {
    expect(flavorFromPath("/Applications/World of Warcraft/_anniversary_/Logs/WoWCombatLog-092826_191215.txt")).toBe("_anniversary_");
    expect(flavorFromPath("C:\\Program Files (x86)\\World of Warcraft\\_classic_era_\\Logs\\WoWCombatLog.txt")).toBe("_classic_era_");
    expect(flavorFromPath("/tmp/WoWCombatLog.txt")).toBeNull();
    expect(flavorFromPath(null)).toBeNull();
  });
});

describe("reportGameVersion", () => {
  it("prefers the stated version and derives one for older reports", () => {
    expect(reportGameVersion({ gameVersion: "forever", log: { build: "2.5.6", projectId: 5 } })).toBe("forever");
    expect(reportGameVersion({ log: { build: "2.5.6", projectId: 5 } })).toBe("anniversary");
    expect(reportGameVersion({ log: { build: "1.15.7", projectId: 2, flavor: "_classic_era_" } })).toBe("era");
    expect(reportGameVersion({ log: { build: "1.60.1", projectId: 18 } })).toBe("forever");
    expect(reportGameVersion({ log: { build: null, projectId: null } })).toBeNull();
  });
});
