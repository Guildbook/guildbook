import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EmblemDef, EmblemPaint, TabardDetail } from "./emblem-types";
import { EMBLEM_IDS, EMBLEMS, emblemById } from "./emblems";

const DETAILS: TabardDetail[] = ["full", "mark", "tiny"];
const SW: Record<TabardDetail, number> = { full: 1.75, mark: 2.2, tiny: 3 };

const paint = (detail: TabardDetail): EmblemPaint => ({
  fill: "#e6c877",
  light: "#fff1b8",
  shade: "#8a6619",
  outline: "#1a0b0d",
  sw: SW[detail],
  detail,
});

const render = (emblem: EmblemDef, detail: TabardDetail) =>
  renderToStaticMarkup(createElement("svg", { viewBox: "0 0 100 100" }, emblem.draw(paint(detail))));

describe("tabard emblems", () => {
  it("has unique kebab-case ids", () => {
    expect(new Set(EMBLEM_IDS).size).toBe(EMBLEM_IDS.length);
    for (const id of EMBLEM_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("offers at least 24 emblems, led by the cross pattee", () => {
    expect(EMBLEMS.length).toBeGreaterThanOrEqual(24);
    expect(EMBLEMS[0].id).toBe("cross-pattee");
    expect(emblemById("cross-pattee")?.name).toBe("Cross Pattee");
    expect(emblemById("no-such-emblem")).toBeUndefined();
  });

  for (const emblem of EMBLEMS) {
    for (const detail of DETAILS) {
      it(`${emblem.id} renders self-contained, stable markup at ${detail}`, () => {
        const markup = render(emblem, detail);
        expect(markup).toContain("<path");
        expect(markup).not.toContain(" id=");
        expect(markup).not.toContain("url(");
        expect(markup).not.toContain("<defs");
        expect(markup).not.toContain("NaN");
        expect(markup).not.toMatch(/\d+\.\d{3,}/);
        expect(render(emblem, detail)).toBe(markup);
      });
    }
  }
});
