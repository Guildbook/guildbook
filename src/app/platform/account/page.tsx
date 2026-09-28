import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmDeleteForm } from "@/components/confirm-delete-form";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { deleteAccountAction } from "@/server/actions/account";
import { getSessionUser } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { getAccountOverview } from "@/server/services/account";

export const metadata: Metadata = { title: "Account and privacy", robots: { index: false } };

const STATUS_LABEL = { active: "Member", applicant: "Applicant", former: "Former member" } as const;

export default async function AccountPage({ searchParams }: PageProps<"/platform/account">) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    if (params.deleted === "1") {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Account deleted" eyebrow="Guildbook" />
          <Panel>
            <p data-testid="account-deleted">
              Your Guildbook account and the data tied to it have been deleted. Guild audit logs now show your past actions
              as &quot;Deleted user&quot;. You can sign in again at any time to start fresh.
            </p>
          </Panel>
        </div>
      );
    }
    redirect("/login?callbackUrl=%2Faccount");
  }

  const overview = await getAccountOverview(db, user.id);
  if (!overview) redirect("/login?callbackUrl=%2Faccount");
  const current = await getRequestHost();
  const { plan } = overview;
  const guildDeleted = typeof params.guildDeleted === "string" ? params.guildDeleted : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Account and privacy" eyebrow="Guildbook">
        Signed in with Discord as <span className="text-bone">{overview.displayName}</span>
        {overview.user.discordUsername && overview.user.discordUsername !== overview.displayName && (
          <span> (@{overview.user.discordUsername})</span>
        )}
        .
      </PageHeader>

      {guildDeleted && (
        <p role="status" className="panel border-emerald-700/50 p-4 text-sm text-emerald-300">
          The guild {guildDeleted} has been deleted.
        </p>
      )}

      <Panel title="Your guilds">
        {overview.guilds.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t joined or applied to a guild yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {overview.guilds.map((g) => (
              <li key={g.slug} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <a href={guildOrigin(g.slug, current)} className="font-semibold text-bone hover:text-gold">
                  {g.name}
                </a>
                <span className="text-muted">
                  {g.status === "active" ? g.rankName : STATUS_LABEL[g.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
        {overview.battletag && (
          <p className="mt-4 text-xs text-muted">
            Battle.net linked as {overview.battletag}. Unlink it from any guild&apos;s character page.
          </p>
        )}
      </Panel>

      <Panel title="Export your data">
        <p className="mb-4 text-sm text-muted">
          Download everything Guildbook stores about you as a JSON file: your profile, guild memberships, characters,
          applications, Vigil reports and the audit entries you made.
        </p>
        <a href="/api/account/export" download className="btn btn-ghost" data-testid="export-data">
          Download my data
        </a>
      </Panel>

      <Panel title="Delete your account" className="border-red-900/60">
        <div className="space-y-3 text-sm text-muted" data-testid="delete-account">
          <p>
            This permanently deletes your Guildbook account: your Discord sign-in, Battle.net link, guild memberships,
            characters, applications, Vigil reports and companion devices. Entries in guild audit logs are kept, with your
            name replaced by &quot;Deleted user&quot;. This can&apos;t be undone.
          </p>
          {plan.soloGuilds.length > 0 && (
            <p className="text-bone">
              You&apos;re the only member of {plan.soloGuilds.map((g) => g.name).join(", ")}, so{" "}
              {plan.soloGuilds.length === 1 ? "that guild" : "those guilds"} will be deleted too.
            </p>
          )}
          {plan.blockers.length > 0 ? (
            <div role="alert" className="rounded border border-red-900/60 p-3 text-red-200" data-testid="delete-blocked">
              <p className="font-semibold">You&apos;re the only admin of {plan.blockers.map((g) => g.name).join(", ")}.</p>
              <p className="mt-1">
                Before deleting your account, promote another member to an admin rank on the guild&apos;s admin{" "}
                <span className="text-bone">Members</span> page, or delete the guild from its admin{" "}
                <span className="text-bone">Guild</span> page.
              </p>
              <ul className="mt-2 flex flex-wrap gap-3">
                {plan.blockers.map((g) => (
                  <li key={g.slug}>
                    <a href={`${guildOrigin(g.slug, current)}/admin/members`} className="text-gold underline-offset-2 hover:underline">
                      Manage {g.name} members
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ConfirmDeleteForm
              action={deleteAccountAction}
              expected={overview.displayName}
              buttonLabel="Delete my account"
              pendingLabel="Deleting…"
            />
          )}
        </div>
      </Panel>

      <p className="text-center text-xs text-muted">
        See the <Link href="/privacy" className="text-gold hover:underline">Privacy Policy</Link> for what we store and why.
      </p>
    </div>
  );
}
