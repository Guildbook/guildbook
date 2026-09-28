import { describe, expect, it } from "vitest";
import { parseHeader, parseTimestamp, splitFields, tokenizeLine } from "./tokenizer";

describe("splitFields", () => {
  it("keeps commas inside quoted names and unescapes doubled quotes", () => {
    expect(splitFields('Player-1-ABC,"Tor, the ""Bold""",0x511,0x0')).toEqual([
      "Player-1-ABC",
      'Tor, the "Bold"',
      "0x511",
      "0x0",
    ]);
  });

  it("nests parentheses and brackets (COMBATANT_INFO)", () => {
    expect(splitFields("Player-1-A,1,[(12345,1),(678,2)],(1,2,3),[]")).toEqual([
      "Player-1-A",
      "1",
      [
        ["12345", "1"],
        ["678", "2"],
      ],
      ["1", "2", "3"],
      [],
    ]);
  });

  it("keeps empty quoted strings and tolerates unbalanced brackets", () => {
    expect(splitFields('a,"",b')).toEqual(["a", "", "b"]);
    expect(splitFields("a,(b,c")).toEqual(["a", ["b", "c"]]);
    expect(splitFields("a,b)),c")).toEqual(["a", "b", "c"]);
  });
});

describe("parseTimestamp", () => {
  it("reads retail timestamps with year and UTC offset", () => {
    const ts = parseTimestamp("9/26/2026 21:00:01.250-4  SPELL_CAST_SUCCESS,x", 2000);
    expect(new Date(ts!.ms).toISOString()).toBe("2026-09-27T01:00:01.250Z");
    expect(ts!.rest).toBe("SPELL_CAST_SUCCESS,x");
  });

  it("reads Classic timestamps without a year", () => {
    const ts = parseTimestamp("9/27 01:00:01.5  SWING_DAMAGE,x", 2026);
    expect(new Date(ts!.ms).toISOString()).toBe("2026-09-27T01:00:01.500Z");
  });

  it("rejects lines without a timestamp", () => {
    expect(parseTimestamp("garbage", 2026)).toBeNull();
    expect(tokenizeLine("")).toBeNull();
  });
});

describe("tokenizeLine and parseHeader", () => {
  it("splits event and fields", () => {
    const line = tokenizeLine('9/27/2026 01:00:00.000+0  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Creature-0-1-0-1-448-1,"Hogger",0xa48,0x0,0');
    expect(line?.event).toBe("UNIT_DIED");
    expect(line?.fields[5]).toBe("Hogger");
  });

  it("reads the COMBAT_LOG_VERSION header", () => {
    const line = tokenizeLine("9/27/2026 01:00:00.000-4  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.1.5,PROJECT_ID,1");
    expect(parseHeader(line!.fields)).toEqual({ version: 22, advanced: true, build: "12.1.5", projectId: 1 });
  });

  it("tolerates a header with unknown or missing keys", () => {
    const line = tokenizeLine("9/27 01:00:00.000  COMBAT_LOG_VERSION,9,ADVANCED_LOG_ENABLED,0,NEW_KEY,7");
    expect(parseHeader(line!.fields)).toEqual({ version: 9, advanced: false, build: null, projectId: null });
  });
});
