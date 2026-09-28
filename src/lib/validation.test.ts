import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bossKillInput, guildSettingsInput } from "@/lib/validation";

const base = { name: "Order", timezone: "America/New_York" };

describe("guild settings Discord invite", () => {
  it.each(["https://discord.gg/abc123", "https://discord.com/invite/abc123", "https://www.discord.com/invite/abc"])(
    "accepts %s",
    (url) => {
      expect(guildSettingsInput.parse({ ...base, discordInviteUrl: url }).discordInviteUrl).toBe(url);
    },
  );

  it("treats an empty value as no invite", () => {
    expect(guildSettingsInput.parse({ ...base, discordInviteUrl: "" }).discordInviteUrl).toBeNull();
  });

  it.each(["http://discord.gg/abc", "https://discord.com/channels/1/2", "https://evil.example/discord.gg"])(
    "rejects %s",
    (url) => {
      expect(guildSettingsInput.safeParse({ ...base, discordInviteUrl: url }).success).toBe(false);
    },
  );
});

describe("boss kill date", () => {
  const kill = (killedOn: string) => bossKillInput.safeParse({ bossId: crypto.randomUUID(), killedOn });
  const message = (killedOn: string) => kill(killedOn).error?.issues[0]?.message;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15T03:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each(["2026-11-04", "2027-01-14"])("accepts %s", (killedOn) => {
    expect(kill(killedOn).success).toBe(true);
  });

  it("accepts today's date in the furthest-ahead time zone", () => {
    expect(kill("2027-01-15").success).toBe(true);
  });

  it.each(["2026-11-03", "2004-11-23"])("rejects %s as before launch", (killedOn) => {
    expect(message(killedOn)).toBe("Kills can't be dated before World of Warcraft: Forever launched on Nov 4, 2026");
  });

  it("rejects a date in the future", () => {
    expect(message("2027-01-16")).toBe("Kills can't be dated in the future");
  });
});
