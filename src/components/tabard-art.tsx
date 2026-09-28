import type { ReactNode } from "react";
import type { BorderStyle, TabardConfig } from "@/lib/tabard/config";
import { shiftLightness } from "@/lib/tabard/color";
import { emblemSrc } from "@/lib/tabard/crest";
import { crestToneTables } from "@/lib/tabard/crest-tone";
import type { TabardDetail } from "@/lib/tabard/emblem-types";
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
  };
}
type Colors = ReturnType<typeof tabardColors>;

/** Banner box and field inset per detail level, matching the Order's crest. */
const LAYOUT: Record<TabardDetail, { box: [number, number, number, number, number]; inset: number; outer: number; inner: number }> = {
  full: { box: [15, 15, 85, 116, 20], inset: 5, outer: 1.6, inner: 1 },
  mark: { box: [9, 3, 91, 117, 22], inset: 8, outer: 2.2, inner: 1.6 },
  tiny: { box: [8, 2, 92, 118, 24], inset: 10, outer: 3, inner: 2.4 },
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

/**
 * How Blizzard's emblem mask is tinted. In the browser each crest defines its own `CrestToneFilter` (`filter`, the id
 * prefixed per instance, see TabardCrest); the server and scripts pass the emblem already tinted as a data URI
 * (`tinted`), since icons, `icon.svg` and link previews can't load or filter external images. `bare` leaves the
 * emblem out, for satori, which lays the emblem over the banner itself.
 */
export type CrestImages = { mode: "filter"; prefix: string } | { mode: "tinted"; emblem: string } | { mode: "bare" };

type Rect = [x: number, y: number, w: number, h: number];

/** Where Blizzard's 125 by 125 emblem box lands on the field per detail. */
const CREST_EMBLEM: Record<TabardDetail, Rect> = { full: [20, 25, 60, 60], mark: [14, 16, 72, 72], tiny: [10, 10, 80, 80] };

/**
 * Tints Blizzard's levels-stretched emblem mask with `hex` on the shared tone curve (lib/tabard/crest-tone.ts): a
 * mask's R, G and B are equal, so each output channel is a table lookup on the gray. Alpha passes through.
 */
export function CrestToneFilter({ id, hex }: { id: string; hex: string }) {
  const [r, g, b] = crestToneTables(hex);
  return (
    <filter id={id} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
      <feComponentTransfer>
        <feFuncR type="table" tableValues={r} />
        <feFuncG type="table" tableValues={g} />
        <feFuncB type="table" tableValues={b} />
      </feComponentTransfer>
    </filter>
  );
}

/** The emblem's tint filter; render once per SVG, outside the detail groups. */
export function CrestDefs({ tabard, prefix }: { tabard: TabardConfig; prefix: string }) {
  return (
    <defs>
      <CrestToneFilter id={`${prefix}-emblem`} hex={tabardColors(tabard).emblem} />
    </defs>
  );
}

/** Without an explicit `images`, crests use a filter with this fixed prefix (one crest per SVG). */
const DEFAULT_IMAGES: CrestImages = { mode: "filter", prefix: "tabard" };

/**
 * Where the emblem goes at one detail in the 100 by 120 viewBox. Satori can't draw an image nested in an SVG image, so
 * link previews and icons lay it over the banner as a separate layer.
 */
export const emblemRect = (detail: TabardDetail): Rect => CREST_EMBLEM[detail];

function Emblem({ tabard, detail, images = DEFAULT_IMAGES }: { tabard: TabardConfig; detail: TabardDetail; images?: CrestImages }) {
  if (images.mode === "bare") return null;
  const [x, y, width, height] = emblemRect(detail).map(f);
  if (images.mode === "tinted") return <image href={images.emblem} x={x} y={y} width={width} height={height} preserveAspectRatio="none" />;
  return (
    <image
      href={emblemSrc(tabard.emblemId)}
      x={x}
      y={y}
      width={width}
      height={height}
      preserveAspectRatio="none"
      filter={`url(#${images.prefix}-emblem)`}
    />
  );
}

type DetailProps = { tabard: TabardConfig; c: Colors; images?: CrestImages };

function Full({ tabard, c, images }: DetailProps) {
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
      <Emblem tabard={tabard} detail="full" images={images} />
    </g>
  );
}

function Mark({ tabard, c, images }: DetailProps) {
  const [x1, y1, x2, y2, notch] = LAYOUT.mark.box;
  const inset = borderInset(tabard.borderStyle, "mark");
  const [, b, cc, n] = insetBannerPoints(x1, y1, x2, y2, notch, inset) as [Pt, Pt, Pt, Pt, Pt];
  return (
    <g data-detail="mark">
      <path d={banner(x1, y1, x2, y2, notch)} fill={c.border} stroke={OUTLINE} strokeWidth={LAYOUT.mark.outer} />
      <BorderOrnament style={tabard.borderStyle} detail="mark" c={c} inset={inset} />
      <path d={insetBanner(x1, y1, x2, y2, notch, inset)} fill={c.field} stroke={OUTLINE} strokeWidth={LAYOUT.mark.inner} />
      <path d={`M${pt([b[0] - 7, b[1]])}L${pt(b)}L${pt(cc)}L${pt([b[0] - 7, cc[1] - ((cc[1] - n[1]) * 7) / (cc[0] - n[0])])}Z`} fill="#000" opacity={0.16} />
      <Emblem tabard={tabard} detail="mark" images={images} />
    </g>
  );
}

function Tiny({ tabard, c, images }: DetailProps) {
  const [x1, y1, x2, y2, notch] = LAYOUT.tiny.box;
  const inset = borderInset(tabard.borderStyle, "tiny");
  return (
    <g data-detail="tiny">
      <path d={banner(x1, y1, x2, y2, notch)} fill={c.border} stroke={OUTLINE} strokeWidth={LAYOUT.tiny.outer} />
      <path d={insetBanner(x1, y1, x2, y2, notch, inset)} fill={c.field} stroke={OUTLINE} strokeWidth={LAYOUT.tiny.inner} />
      <Emblem tabard={tabard} detail="tiny" images={images} />
    </g>
  );
}

export const DETAILS = { full: Full, mark: Mark, tiny: Tiny } as const;

/** Which detail the crest shows at a rendered width, matching the `.crest` container queries in globals.css. */
export const detailForWidth = (width: number): TabardDetail => (width >= 64 ? "full" : width > 20 ? "mark" : "tiny");

/**
 * One detail level as a standalone SVG document (icons, previews and the brand routes). Pass `images`: the tinted
 * emblem on the server, or a filter prefix unique on the page.
 */
export function TabardArt({
  tabard,
  detail,
  width,
  height,
  images,
  children,
}: {
  tabard: TabardConfig;
  detail: TabardDetail;
  width?: number;
  height?: number;
  images?: CrestImages;
  children?: ReactNode;
}) {
  const Detail = DETAILS[detail];
  const art = images ?? DEFAULT_IMAGES;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width={width} height={height}>
      {children}
      {art.mode === "filter" && <CrestDefs tabard={tabard} prefix={art.prefix} />}
      <Detail tabard={tabard} c={tabardColors(tabard)} images={images} />
    </svg>
  );
}
