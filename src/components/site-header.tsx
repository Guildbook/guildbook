import Link from "next/link";
import { AccountCard, AccountSettingsLink, accountName, SignOutButton } from "@/components/account-card";
import { GuildEmblem } from "@/components/guild-emblem";
import { DropdownMenu } from "@/components/dropdown-menu";
import { NavLink } from "@/components/nav-link";
import { RankInsignia } from "@/components/rank-insignia";
import { can } from "@/lib/authz/policy";
import { insigniaFor } from "@/lib/insignia";
import { canViewLoot } from "@/lib/loot/access";
import { guildHref } from "@/lib/paths";
import { type Guild, offersApply, type Viewer } from "@/server/context";

export function SiteHeader({ guild, viewer }: { guild: Guild; viewer: Viewer }) {
  const h = (p: string) => guildHref(guild.slug, p);
  const links = [
    { href: h("/charter"), label: "Charter" },
    { href: h("/lore"), label: "Lore" },
    { href: h("/roster"), label: "Roster" },
    { href: h("/progression"), label: "Progression" },
    { href: h("/addons"), label: "Addons" },
    ...(canViewLoot(viewer.actor, guild) ? [{ href: h("/members/loot"), label: "Loot" }] : []),
    ...(can(viewer.actor, "member.area") ? [{ href: h("/members/characters"), label: "Characters" }] : []),
    ...(can(viewer.actor, "admin.area") ? [{ href: h("/admin"), label: "Admin" }] : []),
  ];
  const showApply = offersApply(viewer);

  const signIn = (
    <Link href={h("/login")} className="btn btn-ghost btn-sm">
      Sign in
    </Link>
  );

  const missingMain = viewer.membershipStatus === "active" && !viewer.main;
  const desktopAccount = viewer.user ? (
    <DropdownMenu
      label="Account"
      description={missingMain ? "No main character yet" : undefined}
      className="relative"
      summaryClassName="flex items-center gap-2 rounded border border-transparent px-2 py-1 hover:border-line"
      summary={
        <>
          {(viewer.rank || missingMain) && (
            <span className="relative shrink-0">
              {viewer.rank && <RankInsignia insignia={insigniaFor(viewer.rank)} tier={viewer.rank.tier} size={28} className="block" />}
              {missingMain && (
                <span
                  aria-hidden
                  data-testid="missing-main-dot"
                  className={`${viewer.rank ? "absolute -top-0.5 -right-0.5" : "block"} size-2.5 rounded-full bg-crimson-bright ring-2 ring-ink`}
                />
              )}
            </span>
          )}
          <span className="flex flex-col text-sm leading-tight whitespace-nowrap">
            <span className="text-bone">{accountName(viewer)}</span>
            {viewer.rank && <span className="text-xs text-gold">{viewer.rank.name}</span>}
          </span>
        </>
      }
    >
      <div className="panel absolute right-0 mt-2 flex w-72 flex-col gap-3 p-3">
        <AccountCard viewer={viewer} guildSlug={guild.slug} />
        <hr className="rule-gold" />
        <AccountSettingsLink />
        <SignOutButton />
      </div>
    </DropdownMenu>
  ) : (
    signIn
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link href={h("/")} className="flex min-w-0 items-center gap-2">
          <GuildEmblem guild={guild} className="h-10 w-8 shrink-0" />
          <span className="font-display text-sm font-bold tracking-widest truncate text-gold uppercase sm:text-base">
            {guild.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-5 xl:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              className="border-b border-transparent py-1 font-display text-sm tracking-wider text-bone hover:text-gold aria-[current=page]:border-gold aria-[current=page]:text-gold"
            >
              {l.label}
            </NavLink>
          ))}
          {showApply && (
            <Link href={h("/apply")} className="btn btn-primary btn-sm">
              Apply
            </Link>
          )}
          {desktopAccount}
        </nav>

        <DropdownMenu label="Menu" summary="Menu" className="relative xl:hidden">
          <div className="panel absolute right-0 mt-2 flex w-72 flex-col gap-1 p-3">
            {viewer.user && (
              <>
                <AccountCard viewer={viewer} guildSlug={guild.slug} />
                <hr className="rule-gold my-2" />
              </>
            )}
            {links.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                className="rounded-r border-l-2 border-transparent px-2 py-2.5 font-display tracking-wider hover:bg-ink aria-[current=page]:border-gold aria-[current=page]:bg-gold/10 aria-[current=page]:text-gold"
              >
                {l.label}
              </NavLink>
            ))}
            {showApply && (
              <Link href={h("/apply")} className="btn btn-primary mt-2">
                Apply
              </Link>
            )}
            <hr className="rule-gold my-2" />
            {viewer.user ? <SignOutButton /> : signIn}
          </div>
        </DropdownMenu>
      </div>
    </header>
  );
}
