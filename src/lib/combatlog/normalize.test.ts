import { describe, expect, it } from "vitest";
import { LogBuilder, mobUnit, playerUnit } from "../../../tests/support/combatlog";
import { npcIdFromGuid, shortName } from "./guid";
import { normalizeEvent } from "./normalize";
import { LogReader } from "./scan";
import { tokenizeLine } from "./tokenizer";
import type { CombatEvent } from "./types";

const me = playerUnit("Rhune");
const mob = mobUnit("Defias Pillager", 589, 3);

function events(b: LogBuilder): CombatEvent[] {
  const reader = new LogReader(2026);
  return b
    .text()
    .split("\n")
    .map((l) => reader.read(l))
    .filter((e): e is CombatEvent => e !== null);
}

describe("normalizeEvent", () => {
  it("reads units, the advanced block and a v22 damage suffix", () => {
    const b = new LogBuilder();
    b.level = 31;
    b.damage(100, me, mob, 6572, "Revenge", 70, { crit: true, power: { type: 1, current: 450, max: 1000, cost: 50 } });
    const [ev] = events(b);
    expect(ev).toMatchObject({
      type: "SPELL_DAMAGE",
      spellId: 6572,
      spellName: "Revenge",
      amount: 70,
      critical: true,
      src: { guid: me.guid, name: "Rhune-Forever-US", flags: 0x511 },
      dst: { guid: mob.guid, name: "Defias Pillager" },
    });
    expect(ev!.adv).toMatchObject({ guid: me.guid, powerType: [1], power: [450], maxPower: [1000], powerCost: 50, level: 31 });
  });

  it("reads pre-v20 damage without base amount or absorb field", () => {
    const b = new LogBuilder({ version: 19 });
    b.swing(0, me, mob, 55, { blocked: 0, crit: true, power: { type: 1, current: 100, max: 1000 } });
    const [ev] = events(b);
    expect(ev).toMatchObject({ type: "SWING_DAMAGE", amount: 55, critical: true });
    expect(ev!.adv).toMatchObject({ power: [100], maxPower: [1000] });
  });

  it("reads logs without advanced logging", () => {
    const b = new LogBuilder({ advanced: false });
    b.damage(0, me, mob, 7386, "Sunder Armor", 0);
    b.swing(10, mob, me, 40, { blocked: 20 });
    const [a, s] = events(b);
    expect(a!.adv).toBeUndefined();
    expect(a!.amount).toBe(0);
    expect(s).toMatchObject({ amount: 40, blocked: 20 });
  });

  it("reads heals, misses, energize, aura doses and encounters", () => {
    const b = new LogBuilder();
    b.heal(0, me, me, 2061, "Flash Heal", 300, 120);
    b.swingMiss(10, mob, me, "PARRY");
    b.energize(20, me, 2687, "Bloodrage", 10, 1);
    b.aura(30, "APPLIED_DOSE", me, mob, 7386, "Sunder Armor", "DEBUFF", 3);
    b.encounterStart(40, 1144, "Rhahk'Zor");
    b.encounterEnd(50, 1144, "Rhahk'Zor", true, 31_000);
    const [heal, miss, energize, dose, start, end] = events(b);
    expect(heal).toMatchObject({ amount: 300, overheal: 120 });
    expect(miss).toMatchObject({ type: "SWING_MISSED", missType: "PARRY" });
    expect(energize).toMatchObject({ amount: 10, powerType: 1 });
    expect(dose).toMatchObject({ auraType: "DEBUFF", stacks: 3 });
    expect(start!.encounter).toMatchObject({ id: 1144, name: "Rhahk'Zor" });
    expect(end!.encounter).toMatchObject({ success: true, durationMs: 31_000 });
  });

  it("ignores events Vigil does not use and never throws on short lines", () => {
    const header = { version: 22, advanced: true, build: null, projectId: null };
    expect(normalizeEvent(tokenizeLine("9/27/2026 01:00:00.000  ZONE_CHANGE,1429,\"Elwynn Forest\",0")!, { header })).toBeNull();
    expect(normalizeEvent(tokenizeLine("9/27/2026 01:00:00.000  SPELL_DAMAGE,Player-1-A")!, { header })).toMatchObject({
      type: "SPELL_DAMAGE",
      amount: 0,
    });
  });
});

describe("advanced block layouts", () => {
  const PLAYER = `Player-6064-0000A001,"Paladin-Dreamscythe-US",0x511,0x80000000`;
  const STAG = `Creature-0-6259-530-120-17130-00003B1769,"Talbuk Stag",0x10a28,0x80000000`;
  const block = (guid: string, extra: string[], power = ["0", "2974", "3152"], level = "64") =>
    [guid, "0000000000000000", 4290, 5715, 1206, 0, 6385, ...extra, ...power, 0, "-1492.98", "6421.02", 1951, "1.8407", level].join(",");
  const read = (body: string, header: { version: number; build: string }) =>
    normalizeEvent(tokenizeLine(`9/28/2026 19:12:15.745-7  ${body}`)!, { header: { ...header, advanced: true, projectId: 5 } })!;
  const tbc = { version: 9, build: "2.5.6" };

  it("reads the 18-field TBC Anniversary block and its 10-field swing suffix with baseAmount", () => {
    const ev = read(`SWING_DAMAGE,${PLAYER},${STAG},${block("Player-6064-0000A001", ["0", "0"], undefined, "87")},645,518,-1,1,0,0,0,1,nil,nil`, tbc);
    expect(ev).toMatchObject({ amount: 645, overkill: 0, critical: true, resisted: 0 });
    expect(ev.adv).toMatchObject({ hp: 4290, maxHp: 5715, powerType: [0], power: [2974], maxPower: [3152], x: -1492.98, y: 6421.02 });
    // 87 is the player's item level: over the 2.5.x cap of 70, so not reported as a level.
    expect(ev.adv!.level).toBeUndefined();
  });

  it("keeps NPC levels and reads a spell suffix with a trailing damage-type field", () => {
    const ev = read(`SPELL_DAMAGE,${PLAYER},${STAG},35395,"Crusader Strike",0x1,${block(STAG.split(",")[0]!, ["0", "0"], ["-1", "0", "0"])},780,626,-1,1,0,0,0,1,nil,nil,ST`, tbc);
    expect(ev).toMatchObject({ spellName: "Crusader Strike", amount: 780, overkill: 0, critical: true });
    expect(ev.adv).toMatchObject({ level: 64, powerType: [-1] });
  });

  it.each([
    { fields: 16, version: 19 },
    { fields: 17, version: 9 },
    { fields: 17, version: 22 },
    { fields: 19, version: 9 },
    { fields: 20, version: 22 },
  ])("detects a $fields-field block in a version $version log", ({ fields, version }) => {
    const extra = Array<string>(fields - 16).fill("0");
    const ev = read(`SPELL_HEAL,${PLAYER},${PLAYER},19750,"Flash of Light",0x2,${block("Player-6064-0000A001", extra, undefined, "60")},365,365,20,0,nil`, {
      version,
      build: "1.15.7",
    });
    expect(ev).toMatchObject({ amount: 365, overheal: 20, critical: false });
    expect(ev.adv).toMatchObject({ power: [2974], maxPower: [3152], x: -1492.98, level: 60 });
  });

  it("reads multi-power lists split by colons or pipes", () => {
    for (const sep of [":", "|"]) {
      const power = [`0${sep}3`, `2974${sep}100`, `3152${sep}100`];
      const ev = read(`SPELL_CAST_SUCCESS,${PLAYER},${STAG},35395,"Crusader Strike",0x1,${block("Player-6064-0000A001", ["0"], power, "70")}`, tbc);
      expect(ev.adv).toMatchObject({ powerType: [0, 3], power: [2974, 100], maxPower: [3152, 100], level: 70 });
    }
  });
});

describe("guid helpers", () => {
  it("reads NPC ids and short names", () => {
    expect(npcIdFromGuid(mob.guid)).toBe(589);
    expect(npcIdFromGuid(me.guid)).toBeNull();
    expect(shortName("Tor-Forever-US")).toBe("Tor");
    expect(shortName(undefined)).toBe("Unknown");
  });
});
