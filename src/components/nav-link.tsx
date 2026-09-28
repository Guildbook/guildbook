"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivePath } from "@/lib/nav";

/** Link that marks itself `aria-current="page"` when its section is open. Style the active state with `aria-[current=page]:`. */
export function NavLink({
  href,
  exact = false,
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ guild?: string }>();
  const active = isActivePath(pathname, href, params.guild, exact);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
