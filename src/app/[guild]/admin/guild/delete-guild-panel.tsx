import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { Panel } from "@/components/ui";
import { db } from "@/db";
import type { Actor } from "@/lib/authz/policy";
import { deleteGuildAction } from "@/server/actions/account";
import { canDeleteGuild } from "@/server/services/account";

/** Owner-only danger zone at the bottom of guild settings. */
export async function DeleteGuildPanel({ slug, name, actor }: { slug: string; name: string; actor: Actor }) {
  if (!(await canDeleteGuild(db, actor))) return null;
  if (process.env.DEFAULT_GUILD_SLUG && process.env.DEFAULT_GUILD_SLUG === slug) return null;
  return (
    <Panel title="Delete this guild" className="border-red-900/60">
      <div className="space-y-3 text-sm text-muted" data-testid="delete-guild">
        <p>
          Permanently deletes {name} and everything in it: members, characters, applications, pages, schedule, progression,
          Vigil reports, custom domains and the audit log. Members keep their Guildbook accounts. This can&apos;t be undone.
        </p>
        <ConfirmDeleteForm
          action={deleteGuildAction.bind(null, slug)}
          expected={name}
          buttonLabel="Delete guild"
          pendingLabel="Deleting…"
        />
      </div>
    </Panel>
  );
}
