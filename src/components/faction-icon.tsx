import clsx from "clsx";
import Image from "next/image";
import { FACTION_LABELS, type Faction } from "@/lib/game";

/** Blizzard faction crest, self-hosted in public/icons/factions. `decorative` when the faction name is shown beside it. */
export function FactionIcon({
  faction,
  size = 20,
  decorative = false,
  className,
}: {
  faction: Faction;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/icons/factions/${faction}.webp`}
      width={size}
      height={size}
      alt={decorative ? "" : FACTION_LABELS[faction]}
      aria-hidden={decorative || undefined}
      unoptimized
      style={{ width: size, height: size }}
      className={clsx(
        "inline-block shrink-0 rounded border object-cover",
        faction === "alliance" ? "border-[#3b5ca8]" : "border-[#a83b3b]",
        className,
      )}
    />
  );
}

/** Both crests side by side, for guilds open to either faction. */
export function BothFactionsIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex shrink-0 items-center -space-x-1", className)} aria-hidden>
      <FactionIcon faction="alliance" size={size} decorative />
      <FactionIcon faction="horde" size={size} decorative />
    </span>
  );
}
