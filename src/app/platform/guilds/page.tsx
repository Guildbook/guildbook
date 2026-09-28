import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FactionIcon } from "@/components/faction-icon";
import { RulesetIcon } from "@/components/ruleset";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { FACTION_LABELS, FACTIONS, type Faction, RULESET_INFO, RULESETS, type Ruleset } from "@/lib/game";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { listDirectoryGuilds } from "@/server/services/platform";
import { GuildCard } from "../guild-card";

export const metadata: Metadata = {
  title: "Guild directory",
  description: "World of Warcraft: Forever guilds on Guildbook that welcome new members.",
};

function pick<T extends string>(options: readonly T[], value: string | string[] | undefined): T | undefined {
  return options.find((o) => o === value);
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={clsx(
        "inline-flex min-h-9 items-center gap-1.5 rounded border px-2.5 text-xs transition-colors",
        active ? "border-gold-dim bg-gold/10 text-gold" : "border-line text-bone/80 hover:border-gold-dim hover:text-gold",
      )}
    >
      {children}
    </Link>
  );
}

export default async function DirectoryPage({ searchParams }: PageProps<"/platform/guilds">) {
  const sp = await searchParams;
  const faction = pick<Faction>(FACTIONS, sp.faction);
  const ruleset = pick<Ruleset>(RULESETS, sp.ruleset);
  const [current, guilds] = await Promise.all([getRequestHost(), listDirectoryGuilds(db, { faction, ruleset })]);
  const href = (next: { faction?: Faction; ruleset?: Ruleset }) => {
    const params = new URLSearchParams();
    if (next.faction) params.set("faction", next.faction);
    if (next.ruleset) params.set("ruleset", next.ruleset);
    const query = params.toString();
    return query ? `/guilds?${query}` : "/guilds";
  };
  const filtered = Boolean(faction || ruleset);

  return (
    <div>
      <PageHeader title="Guild directory" eyebrow="Guildbook">
        Guilds that chose to be listed. Verified guilds, whose Guild Master proved their in-game rank through Battle.net, come
        first. Officers can list theirs under Admin, then Guild.
      </PageHeader>
      <nav aria-label="Filter guilds" className="mb-6 space-y-2" data-testid="directory-filters">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs tracking-wider text-gold-dim uppercase">Faction</span>
          <FilterChip href={href({ ruleset })} active={!faction}>
            All
          </FilterChip>
          {FACTIONS.map((f) => (
            <FilterChip key={f} href={href({ faction: f, ruleset })} active={faction === f}>
              <FactionIcon faction={f} size={14} decorative />
              {FACTION_LABELS[f]}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs tracking-wider text-gold-dim uppercase">Ruleset</span>
          <FilterChip href={href({ faction })} active={!ruleset}>
            All
          </FilterChip>
          {RULESETS.map((r) => (
            <FilterChip key={r} href={href({ faction, ruleset: r })} active={ruleset === r}>
              <RulesetIcon ruleset={r} size={13} className="text-gold-dim" />
              {RULESET_INFO[r].label}
            </FilterChip>
          ))}
        </div>
      </nav>
      {guilds.length === 0 ? (
        <p className="text-center text-muted">
          {filtered ? (
            <>
              No listed guilds match those filters. <Link href="/guilds" className="link">Show all guilds</Link>.
            </>
          ) : (
            <>
              No guilds are listed yet. <Link href="/create" className="link">Create the first one</Link>.
            </>
          )}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="directory">
          {guilds.map((g) => (
            <GuildCard key={g.slug} guild={g} href={guildOrigin(g.slug, current, g.customDomain)}>
              <span>{g.members === 1 ? "1 member" : `${g.members} members`}</span>
              <span className={g.recruitmentOpen ? "text-gold" : undefined}>{g.recruitmentOpen ? "Recruiting" : "Not recruiting"}</span>
            </GuildCard>
          ))}
        </ul>
      )}
    </div>
  );
}
