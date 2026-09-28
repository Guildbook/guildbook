import Link from "next/link";
import { GuildbookMark } from "@/components/guildbook-mark";
import { displayDomain } from "@/lib/product-domain";
import { Panel } from "@/components/ui";
import { db } from "@/db";
import { getSessionUser } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { listDirectoryGuilds, listUserGuilds } from "@/server/services/platform";
import { FEATURE_ICONS, type FeatureIcon } from "./feature-icons";
import { GuildCard } from "./guild-card";
import { exampleSites, loadShowcase, SitePreview } from "./site-preview";

/** The guild shown in the home page preview when it is listed in the directory. */
const SHOWCASE_SLUG = "osm";

const features = (domain: string): { icon: FeatureIcon; title: string; body: string }[] => [
  { icon: "address", title: "Your own address", body: `Every guild gets a subdomain like yourguild.${domain}, and can bring its own domain later.` },
  { icon: "applications", title: "Applications", body: "Applicants sign in with Discord and can verify their character through Battle.net." },
  { icon: "roster", title: "Roster and ranks", body: "Your rank ladder, mains and alts, professions and who can do what in the admin." },
  { icon: "raids", title: "Raid nights", body: "Schedule, recruitment needs and progression, shown in your guild's timezone." },
  { icon: "charter", title: "Charter and lore", body: "Markdown pages for your rules, loot policy and story, with a full revision history." },
  { icon: "vigil", title: "Vigil", body: "Members upload combat logs for a private review of each pull: rotation, uptimes and cooldowns." },
];

const steps = [
  { title: "Sign in with Discord", body: "One Guildbook account works for every guild. There are no passwords to remember." },
  { title: "Name your guild", body: "Pick a subdomain, faction and timezone. Your site is live the moment you create it." },
  { title: "Open your doors", body: "Share the link. Recruits apply, officers review and members sign in with the same account." },
];

export default async function PlatformHome() {
  const [user, current] = await Promise.all([getSessionUser(), getRequestHost()]);
  const [mine, directory] = await Promise.all([user ? listUserGuilds(db, user.id) : [], listDirectoryGuilds(db)]);
  const hrefFor = (g: { slug: string; customDomain: string | null }, path = "") => `${guildOrigin(g.slug, current, g.customDomain)}${path}`;
  const domain = displayDomain(current.config.rootDomain);
  const showcase = directory.find((g) => g.slug === SHOWCASE_SLUG) ?? directory[0];
  const now = new Date();
  const previewSites = [
    ...(showcase ? [await loadShowcase(db, showcase, showcase.customDomain ?? `${showcase.slug}.${domain}`, hrefFor(showcase), now)] : []),
    ...exampleSites(domain),
  ];

  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="flex flex-col items-center pt-4 text-center">
        <GuildbookMark className="h-24 w-24 drop-shadow-[0_0_28px_rgba(201,164,76,0.35)] sm:h-28 sm:w-28" />
        <p className="mt-6 font-display text-xs tracking-[0.3em] text-gold/80 uppercase">Guild sites for World of Warcraft: Forever</p>
        <h1 className="mt-3 max-w-3xl font-title text-3xl text-gold sm:text-5xl">A home for your guild</h1>
        <hr className="rule-gold mt-5 w-56" />
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-bone/90">
          Guildbook gives your guild a site of its own: applications, roster, raid schedule, progression and combat log
          reviews, run by your officers.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn btn-gold px-7">
            Create your guild
          </Link>
          <Link href="/guilds" className="btn btn-ghost">
            Browse guilds
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted">Sign in with Discord and your site is ready in a couple of minutes.</p>
      </section>

      {user && (
        <Panel title="Your guilds">
          {mine.length === 0 ? (
            <p className="text-sm text-muted">
              You are not in a guild on Guildbook yet. <Link href="/guilds" className="link">Find one</Link> or{" "}
              <Link href="/create" className="link">create your own</Link>.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="your-guilds">
              {mine.map((g) => (
                <GuildCard key={g.slug} guild={g} href={hrefFor(g)}>
                  <span className="text-gold">{g.status === "applicant" ? "Application pending" : g.rankName}</span>
                  {g.status === "active" && (g.rankTier === "admin" || g.rankTier === "officer") && (
                    <a href={hrefFor(g, "/admin")} className="link">
                      Admin
                    </a>
                  )}
                </GuildCard>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="sr-only">
          What a guild site looks like
        </h2>
        <SitePreview sites={previewSites} now={now} />
      </section>

      <section>
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-gold">Everything a guild needs</h2>
          <p className="mt-2 text-sm text-muted">Built for how guilds actually run, from the first application to the last boss.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features(domain).map((f) => (
            <li key={f.title} className="panel p-5 transition-colors hover:border-gold-dim">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold-dim/60 bg-gold/10 text-gold shadow-[inset_0_1px_0_rgb(230_200_119/0.15)]">
                  {FEATURE_ICONS[f.icon]}
                </span>
                <h3 className="font-display text-base font-semibold text-gold">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-8 text-center text-2xl font-semibold text-gold">Up and running tonight</h2>
        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-dim font-display text-sm font-semibold text-gold">
                {["I", "II", "III"][i]}
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-bone">{s.title}</h3>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {directory.length > 0 && (
        <section>
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold text-gold">Guilds on Guildbook</h2>
            <Link href="/guilds" className="link text-sm">
              See the directory
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {directory.slice(0, 6).map((g) => (
              <GuildCard key={g.slug} guild={g} href={hrefFor(g)}>
                <span>{g.members === 1 ? "1 member" : `${g.members} members`}</span>
              </GuildCard>
            ))}
          </ul>
        </section>
      )}

      <section className="panel flex flex-col items-center px-6 py-10 text-center">
        <h2 className="font-title text-2xl text-gold sm:text-3xl">Raise your banner</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Give your guild an address, a front door for recruits and one place for everything your officers keep track of.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn btn-gold px-7">
            Create your guild
          </Link>
          <Link href="/guilds" className="btn btn-ghost">
            Browse guilds
          </Link>
        </div>
      </section>
    </div>
  );
}
