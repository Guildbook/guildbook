import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { db } from "@/db";
import { can } from "@/lib/authz/policy";
import { guildHref } from "@/lib/paths";
import { publishGuildAction } from "@/server/actions/setup";
import type { Guild, Viewer } from "@/server/context";
import { getGuildSetup } from "@/server/services/guild-setup";

/** Tells a draft guild's admins that the site is unlisted, with Publish once the minimum setup is done. */
export async function DraftBanner({ guild, viewer }: { guild: Guild; viewer: Viewer }) {
  if (guild.publishedAt || !can(viewer.actor, "guild.settings")) return null;
  const { summary } = await getGuildSetup(db, viewer.actor);
  return (
    <aside className="border-b border-gold-dim/50 bg-gold/5" data-testid="draft-banner" aria-label="Draft guild">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm">
        <p className="flex-1 text-bone">
          <strong className="font-display tracking-wider text-gold uppercase">Draft: not yet public.</strong>{" "}
          <span className="text-muted">
            Anyone with the link can visit. The guild is hidden from the directory and search engines, and applications open
            once you publish.
          </span>
        </p>
        {summary.canPublish ? (
          <ActionForm action={publishGuildAction.bind(null, guild.slug)} className="flex items-center gap-2">
            <SubmitButton variant="gold" size="sm" pendingLabel="Publishing…">
              Publish
            </SubmitButton>
            <FormMessage />
          </ActionForm>
        ) : (
          <Link href={guildHref(guild.slug, "/admin/setup#publish")} className="btn btn-ghost btn-sm">
            {summary.publishMissing.length === 1 ? "1 step left to publish" : `${summary.publishMissing.length} steps left to publish`}
          </Link>
        )}
      </div>
    </aside>
  );
}
