import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { RankInsignia } from "@/components/rank-insignia";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { TIER_LABELS } from "@/lib/authz/tiers";
import { INSIGNIA_INFO, insigniaFor } from "@/lib/insignia";
import { LORE_SLUG } from "@/lib/lore";
import { getGuild } from "@/server/context";
import { listContentPages } from "@/server/services/content";
import { listRanks } from "@/server/services/ranks";

export const metadata: Metadata = { title: "Charter" };

export default async function CharterPage({ params }: PageProps<"/[guild]/charter">) {
  const { guild: slug } = await params;
  const guild = await getGuild(slug);
  const [allPages, ranks] = await Promise.all([listContentPages(db, guild.id), listRanks(db, guild.id)]);
  const pages = allPages.filter((p) => p.slug !== LORE_SLUG);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="The Charter" eyebrow={guild.name} />
      <nav className="mb-6 flex flex-wrap justify-center gap-2" aria-label="Charter sections">
        {pages.map((p) => (
          <a key={p.id} href={`#${p.slug}`} className="btn btn-ghost btn-sm">
            {p.title}
          </a>
        ))}
        {ranks.length > 0 && (
          <a href="#ranks" className="btn btn-ghost btn-sm">
            Ranks
          </a>
        )}
      </nav>
      <div className="space-y-8">
        {pages.map((p) => (
          <article key={p.id} id={p.slug} className="parchment scroll-mt-20 p-5 sm:p-8">
            <h2 className="text-center text-xl font-bold text-crimson-deep sm:text-2xl">{p.title}</h2>
            <hr className="rule-gold mx-auto my-3 w-32" />
            <Markdown>{p.bodyMd}</Markdown>
          </article>
        ))}
        {ranks.length > 0 && (
          <section id="ranks" className="panel scroll-mt-20 p-5 sm:p-8" aria-labelledby="ranks-heading">
            <h2 id="ranks-heading" className="text-center text-xl font-bold text-gold sm:text-2xl">
              Ranks of the Order
            </h2>
            <hr className="rule-gold mx-auto my-3 w-32" />
            <ol className="grid gap-4 sm:grid-cols-2">
              {ranks.map((r) => {
                const insignia = insigniaFor(r);
                return (
                  <li key={r.id} className="flex items-start gap-4 rounded-lg bg-ink/60 p-3">
                    <RankInsignia insignia={insignia} tier={r.tier} size={64} className="shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-display text-lg text-gold">{r.name}</h3>
                      <p className="text-xs tracking-wider text-gold-dim uppercase">{TIER_LABELS[r.tier]}</p>
                      {r.description && <p className="mt-1 text-sm text-bone">{r.description}</p>}
                      <p className="mt-1 text-xs text-muted italic">{INSIGNIA_INFO[insignia].meaning}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
