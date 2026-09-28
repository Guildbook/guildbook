import clsx from "clsx";
import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";

/** A capture of the Vigil window (2x, rendered from the app's synthetic demo raid), framed as a desktop window. */
export function AppScreenshot({
  src,
  alt,
  caption,
  sizes,
  priority = false,
  glow = false,
  fade = false,
  className,
}: {
  src: StaticImageData;
  alt: string;
  caption: ReactNode;
  sizes: string;
  priority?: boolean;
  glow?: boolean;
  /** Fade the bottom edge out, for captures cut off partway down a panel. */
  fade?: boolean;
  className?: string;
}) {
  return (
    <figure className={clsx("relative isolate mx-auto w-full", className)}>
      {glow && (
        <div
          aria-hidden="true"
          className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgb(168_24_47/0.28),transparent_70%)] blur-2xl"
        />
      )}
      <div className="overflow-hidden rounded-xl border border-line bg-[#0d0c0b] shadow-[0_24px_60px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(201_164_76/0.12)]">
        <div aria-hidden="true" className="flex items-center gap-2 border-b border-line bg-ink-3 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#b3423f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#b58a3a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#5f7f4a]" />
        </div>
        <div className="relative">
          <Image src={src} alt={alt} sizes={sizes} priority={priority} placeholder="blur" className="block h-auto w-full" />
          {fade && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-[#0d0c0b] to-transparent" />
          )}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
