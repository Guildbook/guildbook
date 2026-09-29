import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { splitLines } from "@/lib/combatlog/lines";
import { LogReader } from "@/lib/combatlog/scan";
import type { CombatEvent } from "@/lib/combatlog/types";
import { analyzeText, scanText } from "@/lib/vigil/analyze";
import { LiveSession } from "@/lib/vigil/live";
import { fightReportSchema } from "@/lib/vigil/report";

/**
 * Trimmed from a TBC Anniversary (2.5.6) log with names anonymised: a level 65 Retribution Paladin and a Hunter
 * with a pet in Nagrand. The client writes COMBAT_LOG_VERSION 9 with an 18-field advanced block.
 */
const text = readFileSync(join(__dirname, "../fixtures/logs/tbc-anniversary-2.5.6.txt"), "utf8");
const PALADIN = "Player-6064-0000A001";

function events(): CombatEvent[] {
  const reader = new LogReader(2026);
  return [...splitLines(text)]
    .map((l) => reader.read(l))
    .filter((e): e is CombatEvent => e !== null);
}

describe("TBC Anniversary 2.5.6 combat log", () => {
  it("reads the header and finds the recording player", () => {
    const scan = scanText(text);
    expect(scan.header).toMatchObject({ version: 9, advanced: true, build: "2.5.6", projectId: 5 });
    expect(scan.unparsed).toBe(0);
    const me = scan.players.find((p) => p.isLogger)!;
    expect(me).toMatchObject({ guid: PALADIN, name: "Paladin" });
    // The level column holds item level (87) for players on this client, so no level is claimed.
    expect(me.level).toBeNull();
  });

  it("reads every damage and heal suffix after the advanced block", () => {
    const all = events();
    const first = (type: string, src: string) => all.find((e) => e.type === type && e.src?.name.startsWith(src))!;
    expect(first("SWING_DAMAGE", "Paladin")).toMatchObject({ amount: 645, overkill: 0, critical: true });
    expect(first("SPELL_DAMAGE", "Paladin")).toMatchObject({ spellName: "Crusader Strike", amount: 780, critical: true });
    expect(first("RANGE_DAMAGE", "Hunter")).toMatchObject({ spellName: "Auto Shot", amount: 280, critical: false });
    expect(first("SPELL_PERIODIC_DAMAGE", "Talbuk Stag")).toMatchObject({ spellName: "Gore", amount: 63 });
    expect(first("SPELL_PERIODIC_HEAL", "Hunter")).toMatchObject({ spellName: "Mend Pet", amount: 365, overheal: 0 });

    const stag = all.find((e) => e.adv?.guid.includes("-17130-"))!;
    expect(stag.adv).toMatchObject({ level: 64, x: expect.any(Number), y: expect.any(Number) });
    const me = all.find((e) => e.adv?.guid === PALADIN)!;
    expect(me.adv).toMatchObject({ powerType: [0], maxPower: [3152] });

    for (const e of all.filter((x) => x.type.endsWith("_DAMAGE") && x.src?.guid === PALADIN)) {
      expect(e.amount).toBeGreaterThan(20);
      expect(e.amount).toBeLessThan(3000);
    }
  });

  it("builds sane reports that pass the upload schema", () => {
    const reports = analyzeText(text, PALADIN, null, "Paladin");
    expect(reports.map((r) => r.fight.label)).toEqual(["Talbuk Stag +2", "Clefthoof"]);
    const [stags, clefthoof] = reports;
    expect(stags!.fight.durationMs).toBeGreaterThan(45_000);
    expect(stags!.totals.damage).toBe(9138);
    expect(stags!.totals.dps).toBeGreaterThan(150);
    expect(stags!.totals.dps).toBeLessThan(250);
    expect(clefthoof!.totals.damage).toBe(1130);
    for (const r of reports) {
      expect(r.player.level).toBeNull();
      expect(() => fightReportSchema.parse(r)).not.toThrow();
    }
  });

  it("gives the same reports when tailed live", () => {
    const live = new LiveSession({ fallbackYear: 2026 });
    for (const line of splitLines(text)) live.pushLine(line);
    live.finish();
    const reports = live.drainCompleted().map((c) => c.report);
    expect(live.player).toMatchObject({ guid: PALADIN, level: null });
    expect(reports.map((r) => r.totals.damage)).toEqual([9138, 1130]);
    for (const r of reports) expect(() => fightReportSchema.parse(r)).not.toThrow();
  });
});
