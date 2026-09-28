"use client";

import clsx from "clsx";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Chevron, usePopoverPlacement } from "@/components/listbox";
import { firstEnabled, lastEnabled, typeaheadIndex } from "@/lib/listbox";
import { isActivePath } from "@/lib/nav";

export interface NavMenuItem {
  href: string;
  label: string;
  exact?: boolean;
}

/**
 * A menu button of links (WAI-ARIA APG menu pattern), in the listbox's popover style. Arrow keys, Home, End and
 * type-ahead move between items; Escape closes and returns focus to the button. The button shows as current when one
 * of its links is the open page.
 */
export function NavMenu({
  label,
  items,
  className,
  buttonClassName,
  align = "end",
  children,
}: {
  label: string;
  items: readonly NavMenuItem[];
  className?: string;
  buttonClassName?: string;
  align?: "start" | "end";
  /** Button content; defaults to the label. */
  children?: ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ guild?: string }>();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buffer = useRef("");
  const bufferTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusOnOpen = useRef<"first" | "last" | null>(null);
  const base = useId().replace(/:/g, "");
  const menuId = `${base}-menu`;

  const current = items.findIndex((i) => isActivePath(pathname, i.href, params.guild, i.exact));

  usePopoverPlacement(open, buttonRef, menuRef, align);

  useEffect(() => {
    // Navigating away closes the menu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const menuItems = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const all = menuItems();
    (focusOnOpen.current === "last" ? all.at(-1) : all[0])?.focus();
    focusOnOpen.current = null;
  }, [open]);

  const show = (focus: "first" | "last" | null) => {
    focusOnOpen.current = focus;
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      show("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      show("last");
    }
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const all = menuItems();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const labels = items.map((i) => ({ label: i.label }));
    const focus = (i: number) => all[i]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        return focus((at + 1) % all.length);
      case "ArrowUp":
        e.preventDefault();
        return focus((at - 1 + all.length) % all.length);
      case "Home":
        e.preventDefault();
        return focus(firstEnabled(labels));
      case "End":
        e.preventDefault();
        return focus(lastEnabled(labels));
      case "Escape":
        e.preventDefault();
        return close();
      case "Tab":
        return setOpen(false);
    }
    if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      buffer.current += e.key;
      clearTimeout(bufferTimer.current);
      bufferTimer.current = setTimeout(() => (buffer.current = ""), 600);
      const match = typeaheadIndex(labels, buffer.current, at);
      if (match >= 0) focus(match);
    }
  };

  return (
    <div ref={wrapperRef} className={clsx("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-current={current >= 0 || undefined}
        onClick={() => (open ? setOpen(false) : show(null))}
        onKeyDown={onButtonKey}
        className={clsx("inline-flex items-center gap-1", buttonClassName)}
      >
        {children ?? label}
        <Chevron className={clsx("transition-transform", open && "rotate-180")} />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-label={label}
        popover="manual"
        hidden={!open}
        onKeyDown={onMenuKey}
        className="fixed inset-auto m-0 overflow-y-auto rounded border border-line bg-ink-2 p-0 py-1 text-bone shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
      >
        {items.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            tabIndex={-1}
            aria-current={i === current ? "page" : undefined}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center px-4 font-display text-xs tracking-wider whitespace-nowrap text-muted uppercase outline-none hover:bg-gold/10 hover:text-gold focus:bg-gold/10 focus:text-gold aria-[current=page]:text-gold sm:min-h-9"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
