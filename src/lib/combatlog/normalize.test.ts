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

describe("guid helpers", () => {
  it("reads NPC ids and short names", () => {
    expect(npcIdFromGuid(mob.guid)).toBe(589);
    expect(npcIdFromGuid(me.guid)).toBeNull();
    expect(shortName("Tor-Forever-US")).toBe("Tor");
    expect(shortName(undefined)).toBe("Unknown");
  });
});
