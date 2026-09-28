"use client";

// Must stay a client component: server `useId` values restart with each RSC request, so a mark rendered on
// navigation could reuse the gradient ID of one already on the page (see rank-insignia.tsx).
import clsx from "clsx";
import { useId } from "react";

/**
 * The Guildbook mark: an open gold book with a crimson ribbon. Deliberately unlike the Order's tabard crest,
 * which stays that guild's own emblem. `pnpm brand:assets` rasterizes this for the apex favicon and previews.
 * `gradientId` must be unique on the page when several marks share it.
 */
export function GuildbookMarkArt({ size, title = "Guildbook", gradientId = "gbm-page" }: { size?: number; title?: string | null; gradientId?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2dc98" />
          <stop offset="1" stopColor="#c9a44c" />
        </linearGradient>
      </defs>
      <path d="M5 15 C15 10 25 11 31 16 V52 C25 47 15 46 5 51 Z" fill={`url(#${gradientId})`} stroke="#8a7036" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M59 15 C49 10 39 11 33 16 V52 C39 47 49 46 59 51 Z" fill={`url(#${gradientId})`} stroke="#8a7036" strokeWidth="1.5" strokeLinejoin="round" />
      <g stroke="#2b1d12" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M11 23 C16 21 21 21 26 23" />
        <path d="M11 30 C16 28 21 28 26 30" />
        <path d="M11 37 C16 35 21 35 26 37" />
        <path d="M38 30 C43 28 48 28 53 30" />
        <path d="M38 37 C43 35 48 35 53 37" />
      </g>
      <path d="M42 11 V27 L45.5 23.5 L49 27 V11.5 C46.5 10.8 44.2 10.7 42 11 Z" fill="#a8182f" stroke="#4a0913" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function GuildbookMark({ className = "h-8 w-8" }: { className?: string }) {
  const gradientId = `gbm-page-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <span className={clsx("inline-block", className)}>
      <span className="block h-full w-full [&>svg]:h-full [&>svg]:w-full">
        <GuildbookMarkArt title={null} gradientId={gradientId} />
      </span>
    </span>
  );
}

/** Mark plus the Cinzel "Guildbook" wordmark. */
export function GuildbookWordmark({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)} aria-label="Guildbook" role="img">
      <GuildbookMark className={size === "lg" ? "h-14 w-14" : "h-8 w-8"} />
      <span
        aria-hidden
        className={clsx("font-display font-bold tracking-[0.18em] text-gold uppercase", size === "lg" ? "text-3xl sm:text-4xl" : "text-lg")}
      >
        Guild<span className="text-bone">book</span>
      </span>
    </span>
  );
}
