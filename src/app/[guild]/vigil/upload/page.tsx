import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { VigilUploadFlow } from "@/components/vigil/upload-flow";
import { db } from "@/db";
import { guildHref } from "@/lib/paths";
import { requirePage } from "@/server/context";
import { listOwnCharacters } from "@/server/services/characters";
import { getVigilPreferences } from "@/server/services/vigil";

export const metadata: Metadata = { title: "Upload a combat log" };

export default async function VigilUploadPage({ params }: PageProps<"/[guild]/vigil/upload">) {
  const { guild: slug } = await params;
  const { actor } = await requirePage(slug, "vigil.use", guildHref(slug, "/vigil/upload"));
  const [characters, prefs] = await Promise.all([listOwnCharacters(db, actor), getVigilPreferences(db, actor)]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Upload a combat log" eyebrow="Vigil">
        In game, type <code className="text-gold">/combatlog</code> (or <code className="text-gold">/vigil log on</code>) before
        you fight, then pick <code className="text-gold">Logs/WoWCombatLog.txt</code> here.
      </PageHeader>
      <VigilUploadFlow
        slug={slug}
        defaultVisibility={prefs.defaultVisibility}
        characters={characters.map((c) => ({
          id: c.id,
          name: c.name,
          surname: c.surname,
          wowClass: c.wowClass,
          level: c.level,
          isMain: c.isMain,
        }))}
      />
    </div>
  );
}
