import type { ReactNode } from "react";
import type { EmblemDef, EmblemPaint } from "./emblem-types";
import { crossFacets, crossPattee, f, polar, poly, pt, turn, type Pt } from "./geometry";

/* ------------------------------------------------------------------------------------------------------------
 * Path toolkit. Outlines are written as absolute M/L/Q/C/A commands; symmetric emblems are drawn as their right
 * half (from the top of the centerline, clockwise, back to the centerline) and mirrored. Every emitted number
 * goes through `f`, so markup is identical on server and client.
 * ---------------------------------------------------------------------------------------------------------- */

type Seg =
  | { c: "L"; to: Pt }
  | { c: "Q"; c1: Pt; to: Pt }
  | { c: "C"; c1: Pt; c2: Pt; to: Pt }
  | { c: "A"; r: number; large: number; sweep: number; to: Pt };

interface Contour {
  start: Pt;
  segs: Seg[];
}

/** Parses one subpath of absolute M, L, Q, C and circular A commands (a trailing Z is ignored). */
function parse(d: string): Contour {
  const tokens = d.match(/[MLQCA]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let cmd = "M";
  const num = () => Number(tokens[i++]);
  const point = (): Pt => [num(), num()];
  let start: Pt = [0, 0];
  const segs: Seg[] = [];
  while (i < tokens.length) {
    if (/[MLQCA]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      start = point();
      cmd = "L";
    } else if (cmd === "L") segs.push({ c: "L", to: point() });
    else if (cmd === "Q") segs.push({ c: "Q", c1: point(), to: point() });
    else if (cmd === "C") segs.push({ c: "C", c1: point(), c2: point(), to: point() });
    else {
      const r = num();
      num();
      num();
      const large = num();
      const sweep = num();
      segs.push({ c: "A", r, large, sweep, to: point() });
    }
  }
  return { start, segs };
}

/** The same outline traversed backwards. */
function reverse({ start, segs }: Contour): Contour {
  const ends = [start, ...segs.map((s) => s.to)];
  const out: Seg[] = segs
    .map((s, k): Seg => {
      const to = ends[k];
      if (s.c === "C") return { c: "C", c1: s.c2, c2: s.c1, to };
      if (s.c === "Q") return { c: "Q", c1: s.c1, to };
      if (s.c === "A") return { ...s, sweep: 1 - s.sweep, to };
      return { c: "L", to };
    })
    .reverse();
  return { start: ends[ends.length - 1], segs: out };
}

/** Moves every point through `fn`; `mirrored` flips arc sweeps for reflections. */
function map({ start, segs }: Contour, fn: (p: Pt) => Pt, mirrored = false): Contour {
  return {
    start: fn(start),
    segs: segs.map((s): Seg => {
      if (s.c === "C") return { c: "C", c1: fn(s.c1), c2: fn(s.c2), to: fn(s.to) };
      if (s.c === "Q") return { c: "Q", c1: fn(s.c1), to: fn(s.to) };
      if (s.c === "A") return { ...s, sweep: mirrored ? 1 - s.sweep : s.sweep, to: fn(s.to) };
      return { c: "L", to: fn(s.to) };
    }),
  };
}

function emit({ start, segs }: Contour, move = true) {
  const body = segs
    .map((s) => {
      if (s.c === "C") return `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}`;
      if (s.c === "Q") return `Q${pt(s.c1)} ${pt(s.to)}`;
      if (s.c === "A") return `A${f(s.r)} ${f(s.r)} 0 ${s.large} ${s.sweep} ${pt(s.to)}`;
      return `L${pt(s.to)}`;
    })
    .join("");
  return (move ? `M${pt(start)}` : "") + body;
}

const mirrorX = ([x, y]: Pt): Pt => [100 - x, y];
const flipY = ([x, y]: Pt): Pt => [x, 100 - y];

/** A closed symmetric outline from its right half. */
function sym(half: string) {
  const r = parse(half);
  return `${emit(r)}${emit(reverse(map(r, mirrorX, true)), false)}Z`;
}

/** Applies `fn` to every subpath of `d` (subpaths keep their Z). */
function xf(d: string, fn: (p: Pt) => Pt, mirrored = false) {
  return d
    .split(/(?=M)/)
    .filter((s) => s.trim())
    .map((s) => emit(map(parse(s), fn, mirrored)) + (s.includes("Z") ? "Z" : ""))
    .join("");
}

/** `d` plus its mirror image (for open detail strokes and paired shapes). */
const pair = (d: string) => d + xf(d, mirrorX, true);

function circle(cx: number, cy: number, r: number) {
  const a = `A${f(r)} ${f(r)} 0 1 0`;
  return `M${f(cx - r)} ${f(cy)}${a} ${f(cx + r)} ${f(cy)}${a} ${f(cx - r)} ${f(cy)}Z`;
}

/** Four arms around `c` from the right half of the upward arm (relative to `c`, from its tip to the waist corner). */
function arms(c: Pt, half: string) {
  const r = parse(half);
  const l = reverse(map(r, ([x, y]) => [-x, y], true));
  let d = "";
  let facets = "";
  for (let q = 0; q < 4; q++) {
    const m = turn(c, q);
    const [lq, rq] = [map(l, m), map(r, m)];
    d += `${q === 0 ? "M" : "L"}${pt(lq.start)}${emit(lq, false)}${emit(rq, false)}`;
    facets += `M${pt(c)}L${pt(rq.start)}${emit(rq, false)}Z`;
  }
  return { d: `${d}Z`, facets };
}

/* ------------------------------------------------------------------------------------------------------------
 * Rendering. An emblem is a stack of layers; each paints its silhouette with the outline, then (by detail) its
 * bevel facet, outline-coloured marks (eyes and the like), fine interior lines and highlights.
 * ---------------------------------------------------------------------------------------------------------- */

interface Layer {
  d: string;
  /** Far limbs and other parts set back from the viewer take the shade colour (except at `tiny`). */
  back?: boolean;
  shade?: string;
  /** Outline-coloured shapes (eyes, nostrils) at `mark` and `full`. */
  dark?: string;
  /** Fine interior lines at `full`. */
  lines?: string;
  /** Highlights at `full`. */
  lights?: string;
  transform?: string;
}

function art(p: EmblemPaint, layers: Layer[]): ReactNode {
  const stroke = { stroke: p.outline, strokeLinejoin: "round" as const };
  if (p.detail === "tiny") {
    // One merged silhouette: a double-width outline under every layer, then every fill on top, so only the outer
    // edge (and the edges of holes) stays outlined.
    return (
      <g>
        {layers.map((l, i) => (
          <path key={`o${i}`} d={l.d} transform={l.transform} fill={p.outline} fillRule="evenodd" {...stroke} strokeWidth={f(p.sw * 2)} />
        ))}
        {layers.map((l, i) => (
          <path key={`f${i}`} d={l.d} transform={l.transform} fill={p.fill} fillRule="evenodd" />
        ))}
      </g>
    );
  }
  const full = p.detail === "full";
  return (
    <g>
      {layers.map((l, i) => (
        <g key={i} transform={l.transform}>
          <path d={l.d} fill={l.back ? p.shade : p.fill} fillRule="evenodd" {...stroke} strokeWidth={p.sw} />
          {l.shade && <path d={l.shade} fill={p.shade} fillRule="evenodd" opacity={full ? 0.5 : 0.45} />}
          {l.dark && <path d={l.dark} fill={p.outline} />}
          {full && l.lines && (
            <path d={l.lines} fill="none" stroke={p.outline} strokeWidth={f(p.sw * 0.55)} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
          )}
          {full && l.lights && <path d={l.lights} fill={p.light} opacity={0.85} />}
        </g>
      ))}
    </g>
  );
}

const isTiny = (p: EmblemPaint) => p.detail === "tiny";

/* ------------------------------------------------------------------------------------------------------------
 * Emblems.
 * ---------------------------------------------------------------------------------------------------------- */

function drawCrossPattee(p: EmblemPaint) {
  const d = isTiny(p) ? crossPattee([50, 50], 32, 8, 15) : crossPattee([50, 50], 31, 6, 14);
  return art(p, [
    {
      d,
      shade: crossFacets([50, 50], 31, 6, 14),
      lights: "M40 21.5L44 21.5C43 26 43.5 31 44.5 36L43.5 36C41.5 31 40.5 26 40 21.5Z",
    },
  ]);
}

function drawCross(p: EmblemPaint) {
  const w = isTiny(p) ? 7.5 : 6.5;
  const half = `M50 16L${f(50 + w)} 16L${f(50 + w)} ${f(40 - w)}L80 ${f(40 - w)}L80 ${f(40 + w)}L${f(50 + w)} ${f(40 + w)}L${f(50 + w)} 84L50 84`;
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lights: poly([
        [52 - w, 18],
        [53.5 - w, 18],
        [53.5 - w, 30],
        [52 - w, 30],
      ]),
    },
  ]);
}

function drawCrossFleury(p: EmblemPaint) {
  const w = isTiny(p) ? 8 : 7;
  // Right half of the upward arm, relative to the center: central petal, a side petal curling out, the shaft.
  const half = `M0 -34C4 -31 6 -28 6 -24C9 -28 14 -31 18 -29C20 -24 16 -19 ${f(w + 1)} -18L${f(w)} ${f(-w)}`;
  const { d, facets } = arms([50, 50], half);
  return art(p, [{ d, shade: facets, lights: circle(50, 50, 2.5) }]);
}

function drawCelticCross(p: EmblemPaint) {
  const w = isTiny(p) ? 7.5 : 6;
  const [cy, R, r] = [40, 21, isTiny(p) ? 14 : 14.5];
  const half =
    `M50 15L${f(50 + w + 2)} 15L${f(50 + w)} ${f(cy - w)}L81 ${f(cy - w - 2)}L81 ${f(cy + w + 2)}L${f(50 + w)} ${f(cy + w)}` +
    `L${f(50 + w)} 72L${f(50 + w + 6)} 78L${f(50 + w + 6)} 85L50 85`;
  return art(p, [
    {
      d: circle(50, cy, R) + circle(50, cy, r),
      shade: `M50 ${f(cy - R)}A${f(R)} ${f(R)} 0 0 1 50 ${f(cy + R)}L50 ${f(cy + r)}A${f(r)} ${f(r)} 0 0 0 50 ${f(cy - r)}Z`,
      lines: `M${f(50 - (R + r) / 2)} ${cy}A${f((R + r) / 2)} ${f((R + r) / 2)} 0 0 1 ${f(50 + (R + r) / 2)} ${cy}`,
    },
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: circle(50, cy, 4.5),
      lights: circle(50, cy, 2.5),
    },
  ]);
}

/** A sword pointing down (or up); `k` thickens it for small sizes. */
function sword(k: number, up = false): Layer[] {
  const [g, b] = [2.6 * k, 5 * k];
  const half = `M50 22L${f(50 + g)} 22L${f(50 + g)} 33L66 33Q70 33 70 36Q70 39 66 39L${f(50 + b)} 39L${f(50 + b)} 72L50 85`;
  const fy = (d: string) => (up ? xf(d, flipY, true) : d);
  return [
    {
      d: fy(sym(half)),
      shade: fy(`${half}Z`),
      lines: fy(`M${f(50 - g)} 25L${f(50 + g)} 27M${f(50 - g)} 28.5L${f(50 + g)} 30.5M50 42L50 70`),
      lights: fy(poly([
        [51 - b + 1, 41],
        [51 - b + 2.2, 41],
        [51 - b + 2.2, 68],
        [51 - b + 1, 66],
      ])),
    },
    {
      d: fy(circle(50, 19, 4 + k)),
      shade: fy(`M50 ${f(15 - k)}A${f(4 + k)} ${f(4 + k)} 0 0 1 50 ${f(23 + k)}Z`),
      lights: fy(circle(48.5, 17.5, 1.2)),
    },
  ];
}

function drawSword(p: EmblemPaint) {
  return art(p, sword(isTiny(p) ? 1.8 : 1));
}

function drawCrossedSwords(p: EmblemPaint) {
  const k = isTiny(p) ? 1.3 : 1.1;
  return art(p, [
    ...sword(k, true).map((l) => ({ ...l, transform: "rotate(-40 50 50)" })),
    ...sword(k, true).map((l) => ({ ...l, transform: "rotate(40 50 50)" })),
  ]);
}

function drawShield(p: EmblemPaint) {
  const half = "M50 19Q65 20 78 15L79 44C79 62 67 75 50 85";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: sym("M50 26Q62 27 72 23L72.5 44C72.5 58 63 69 50 77"),
      lights: "M27 22Q34 24 42 24.5L42 27Q34 27 27 25.5Z",
    },
  ]);
}

/** Lion rampant facing left: flame-lock mane, both forepaws raised, sinister hind leg planted, tail tufted. */
function drawLion(p: EmblemPaint) {
  const body =
    // mane: locks swept back from the crown down to the shoulder
    "M39 12Q47 6 54 9L51 15Q59 13 63 18L58 22Q65 23 67 29L61 30Q67 34 66 40L60 39Q64 44 62 49L57 46" +
    // back, rump
    "C62 52 66 57 68 62C72 64 75 70 72 76" +
    // planted hind leg
    "L74 83Q76 87 72 87L62 87L59 85L64 83L65 79C63 75 60 73 57 72" +
    // raised hind leg, claws to the left
    "C53 74 48 77 43 78L37 78L32 77L30 75L33 73.5L30 71.5L33 70L38 71C42 70 45 67 47 63" +
    // belly and chest, lower foreleg
    "C45 60 44 57 44 54L37 55L30 55L26 57L21 56L24 54L20 52L24 50L28 50L36 49L42 47" +
    // upper foreleg
    "L40 44L33 43L27 44L22 43L24 41L19 39L23 37L27 38L34 37L40 36" +
    // mane lock at the throat, then the head: open jaws, snout, brow, ear
    "L37 34L32 35L33 31L29 31L23 30L20 28L27 26L19 24L17 21L18 18L23 15L28 14L32 9L36 12Z";
  return art(p, [
    {
      d: "M68 60C78 58 82 50 78 42C75 36 76 30 80 26L78 20L83 23L84 16L86 23L89 21L86 29C82 33 81 38 83 44C87 54 80 64 70 66Z",
    },
    {
      d: body,
      shade: "M57 46C62 52 66 57 68 62C72 64 75 70 72 76L68 76C70 68 65 62 60 56C58 52 56 49 55 47Z",
      dark: "M24.5 18.5L28 18L27 20.5Z",
      lines: "M42 15Q46 19 45 25M49 17Q53 22 52 29M55 23Q58 28 56 35M39 27Q42 30 41 34M22 52L26 52M22 39L26 39M31 73.5L35 73.5M62 85L65 84",
      lights: "M47 44C50 46 52 50 52 54L50 54C49 50 48 47 46 45Z",
    },
  ]);
}

/** Griffin segreant: the lion's hindquarters and raised forelegs with an eagle's head and a raised wing. */
function drawGriffin(p: EmblemPaint) {
  const body =
    // eagle head and feathered neck
    "M34 11C40 9 46 11 48 17L52 21L50 25L55 29L53 33L58 37L56 41L60 45" +
    // back, rump, planted hind leg
    "C63 51 66 57 68 62C72 64 75 70 72 76L74 83Q76 87 72 87L62 87L59 85L64 83L65 79C63 75 60 73 57 72" +
    // raised hind leg
    "C53 74 48 77 43 78L37 78L32 77L30 75L33 73.5L30 71.5L33 70L38 71C42 70 45 67 47 63" +
    // belly, taloned forelegs
    "C45 60 44 57 44 54L37 55L30 55L26 57L21 56L24 54L20 52L24 50L28 50L36 49L42 47" +
    "L40 44L33 43L27 44L22 43L24 41L19 39L23 37L27 38L34 37L39 35" +
    // throat and hooked beak
    "C36 32 33 29 29 27L24 27L20 30C17 26 19 18 26 15L30 13L31 8Z";
  const wing =
    "M51 42C52 30 58 20 68 14L85 6" +
    // primaries down the trailing edge
    "L84 14L89 15L84 22L89 24L83 30L87 33L80 38L83 42L75 44L73 51L64 50Z";
  return art(p, [
    { d: "M68 62C76 63 80 68 82 74L85 71L85 77L89 81L81 81C77 77 74 71 68 67Z" },
    {
      d: wing,
      shade: "M68 14L85 6L84 14L89 15L84 22L89 24L83 30L87 33L80 38L83 42L75 44L73 51L64 50L62 34Z",
      lines: "M58 26Q70 20 83 13M57 34Q70 29 83 23M58 42Q68 38 80 36",
    },
    {
      d: body,
      shade: "M60 45C63 51 66 57 68 62C72 64 75 70 72 76L68 76C70 68 65 62 61 56C59 52 57 49 56 47Z",
      dark: circle(33, 18.5, 1.5),
      lines: "M20 28L28 25M44 20Q46 26 44 32M22 52L26 52M22 39L26 39M31 73.5L35 73.5M62 85L65 84",
      lights: "M47 44C50 46 52 50 52 54L50 54C49 50 48 47 46 45Z",
    },
  ]);
}

/** Eagle displayed: wings raised with pointed primaries, tail fanned, talons spread, head turned to the left. */
function drawEagle(p: EmblemPaint) {
  const half =
    "M50 29L54 31C58 27 62 21 67 17L81 11" +
    // primaries fanning down the wing's outer edge
    "L85 20L80 21L86 30L80 31L84 40L78 40L79 48L73 46L71 53L65 49" +
    // flank, leg and talons, tail feathers
    "C61 52 59 55 58 58L58 63L64 64L69 70L73 69L71 73L74 76L69 75L67 78L64 73L59 70L56 71" +
    "L60 79L62 85L57 82L55 86L52 83L50 87";
  const head = "M54 32C55 25 53 18 47 17C44 17 41 18 39 21L33 23Q32 27 35 29L36 26.5L41 27C43 30 46 32 48 34Z";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: pair("M58 34Q67 30 75 24M58 40Q67 37 76 34M58 46Q64 45 72 43M53 62L54 70") + "M46 46Q50 48 54 46M46 52Q50 54 54 52M47 58Q50 60 53 58",
    },
    {
      d: head,
      dark: circle(44, 22.5, 1.4),
      lines: "M36 25L41 25.5",
      lights: "M45 18.5Q49 18.5 51 21L49.5 21.5Q48 20 45 20Z",
    },
  ]);
}

/** Dragon passant facing left, Welsh style: bat wing raised, one foreleg lifted, tail curled with a spade tip. */
function drawDragon(p: EmblemPaint) {
  const wing =
    "M46 46L50 30L57 18L62 10L64 17" +
    // bat-wing trailing edge, scalloped between the finger tips
    "Q70 16 76 12Q76 20 85 24Q79 30 86 38Q78 40 79 49Q72 46 66 50Z";
  const body =
    // head: snout, horn swept back, back of the skull
    "M13 26L19 21L27 18L40 9L33 20L38 24" +
    // neck with dorsal spines, back
    "L42 23L41 28L46 28L44 33L49 34L47 38L52 40L50 44C56 46 62 47 68 49" +
    // tail curling down to a spade
    "C80 51 86 60 82 68C80 72 76 74 74 77L77 75L88 80L77 85L76 81C70 83 66 78 70 72C73 68 74 62 68 59" +
    // hind leg
    "L70 66L66 72L68 78L72 81L60 81L61 76L59 68C54 64 48 64 42 64" +
    // standing foreleg
    "L40 70L37 75L41 81L30 81L31 75L33 68L33 62" +
    // raised foreleg, chest, throat, open jaws
    "L30 60L24 61L19 60L21 58L17 56L21 54L25 55L30 53C31 46 31 38 28 32L17 31L15 29L24 27Z";
  return art(p, [
    {
      d: wing,
      shade: "M64 17Q70 16 76 12Q76 20 85 24Q79 30 86 38Q78 40 79 49Q72 46 66 50L58 28Z",
      lines: "M64 17L58 28L52 44M58 28L85 24M58 28L86 38M58 28L79 49M58 28L66 50",
    },
    {
      d: body,
      dark: "M23 22L27 21L26 23.5Z",
      lines: "M36 50Q46 53 56 50M59 68C57 64 55 62 52 60M33 62Q35 58 38 56",
      lights: "M30 38C31 43 31 48 30 52L28.5 51.5C29.5 47 29.5 43 28.5 38.5Z",
    },
  ]);
}

function drawWolf(p: EmblemPaint) {
  const half =
    "M50 33C53 31 56 30 58 30L68 13C71 19 73 27 72 36C76 38 79 40 83 44L76 47C79 50 81 54 82 59L73 58" +
    "C71 64 67 68 62 70L57 78C56 82 53 85 50 85";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      dark: pair("M54 47L63.5 43L61 49Z") + sym("M50 75L54.5 75Q54.5 79.5 50 80.5"),
      lines: pair("M60 31L67 20L69.5 33M53 52L55 70M58 66L62 70") + "M50 81L50 84",
      lights: pair("M60.5 32L66.5 22L67.5 31Z"),
    },
  ]);
}

function drawSkull(p: EmblemPaint) {
  const t = isTiny(p);
  const half = "M50 16C65 16 76 26 76 41C76 50 72 56 68 59L68 65C68 68 65 69 62 69L62 74C62 78 58 81 54 81L50 81";
  const socket = t ? "M53 50C53 41 60 39 67 41C71 43 71 51 67 54C62 57 54 56 53 50Z" : "M54 50C54 42 60 40 66 42C70 44 70 50 66 53C62 56 55 55 54 50Z";
  const nose = "M50 58L54 66L50 64.5L46 66Z";
  const holes = pair(socket) + nose;
  return art(p, [
    {
      d: sym(half) + holes,
      shade: `${half}Z${socket}M50 58L54 66L50 64.5Z`,
      lines: "M38 69L62 69M44 69L44 78M50 69L50 80M56 69L56 78",
      lights: "M30 30C33 24 38 21 44 20L44 22C39 23 35 26 32 31Z",
    },
  ]);
}

function drawTree(p: EmblemPaint) {
  const half = "M50 16A10 10 0 0 1 66 22A10 10 0 0 1 78 36A9.5 9.5 0 0 1 76 52A9.5 9.5 0 0 1 62 60L56 60L55 62L55 72Q57 79 68 83L50 83";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: "M50 64L50 38M50 54L60 44M50 54L40 44M50 46L57 36M50 46L43 36M60 44L66 42M40 44L34 42M55 66L50 76L45 66",
      lights: circle(36, 30, 3) + circle(45, 23, 2.2),
    },
  ]);
}

function drawSun(p: EmblemPaint) {
  const c: Pt = [50, 50];
  const t = isTiny(p);
  // Tiny suns get twelve long rays; larger ones sixteen, alternating long and short.
  const n = t ? 24 : 32;
  const rays: Pt[] = [];
  let facets = "";
  for (let k = 0; k < n; k++) rays.push(polar(c, k % 2 ? (t ? 18 : 21) : t || k % 4 === 0 ? 35 : 29, (k * 360) / n));
  for (let k = 0; k < n; k += 2) facets += poly([c, rays[k], rays[(k + 1) % n]]);
  return art(p, [
    { d: poly(rays), shade: facets },
    {
      d: circle(50, 50, t ? 13 : 16),
      shade: "M50 34A16 16 0 0 1 50 66Z",
      lines: circle(50, 50, 12),
      lights: "M39 44A12 12 0 0 1 46 38L46.5 40A10 10 0 0 0 41 44.5Z",
    },
  ]);
}

function drawMoon(p: EmblemPaint) {
  // Crescent between two circles: outer centred (50, 48) radius 32, inner centred (50, 36) radius 25.
  const [R, r, d] = [32, 25, 12];
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const [yl, xl, xr] = [48 - a, 50 - h, 50 + h];
  return art(p, [
    {
      d: `M${f(xl)} ${f(yl)}A${R} ${R} 0 1 0 ${f(xr)} ${f(yl)}A${r} ${r} 0 1 1 ${f(xl)} ${f(yl)}Z`,
      shade: `M50 80A${R} ${R} 0 0 0 ${f(xr)} ${f(yl)}A${r} ${r} 0 0 1 50 61Z`,
      lights: "M24 44A28 28 0 0 0 36 72L35 74A30 30 0 0 1 22 44Z",
    },
  ]);
}

function drawStar(p: EmblemPaint) {
  const c: Pt = [50, 53];
  const inner = isTiny(p) ? 15.5 : 14;
  const pts: Pt[] = [];
  let facets = "";
  for (let k = 0; k < 10; k++) pts.push(polar(c, k % 2 ? inner : 34, k * 36));
  for (let k = 0; k < 10; k += 2) facets += poly([c, pts[k], pts[k + 1]]);
  return art(p, [{ d: poly(pts), shade: facets }]);
}

function drawCrown(p: EmblemPaint) {
  const points = "M50 24L57 49L65 32L70 49L77 28L76 62L50 62";
  const band = "M50 60L79 60Q81 60 81 62L81 74Q81 76 79 76L50 76";
  const balls: [number, number, number][] = [
    [50, 21, 4],
    [65, 29.5, 3.5],
    [77, 25.5, 3.5],
    [35, 29.5, 3.5],
    [23, 25.5, 3.5],
  ];
  return art(p, [
    { d: sym(points), shade: `${points}Z` },
    { d: balls.map(([x, y, r]) => circle(x, y, r)).join(""), lights: circle(48.8, 19.8, 1.1) },
    {
      d: sym(band),
      shade: "M19 70L81 70L81 74Q81 76 79 76L21 76Q19 76 19 74Z",
      dark: isTiny(p) ? undefined : circle(50, 68, 3),
      lines: circle(34, 68, 2.5) + circle(66, 68, 2.5),
      lights: circle(49, 67, 1),
    },
  ]);
}

function drawFlame(p: EmblemPaint) {
  const half = "M50 11C55 23 62 31 60 45C66 40 70 32 70 20C79 31 82 45 80 58C78 74 66 84 50 84";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lights: sym("M50 44C54 52 60 56 60 65C60 72 56 77 50 77"),
    },
  ]);
}

function drawAxe(p: EmblemPaint) {
  const hw = isTiny(p) ? 4.5 : 3.5;
  const haft = `M50 15L${f(50 + hw)} 16L${f(50 + hw)} 83Q${f(50 + hw)} 85 50 85`;
  const head = "M50 27L55 27C62 27 68 23 74 17C85 30 85 52 74 64C68 58 62 53 55 53L50 53";
  return art(p, [
    { d: sym(haft), shade: `${haft}Z`, lines: `M${f(50 - hw)} 64L${f(50 + hw)} 66M${f(50 - hw)} 68L${f(50 + hw)} 70` },
    {
      d: sym(head),
      shade: `${head}Z`,
      lines: pair("M72 22C80 33 80 49 72 59"),
      lights: "M26 24C21 34 21 46 25 56L27 55C24 46 24 35 28 25Z",
    },
  ]);
}

function drawHammer(p: EmblemPaint) {
  const hw = isTiny(p) ? 5 : 4;
  const handle = `M50 36L${f(50 + hw)} 36L${f(50 + hw)} 76L${f(53 + hw)} 80L${f(53 + hw)} 84L50 84`;
  const head = "M50 21L65 22L67 16L81 16L81 44L67 44L65 38L50 39";
  return art(p, [
    { d: sym(handle), shade: `${handle}Z`, lines: `M${f(50 - hw)} 60L${f(50 + hw)} 62M${f(50 - hw)} 65L${f(50 + hw)} 67M${f(50 - hw)} 70L${f(50 + hw)} 72` },
    { d: sym(head), shade: `${head}Z`, lines: "M65 22L65 38M35 22L35 38", lights: "M21 18L24 18L24 42L21 42Z" },
  ]);
}

function drawBow(p: EmblemPaint) {
  const t = isTiny(p);
  const limb = t
    ? "M60 13C31 19 21 35 21 50C21 65 31 81 60 87L62 81C40 76 31 63 31 50C31 37 40 24 62 19Z"
    : "M60 14C33 20 23 36 23 50C23 64 33 80 60 86L61.5 81.5C39 76 30.5 62 30.5 50C30.5 38 39 24 61.5 18.5Z";
  const s = t ? 2.5 : 1.6;
  const arrow = `M14 50L27 42L25 ${f(50 - s)}L70 ${f(50 - s)}L75 42L86 42L80 ${f(50 - s)}L80 ${f(50 + s)}L86 58L75 58L70 ${f(50 + s)}L25 ${f(50 + s)}L27 58Z`;
  return art(p, [
    {
      d: limb,
      shade: "M23 50C23 64 33 80 60 86L61.5 81.5C39 76 30.5 62 30.5 50Z",
      lines: "M24 47L30.5 47M24 53L30.5 53",
    },
    ...(t ? [] : [{ d: "M61 17L62 83L61 83L60 17Z" }]),
    { d: arrow, shade: `M14 50L27 58L25 ${f(50 + s)}L80 ${f(50 + s)}L80 50Z`, lines: "M75 44L79 50M79 44L83 50" },
  ]);
}

function drawAnvil(p: EmblemPaint) {
  return art(p, [
    {
      d: "M34 26L82 26L82 38C76 40 70 42 66 44C62 50 62 56 66 62L76 66L78 73L78 80L26 80L26 73L28 66L38 62C42 56 42 50 38 44C30 42 22 38 15 29C22 30 28 28 34 26Z",
      shade: "M82 26L82 38C76 40 70 42 66 44L38 44C30 42 22 38 15 29L34 34L82 34ZM26 73L78 73L78 80L26 80Z",
      lines: "M34 26L34 34M28 66L76 66",
      lights: "M36 28L78 28L78 30L36 30Z",
    },
  ]);
}

function drawBook(p: EmblemPaint) {
  const cover = "M50 32C58 27 70 25 84 27L84 78C70 76 58 78 50 83";
  const pages = "M50 29C57 23 68 21 80 22L80 73C68 72 57 74 50 79";
  return art(p, [
    { d: sym(cover), back: true },
    {
      d: sym(pages),
      shade: `${pages}Z`,
      lines: pair("M55 34C61 30 67 29 75 29M55 42C61 38 67 37 75 37M55 50C61 46 67 45 75 45M55 58C61 54 67 53 75 53") + "M50 30L50 78",
      lights: "M24 26L27 25.5L27 70L24 70.5Z",
    },
  ]);
}

function drawRaven(p: EmblemPaint) {
  const legs = "M49 68L47 78L41 81L46 81L48.5 79.5L51 83L52.5 79.5L57 81L57 79L52.5 77L54 68Z";
  const body =
    // long heavy beak, flat crown and nape
    "M12 37C18 31 24 28 30 26C34 22 42 21 48 24" +
    // back and folded wing to the long wedge tail
    "C56 28 64 36 70 46L86 74L80 74L85 80L73 76C68 73 63 71 58 71" +
    // belly and shaggy throat hackles
    "C49 71 42 66 38 58L34 56L36 53L32 51L34 48L30 46L32 43L28 41L22 39Z";
  return art(p, [
    { d: legs },
    {
      d: body,
      shade: "M48 24C56 28 64 36 70 46L86 74L80 74L85 80L73 76C68 73 63 71 58 71C60 60 58 44 50 34Z",
      dark: circle(35, 27.5, 1.6),
      lines: "M13 36.5L26 33.5M48 36C56 44 64 56 72 70M52 34C60 42 66 52 72 62",
      lights: "M38 23.5C42 22.5 46 23.5 49 26L47.5 26.5C45 25 42 24.5 38 25Z",
    },
  ]);
}

function drawFleurDeLis(p: EmblemPaint) {
  const half =
    "M50 13C56 21 61 30 60 40C59 47 56 51 55 55L57 55" +
    // side petal sweeping out and curling down to a point
    "C60 47 64 39 72 35C80 32 86 38 85 46C84 52 79 56 75 53C78 50 78 45 74 44C69 44 66 49 65 55" +
    // band, lower petal, foot
    "L68 55L68 62L60 62C62 68 66 74 72 79C64 80 58 76 55 68L50 71";
  const band = "M50 55L68 55L68 62L50 62";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: sym(band),
      lights: "M47 22C45 29 44 35 45 42L46.5 42C46 35 47 29 48.5 23Z",
    },
  ]);
}

function drawRose(p: EmblemPaint) {
  const c: Pt = [50, 50];
  const t = isTiny(p);
  let outer = "";
  let inner = "";
  let barbs = "";
  for (let k = 0; k < 5; k++) {
    const a = k * 72;
    const v = t ? 15 : 20;
    const [v0, v1] = [polar(c, v, a - 36), polar(c, v, a + 36)];
    outer += `${k === 0 ? `M${pt(v0)}` : ""}C${pt(polar(c, t ? 42 : 39, a - 30))} ${pt(polar(c, t ? 42 : 39, a + 30))} ${pt(v1)}`;
    const [w0, w1] = [polar(c, 10, a), polar(c, 10, a + 72)];
    inner += `${k === 0 ? `M${pt(w0)}` : ""}C${pt(polar(c, 23, a + 12))} ${pt(polar(c, 23, a + 60))} ${pt(w1)}`;
    barbs += poly([polar(c, 18, a + 22), polar(c, 36, a + 36), polar(c, 18, a + 50)]);
  }
  // At tiny the seeded centre becomes a hole, which keeps the bloom from reading as a plain disc.
  if (t) return art(p, [{ d: barbs }, { d: `${outer}Z${circle(50, 50, 6)}` }]);
  return art(p, [
    { d: barbs, back: true },
    { d: `${outer}Z`, lights: circle(40, 28, 2.5) },
    { d: `${inner}Z`, shade: `${inner}Z` },
    { d: circle(50, 50, 6), lights: circle(48, 48, 1.8) },
  ]);
}

function drawKeys(p: EmblemPaint) {
  const k = isTiny(p) ? 1.35 : 1;
  const w = 3 * k;
  const shaftPts: Pt[] = [
    [50 - w, 34],
    [50 + w, 34],
    [50 + w, 66],
    [63, 66],
    [63, 72],
    [58, 72],
    [58, 76],
    [63, 76],
    [63, 83],
    [50 - w, 83],
  ];
  const key = (mirror: boolean, transform: string): Layer[] => {
    const pts = mirror ? shaftPts.map(mirrorX) : shaftPts;
    return [
      { d: poly(pts), transform, shade: poly(pts.slice(1, 9).concat([[50, 83], [50, 34]])) },
      { d: circle(50, 25, 11) + circle(50, 25, isTiny(p) ? 4 : 5), transform, lights: circle(45, 20, 1.3) },
    ];
  };
  return art(p, [...key(false, "rotate(-40 50 50)"), ...key(true, "rotate(40 50 50)")]);
}

function drawChalice(p: EmblemPaint) {
  const half = "M50 17L74 17C74 33 67 44 56 48L55 57C59 57 60 63 55 64L55 70C61 72 69 76 71 84L50 84";
  return art(p, [
    {
      d: sym(half),
      shade: `${half}Z`,
      lines: "M26 17C34 23 66 23 74 17M34 80L66 80",
      lights: "M31 22C32 31 36 38 42 42L40.5 43C35 39 31 32 29.5 22.5Z",
    },
  ]);
}

function drawTower(p: EmblemPaint) {
  const t = isTiny(p);
  const half = "M50 16L54 16L54 23L60 23L60 16L69 16L69 30L65 33L65 76L71 80L71 84L50 84";
  const door = t ? "M43 84L43 69A7 7 0 0 1 57 69L57 84Z" : "M44 80L44 70A6 6 0 0 1 56 70L56 80Z";
  const slit = t ? "" : "M47.5 46L47.5 40A2.5 2.5 0 0 1 52.5 40L52.5 46Z";
  return art(p, [
    {
      d: sym(half) + door + slit,
      shade: `${half}Z${t ? "" : "M50 80L50 64A6 6 0 0 1 56 70L56 80ZM50 46L50 37.5A2.5 2.5 0 0 1 52.5 40L52.5 46Z"}`,
      lines: "M31 30L69 30M35 44L44 44M56 44L65 44M35 58L65 58M42 58L42 64M58 58L58 64",
      lights: "M37 34L39 34L39 74L37 74Z",
    },
  ]);
}

/* ------------------------------------------------------------------------------------------------------------ */

export const EMBLEMS: EmblemDef[] = [
  { id: "cross-pattee", name: "Cross Pattee", tags: ["cross", "templar", "crusader", "holy", "order"], draw: drawCrossPattee },
  { id: "cross", name: "Cross", tags: ["latin", "holy", "church", "faith", "priest"], draw: drawCross },
  { id: "cross-fleury", name: "Cross Fleury", tags: ["cross", "fleur", "holy", "ornate"], draw: drawCrossFleury },
  { id: "celtic-cross", name: "Celtic Cross", tags: ["cross", "ring", "druid", "ancient"], draw: drawCelticCross },
  { id: "sword", name: "Sword", tags: ["blade", "warrior", "weapon", "knight"], draw: drawSword },
  { id: "crossed-swords", name: "Crossed Swords", tags: ["blades", "battle", "war", "pvp", "weapon"], draw: drawCrossedSwords },
  { id: "shield", name: "Shield", tags: ["defense", "tank", "protection", "heater"], draw: drawShield },
  { id: "lion", name: "Lion", tags: ["rampant", "beast", "alliance", "king", "courage"], draw: drawLion },
  { id: "eagle", name: "Eagle", tags: ["bird", "displayed", "wings", "empire"], draw: drawEagle },
  { id: "dragon", name: "Dragon", tags: ["wyrm", "wyvern", "beast", "fire", "flight"], draw: drawDragon },
  { id: "wolf", name: "Wolf", tags: ["head", "beast", "pack", "horde", "hunter"], draw: drawWolf },
  { id: "skull", name: "Skull", tags: ["death", "undead", "bone", "forsaken", "scourge"], draw: drawSkull },
  { id: "tree", name: "Tree", tags: ["oak", "nature", "druid", "life", "forest"], draw: drawTree },
  { id: "sun", name: "Sun", tags: ["light", "splendour", "radiant", "paladin", "dawn"], draw: drawSun },
  { id: "moon", name: "Moon", tags: ["crescent", "night", "elune", "lunar"], draw: drawMoon },
  { id: "star", name: "Star", tags: ["mullet", "celestial", "guide"], draw: drawStar },
  { id: "crown", name: "Crown", tags: ["king", "royal", "regal", "noble"], draw: drawCrown },
  { id: "flame", name: "Flame", tags: ["fire", "burning", "mage", "inferno"], draw: drawFlame },
  { id: "axe", name: "Axe", tags: ["battle axe", "double", "weapon", "orc", "warrior"], draw: drawAxe },
  { id: "hammer", name: "Hammer", tags: ["warhammer", "maul", "weapon", "dwarf", "smith"], draw: drawHammer },
  { id: "bow", name: "Bow", tags: ["arrow", "archer", "hunter", "ranger"], draw: drawBow },
  { id: "anvil", name: "Anvil", tags: ["smith", "forge", "craft", "dwarf"], draw: drawAnvil },
  { id: "book", name: "Book", tags: ["tome", "lore", "scholar", "mage", "knowledge"], draw: drawBook },
  { id: "raven", name: "Raven", tags: ["crow", "bird", "omen", "shadow"], draw: drawRaven },
  { id: "fleur-de-lis", name: "Fleur-de-lis", tags: ["lily", "french", "royal", "flower"], draw: drawFleurDeLis },
  { id: "rose", name: "Rose", tags: ["flower", "tudor", "love", "bloom"], draw: drawRose },
  { id: "keys", name: "Crossed Keys", tags: ["key", "saint peter", "treasury", "vault"], draw: drawKeys },
  { id: "chalice", name: "Chalice", tags: ["grail", "cup", "holy", "priest"], draw: drawChalice },
  { id: "tower", name: "Tower", tags: ["castle", "keep", "fortress", "stronghold"], draw: drawTower },
  { id: "griffin", name: "Griffin", tags: ["gryphon", "segreant", "beast", "wings", "alliance"], draw: drawGriffin },
];

export const EMBLEM_IDS: readonly string[] = EMBLEMS.map((e) => e.id);

export function emblemById(id: string): EmblemDef | undefined {
  return EMBLEMS.find((e) => e.id === id);
}
