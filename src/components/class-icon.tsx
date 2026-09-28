import clsx from "clsx";
import Image from "next/image";
import { CLASS_INFO, type WowClass } from "@/lib/game";

/** Blizzard class icon, self-hosted in public/icons/classes. `decorative` when the class name is shown beside it. */
export function ClassIcon({
  wowClass,
  size = 20,
  decorative = false,
  className,
}: {
  wowClass: WowClass;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/icons/classes/${wowClass}.webp`}
      width={size}
      height={size}
      alt={decorative ? "" : CLASS_INFO[wowClass].label}
      aria-hidden={decorative || undefined}
      unoptimized
      style={{ borderColor: CLASS_INFO[wowClass].color, width: size, height: size }}
      className={clsx("inline-block shrink-0 rounded border object-cover", className)}
    />
  );
}
