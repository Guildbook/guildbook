import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeText, scanText } from "@/lib/vigil/analyze";
import { fightReportSchema } from "@/lib/vigil/report";
import { detectModel } from "@/lib/vigil/rotations";

const SAMPLE = join(__dirname, "../fixtures/combatlog/forever-sample.txt");
const present = existsSync(SAMPLE);

/** Runs once a real WoW: Forever beta log is dropped at tests/fixtures/combatlog/forever-sample.txt. */
describe.skipIf(!present)("Forever beta combat log sample", () => {
  const text = present ? readFileSync(SAMPLE, "utf8") : "";
  const scan = present ? scanText(text) : null;

  it("parses almost every line and finds the recording player", () => {
    expect(scan!.lines).toBeGreaterThan(0);
    expect(scan!.unparsed / scan!.lines).toBeLessThan(0.01);
    expect(scan!.players.find((p) => p.isLogger)).toBeTruthy();
  });

  it("builds valid reports for the recording player", () => {
    const player = scan!.players.find((p) => p.isLogger) ?? scan!.players[0]!;
    const model = detectModel(player.spells);
    const reports = analyzeText(text, player.guid, model?.id ?? null, player.name);
    expect(reports.length).toBeGreaterThan(0);
    for (const r of reports) expect(() => fightReportSchema.parse(r)).not.toThrow();
  });
});
