import { describe, expect, it } from "vitest";
import { LogBuilder, mobUnit, PALADIN, paladinLog, playerUnit, WARRIOR, warriorLog } from "../../../tests/support/combatlog";
import { scanText, splitText } from "@/lib/vigil/analyze";
import { FightSplitter } from "./fights";
import { LineSplitter, splitLines } from "./lines";
import { LogReader } from "./scan";

describe("PlayerScanner", () => {
  it("finds the player who recorded the log first, with their spells and level", () => {
    const scan = scanText(paladinLog());
    expect(scan.header.version).toBe(22);
    expect(scan.unparsed).toBe(0);
    expect(scan.players[0]).toMatchObject({ guid: PALADIN.guid, name: "Tor", isLogger: true, level: 8 });
    expect(scan.players[0]!.spells).toEqual(["Holy Strike", "Judgement", "Seal of Righteousness"]);
  });
});

describe("FightSplitter", () => {
  it("splits trash on idle gaps and labels fights by mob", () => {
    const { fights } = splitText(paladinLog(), PALADIN.guid);
    expect(fights.map((f) => [f.kind, f.label])).toEqual([
      ["trash", "Rockhide Boar"],
      ["trash", "Young Wolf"],
    ]);
    expect(fights[0]!.targets[0]).toMatchObject({ npcId: 708, died: true });
    expect(fights[0]!.initialAuras).toHaveProperty("seal of righteousness");
  });

  it("uses ENCOUNTER_START and ENCOUNTER_END for bosses", () => {
    const { fights } = splitText(warriorLog(), WARRIOR.guid);
    expect(fights.map((f) => [f.kind, f.label])).toEqual([
      ["trash", "Defias Pillager"],
      ["boss", "Rhahk'Zor"],
    ]);
    const boss = fights[1]!;
    expect(boss.encounter).toMatchObject({ id: 1144, success: true });
    expect(boss.endT - boss.startT).toBe(31_000);
  });

  it("labels multi-mob pulls and drops fights where the player did nothing", () => {
    const me = playerUnit("Tor");
    const a = mobUnit("Kobold Vermin", 6, 1);
    const c = mobUnit("Kobold Worker", 257, 2);
    const b = new LogBuilder();
    for (let t = 0; t < 8000; t += 2000) {
      b.swing(t, me, a, 20);
      b.swing(t + 500, me, c, 10);
    }
    b.swing(30_000, a, me, 5);
    const { fights } = splitText(b.text(), me.guid);
    expect(fights).toHaveLength(1);
    expect(fights[0]!.label).toBe("Kobold Vermin +1");
  });

  it("honours a custom idle gap", () => {
    const { fights } = splitText(paladinLog(), PALADIN.guid, { idleGapMs: 60_000 });
    expect(fights).toHaveLength(1);
  });

  it("works incrementally: peek at the open fight, close it on a quiet tick, drain what finished", () => {
    const reader = new LogReader(2026);
    const splitter = new FightSplitter(PALADIN.guid, { keepFinished: false });
    const events = [...splitLines(paladinLog())].map((l) => reader.read(l)).filter((e) => e !== null);
    const firstPullEnd = events.findIndex((e) => e.type === "UNIT_DIED");
    for (const ev of events.slice(0, firstPullEnd + 1)) splitter.push(ev);

    const died = events[firstPullEnd]!;
    const open = splitter.peek(died.t + 1000);
    expect(open).toMatchObject({ label: "Rockhide Boar", kind: "trash", endT: died.t + 1000 });
    expect(splitter.drain()).toEqual([]);

    expect(splitter.tick(died.t + 3000)).toBe(false);
    expect(splitter.tick(died.t + 7000)).toBe(true);
    expect(splitter.peek()).toBeNull();
    const [boar] = splitter.drain();
    expect(boar).toMatchObject({ label: "Rockhide Boar", index: 0 });
    expect(splitter.drain()).toEqual([]);

    for (const ev of events.slice(firstPullEnd + 1)) splitter.push(ev);
    expect(splitter.finish().map((f) => f.label)).toEqual(["Young Wolf"]);
  });
});

describe("LineSplitter", () => {
  it("rebuilds lines from arbitrary byte chunks, including split multi-byte characters", () => {
    const text = `${warriorLog()}9/27/2026 21:00:00.000-4  SPELL_CAST_SUCCESS,"Ærindel","Ünïcode"\npartial`;
    const bytes = new TextEncoder().encode(text);
    const splitter = new LineSplitter();
    const lines: string[] = [];
    let seed = 7;
    for (let i = 0; i < bytes.length; ) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      const n = 1 + (seed % 97);
      lines.push(...splitter.push(bytes.subarray(i, i + n)));
      i += n;
    }
    expect(splitter.pending).toBe("partial");
    lines.push(...splitter.flush());
    expect(lines).toEqual([...splitLines(text)]);
  });
});
