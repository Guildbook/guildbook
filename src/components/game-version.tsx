import clsx from "clsx";
import { type GuildVersion, VERSION_INFO } from "@/lib/game-versions";

/** An hourglass for WoW: Forever (it starts over), a portal ring for the Burning Crusade. */
const PATHS: Record<GuildVersion, string> = {
  forever: "M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6",
  anniversary: "M8 2.5c3 0 5 2.4 5 5.5s-2 5.5-5 5.5S3 11.1 3 8s2-5.5 5-5.5ZM8 5c1.5 0 2.5 1.3 2.5 3S9.5 11 8 11 5.5 9.7 5.5 8 6.5 5 8 5Z",
  era: "M8 2v12M2 8h12",
  seasonal: "M8 2v12M2 8h12",
  progression: "M8 2v12M2 8h12",
};

export function GameVersionIcon({ version, size = 16, className }: { version: GuildVersion; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className={clsx("shrink-0", className)}>
      <path d={PATHS[version]} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Small game version label for cards and headers, alongside `RegionBadge` and `RulesetBadge`. WoW: Forever guilds get
 * none unless `always` is set: Forever is the default, so only other versions need calling out.
 */
export function GameVersionBadge({ version, always = false, className }: { version: GuildVersion; always?: boolean; className?: string }) {
  if (version === "forever" && !always) return null;
  const info = VERSION_INFO[version];
  return (
    <span
      title={info.label}
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wider uppercase ring-1",
        version === "forever" ? "bg-ink-2 text-bone/80 ring-line" : "bg-emerald-950/60 text-emerald-200 ring-emerald-800",
        className,
      )}
      data-testid="game-version-badge"
      data-version={version}
    >
      <GameVersionIcon version={version} size={12} className={version === "forever" ? "text-gold-dim" : "text-emerald-300"} />
      {info.short}
    </span>
  );
}
