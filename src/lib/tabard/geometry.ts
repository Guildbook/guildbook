/**
 * Path helpers for tabard art. Every computed coordinate goes through `f` (two decimals) so server and client
 * render byte-identical markup.
 */
export type Pt = [number, number];

export const f = (n: number) => (Math.abs(n) < 0.005 ? "0" : n.toFixed(2));
export const pt = ([x, y]: Pt) => `${f(x)} ${f(y)}`;

/** Rotates an upward-pointing shape about `c` by quarter turns. */
export const turn =
  (c: Pt, q: number) =>
  ([x, y]: Pt): Pt => {
    const [cos, sin] = [[1, 0], [0, 1], [-1, 0], [0, -1]][q];
    return [c[0] + x * cos - y * sin, c[1] + x * sin + y * cos];
  };

/** Rotates `p` about `c` by `deg` degrees (clockwise in SVG's y-down space). */
export function rotate(c: Pt, deg: number, [x, y]: Pt): Pt {
  const a = (deg * Math.PI) / 180;
  const [dx, dy] = [x - c[0], y - c[1]];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The point `r` from `c` at `deg` degrees, measured clockwise from straight up. */
export function polar(c: Pt, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [c[0] + r * Math.sin(a), c[1] - r * Math.cos(a)];
}

/** A closed polygon path through `points`. */
export const poly = (points: Pt[]) => `M${points.map(pt).join("L")}Z`;

/**
 * A cross pattee: arms flare along concave curves from a square waist (`waist` half-width) to straight ends
 * `r` from the center and `end` half-width, like the in-game premade cross emblem.
 */
export function crossPattee(c: Pt, r: number, waist: number, end: number) {
  let d = "";
  for (let q = 0; q < 4; q++) {
    const m = turn(c, q);
    const start = m([-waist, -waist]);
    d +=
      (q === 0 ? `M${pt(start)}` : `L${pt(start)}`) +
      `C${pt(m([-waist * 1.05, -r * 0.62]))} ${pt(m([-end * 0.8, -r * 0.9]))} ${pt(m([-end, -r]))}` +
      `L${pt(m([end, -r]))}` +
      `C${pt(m([end * 0.8, -r * 0.9]))} ${pt(m([waist * 1.05, -r * 0.62]))} ${pt(m([waist, -waist]))}`;
  }
  return `${d}Z`;
}

/** A banner with a swallowtail foot: `notch` is how far the notch rises above the tail tips. */
export function banner(x1: number, y1: number, x2: number, y2: number, notch: number) {
  const mid = (x1 + x2) / 2;
  return `M${f(x1)} ${f(y1)}H${f(x2)}V${f(y2)}L${f(mid)} ${f(y2 - notch)}L${f(x1)} ${f(y2)}Z`;
}

/** The corners of a banner inset by `k` on every side (the slanted foot edges move perpendicular to themselves). */
export function insetBannerPoints(x1: number, y1: number, x2: number, y2: number, notch: number, k: number): Pt[] {
  const half = (x2 - x1) / 2;
  const slope = notch / half;
  const drop = k * Math.hypot(1, slope);
  const [ix1, ix2] = [x1 + k, x2 - k];
  const tip = y2 - drop - slope * k;
  const notchY = y2 - notch - drop;
  return [[ix1, y1 + k], [ix2, y1 + k], [ix2, tip], [(x1 + x2) / 2, notchY], [ix1, tip]];
}

export function insetBanner(x1: number, y1: number, x2: number, y2: number, notch: number, k: number) {
  return poly(insetBannerPoints(x1, y1, x2, y2, notch, k));
}

/** `count` points evenly spaced along a closed polyline, starting at its first corner. */
export function alongPolyline(points: Pt[], count: number): Pt[] {
  const segs = points.map((p, i) => [p, points[(i + 1) % points.length]!] as const);
  const lengths = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  const total = lengths.reduce((s, l) => s + l, 0);
  const out: Pt[] = [];
  for (let i = 0; i < count; i++) {
    let d = (i * total) / count;
    let s = 0;
    while (d > lengths[s]!) d -= lengths[s++]!;
    const [a, b] = segs[s]!;
    const t = lengths[s] ? d / lengths[s]! : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

/** The shaded half of each cross pattee arm (right of its centerline), for a struck-metal bevel. */
export function crossFacets(c: Pt, r: number, waist: number, end: number) {
  let d = "";
  for (let q = 0; q < 4; q++) {
    const m = turn(c, q);
    d +=
      `M${pt(c)}L${pt(m([0, -r]))}L${pt(m([end, -r]))}` +
      `C${pt(m([end * 0.8, -r * 0.9]))} ${pt(m([waist * 1.05, -r * 0.62]))} ${pt(m([waist, -waist]))}Z`;
  }
  return d;
}
