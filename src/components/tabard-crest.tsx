"use client";

// A client component: crests define tint filters, and server `useId` values restart with each RSC
// request, so a crest rendered on navigation could reuse the filter ids of one already on the page (see crest.tsx).
import clsx from "clsx";
import { useId } from "react";
import { CrestDefs, type CrestImages, DETAILS, tabardColors } from "@/components/tabard-art";
import type { TabardConfig } from "@/lib/tabard/config";

export { detailForWidth, TabardArt, tabardColors } from "@/components/tabard-art";

/**
 * A guild's tabard crest. All three detail levels share one SVG and the box's rendered width picks one
 * (see `.crest` in globals.css), exactly like the Order's crest.
 */
export function TabardCrest({ tabard, label, className = "h-24 w-20" }: { tabard: TabardConfig; label: string; className?: string }) {
  const prefix = `tabard-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const c = tabardColors(tabard);
  const images: CrestImages = { mode: "filter", prefix };
  const { tiny: Tiny, mark: Mark, full: Full } = DETAILS;
  return (
    <span className={clsx("crest", className)}>
      <svg viewBox="0 0 100 120" role="img" aria-label={label}>
        <CrestDefs tabard={tabard} prefix={prefix} />
        <Tiny tabard={tabard} c={c} images={images} />
        <Mark tabard={tabard} c={c} images={images} />
        <Full tabard={tabard} c={c} images={images} />
      </svg>
    </span>
  );
}
