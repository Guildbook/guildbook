"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useId, useRef } from "react";

/** Disclosure menu that closes on outside click, Escape, or navigation. Gains `data-ready` once those handlers are live. */
export function DropdownMenu({
  label,
  description,
  summary,
  summaryClassName = "btn btn-ghost btn-sm",
  className,
  children,
}: {
  label: string;
  /** Announced after the label, for state the summary only shows visually. */
  description?: string;
  summary: ReactNode;
  summaryClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const descriptionId = useId();
  const pathname = usePathname();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    // Only on navigation: a menu opened natively before hydration must stay open when this first runs.
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
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
    ref.current?.setAttribute("data-ready", "");
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className={className}>
      <summary
        className={`${summaryClassName} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
      >
        {summary}
        {description && (
          <span id={descriptionId} className="sr-only">
            {description}
          </span>
        )}
      </summary>
      {children}
    </details>
  );
}
