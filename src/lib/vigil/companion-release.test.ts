import { describe, expect, it } from "vitest";
import { detectPlatform, formatBytes, type GitHubRelease, parseSigning, pickCompanionRelease, primaryAsset } from "./companion-release";

const asset = (name: string, size = 1000) => ({ name, size, browser_download_url: `https://github.com/Guildbook/vigil/releases/download/x/${name}` });

const release = (overrides: Partial<GitHubRelease>): GitHubRelease => ({
  tag_name: "v0.2.0",
  name: "Vigil 0.2.0",
  body: "Faster callouts.\n\n<!-- vigil-signing: mac=signed windows=unsigned -->",
  html_url: "https://github.com/Guildbook/vigil/releases/tag/v0.2.0",
  draft: false,
  prerelease: false,
  published_at: "2026-09-20T12:00:00Z",
  assets: [
    asset("latest-mac.yml"),
    asset("Vigil-0.2.0-win-x64.exe"),
    asset("Vigil-0.2.0-mac-universal.zip"),
    asset("Vigil-0.2.0-linux-x86_64.AppImage"),
    asset("Vigil-0.2.0-mac-universal.dmg"),
    asset("Vigil-0.2.0-mac-universal.dmg.blockmap"),
  ],
  ...overrides,
});

describe("pickCompanionRelease", () => {
  it("takes the newest published v<version> release and skips drafts, prereleases and other tags", () => {
    const picked = pickCompanionRelease([
      release({ tag_name: "nightly", assets: [] }),
      release({ tag_name: "v0.3.0", draft: true }),
      release({ tag_name: "v0.3.0-beta.1", prerelease: true }),
      release({}),
      release({ tag_name: "v0.1.0" }),
    ]);
    expect(picked).toMatchObject({ version: "0.2.0", tag: "v0.2.0", notes: "Faster callouts.", signed: { mac: true, windows: false } });
    expect(pickCompanionRelease([release({ tag_name: "vigil-v1.0.0" }), release({ tag_name: "v1" })])).toBeNull();
    expect(pickCompanionRelease([release({ tag_name: "v1.0.0-rc.1" })])?.version).toBe("1.0.0-rc.1");
  });

  it("orders assets by platform with the installer first, and update files last", () => {
    const picked = pickCompanionRelease([release({})])!;
    expect(picked.assets.map((a) => a.name)).toEqual([
      "Vigil-0.2.0-mac-universal.dmg",
      "Vigil-0.2.0-mac-universal.zip",
      "Vigil-0.2.0-win-x64.exe",
      "Vigil-0.2.0-linux-x86_64.AppImage",
      "latest-mac.yml",
      "Vigil-0.2.0-mac-universal.dmg.blockmap",
    ]);
    expect(primaryAsset(picked, "mac")?.name).toBe("Vigil-0.2.0-mac-universal.dmg");
    expect(primaryAsset(picked, "windows")?.name).toBe("Vigil-0.2.0-win-x64.exe");
    expect(primaryAsset(picked, "linux")?.name).toBe("Vigil-0.2.0-linux-x86_64.AppImage");
  });
});

describe("parseSigning", () => {
  it("treats a missing marker or platform as unsigned", () => {
    expect(parseSigning(null)).toEqual({ mac: false, windows: false });
    expect(parseSigning("<!-- vigil-signing: windows=signed -->")).toEqual({ mac: false, windows: true });
    expect(parseSigning("<!--vigil-signing: mac=SIGNED windows=signed-->")).toEqual({ mac: true, windows: true });
  });
});

describe("detectPlatform", () => {
  it("reads Client Hints first, then the user agent", () => {
    expect(detectPlatform(null, '"macOS"')).toBe("mac");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", '"Windows"')).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)", '"Linux"')).toBe("linux");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")).toBe("mac");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0")).toBe("linux");
  });

  it("offers nothing to phones, tablets and Chromebooks", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile")).toBeNull();
    expect(detectPlatform("Mozilla/5.0 (X11; CrOS x86_64 15000.0.0)")).toBeNull();
    expect(detectPlatform(null, '"Android"')).toBeNull();
    expect(detectPlatform(null)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("rounds to a readable unit", () => {
    expect(formatBytes(515)).toBe("515 B");
    expect(formatBytes(197_567)).toBe("193 KB");
    expect(formatBytes(188_855_879)).toBe("180.1 MB");
  });
});
