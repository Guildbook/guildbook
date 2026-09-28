import clsx from "clsx";
import type { ReactNode } from "react";
import type { BorderStyle, TabardConfig } from "@/lib/tabard/config";
import { shiftLightness } from "@/lib/tabard/color";
import type { EmblemPaint, TabardDetail } from "@/lib/tabard/emblem-types";
import { emblemById, EMBLEMS } from "@/lib/tabard/emblems";
import { alongPolyline, banner, f, insetBanner, insetBannerPoints, type Pt, pt } from "@/lib/tabard/geometry";
import { swatchOf } from "@/lib/tabard/palette";

const OUTLINE = "#1a0b0d";

/**
 * The tabard's colours, derived from its palette swatches. Everything is a plain fill (no gradients or `<defs>`),
 * so any number of different crests can share a page without id collisions.
 */
export function tabardColors(t: TabardConfig) {
  const field = swatchOf("background", t.background).hex;
  const border = swatchOf("border", t.border).hex;
  const emblem = swatchOf("emblem", t.emblemColor).hex;
  return {
    field,
    fieldShade: shiftLightness(field, -0.14),
    border,
    borderLight: shiftLightness(border, 0.16),
    borderShade: shiftLightness(border, -0.2),
    emblem,
    emblemLight: shiftLightness(emblem, 0.16),
    emblemShade: shiftLightness(emblem, -0.22),
  };
}
type Colors = ReturnType<typeof tabardColors>;

/** Banner box and field inset per detail level, matching the Order's crest. */
const LAYOUT: Record<TabardDetail, { box: [number, number, number, number, number]; inset: number; outer: number; inner: number }> = {
  full: { box: [15, 15, 85, 116, 20], inset: 5, outer: 1.6, inner: 1 },
  mark: { box: [9, 3, 91, 117, 22], inset: 8, outer: 2.2, inner: 1.6 },
  tiny: { box: [8, 2, 92, 118, 24], inset: 10, outer: 3, inner: 2.4 },
};

/** Where the emblem's 100 by 100 box lands on the field, and its outline weight in that box. */
const EMBLEM_PLACEMENT: Record<TabardDetail, { transform: string; sw: number }> = {
  full: { transform: "translate(10 15) scale(0.8)", sw: 1.75 },
  mark: { transform: "translate(5 5) scale(0.9)", sw: 2.2 },
  tiny: { transform: "translate(3 2) scale(0.94)", sw: 3 },
};

function borderInset(style: BorderStyle, detail: TabardDetail) {
  const base = LAYOUT[detail].inset;
  if (style === "wide") return base + 3;
  return style === "studded" && detail === "full" ? base + 1 : base;
}

/** The border band's ornament between the banner edge and the field. */
function BorderOrnament({ style, detail, c, inset }: { style: BorderStyle; detail: TabardDetail; c: Colors; inset: number }) {
  const [x1, y1, x2, y2, notch] = LAYOUT[detail].box;
  if (detail === "tiny") return null;
  const mid = inset / 2;
  if (style === "double") {
    return <path d={insetBanner(x1, y1, x2, y2, notch, mid)} fill="none" stroke={OUTLINE} strokeWidth={detail === "full" ? 0.9 : 1.4} />;
  }
  if (style === "stitched" && detail === "full") {
    return (
      <path d={insetBanner(x1, y1, x2, y2, notch, mid)} fill="none" stroke={c.borderShade} strokeWidth={0.8} strokeDasharray="2.4 1.6" />
    );
  }
  if (style === "studded") {
    const corners = insetBannerPoints(x1, y1, x2, y2, notch, mid);
    const studs = alongPolyline(corners, detail === "full" ? 30 : 14);
    const r = detail === "full" ? 1.35 : 2;
    return (
      <g>
        {studs.map(([x, y], i) => (
          <circle key={i} cx={f(x)} cy={f(y)} r={r} fill={c.borderLight} stroke={OUTLINE} strokeWidth={detail === "full" ? 0.45 : 0.7} />
        ))}
      </g>
    );
  }
  return null;
}

/** Left and right fold shadows inside the field, stepped instead of a gradient. */
function FoldShade({ corners }: { corners: Pt[] }) {
  const [a, b, c, n, d] = corners as [Pt, Pt, Pt, Pt, Pt];
  const footY = (x: number, from: Pt) => from[1] + ((n[1] - from[1]) / (n[0] - from[0])) * (x - from[0]);
  const band = (x0: number, x1: number, from: Pt): string => {
    const pts: Pt[] = [[x0, a[1]], [x1, a[1]], [x1, footY(x1, from)], [x0, footY(x0, from)]];
    return `M${pts.map(pt).join("L")}Z`;
  };
  return (
    <g>
      <path d={band(a[0], a[0] + 3, d)} fill="#000" opacity={0.18} />
      <path d={band(a[0] + 3, a[0] + 8, d)} fill="#000" opacity={0.08} />
      <path d={band(b[0] - 3, b[0], c)} fill="#000" opacity={0.22} />
      <path d={band(b[0] - 9, b[0] - 3, c)} fill="#000" opacity={0.1} />
    </g>
  );
}

function Emblem({ tabard, detail, c }: { tabard: TabardConfig; detail: TabardDetail; c: Colors }) {
  const emblem = emblemById(tabard.emblem) ?? EMBLEMS[0]!;
  const place = EMBLEM_PLACEMENT[detail];
  const paint: EmblemPaint = { fill: c.emblem, light: c.emblemLight, shade: c.emblemShade, outline: OUTLINE, sw: place.sw, detail };
  return <g transform={place.transform}>{emblem.draw(paint)}</g>;
}

function Full({ tabard, c }: { tabard: TabardConfig; c: Colors }) {
  const [x1, y1, x2, y2, notch] = LAYOUT.full.box;
  const inset = borderInset(tabard.borderStyle, "full");
  const corners = insetBannerPoints(x1, y1, x2, y2, notch, inset);
  const ruled = tabard.borderStyle === "plain" || tabard.borderStyle === "wide";
  return (
    <g data-detail="full">
      <path d="M8 6.2 H92 A2.8 2.8 0 0 1 92 11.8 H8 A2.8 2.8 0 0 1 8 6.2 Z" fill={c.border} stroke={OUTLINE} strokeWidth={1.1} />
      <path d="M9 7.4 H91" stroke={c.borderLight} strokeWidth={0.9} strokeLinecap="round" opacity={0.8} />
      {[4.5, 95.5].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={9} r={4.2} fill={c.border} stroke={OUTLINE} strokeWidth={1.1} />
          <circle cx={cx - 1.2} cy={7.8} r={1.2} fill={c.borderLight} opacity={0.8} />
        </g>
      ))}
      {[26, 50, 74].map((cx) => (
        <rect key={cx} x={cx - 4} y={4.5} width={8} height={13} rx={1.5} fill={c.fieldShade} stroke={OUTLINE} strokeWidth={1} />
      ))}

      <path d={banner(x1, y1, x2, y2, notch)} fill={c.border} stroke={OUTLINE} strokeWidth={LAYOUT.full.outer} strokeLinejoin="miter" />
      <path d={`M${x1 + 1.2} ${y1 + 1.2}H${x2 - 1.2}`} stroke={c.borderLight} strokeWidth={1} opacity={0.7} />
      <BorderOrnament style={tabard.borderStyle} detail="full" c={c} inset={inset} />
      <path d={insetBanner(x1, y1, x2, y2, notch, inset)} fill={c.field} stroke={OUTLINE} strokeWidth={LAYOUT.full.inner} />
      <FoldShade corners={corners} />
      {ruled && <path d={insetBanner(x1, y1, x2, y2, notch, inset + 3)} fill="none" stroke={c.borderLight} strokeWidth={0.8} opacity={0.7} />}
      <path
        d={`M${x1 + inset} ${y1 + inset}H${x2 - inset}V${y1 + inset + 7}C${x2 - 25} ${y1 + inset + 3} ${x1 + 25} ${y1 + inset + 3} ${x1 + inset} ${y1 + inset + 7}Z`}
        fill="#fff"
        opacity={0.08}
      />
      <Emblem tabard={tabard} detail="full" c={c} />
    </g>
  );
}

function Mark({ tabard, c }: { tabard: TabardConfig; c: Colors }) {
  const [x1, y1, x2, y2, notch] = LAYOUT.mark.box;
  const inset = borderInset(tabard.borderStyle, "mark");
  const [, b, cc, n] = insetBannerPoints(x1, y1, x2, y2, notch, inset) as [Pt, Pt, Pt, Pt, Pt];
  return (
    <g data-detail="mark">
      <path d={banner(x1, y1, x2, y2, notch)} fill={c.border} stroke={OUTLINE} strokeWidth={LAYOUT.mark.outer} />
      <BorderOrnament style={tabard.borderStyle} detail="mark" c={c} inset={inset} />
      <path d={insetBanner(x1, y1, x2, y2, notch, inset)} fill={c.field} stroke={OUTLINE} strokeWidth={LAYOUT.mark.inner} />
      <path d={`M${pt([b[0] - 7, b[1]])}L${pt(b)}L${pt(cc)}L${pt([b[0] - 7, cc[1] - ((cc[1] - n[1]) * 7) / (cc[0] - n[0])])}Z`} fill="#000" opacity={0.16} />
      <Emblem tabard={tabard} detail="mark" c={c} />
    </g>
  );
}

function Tiny({ tabard, c }: { tabard: TabardConfig; c: Colors }) {
  const [x1, y1, x2, y2, notch] = LAYOUT.tiny.box;
  const inset = borderInset(tabard.borderStyle, "tiny");
  return (
    <g data-detail="tiny">
      <path d={banner(x1, y1, x2, y2, notch)} fill={c.border} stroke={OUTLINE} strokeWidth={LAYOUT.tiny.outer} />
      <path d={insetBanner(x1, y1, x2, y2, notch, inset)} fill={c.field} stroke={OUTLINE} strokeWidth={LAYOUT.tiny.inner} />
      <Emblem tabard={tabard} detail="tiny" c={c} />
    </g>
  );
}

const DETAILS = { full: Full, mark: Mark, tiny: Tiny } as const;

/** Which detail the crest shows at a rendered width, matching the `.crest` container queries in globals.css. */
export const detailForWidth = (width: number): TabardDetail => (width >= 64 ? "full" : width > 20 ? "mark" : "tiny");

/** One detail level as a standalone SVG document (icons, previews and the brand routes). */
export function TabardArt({
  tabard,
  detail,
  width,
  height,
  children,
}: {
  tabard: TabardConfig;
  detail: TabardDetail;
  width?: number;
  height?: number;
  children?: ReactNode;
}) {
  const Detail = DETAILS[detail];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={width} height={height}>
      {children}
      <Detail tabard={tabard} c={tabardColors(tabard)} />
    </svg>
  );
}

/**
 * A guild's tabard crest. All three detail levels share one SVG and the box's rendered width picks one
 * (see `.crest` in globals.css), exactly like the Order's crest.
 */
export function TabardCrest({ tabard, label, className = "h-24 w-20" }: { tabard: TabardConfig; label: string; className?: string }) {
  const c = tabardColors(tabard);
  return (
    <span className={clsx("crest", className)}>
      <svg viewBox="0 0 100 120" role="img" aria-label={label}>
        <Tiny tabard={tabard} c={c} />
        <Mark tabard={tabard} c={c} />
        <Full tabard={tabard} c={c} />
      </svg>
    </span>
  );
}
