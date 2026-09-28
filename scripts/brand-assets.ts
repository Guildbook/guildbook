/**
 * Regenerates the brand assets:
 *   public/brand/osm/        the Order of Saint Michael, from the tabard crest in src/components/crest.tsx
 *   public/brand/guildbook/  the Guildbook platform, from the mark in src/components/guildbook-mark.tsx
 * Each set holds the favicon, icon.svg, apple icon, manifest icons and a link preview (og.png); Guildbook also
 * gets a 1024px icon for the GitHub org avatar and Discord app icon, and social/ holds its X header and circle-safe avatar.
 *   pnpm brand:assets            writes both sets and the Order's Discord icon
 *   pnpm brand:assets --preview  also writes pixel-zoom sheets of the small marks, and mocks of the X header and
 *                                circle-cropped avatar, to .brand-preview/
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

const FONT_OPTIONS = { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Cinzel" };

/** Rasterizes `svg` at its own size, or scaled to `width` pixels wide (for @2x renders). */
function png(svg: string, width?: number) {
  return new Resvg(svg, { font: FONT_OPTIONS, fitTo: width ? { mode: "width", value: width } : { mode: "original" } }).render().asPng();
}

/** The inked width of a line of text, for laying out lockups around it. */
function textWidth(attrs: string, content: string) {
  const bbox = new Resvg(doc(4000, 400, `<text x="0" y="300" ${attrs}>${content}</text>`), { font: FONT_OPTIONS }).getBBox();
  if (!bbox) throw new Error(`could not measure "${content}"`);
  return bbox.width;
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

/** Faint gold grain over the ink, like the parchment texture in globals.css but barely there. */
const grain = (w: number, h: number, opacity: number) =>
  `<filter id="grain" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="7" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.79 0 0 0 0 0.64 0 0 0 0 0.3 0 0 0 ${opacity} 0"/></filter>`;

const RULE = `<stop offset="0" stop-color="#c9a44c" stop-opacity="0"/><stop offset="0.2" stop-color="#c9a44c"/><stop offset="0.5" stop-color="#e6c877"/><stop offset="0.8" stop-color="#c9a44c"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/>`;

/** Where the book's pages sit in the mark's 64-unit viewBox (for centering what is drawn, not the square). */
const BOOK = { left: 5, width: 54, centerY: 31.5 };

/** A small gold lozenge, the rules' centerpiece. */
const lozenge = (cx: number, cy: number, r: number, opacity: number) =>
  `<path d="M${cx} ${cy - r} L${cx + r} ${cy} L${cx} ${cy + r} L${cx - r} ${cy} Z" fill="#c9a44c" fill-opacity="${opacity}"/>`;

/**
 * The X (Twitter) header, drawn at 1500 by 500. X lays the round avatar over the bottom-left (roughly the left fifth
 * and bottom two fifths) and crops the top and bottom on some screens, so the lockup sits right of centre inside the
 * middle 1000 by 300.
 */
function xHeader() {
  const [w, h] = [1500, 500];
  const cx = 800;
  const markPx = 196;
  const gap = 40;
  const word = { size: 72, attrs: 'font-family="Cinzel" font-size="72" font-weight="700" letter-spacing="13"', text: "GUILDBOOK" };
  const tag = { attrs: 'font-family="Cinzel" font-size="16" font-weight="700" letter-spacing="4.8"', text: "GUILD SITES FOR WORLD OF WARCRAFT: FOREVER" };
  const url = { attrs: 'font-family="Cinzel" font-size="21" letter-spacing="3"', text: "guildbook.io" };
  const textW = Math.max(textWidth(word.attrs, word.text), textWidth(tag.attrs, tag.text));
  const bookW = (markPx * BOOK.width) / 64;
  const left = cx - (bookW + gap + textW) / 2;
  const tx = left + bookW + gap;
  const midY = 252;
  const markX = left - (markPx * BOOK.left) / 64;
  const markY = midY - (markPx * BOOK.centerY) / 64;
  const line = (y: number, attrs: string, fill: string, content: string) => `<text x="${tx}" y="${y}" ${attrs} fill="${fill}">${content}</text>`;
  const ornament = (y: number) =>
    `<rect x="${cx - 470}" y="${y}" width="940" height="1" fill="url(#rule)" opacity="0.4"/>${lozenge(cx, y + 0.5, 4, 0.5)}`;
  return doc(
    w,
    h,
    `<defs>
      <radialGradient id="glow" cx="0.5" cy="0" r="0.75"><stop offset="0" stop-color="#c9a44c" stop-opacity="0.16"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></radialGradient>
      <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a44c" stop-opacity="0.14"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></radialGradient>
      <radialGradient id="cool" cx="0.5" cy="1" r="0.8"><stop offset="0" stop-color="#8c96aa" stop-opacity="0.06"/><stop offset="1" stop-color="#8c96aa" stop-opacity="0"/></radialGradient>
      <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></radialGradient>
      <linearGradient id="rule" x1="0" x2="1">${RULE}</linearGradient>
      <linearGradient id="tagRule" x1="0" x2="1"><stop offset="0" stop-color="#c9a44c"/><stop offset="0.6" stop-color="#e6c877" stop-opacity="0.7"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></linearGradient>
      <linearGradient id="title" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2dc98"/><stop offset="1" stop-color="#c9a44c"/></linearGradient>
      ${grain(w, h, 0.05)}
    </defs>
    <rect width="${w}" height="${h}" fill="${INK}"/>
    <rect width="${w}" height="${h}" fill="url(#glow)"/>
    <rect width="${w}" height="${h}" fill="url(#cool)"/>
    <rect width="${w}" height="${h}" filter="url(#grain)"/>
    <rect width="${w}" height="${h}" fill="url(#vignette)"/>
    <circle cx="${left + bookW / 2}" cy="${midY}" r="${markPx * 0.75}" fill="url(#halo)"/>
    ${ornament(104)}
    ${ornament(396)}
    ${mark(markPx, markX, markY)}
    ${line(midY - 12, word.attrs, "url(#title)", word.text)}
    <rect x="${tx}" y="${midY + 12}" width="${textW}" height="1.5" fill="url(#tagRule)" opacity="0.8"/>
    ${line(midY + 46, tag.attrs, "#c9a44c", tag.text).replace("<text ", '<text fill-opacity="0.85" ')}
    ${line(midY + 86, url.attrs, "#ece4d4", url.text).replace("<text ", '<text fill-opacity="0.8" ')}`,
  );
}

/**
 * A square profile picture for sites that crop to a circle (X, GitHub, Discord): opaque ink, no rounded corners,
 * the book's pages 62% of the width so they clear the inscribed circle with room to spare.
 */
function avatar(px: number) {
  const markPx = (px * 0.62 * 64) / BOOK.width;
  return doc(
    px,
    px,
    `<defs>
      <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#c9a44c" stop-opacity="0.22"/><stop offset="0.7" stop-color="#c9a44c" stop-opacity="0.05"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow" cx="0.5" cy="0" r="0.9"><stop offset="0" stop-color="#c9a44c" stop-opacity="0.1"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></radialGradient>
      ${grain(px, px, 0.04)}
    </defs>
    <rect width="${px}" height="${px}" fill="${INK}"/>
    <rect width="${px}" height="${px}" fill="url(#glow)"/>
    <rect width="${px}" height="${px}" filter="url(#grain)"/>
    <rect width="${px}" height="${px}" fill="url(#halo)"/>
    ${mark(markPx, (px - markPx) / 2, px / 2 - (markPx * BOOK.centerY) / 64)}`,
  );
}

const dataUri = (data: Buffer) => `data:image/png;base64,${data.toString("base64")}`;

/** The header as X shows it on desktop: the avatar ringed in the page colour over its bottom-left, with optional guides. */
function xHeaderMock(header: Buffer, face: Buffer, guides: boolean) {
  const [w, h] = [1500, 760];
  const [r, ax, ring] = [167, 40 + 167, 10];
  const ay = 500;
  const dashed = (x: number, y: number, rw: number, rh: number, stroke: string) =>
    `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="10 8"/>`;
  const guideLayer = guides
    ? `${dashed(250, 100, 1000, 300, "#4fd1c5")}
       <rect x="0" y="0" width="${w}" height="60" fill="#e04f5f" fill-opacity="0.18"/><rect x="0" y="440" width="${w}" height="60" fill="#e04f5f" fill-opacity="0.18"/>
       <rect x="0" y="300" width="300" height="200" fill="#e04f5f" fill-opacity="0.18"/>
       <text x="258" y="94" font-family="Cinzel" font-size="16" fill="#4fd1c5">safe area 1000 x 300</text>
       <text x="8" y="24" font-family="Cinzel" font-size="16" fill="#e04f5f">possible crop</text>`
    : "";
  return png(
    doc(
      w,
      h,
      `<defs><clipPath id="face"><circle cx="${ax}" cy="${ay}" r="${r}"/></clipPath></defs>
      <rect width="${w}" height="${h}" fill="#000"/>
      <image x="0" y="0" width="1500" height="500" href="${dataUri(header)}"/>
      <circle cx="${ax}" cy="${ay}" r="${r + ring}" fill="#000"/>
      <image x="${ax - r}" y="${ay - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#face)" href="${dataUri(face)}"/>
      <text x="40" y="${ay + r + 60}" font-family="Cinzel" font-size="40" font-weight="700" fill="#ece4d4">Guildbook</text>
      ${guideLayer}`,
    ),
  );
}

/**
 * The avatar cropped to a circle at the sizes X shows it (400, 96, 48), on dark and light, plus 48 zoomed. Each size is
 * rendered directly: resvg's image scaling is closer to nearest-neighbour than to the resampling X applies.
 */
function avatarCircles() {
  const sizes = [400, 96, 48];
  const zoom = 6;
  const faces = new Map(sizes.map((px) => [px, dataUri(png(avatar(px)))]));
  const crop = (px: number, x: number, y: number, id: string) =>
    `<clipPath id="${id}"><circle cx="${x + px / 2}" cy="${y + px / 2}" r="${px / 2}"/></clipPath><image x="${x}" y="${y}" width="${px}" height="${px}" clip-path="url(#${id})" href="${faces.get(px)}"/>`;
  const small = png(doc(48, 48, crop(48, 0, 0, "c")));
  const rowH = 400 + 48;
  const width = 24 + sizes.reduce((sum, px) => sum + px + 32, 0) + 48 * zoom + 24;
  const rows = ["#000", "#fff"]
    .map((bg, row) => {
      const y = row * rowH;
      let x = 24;
      const crops = sizes
        .map((px, i) => {
          const out = crop(px, x, y + 24 + (400 - px) / 2, `c${row}${i}`);
          x += px + 32;
          return out;
        })
        .join("");
      const zoomed = `<image x="${x}" y="${y + 24 + (400 - 48 * zoom) / 2}" width="${48 * zoom}" height="${48 * zoom}" image-rendering="optimizeSpeed" href="${dataUri(small)}"/>`;
      return `<rect x="0" y="${y}" width="${width}" height="${rowH}" fill="${bg}"/>${crops}${zoomed}`;
    })
    .join("");
  return png(doc(width, rowH * 2, rows));
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
// For the X account (and other circle-cropping profiles).
const header = xHeader();
const xHeaderPng = png(header);
const avatar400 = png(avatar(400));
write("public/brand/guildbook/social/x-header.png", xHeaderPng);
write("public/brand/guildbook/social/x-header@2x.png", png(header, 3000));
write("public/brand/guildbook/social/avatar-400.png", avatar400);
write("public/brand/guildbook/social/avatar-1024.png", png(avatar(1024)));

if (process.argv.includes("--preview")) {
  write(".brand-preview/small-marks.png", previewSheet());
  for (const px of [96, 160, 208, 480]) write(`.brand-preview/crest-${px}.png`, icon(px));
  write(".brand-preview/x-header-mock.png", xHeaderMock(xHeaderPng, avatar400, false));
  write(".brand-preview/x-header-safe-area.png", xHeaderMock(xHeaderPng, avatar400, true));
  write(".brand-preview/avatar-circles.png", avatarCircles());
}
