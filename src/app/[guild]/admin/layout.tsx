import { NavLink } from "@/components/nav-link";
import { can } from "@/lib/authz/policy";
import { guildHref } from "@/lib/paths";
import { getGuild, getViewer } from "@/server/context";

/** Navigation only. Each admin page and service enforces its own permission. */
export default async function AdminLayout({ children, params }: LayoutProps<"/[guild]/admin">) {
  const { guild: slug } = await params;
  const guild = await getGuild(slug);
  const viewer = await getViewer(guild.id);
  const h = (p: string) => guildHref(slug, `/admin${p}`);
  const links: { href: string; label: string; exact?: boolean }[] = [
    { href: h(""), label: "Overview", exact: true },
    { href: h("/applications"), label: "Applications" },
    { href: h("/members"), label: "Members" },
    ...(can(viewer.actor, "rank.manage") ? [{ href: h("/ranks"), label: "Ranks" }] : []),
    { href: h("/content"), label: "Charter" },
    { href: h("/schedule"), label: "Schedule" },
    { href: h("/recruitment"), label: "Recruitment" },
    { href: h("/progression"), label: "Progression" },
    ...(can(viewer.actor, "loot.award") ? [{ href: h("/loot"), label: "Loot" }] : []),
    { href: h("/addons"), label: "Addons" },
    ...(can(viewer.actor, "guild.settings") ? [{ href: h("/guild"), label: "Guild" }] : []),
    { href: h("/audit"), label: "Audit log" },
  ];

  return (
    <div>
      {can(viewer.actor, "admin.area") && (
        <nav aria-label="Admin" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4">
          <ul className="flex gap-1 whitespace-nowrap">
            {links.map((l) => (
              <li key={l.href}>
                <NavLink
                  href={l.href}
                  exact={l.exact}
                  className="inline-block rounded-t border-b-2 border-transparent px-3 py-2.5 font-display text-xs tracking-wider text-muted uppercase hover:text-gold aria-[current=page]:border-gold aria-[current=page]:bg-gold/10 aria-[current=page]:text-gold"
                >
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {children}
    </div>
  );
}
