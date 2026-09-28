import { describe, expect, it } from "vitest";
import { LogBuilder, mobUnit, playerUnit } from "../../../tests/support/combatlog";
import { splitText } from "@/lib/vigil/analyze";
import { computeMetrics, swingStats } from "./metrics";
import { coverage, mergeIntervals } from "./auras";

describe("swingStats", () => {
  it("counts swings lost in long gaps", () => {
    expect(swingStats([0, 2000, 4000, 6000, 12_000, 14_000])).toEqual({ count: 6, medianIntervalMs: 2000, lostSwings: 2 });
    expect(swingStats([0, 2000])).toBeNull();
  });
});

describe("intervals", () => {
  it("merges and measures coverage", () => {
    expect(mergeIntervals([[5, 8], [0, 3], [2, 4]])).toEqual([[0, 4], [5, 8]]);
    expect(coverage([[0, 4], [5, 8]], 2, 6)).toBe(3);
  });
});

describe("computeMetrics", () => {
  const me = playerUnit("Rhune");
  const mob = mobUnit("Defias Pillager", 589, 1);

  it("totals damage, taken damage, GCD activity, idle gaps and per-spell stats", () => {
    const b = new LogBuilder();
    b.cast(0, me, mob, 7386, "Sunder Armor");
    b.cast(1500, me, mob, 6572, "Revenge");
    b.damage(1510, me, mob, 6572, "Revenge", 70, { crit: true });
    b.miss(3000, me, mob, 6572, "Revenge", "DODGE");
    b.swing(2000, me, mob, 50);
    b.swing(4000, mob, me, 30);
    b.cast(9000, me, mob, 7386, "Sunder Armor");
    b.swing(10_000, me, mob, 50);
    const { fights } = splitText(b.text(), me.guid);
    const m = computeMetrics(fights[0]!, me.guid, { gcdMs: 1500 });
    expect(m.damage).toBe(170);
    expect(m.damageTaken).toBe(30);
    expect(m.gcdCasts).toBe(3);
    expect(m.activeMs).toBe(4000);
    expect(m.idleGaps).toEqual([[3000, 9000]]);
    expect(m.spells.find((s) => s.name === "Revenge")).toMatchObject({ casts: 1, hits: 1, crits: 1, misses: 1, damage: 70 });
  });

  it("scales rage reported in tenths and measures time at cap", () => {
    const b = new LogBuilder();
    b.swing(0, me, mob, 50, { power: { type: 1, current: 400, max: 1000 } });
    b.swing(2000, me, mob, 50, { power: { type: 1, current: 1000, max: 1000 } });
    b.swing(4000, me, mob, 50, { power: { type: 1, current: 1000, max: 1000 } });
    b.swing(6000, me, mob, 50, { power: { type: 1, current: 700, max: 1000 } });
    const { fights } = splitText(b.text(), me.guid);
    const m = computeMetrics(fights[0]!, me.guid, { powerType: 1 });
    expect(m.resource).toMatchObject({ max: 100, timeAtCapMs: 4000, gained: 60, spent: 30 });
    expect(m.resource!.samples[0]).toEqual([0, 40]);
  });
});
