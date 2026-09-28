/**
 * Renders a contact sheet of every tabard emblem to .brand-preview/emblems.png:
 *   npx tsx scripts/emblem-sheet.ts
 * Each tile shows the emblem at `full` detail (gold on crimson), at `mark` and `tiny` (white on navy) and a hard-pixel
 * zoom of the 16px render, so small-size legibility can be judged. Rasterized with resvg and the bundled Cinzel font.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { EmblemDef, EmblemPaint, TabardDetail } from "../src/lib/tabard/emblem-types";
import { EMBLEMS } from "../src/lib/tabard/emblems";

const ROOT = path.resolve(import.meta.dirname, "..");
const FONTS = [path.join(ROOT, "scripts/fonts/Cinzel-Regular.ttf")];
const INK = "#0b0908";
const CRIMSON = "#7a1020";
const NAVY = "#1d2f5a";
const OUTLINE = "#1a0b0d";
const SW: Record<TabardDetail, number> = { full: 1.75, mark: 2.2, tiny: 3 };

const gold = (detail: TabardDetail): EmblemPaint => ({ fill: "#e6c877", light: "#fff1b8", shade: "#8a6619", outline: OUTLINE, sw: SW[detail], detail });
const white = (detail: TabardDetail): EmblemPaint => ({ fill: "#f7f8fa", light: "#ffffff", shade: "#8d9bb0", outline: OUTLINE, sw: SW[detail], detail });

/** The emblem as a standalone `sizePx` square SVG. */
export function renderEmblemSvg(emblem: EmblemDef, paint: EmblemPaint, sizePx: number) {
  return renderToStaticMarkup(
    createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 100 100", width: sizePx, height: sizePx }, emblem.draw(paint)),
  );
}

const at = (svg: string, x: number, y: number) => svg.replace("<svg ", `<svg x="${x}" y="${y}" `);

function doc(width: number, height: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function png(svg: string) {
  return new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Cinzel" } }).render().asPng();
}

const [TILE_W, TILE_H, COLS, GAP] = [270, 290, 6, 16];
const ZOOM = 5;

function tile(emblem: EmblemDef, x: number, y: number) {
  const tinyPng = png(doc(16, 16, `<rect width="16" height="16" fill="${NAVY}"/>${renderEmblemSvg(emblem, white("tiny"), 16)}`)).toString("base64");
  const row2 = y + 160;
  return [
    `<rect x="${x}" y="${y}" width="${TILE_W}" height="${TILE_H}" rx="6" fill="#15110f" stroke="#3a2e22"/>`,
    `<rect x="${x + 65}" y="${y + 10}" width="140" height="140" fill="${CRIMSON}"/>`,
    at(renderEmblemSvg(emblem, gold("full"), 120), x + 75, y + 20),
    `<rect x="${x + 10}" y="${row2}" width="56" height="56" fill="${NAVY}"/>`,
    at(renderEmblemSvg(emblem, white("mark"), 40), x + 18, row2 + 8),
    `<rect x="${x + 76}" y="${row2 + 16}" width="24" height="24" fill="${NAVY}"/>`,
    at(renderEmblemSvg(emblem, white("tiny"), 16), x + 80, row2 + 20),
    `<image x="${x + 110}" y="${row2}" width="${16 * ZOOM}" height="${16 * ZOOM}" image-rendering="optimizeSpeed" href="data:image/png;base64,${tinyPng}"/>`,
    `<text x="${x + TILE_W / 2}" y="${y + TILE_H - 14}" text-anchor="middle" font-family="Cinzel" font-size="18" fill="#ece4d4">${emblem.name}</text>`,
  ].join("");
}

/** `--only lion,eagle` limits the sheet (written to emblems-only.png); `--scale 2` enlarges it for close inspection. */
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const only = arg("--only")?.split(",");
const scale = Number(arg("--scale") ?? 1);
const emblems = only ? EMBLEMS.filter((e) => only.includes(e.id)) : EMBLEMS;
const cols = Math.min(COLS, emblems.length);
const rows = Math.ceil(emblems.length / cols);
const [width, height] = [GAP + cols * (TILE_W + GAP), GAP + rows * (TILE_H + GAP)];
const tiles = emblems.map((e, i) => tile(e, GAP + (i % cols) * (TILE_W + GAP), GAP + Math.floor(i / cols) * (TILE_H + GAP))).join("");
const out = path.join(ROOT, `.brand-preview/${only ? "emblems-only" : "emblems"}.png`);
const sheet = `<rect width="${width}" height="${height}" fill="${INK}"/>${tiles}`;
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, png(doc(width * scale, height * scale, `<g transform="scale(${scale})">${sheet}</g>`)));
console.log(`wrote ${path.relative(ROOT, out)}`);
