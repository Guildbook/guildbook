import type { Metadata } from "next";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { CompanionPairing } from "@/components/vigil/companion-pairing";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import { VISIBILITY_LABELS } from "@/lib/vigil/visibility";
import { revokeCompanionDeviceAction } from "@/server/actions/vigil";
import { requirePage } from "@/server/context";
import { getRequestHost } from "@/server/hosts";
import { getVigilPreferences } from "@/server/services/vigil";
import { listCompanionDevices } from "@/server/services/vigil-companion";

export const metadata: Metadata = { title: "Connect Vigil companion" };

export default async function VigilCompanionPage({ params }: PageProps<"/[guild]/vigil/companion">) {
  const { guild: slug } = await params;
  const { guild, actor } = await requirePage(slug, "vigil.use", guildHref(slug, "/vigil/companion"));
  const [devices, prefs, current] = await Promise.all([listCompanionDevices(db, actor), getVigilPreferences(db, actor), getRequestHost()]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Connect Vigil companion" eyebrow="Live analysis on your second screen">
        The companion app watches your combat log file while you play, shows rotation callouts as they happen and
        uploads each fight here. It only reads the log on disk; it never touches the game.
      </PageHeader>

      <Panel title="Get the app">
        <div className="flex flex-wrap items-center gap-4">
          <p className="min-w-0 flex-1 text-sm text-muted">
            Vigil runs on Windows, macOS and Linux and keeps itself up to date. The download page also covers turning on
            combat logging.
          </p>
          <a href={`${current.apexOrigin}/vigil`} className="btn btn-primary" data-testid="companion-download-link">
            Download the companion
          </a>
        </div>
      </Panel>

      <Panel title="Pair a computer">
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Open the Vigil companion and go to Settings.</li>
          <li>Create a code below and enter it under Pair with the site, or click Open in the companion.</li>
          <li>
            New reports use your default sharing (
            <strong className="text-bone">{prefs.defaultVisibility === "private" ? "Private" : VISIBILITY_LABELS[prefs.defaultVisibility]}</strong>)
            unless you choose otherwise in the app.
          </li>
        </ol>
        <CompanionPairing slug={slug} />
      </Panel>

      <Panel title="Paired companions" actions={<span className="text-xs text-muted">{devices.length} active</span>}>
        {devices.length === 0 ? (
          <EmptyState>No companions paired yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line" data-testid="companion-devices">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-bone">{d.name}</span>
                  <span className="block text-xs text-muted">
                    Token ending {d.tokenHint}, paired {formatDateTime(d.createdAt, guild.timezone)}
                    {d.lastUsedAt ? `, last used ${formatDateTime(d.lastUsedAt, guild.timezone)}` : ", not used yet"}
                  </span>
                </span>
                <ActionForm
                  action={revokeCompanionDeviceAction.bind(null, slug, d.id)}
                  confirm={`Revoke ${d.name}? It will stop uploading until you pair it again.`}
                  className="flex items-center gap-2"
                >
                  <SubmitButton size="sm" variant="danger" pendingLabel="Revoking…">
                    Revoke
                  </SubmitButton>
                  <FormMessage />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
