import type { ReactNode } from "react";
import { GuildEmblem } from "@/components/guild-emblem";
import { RulesetBadge } from "@/components/ruleset";
import { FactionBadge } from "@/components/ui";
import { VerifiedSeal } from "@/components/verified-seal";
import type { Faction, Ruleset } from "@/lib/game";
import type { LookColumns } from "@/lib/tabard/look";

/** A guild on the apex. Links are plain anchors: the guild lives on another host. */
export function GuildCard({
  guild,
  href,
  children,
}: {
  guild: { name: string; motto: string | null; faction: Faction; ruleset: Ruleset; verifiedAt: Date | null } & LookColumns;
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
          <FactionBadge faction={guild.faction} />
          <RulesetBadge ruleset={guild.ruleset} />
          {guild.verifiedAt && <VerifiedSeal label size={12} />}
          {children}
        </div>
      </div>
    </li>
  );
}
