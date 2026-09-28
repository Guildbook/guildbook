"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

/** Disclosure menu that closes on outside click, Escape, or navigation. */
export function DropdownMenu({
  label,
  summary,
  summaryClassName = "btn btn-ghost btn-sm",
  className,
  children,
}: {
  label: string;
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = () => {
      if (ref.current) ref.current.open = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current?.open) {
        close();
        ref.current?.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary className={`${summaryClassName} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={label}>
        {summary}
      </summary>
      {children}
    </details>
  );
}
