import { describe, expect, it } from "vitest";
import { SEED_KILLS } from "@/db/seed";
import { WOWF_LAUNCH_DATE } from "@/lib/game";

const eastern = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "long",
  hour: "numeric",
  hourCycle: "h23",
});

describe("seeded boss kills", () => {
  it.each(SEED_KILLS)("$boss falls on a Tuesday or Thursday raid night, 8 to 11 PM Eastern", ({ killedAt }) => {
    const parts = Object.fromEntries(eastern.formatToParts(killedAt).map((p) => [p.type, p.value]));
    expect(["Tuesday", "Thursday"]).toContain(parts.weekday);
    expect(Number(parts.hour)).toBeGreaterThanOrEqual(20);
    expect(Number(parts.hour)).toBeLessThan(23);
  });

  it("all happen after launch, in order", () => {
    const times = SEED_KILLS.map((k) => k.killedAt.getTime());
    expect(Math.min(...times)).toBeGreaterThan(new Date(`${WOWF_LAUNCH_DATE}T00:00:00-05:00`).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});
