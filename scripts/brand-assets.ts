/**
 * Regenerates the brand assets:
 *   public/brand/osm/        the Order of Saint Michael, from the tabard crest in src/components/crest.tsx
 *   public/brand/guildbook/  the Guildbook platform, from the mark in src/components/guildbook-mark.tsx
 * Each set holds the favicon, icon.svg, apple icon, manifest icons and a link preview (og.png); Guildbook also
 * gets a 1024px icon for the GitHub org avatar and Discord app icon.
 *   pnpm brand:assets            writes both sets and the Order's Discord icon
 *   pnpm brand:assets --preview  also writes pixel-zoom sheets of the small marks to .brand-preview/
 * Rasterized with resvg using the bundled Cinzel fonts (scripts/fonts, SIL OFL) so the preview text matches the site.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CrestArt, type CrestDetail } from "../src/components/crest";
import { GuildbookMarkArt } from "../src/components/guildbook-mark";

const ROOT = path.resolve(import.meta.dirname, "..");
const FONTS = ["Cinzel-Regular.ttf", "Cinzel-Bold.ttf", "CinzelDecorative-Bold.ttf"].map((f) => path.join(ROOT, "scripts/fonts", f));
const INK = "#0b0908";
/** The crest's width over its height (its viewBox is 100 by 120). */
const ASPECT = 100 / 120;

/** Picks the detail the site would show for a crest this many pixels wide. */
const detailAt = (width: number): CrestDetail => (width >= 64 ? "full" : width > 20 ? "mark" : "tiny");

/** The crest `height` pixels tall, horizontally centered on `cx` with its top at `y`. */
function crest(height: number, cx: number, y: number) {
  const width = height * ASPECT;
  const markup = renderToStaticMarkup(createElement(CrestArt, { detail: detailAt(width), width, height }));
  return markup.replace("<svg ", `<svg x="${cx - width / 2}" y="${y}" `);
}

function doc(width: number, height: number, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function png(svg: string) {
  return new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Cinzel" } }).render().asPng();
}

/** The crest filling the height of a transparent square. */
const icon = (px: number) => png(doc(px, px, crest(px, px / 2, 0)));

/** The crest centered on a solid square at `fill` of its height (for platforms that crop, mask or forbid transparency). */
function padded(px: number, fill: number, background = INK) {
  const height = px * fill;
  const glow = `<radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7a1020" stop-opacity="0.45"/><stop offset="1" stop-color="#7a1020" stop-opacity="0"/></radialGradient>`;
  return png(doc(px, px, `<defs>${glow}</defs><rect width="${px}" height="${px}" fill="${background}"/><rect width="${px}" height="${px}" fill="url(#g)"/>${crest(height, px / 2, (px - height) / 2)}`));
}

/** A .ico holding PNG images (supported by every current browser). */
function ico(images: { px: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ px, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(px >= 256 ? 0 : px, e);
    header.writeUInt8(px >= 256 ? 0 : px, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

function linkPreview() {
  const [w, h] = [1200, 630];
  const crestPx = 480;
  const text = (y: number, size: number, family: string, fill: string, content: string, extra = "") =>
    `<text x="830" y="${y}" text-anchor="middle" font-family="${family}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;
  return png(
    doc(
      w,
      h,
      `<defs>
        <radialGradient id="glow" cx="0.5" cy="0" r="0.9"><stop offset="0" stop-color="#7a1020" stop-opacity="0.55"/><stop offset="1" stop-color="#7a1020" stop-opacity="0"/></radialGradient>
        <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.6" stop-color="#a8182f" stop-opacity="0.35"/><stop offset="1" stop-color="#a8182f" stop-opacity="0"/></radialGradient>
        <linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="#c9a44c" stop-opacity="0"/><stop offset="0.2" stop-color="#c9a44c"/><stop offset="0.5" stop-color="#e6c877"/><stop offset="0.8" stop-color="#c9a44c"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></linearGradient>
        <linearGradient id="title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2dc98"/><stop offset="1" stop-color="#c9a44c"/></linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="${INK}"/>
      <rect width="${w}" height="${h}" fill="url(#glow)"/>
      <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="6" fill="none" stroke="#3a2e22" stroke-width="2"/>
      <rect x="32" y="32" width="${w - 64}" height="${h - 64}" rx="4" fill="none" stroke="#8a7036" stroke-opacity="0.45" stroke-width="1"/>
      <circle cx="310" cy="${h / 2}" r="${crestPx / 2 + 10}" fill="url(#halo)"/>
      ${crest(crestPx, 310, (h - crestPx) / 2)}
      ${text(232, 62, "Cinzel Decorative", "url(#title)", "Order of", 'font-weight="700"')}
      ${text(310, 62, "Cinzel Decorative", "url(#title)", "Saint Michael", 'font-weight="700"')}
      <rect x="650" y="342" width="360" height="2" fill="url(#rule)"/>
      ${text(398, 30, "Cinzel", "#c8283f", "QUIS UT DEUS", 'font-weight="700" letter-spacing="12"')}
      ${text(462, 24, "Cinzel", "#ece4d4", "A Catholic raiding guild", 'fill-opacity="0.9"')}
      ${text(498, 24, "Cinzel", "#ece4d4", "for World of Warcraft: Forever", 'fill-opacity="0.9"')}`,
    ),
  );
}

/** The crest in each box the site renders it in (favicon, header, footer, sign-in), at 1x and zoomed with hard pixels. */
function previewSheet() {
  const boxes: [number, number][] = [[16, 16], [32, 40], [44, 56], [80, 96]];
  const zoom = 5;
  let x = 24;
  const body = boxes
    .map(([w, h]) => {
      const data = png(doc(w, h, crest(h, w / 2, 0))).toString("base64");
      const img = `<image x="${x}" y="24" width="${w}" height="${h}" href="data:image/png;base64,${data}"/><image x="${x}" y="${48 + 96}" width="${w * zoom}" height="${h * zoom}" image-rendering="optimizeSpeed" href="data:image/png;base64,${data}"/>`;
      x += w * zoom + 24;
      return img;
    })
    .join("");
  const [width, height] = [x, 48 + 96 + 96 * zoom + 24];
  return png(doc(width, height, `<rect width="${width}" height="${height}" fill="${INK}"/>${body}`));
}

function write(rel: string, data: Buffer | string) {
  const file = path.join(ROOT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote ${rel}`);
}

/** The Guildbook mark, `px` square, with its top-left corner at (x, y). */
function mark(px: number, x: number, y: number) {
  const markup = renderToStaticMarkup(createElement(GuildbookMarkArt, { size: px, title: null }));
  return markup.replace("<svg ", `<svg x="${x}" y="${y}" `);
}

/** The mark on a rounded ink tile at `fill` of its size (favicons read better on a solid tile). */
function markTile(px: number, fill: number, radius = 0.22) {
  const inner = px * fill;
  return doc(px, px, `<rect width="${px}" height="${px}" rx="${px * radius}" fill="${INK}"/><rect x="${px * 0.03}" y="${px * 0.03}" width="${px * 0.94}" height="${px * 0.94}" rx="${px * (radius - 0.02)}" fill="none" stroke="#8a7036" stroke-width="${Math.max(1, px / 64)}"/>${mark(inner, (px - inner) / 2, (px - inner) / 2)}`);
}

function guildbookPreview() {
  const [w, h] = [1200, 630];
  const text = (y: number, size: number, family: string, fill: string, content: string, extra = "") =>
    `<text x="790" y="${y}" text-anchor="middle" font-family="${family}" font-size="${size}" fill="${fill}" ${extra}>${content}</text>`;
  return png(
    doc(
      w,
      h,
      `<defs>
        <radialGradient id="glow" cx="0.3" cy="0.5" r="0.7"><stop offset="0" stop-color="#c9a44c" stop-opacity="0.18"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></radialGradient>
        <linearGradient id="rule" x1="0" x2="1"><stop offset="0" stop-color="#c9a44c" stop-opacity="0"/><stop offset="0.2" stop-color="#c9a44c"/><stop offset="0.5" stop-color="#e6c877"/><stop offset="0.8" stop-color="#c9a44c"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></linearGradient>
        <linearGradient id="title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2dc98"/><stop offset="1" stop-color="#c9a44c"/></linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="${INK}"/>
      <rect width="${w}" height="${h}" fill="url(#glow)"/>
      <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="6" fill="none" stroke="#3a2e22" stroke-width="2"/>
      ${mark(300, 90, (h - 300) / 2)}
      ${text(290, 80, "Cinzel", "url(#title)", "GUILDBOOK", 'font-weight="700" letter-spacing="8"')}
      <rect x="590" y="326" width="400" height="2" fill="url(#rule)"/>
      ${text(392, 28, "Cinzel", "#ece4d4", "Guild sites for", 'fill-opacity="0.9"')}
      ${text(432, 28, "Cinzel", "#ece4d4", "World of Warcraft: Forever", 'fill-opacity="0.9"')}
      ${text(494, 22, "Cinzel", "#a39888", "Rosters, applications, raid nights and progression")}`,
    ),
  );
}

const svgFile = (svg: string, px: number) => svg.replace(new RegExp(` width="${px}" height="${px}"`), "");

// The Order of Saint Michael
write("public/brand/osm/icon.svg", svgFile(doc(120, 120, crest(120, 60, 0)), 120));
write("public/brand/osm/favicon.ico", ico([16, 32, 48].map((px) => ({ px, data: icon(px) }))));
write("public/brand/osm/apple-icon.png", padded(180, 0.8));
write("public/brand/osm/icon-192.png", icon(192));
write("public/brand/osm/icon-512.png", icon(512));
write("public/brand/osm/icon-maskable-512.png", padded(512, 0.6));
write("public/brand/osm/og.png", linkPreview());
write("public/brand/discord-icon.png", padded(512, 0.72));

// Guildbook
write("public/brand/guildbook/icon.svg", svgFile(markTile(64, 0.86), 64));
write("public/brand/guildbook/favicon.ico", ico([16, 32, 48].map((px) => ({ px, data: png(markTile(px, 0.9)) }))));
write("public/brand/guildbook/apple-icon.png", png(markTile(180, 0.72, 0)));
write("public/brand/guildbook/icon-192.png", png(markTile(192, 0.86)));
write("public/brand/guildbook/icon-512.png", png(markTile(512, 0.86)));
// For the GitHub org avatar and the Discord app icon, which want 1024px uploads.
write("public/brand/guildbook/icon-1024.png", png(markTile(1024, 0.86)));
write("public/brand/guildbook/icon-maskable-512.png", png(markTile(512, 0.6, 0)));
write("public/brand/guildbook/og.png", guildbookPreview());

if (process.argv.includes("--preview")) {
  write(".brand-preview/small-marks.png", previewSheet());
  for (const px of [96, 160, 208, 480]) write(`.brand-preview/crest-${px}.png`, icon(px));
}
