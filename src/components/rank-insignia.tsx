"use client";

// Must stay a client component: server `useId` values restart with each RSC request, so a page rendered on
// navigation can reuse the gradient IDs of the header's hidden insignia and paint nothing.
import { type ReactNode, useId } from "react";
import type { RankTier } from "@/lib/authz/tiers";
import { type Insignia, INSIGNIA_INFO } from "@/lib/insignia";

type Metal = "gold" | "silver" | "bronze" | "parchment";

const METAL_STOPS: Record<Metal, [number, string][]> = {
  gold: [[0, "#fff1b8"], [0.35, "#e6c46a"], [0.7, "#b8902f"], [1, "#7a5a18"]],
  silver: [[0, "#ffffff"], [0.35, "#d9dde3"], [0.7, "#9aa1ab"], [1, "#5d636c"]],
  bronze: [[0, "#f7cfa0"], [0.35, "#cf9058"], [0.7, "#9a5f2e"], [1, "#5e3718"]],
  parchment: [[0, "#fbf3dc"], [0.4, "#e3d3a8"], [0.75, "#b7a275"], [1, "#7d6c48"]],
};

/** Metal reads seniority at a glance: gold for admins down to parchment for applicants. */
const TIER_STYLE: Record<RankTier, { rim: Metal; emblem: Metal; field: "crimson" | "ink" }> = {
  admin: { rim: "gold", emblem: "gold", field: "crimson" },
  officer: { rim: "gold", emblem: "silver", field: "crimson" },
  raider: { rim: "silver", emblem: "silver", field: "crimson" },
  member: { rim: "bronze", emblem: "bronze", field: "ink" },
  applicant: { rim: "parchment", emblem: "parchment", field: "ink" },
};

const SHIELD = "M12 17 L40 11 L68 17 V42 C68 59 56 70 40 77 C24 70 12 59 12 42 Z";
const SHIELD_INNER = "M16.5 20.3 L40 15.3 L63.5 20.3 V42 C63.5 56.6 53.3 66.3 40 72.3 C26.7 66.3 16.5 56.6 16.5 42 Z";
const SHADE = "rgb(0 0 0 / 0.32)";

/** A tapered feather from `root` to `tip`, `w` wide at its widest point. */
function feather([rx, ry]: [number, number], [tx, ty]: [number, number], w: number) {
  const dx = tx - rx;
  const dy = ty - ry;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const mx = rx + dx * 0.45;
  const my = ry + dy * 0.45;
  const f = (n: number) => n.toFixed(2);
  return `M${f(rx)} ${f(ry)} Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)} Q${f(mx - nx)} ${f(my - ny)} ${f(rx)} ${f(ry)} Z`;
}

const LEFT_WING: [[number, number], [number, number]][] = [
  [[20, 22], [2, 12]],
  [[19, 28], [0, 24]],
  [[18, 34], [1, 36]],
  [[18, 40], [4, 47]],
  [[19, 46], [9, 57]],
];

/** Leaves along the left laurel branch, a quadratic curve rising from the base of the sword. */
const LAUREL_STEM = { p0: [36, 64], c: [21, 47], p2: [28, 22] } as const;
const LAUREL_LEAVES = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87, 0.99].flatMap((t, i) => {
  const { p0, c, p2 } = LAUREL_STEM;
  const at = (k: 0 | 1) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * c[k] + t ** 2 * p2[k];
  const d = (k: 0 | 1) => 2 * (1 - t) * (c[k] - p0[k]) + 2 * t * (p2[k] - c[k]);
  const len = Math.hypot(d(0), d(1));
  const [tx, ty] = [d(0) / len, d(1) / len];
  const leaf = (side: 1 | -1, offset: number, ry: number) => {
    const [nx, ny] = [ty * side, -tx * side];
    const [dx, dy] = [tx + nx * 0.7, ty + ny * 0.7];
    return {
      cx: (at(0) + nx * offset).toFixed(2),
      cy: (at(1) + ny * offset).toFixed(2),
      ry,
      deg: ((Math.atan2(-dx, dy) * 180) / Math.PI).toFixed(1),
      outer: side === 1,
    };
  };
  return i % 2 === 1 && t < 0.95 ? [leaf(1, 3.2, 4.6), leaf(-1, 2.6, 3.8)] : [leaf(1, 3.2, 4.6)];
});

/** A ring as a single even-odd path so it takes the metal fill and a dark outline. */
function ring(cx: number, cy: number, outer: number, inner: number) {
  const circle = (r: number, sweep: 0 | 1) =>
    `M${cx - r} ${cy}a${r} ${r} 0 1 ${sweep} ${2 * r} 0a${r} ${r} 0 1 ${sweep} ${-2 * r} 0Z`;
  return circle(outer, 0) + circle(inner, 1);
}

function Glory({ cx, cy, from, to, count, fill }: { cx: number; cy: number; from: number; to: number; count: number; fill: string }) {
  return (
    <g stroke={fill} strokeWidth={0.8} opacity={0.4}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.PI / count;
        return (
          <line
            key={i}
            x1={(cx + Math.cos(a) * from).toFixed(2)}
            y1={(cy + Math.sin(a) * from).toFixed(2)}
            x2={(cx + Math.cos(a) * to).toFixed(2)}
            y2={(cy + Math.sin(a) * to).toFixed(2)}
          />
        );
      })}
    </g>
  );
}

function Sword() {
  return (
    <>
      <path d="M40 21 L43 26 V50 H37 V26 Z" />
      <path d="M40 27 V48" stroke={SHADE} strokeWidth={0.9} fill="none" />
      <path d="M29 50 H51 A2 2 0 0 1 51 54 H29 A2 2 0 0 1 29 50 Z" />
      <rect x={38.3} y={54} width={3.4} height={8} rx={0.8} />
      <circle cx={40} cy={64.5} r={2.8} />
    </>
  );
}

/**
 * `fill` is the emblem metal; `accent` is the rim metal, used for secondary charges on senior ranks.
 * `small` drops hairline detail and thickens strokes so the emblem survives 16px.
 */
function Emblem({ insignia, fill, accent, small }: { insignia: Insignia; fill: string; accent: string; small: boolean }): ReactNode {
  switch (insignia) {
    case "archangel":
      return (
        <>
          <g stroke={fill} strokeWidth={0.8} opacity={0.35}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={(40 + Math.cos(a) * 9).toFixed(2)}
                  y1={(36 + Math.sin(a) * 9).toFixed(2)}
                  x2={(40 + Math.cos(a) * 19).toFixed(2)}
                  y2={(36 + Math.sin(a) * 19).toFixed(2)}
                />
              );
            })}
          </g>
          <Sword />
        </>
      );
    case "keys": {
      // Heraldic crossed keys: bows low, wards high and turned outward, leaving room for the cross.
      const key = small ? (
        <>
          <path d={ring(40, 63, 7.2, 2.6)} fillRule="evenodd" />
          <rect x={37.6} y={23} width={4.8} height={35} />
          <rect x={42.4} y={23} width={7.6} height={9.5} />
        </>
      ) : (
        <>
          <path d={ring(40, 63, 6.2, 2.8)} fillRule="evenodd" />
          <rect x={38.2} y={23} width={3.6} height={34.5} rx={0.6} />
          <path d="M41.8 23 H49 V26.2 H46 V28.3 H49 V32.6 H41.8 Z" />
          <rect x={36} y={54.5} width={8} height={2.6} rx={0.8} />
          <path d="M40 25 V53" stroke={SHADE} strokeWidth={0.8} fill="none" />
        </>
      );
      return (
        <>
          {!small && <Glory cx={40} cy={25} from={7} to={11.5} count={8} fill={accent} />}
          <g transform="rotate(32 40 45)">{key}</g>
          <g transform="translate(80 0) scale(-1 1) rotate(32 40 45)">{key}</g>
          <path
            d={small ? "M37.6 15.5h4.8v4.2h4.4v4.8h-4.4v8h-4.8v-8h-4.4v-4.8h4.4z" : "M38.3 16.5h3.4v4.2h4.2v3.4h-4.2v8.4h-3.4v-8.4h-4.2v-3.4h4.2z"}
            fill={accent}
          />
        </>
      );
    }
    case "banner":
      // A gonfalon in the rim's metal hangs from its crossbar with the sword driven through it.
      return (
        <>
          <rect x={25.5} y={24} width={29} height={2.6} rx={1.2} fill={accent} />
          <path d="M28 26.6 H52 V43 L46 39.2 L40 43 L34 39.2 L28 43 Z" fill={accent} />
          {!small && <path d="M34 28.5 V38.5 M46 28.5 V38.5" stroke={SHADE} strokeWidth={0.8} fill="none" />}
          <Sword />
        </>
      );
    case "laurel": {
      const branch = (
        <g fill={accent}>
          <path
            d={`M${LAUREL_STEM.p0.join(" ")} Q${LAUREL_STEM.c.join(" ")} ${LAUREL_STEM.p2.join(" ")}`}
            fill="none"
            stroke={accent}
            strokeWidth={small ? 2.6 : 1.6}
          />
          {LAUREL_LEAVES.filter((l) => !small || l.outer).map((l) => (
            <ellipse
              key={`${l.cx}-${l.cy}`}
              cx={l.cx}
              cy={l.cy}
              rx={small ? 2.8 : 2.1}
              ry={small ? l.ry + 0.8 : l.ry}
              transform={`rotate(${l.deg} ${l.cx} ${l.cy})`}
            />
          ))}
        </g>
      );
      return (
        <>
          {branch}
          <g transform="translate(80 0) scale(-1 1)">{branch}</g>
          <Sword />
        </>
      );
    }
    case "chalice":
      return (
        <>
          <g stroke={fill} strokeWidth={0.7} opacity={0.4}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
              return (
                <line
                  key={i}
                  x1={(40 + Math.cos(a) * 8.5).toFixed(2)}
                  y1={(26 + Math.sin(a) * 8.5).toFixed(2)}
                  x2={(40 + Math.cos(a) * 12).toFixed(2)}
                  y2={(26 + Math.sin(a) * 12).toFixed(2)}
                />
              );
            })}
          </g>
          <circle cx={40} cy={26} r={6.5} />
          <path d="M39.2 22h1.6v3.2h3.2v1.6h-3.2v3.2h-1.6v-3.2H36v-1.6h3.2z" fill={SHADE} stroke="none" />
          <path d="M28 36 H52 C52 47 47 52 40 52 C33 52 28 47 28 36 Z" />
          <rect x={38.6} y={52} width={2.8} height={9} />
          <circle cx={40} cy={54.8} r={2.3} />
          <path d="M31 66 C31 62.5 35 61 40 61 C45 61 49 62.5 49 66 Z" />
        </>
      );
    case "cross-pattee":
      return (
        <>
          <path d="M33 20 H47 L42.6 37.4 L60 33 V47 L42.6 42.6 L47 62 H33 L37.4 42.6 L20 47 V33 L37.4 37.4 Z" />
          <circle cx={40} cy={40} r={2.4} fill={SHADE} stroke="none" />
        </>
      );
    case "chevron":
      return (
        <>
          <path d="M10 62 L40 38 L70 62 V71.5 L40 47.5 L10 71.5 Z" />
          <path d="M10 66.8 L40 42.8 L70 66.8" stroke={SHADE} strokeWidth={0.9} fill="none" />
          <path d="M37.3 17.5h5.4v5h5v5.4h-5v6.6h-5.4v-6.6h-5v-5.4h5z" />
        </>
      );
    case "helm":
      // A flat-topped great helm with a cross-shaped brow and nasal reinforcement.
      return (
        <>
          <path d="M27 26 L30.5 20.5 H49.5 L53 26 V57 C53 61.5 47.5 65 40 65 C32.5 65 27 61.5 27 57 Z" />
          <rect x={38.7} y={20.8} width={2.6} height={44} fill={SHADE} stroke="none" />
          {small ? (
            <rect x={28.5} y={35} width={23} height={5} rx={1} fill="#120708" stroke="none" />
          ) : (
            <>
              <rect x={27.3} y={31.2} width={25.4} height={1.6} fill={SHADE} stroke="none" />
              <rect x={29.5} y={36} width={8} height={3.2} rx={1} fill="#120708" stroke="none" />
              <rect x={42.5} y={36} width={8} height={3.2} rx={1} fill="#120708" stroke="none" />
              {[45, 48.5].flatMap((cx) =>
                [47, 51, 55].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1} fill="#120708" stroke="none" />),
              )}
            </>
          )}
        </>
      );
    case "cross": {
      const d = "M37 21h6v11h11v6H43v26h-6V38H26v-6h11z";
      return (
        <>
          <path d={d} fill="none" stroke="#1a0b0d" strokeWidth={small ? 6.4 : 4.4} strokeLinejoin="miter" />
          <path d={d} fill="none" stroke={fill} strokeWidth={small ? 4.6 : 2.8} strokeLinejoin="miter" />
        </>
      );
    }
    case "candle":
      return (
        <>
          <circle cx={40} cy={26} r={12} opacity={0.14} stroke="none" />
          <circle cx={40} cy={26} r={7.5} opacity={0.18} stroke="none" />
          <path d="M40 15.5 C46 22.5 46.5 28 40 33.5 C33.5 28 34 22.5 40 15.5 Z" />
          <path d="M40 23 C42.2 26 42.3 28.6 40 31 C37.7 28.6 37.8 26 40 23 Z" fill="#fff8e6" stroke="none" />
          <path d="M40 33.5 V36.5" stroke="#120708" strokeWidth={1.1} />
          <path d="M34.5 36.5 H45.5 V60 H34.5 Z" />
          {!small && (
            <>
              <path d="M34.5 36.5 H39 V41.5 C39 43 37.2 43 37.2 41.5 V39.5 C37.2 38.5 34.5 38.8 34.5 40 Z" fill={SHADE} stroke="none" />
              <path d="M43.4 38.5 V58.5" stroke={SHADE} strokeWidth={1.2} fill="none" />
            </>
          )}
          <path d="M26 60 H54 L50 66 H30 Z" />
        </>
      );
  }
}

/**
 * Heraldic rank insignia. The shield's metal comes from the permission tier and the emblem from
 * the rank, so custom ranks can reuse any emblem.
 */
export function RankInsignia({
  insignia,
  tier,
  size = 24,
  title,
  className,
}: {
  insignia: Insignia;
  tier: RankTier;
  size?: number;
  /** Accessible name. Omit when a visible rank name sits next to the insignia. */
  title?: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const style = TIER_STYLE[tier];
  const rim = `url(#${id}-rim)`;
  const emblem = `url(#${id}-emblem)`;
  const ornate = insignia === "archangel";

  const gradient = (gid: string, metal: Metal) => (
    <linearGradient id={gid} x1="0" y1="0" x2="0.45" y2="1">
      {METAL_STOPS[metal].map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );

  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-rank-insignia=""
    >
      {title && <title>{`${title}: ${INSIGNIA_INFO[insignia].label}`}</title>}
      <defs>
        {gradient(`${id}-rim`, style.rim)}
        {gradient(`${id}-emblem`, style.emblem)}
        <radialGradient id={`${id}-field`} cx="0.5" cy="0.35" r="0.75">
          {style.field === "crimson" ? (
            <>
              <stop offset="0" stopColor="#8a1a2c" />
              <stop offset="1" stopColor="#3a0910" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#2e2823" />
              <stop offset="1" stopColor="#12100e" />
            </>
          )}
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SHIELD_INNER} />
        </clipPath>
      </defs>

      {ornate && (
        <g fill={rim} stroke="#1a0b0d" strokeWidth={0.6} strokeLinejoin="round">
          {LEFT_WING.map(([root, tip]) => (
            <path key={`l${tip.join()}`} d={feather(root, tip, 3.4)} />
          ))}
          <g transform="translate(80 0) scale(-1 1)">
            {LEFT_WING.map(([root, tip]) => (
              <path key={`r${tip.join()}`} d={feather(root, tip, 3.4)} />
            ))}
          </g>
        </g>
      )}

      <path d={SHIELD} fill={rim} stroke="#1a0b0d" strokeWidth={0.8} strokeLinejoin="round" />
      <path d={SHIELD_INNER} fill={`url(#${id}-field)`} />
      <path d={SHIELD_INNER} fill="none" stroke="#000" strokeOpacity={0.45} strokeWidth={0.8} />

      <g clipPath={`url(#${id}-clip)`} fill={emblem} stroke="#1a0b0d" strokeWidth={0.6} strokeLinejoin="round">
        <Emblem insignia={insignia} fill={emblem} accent={rim} small={size <= 20} />
      </g>

      <path d="M16.5 20.3 L40 15.3 L63.5 20.3 V32 C52 28 28 28 16.5 32 Z" fill="#fff" opacity={0.07} />

      {ornate && (
        <g fill={rim} stroke="#1a0b0d" strokeWidth={0.6} strokeLinejoin="round">
          <path d="M27 14.5 L27.6 5.5 L33 9.5 L36 3.5 L40 8 L44 3.5 L47 9.5 L52.4 5.5 L53 14.5 Z" />
          <path d="M39.1 0.2h1.8v2.1h2.1v1.8h-2.1v3.4h-1.8V4.1H37V2.3h2.1z" />
          {[[27.6, 5.5], [36, 3.5], [44, 3.5], [52.4, 5.5]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.3} fill="#b3152f" />
          ))}
        </g>
      )}
    </svg>
  );
}
