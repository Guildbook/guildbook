"use client";

// Must stay a client component: server `useId` values restart with each RSC request, so gradient IDs could collide
// with icons already on the page (see rank-insignia.tsx).
import { type ReactNode, useId } from "react";
import { ADDON_ICON_INFO, type AddonIconName, addonIconFor } from "@/lib/addon-icons";

const OUTLINE = "#1a0b0d";
const INK_MARK = "#2a0a10";
const GOLD: [number, string][] = [[0, "#fff1b8"], [0.35, "#e6c46a"], [0.7, "#b8902f"], [1, "#7a5a18"]];
const WHITE: [number, string][] = [[0, "#ffffff"], [0.5, "#ece4d4"], [1, "#b3a78f"]];

const f = (n: number) => n.toFixed(2);

/** `count` tick marks between radii `from` and `to` around a center, like a clock face or a glory. */
function rays(cx: number, cy: number, from: number, to: number, count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + offset;
    return `M${f(cx + Math.cos(a) * from)} ${f(cy + Math.sin(a) * from)}L${f(cx + Math.cos(a) * to)} ${f(cy + Math.sin(a) * to)}`;
  }).join("");
}

/** A quill vane from the base of the barbs to the tip, wider on the leading (upper-left) side. */
function vane(base: [number, number], tip: [number, number], lead: number, trail: number) {
  const [dx, dy] = [tip[0] - base[0], tip[1] - base[1]];
  const len = Math.hypot(dx, dy);
  const [nx, ny] = [dy / len, -dx / len];
  const at = (t: number, w: number): string => `${f(base[0] + dx * t + nx * w)} ${f(base[1] + dy * t + ny * w)}`;
  return (
    `M${at(0, 0)}C${at(0.2, -lead)} ${at(0.75, -lead * 1.1)} ${at(1, 0)}` +
    `C${at(0.8, trail * 0.9)} ${at(0.25, trail)} ${at(0, 0)}Z`
  );
}

function Emblem({ icon, gold, white, small }: { icon: AddonIconName; gold: string; white: string; small: boolean }): ReactNode {
  const sw = small ? 1.1 : 0.7;
  const common = { stroke: OUTLINE, strokeWidth: sw, strokeLinejoin: "round" as const };
  switch (icon) {
    case "meter": {
      // Ranked bars of a damage meter, the leader picked out in crimson.
      const bars = small
        ? [[12, 26], [20.5, 19], [29, 12]]
        : [[11.5, 26], [17.8, 21], [24.1, 16], [30.4, 10.5]];
      const h = small ? 6.5 : 4.6;
      return (
        <g {...common}>
          {!small && <rect x={9} y={10} width={1.8} height={27} rx={0.9} fill={gold} />}
          {bars.map(([y, w], i) => (
            <rect key={y} x={small ? 11 : 12.5} y={y} width={w} height={h} rx={small ? 1.4 : 1} fill={i === 0 ? "#b3152f" : gold} />
          ))}
          {!small &&
            bars.map(([y, w]) => <path key={y} d={`M13.8 ${y + 1.3}H${11.8 + w}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={0.8} fill="none" />)}
        </g>
      );
    }
    case "sigil":
      // A warning triangle over a clock face: the boss timer's alarm.
      return (
        <>
          {!small && <path d={rays(24, 26, 15.5, 18.5, 12, Math.PI / 12)} stroke={gold} strokeWidth={1.2} opacity={0.55} />}
          <path
            d={small ? "M24 7.5 L41 37.5 H7 Z" : "M24 9.5 L38.5 35 H9.5 Z"}
            fill={gold}
            stroke={OUTLINE}
            strokeWidth={small ? 1.4 : 1}
            strokeLinejoin="round"
          />
          <path d={small ? "M21.6 16.5 H26.4 L25.4 28 H22.6 Z" : "M22.2 17.5 H25.8 L25 27 H23 Z"} fill={INK_MARK} />
          <circle cx={24} cy={small ? 32.3 : 30.9} r={small ? 2.5 : 1.9} fill={INK_MARK} />
        </>
      );
    case "bell":
      // The compline bell, crowned with a cross.
      return (
        <g {...common}>
          {!small && (
            <path
              d="M10 19 Q7.5 23.5 10 28 M7 16.5 Q3.5 23.5 7 30.5 M38 19 Q40.5 23.5 38 28 M41 16.5 Q44.5 23.5 41 30.5"
              stroke={gold}
              strokeWidth={1.1}
              strokeLinecap="round"
              fill="none"
              opacity={0.7}
            />
          )}
          {small ? (
            <circle cx={24} cy={10.5} r={2.6} fill={gold} />
          ) : (
            <path d="M23.1 5.5h1.8v2h2v1.8h-2v3h-1.8v-3h-2V7.5h2z" fill={gold} />
          )}
          <path
            d={
              small
                ? "M24 12 C16.5 12 14.5 17 14.5 23 V28 C14.5 30.5 12 32 10 33 V35.5 H38 V33 C36 32 33.5 30.5 33.5 28 V23 C33.5 17 31.5 12 24 12 Z"
                : "M24 12.5 C17.8 12.5 15.5 17 15.5 22.5 V28 C15.5 30.5 13.5 32 11.5 33 V35 H36.5 V33 C34.5 32 32.5 30.5 32.5 28 V22.5 C32.5 17 30.2 12.5 24 12.5 Z"
            }
            fill={gold}
          />
          {!small && <path d="M19.5 18 C18.6 20 18.5 22 18.5 28" stroke="#fff" strokeOpacity={0.4} strokeWidth={1} fill="none" />}
          <rect x={small ? 9 : 10.5} y={small ? 34 : 33.5} width={small ? 30 : 27} height={small ? 3.5 : 2.8} rx={1.4} fill={gold} />
          <circle cx={24} cy={small ? 40 : 39} r={small ? 3 : 2.5} fill={gold} />
        </g>
      );
    case "scales": {
      // Balance scales, one pan heaped with coin.
      const chain = small ? 1.3 : 0.8;
      const pan = (cx: number) => `M${cx - 5} 28 H${cx + 5} Q${cx + 5} 32.5 ${cx} 32.5 Q${cx - 5} 32.5 ${cx - 5} 28 Z`;
      return (
        <>
          <path
            d="M11 16.5 L6.5 28 M11 16.5 L15.5 28 M37 16.5 L32.5 28 M37 16.5 L41.5 28"
            stroke={small ? gold : "#e6c46a"}
            strokeWidth={chain}
            fill="none"
          />
          <g {...common}>
            {!small && (
              <>
                <ellipse cx={35.5} cy={26.6} rx={2.2} ry={1} fill={gold} />
                <ellipse cx={38.3} cy={26.8} rx={2.2} ry={1} fill={gold} />
                <ellipse cx={36.9} cy={25.4} rx={2.2} ry={1} fill={gold} />
              </>
            )}
            <rect x={small ? 22.4 : 22.8} y={13} width={small ? 3.2 : 2.4} height={22} fill={gold} />
            <path d="M16.5 38.5 H31.5 L28.5 34.5 H19.5 Z" fill={gold} />
            <rect x={8.5} y={small ? 13.9 : 14.4} width={31} height={small ? 3.2 : 2.2} rx={1.1} fill={gold} />
            <circle cx={24} cy={small ? 11.5 : 11.8} r={small ? 2.6 : 2} fill={gold} />
            <path d={pan(11)} fill={gold} />
            <path d={pan(37)} fill={gold} />
          </g>
        </>
      );
    }
    case "scroll":
      // An unrolled scroll of assignments with checked lines.
      return (
        <g {...common}>
          <rect x={13} y={11} width={22} height={26} fill={white} />
          <rect x={10} y={small ? 7.5 : 8.5} width={28} height={small ? 6 : 5} rx={small ? 3 : 2.5} fill={gold} />
          <rect x={10} y={small ? 34.5 : 34.5} width={28} height={small ? 6 : 5} rx={small ? 3 : 2.5} fill={gold} />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            {(small ? [19, 28] : [17.5, 23.5, 29.5]).map((y) => (
              <g key={y}>
                <path
                  d={small ? `M15.8 ${y} l2.2 2.3 l3.8 -4.6` : `M16 ${y} l1.6 1.7 l2.8 -3.4`}
                  stroke="#a8182f"
                  strokeWidth={small ? 2.4 : 1.5}
                />
                <path d={`M${small ? 24.5 : 22.5} ${y}H32`} stroke={INK_MARK} strokeWidth={small ? 2.2 : 1.1} opacity={0.75} />
              </g>
            ))}
          </g>
        </g>
      );
    case "eye":
      // The watchful eye that keeps vigil over every pull.
      return (
        <>
          {!small && <path d={rays(24, 24, 15, 19, 16, Math.PI / 16)} stroke={gold} strokeWidth={1} opacity={0.45} />}
          <path
            d={small ? "M6 24 Q24 6.5 42 24 Q24 41.5 6 24 Z" : "M8 24 Q24 9 40 24 Q24 39 8 24 Z"}
            fill={white}
            stroke={OUTLINE}
            strokeWidth={small ? 1.3 : 0.9}
            strokeLinejoin="round"
          />
          <circle cx={24} cy={24} r={small ? 7.5 : 6.5} fill={gold} stroke={OUTLINE} strokeWidth={sw} />
          <circle cx={24} cy={24} r={small ? 3.3 : 2.8} fill={INK_MARK} />
          <circle cx={22} cy={22} r={small ? 1.4 : 1.1} fill="#fff" />
        </>
      );
    case "quill": {
      // A quill in its inkwell: the maker's mark for member-written addons.
      const base: [number, number] = [18, 29];
      const tip: [number, number] = small ? [39, 7] : [38, 8];
      return (
        <g {...common}>
          <path d={vane(base, tip, small ? 7 : 6.2, small ? 3.6 : 3.2)} fill={white} />
          {!small && (
            <path
              d="M22.2 22.5 L19.6 22.1 M26.4 18 L23.2 17.2 M30.6 13.6 L27.5 12.5 M23.8 23.6 L25.1 25.4 M28 19.2 L29.5 20.8"
              stroke={OUTLINE}
              strokeWidth={0.6}
              fill="none"
            />
          )}
          <path d={`M15 33 L${f(tip[0] - 2)} ${f(tip[1] + 2.2)}`} stroke={OUTLINE} strokeWidth={small ? 1.3 : 0.9} fill="none" />
          <rect x={small ? 10.5 : 11} y={31.5} width={small ? 10 : 9} height={1.8} rx={0.9} fill={gold} />
          <path
            d={small ? "M8.5 34.5 H22.5 V39.5 Q22.5 42 20 42 H11 Q8.5 42 8.5 39.5 Z" : "M9 34.5 H22 V39.5 Q22 41.5 20 41.5 H11 Q9 41.5 9 39.5 Z"}
            fill={gold}
          />
          <rect x={12.5} y={33.2} width={6} height={1.4} fill={gold} />
        </g>
      );
    }
  }
}

/**
 * A heraldic addon icon: a gold-rimmed rounded tile like a WoW ability icon. Pass `addon` to pick the icon from its
 * slug or name (see src/lib/addon-icons.ts), or `icon` directly. At 24px and below it draws a simplified emblem.
 */
export function AddonIcon({
  addon,
  icon,
  size = 32,
  title,
  className,
}: {
  addon?: { slug: string; name: string };
  icon?: AddonIconName;
  size?: number;
  /** Accessible name. Omit when the addon name is shown beside the icon. */
  title?: string;
  className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const name = icon ?? (addon ? addonIconFor(addon) : "quill");
  const { field } = ADDON_ICON_INFO[name];
  const small = size <= 24;
  const inner = small ? { x: 4.5, r: 4.5 } : { x: 4, r: 5 };
  const innerSize = 48 - inner.x * 2;

  const gradient = (gid: string, stops: [number, string][]) => (
    <linearGradient id={gid} x1="0" y1="0" x2="0.45" y2="1">
      {stops.map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-addon-icon={name}
    >
      {title && <title>{title}</title>}
      <defs>
        {gradient(`${id}-gold`, GOLD)}
        {gradient(`${id}-white`, WHITE)}
        <radialGradient id={`${id}-field`} cx="0.5" cy="0.35" r="0.8">
          {field === "crimson" ? (
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
          <rect x={inner.x} y={inner.x} width={innerSize} height={innerSize} rx={inner.r} />
        </clipPath>
      </defs>

      <rect x={0.75} y={0.75} width={46.5} height={46.5} rx={8} fill={`url(#${id}-gold)`} stroke={OUTLINE} strokeWidth={small ? 1.2 : 0.9} />
      <rect x={inner.x} y={inner.x} width={innerSize} height={innerSize} rx={inner.r} fill={`url(#${id}-field)`} />
      {!small && <rect x={6} y={6} width={36} height={36} rx={3.5} fill="none" stroke="#e6c46a" strokeOpacity={0.3} strokeWidth={0.6} />}

      <g clipPath={`url(#${id}-clip)`}>
        <Emblem icon={name} gold={`url(#${id}-gold)`} white={`url(#${id}-white)`} small={small} />
        <path d="M0 0 H48 V17 C34 13 14 13 0 17 Z" fill="#fff" opacity={0.07} />
      </g>
      <rect x={inner.x} y={inner.x} width={innerSize} height={innerSize} rx={inner.r} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={small ? 1.1 : 0.8} />
    </svg>
  );
}
