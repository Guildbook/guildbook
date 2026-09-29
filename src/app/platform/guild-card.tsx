import type { ReactNode } from "react";
import { GameVersionBadge } from "@/components/game-version";
import { GuildEmblem } from "@/components/guild-emblem";
import { RegionBadge } from "@/components/region";
import { RulesetBadge } from "@/components/ruleset";
import { FactionBadge } from "@/components/ui";
import { VerifiedSeal } from "@/components/verified-seal";
import type { Faction, Region, Ruleset } from "@/lib/game";
import { type GuildVersion, realmLabel } from "@/lib/game-versions";
import type { LookColumns } from "@/lib/tabard/look";

/** A guild on the apex. Links are plain anchors: the guild lives on another host. */
export function GuildCard({
  guild,
  href,
  children,
}: {
  guild: {
    name: string;
    motto: string | null;
    gameVersion: GuildVersion;
    realmSlug: string | null;
    region: Region;
    faction: Faction;
    ruleset: Ruleset;
    verifiedAt: Date | null;
  } & LookColumns;
  href: string;
  children?: ReactNode;
}) {
  return (
    <li className="panel group relative flex gap-4 p-4 transition-colors hover:border-gold-dim">
      <GuildEmblem guild={guild} className="h-16 w-14 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <a
          href={href}
          className="flex items-center gap-1.5 font-display text-lg font-semibold text-gold group-hover:text-gold-bright after:absolute after:inset-0 after:rounded-[inherit] after:content-['']"
        >
          <span className="min-w-0">{guild.name}</span>
          {guild.verifiedAt && <VerifiedSeal size={16} />}
        </a>
        {guild.motto && <p className="text-xs tracking-[0.2em] text-muted uppercase">{guild.motto}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted [&_a]:relative [&_a]:z-10">
          <GameVersionBadge version={guild.gameVersion} />
          {guild.realmSlug ? (
            <span
              className="inline-flex items-center rounded bg-ink-2 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wider text-bone/80 uppercase ring-1 ring-line"
              data-testid="realm-badge"
            >
              {realmLabel(guild.gameVersion, guild.realmSlug, guild.region)}
            </span>
          ) : (
            <RegionBadge region={guild.region} />
          )}
          <FactionBadge faction={guild.faction} />
          <RulesetBadge ruleset={guild.ruleset} />
          {guild.verifiedAt && <VerifiedSeal label size={12} />}
          {children}
        </div>
      </div>
    </li>
  );
}
