import Link from "next/link";
import type { ReactNode } from "react";
import { RankInsignia } from "@/components/rank-insignia";
import { VerifiedMark } from "@/components/ui";
import { CLASS_INFO, fullName } from "@/lib/game";
import { insigniaFor } from "@/lib/insignia";
import { characterHref, guildHref } from "@/lib/paths";
import type { Viewer } from "@/server/context";
import { signOutAction } from "@/server/actions/member";

/** Main character's full name, falling back to the Discord display name. */
export function accountName(viewer: Viewer): string {
  return viewer.main ? fullName(viewer.main.name, viewer.main.surname) : (viewer.user?.name ?? "Signed in");
}

/** Profile card for the signed-in viewer: insignia, main character, level line and rank. */
export function AccountCard({ viewer, guildSlug }: { viewer: Viewer; guildSlug: string }) {
  const { main, rank } = viewer;
  const h = (p: string) => guildHref(guildSlug, p);

  const name = <p className="truncate font-display text-base tracking-wide text-bone">{accountName(viewer)}</p>;

  let identity;
  if (main) {
    identity = (
      <Link href={characterHref(guildSlug, main.id)} className="group block space-y-0.5">
        <p className="flex items-center gap-1.5 font-display text-base tracking-wide text-bone group-hover:text-gold">
          <span className="truncate">{accountName(viewer)}</span>
          {main.verified && <VerifiedMark size={12} />}
        </p>
        <p className="text-xs text-muted">
          Level {main.level}{" "}
          <span style={{ color: CLASS_INFO[main.wowClass].color }}>
            {main.spec} {CLASS_INFO[main.wowClass].label}
          </span>
        </p>
      </Link>
    );
  } else if (viewer.membershipStatus === "active") {
    identity = (
      <>
        {name}
        <Link href={h("/members/characters")} className="text-xs text-gold underline-offset-2 hover:underline">
          Add your main character
        </Link>
      </>
    );
  } else if (viewer.membershipStatus === "applicant") {
    identity = (
      <>
        {name}
        <Link href={h("/apply")} className="text-xs text-gold underline-offset-2 hover:underline">
          Application pending
        </Link>
      </>
    );
  } else {
    identity = (
      <>
        {name}
        <p className="text-xs text-muted">Signed in with Discord</p>
      </>
    );
  }

  return (
    <div data-testid="account-card" className="flex items-center gap-3 px-1 py-1">
      {rank && <RankInsignia insignia={insigniaFor(rank)} tier={rank.tier} size={44} className="shrink-0" />}
      <div className="min-w-0 space-y-0.5 leading-tight">
        {identity}
        {rank && <p className="text-xs tracking-wider text-gold uppercase">{rank.name}</p>}
      </div>
    </div>
  );
}

/** Guild hosts redirect /account to the Guildbook apex, where the account lives, so this is a full navigation. */
export function AccountSettingsLink({ className = "btn btn-ghost btn-sm w-full", children = "Account and privacy" }: { className?: string; children?: ReactNode }) {
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/account" className={className} data-testid="account-settings-link">
      {children}
    </a>
  );
}

export function SignOutButton({ className = "btn btn-ghost btn-sm w-full", children = "Sign out" }: { className?: string; children?: ReactNode }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
