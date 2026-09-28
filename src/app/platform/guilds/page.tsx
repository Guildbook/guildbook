import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { listDirectoryGuilds } from "@/server/services/platform";
import { GuildCard } from "../guild-card";

export const metadata: Metadata = {
  title: "Guild directory",
  description: "World of Warcraft: Forever guilds on Guildbook that welcome new members.",
};

export default async function DirectoryPage() {
  const [current, guilds] = await Promise.all([getRequestHost(), listDirectoryGuilds(db)]);

  return (
    <div>
      <PageHeader title="Guild directory" eyebrow="Guildbook">
        Guilds that chose to be listed. Officers can list theirs under Admin, then Guild.
      </PageHeader>
      {guilds.length === 0 ? (
        <p className="text-center text-muted">
          No guilds are listed yet. <Link href="/create" className="link">Create the first one</Link>.
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
