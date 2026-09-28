import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClassName, PageHeader, Panel } from "@/components/ui";
import { FightReportView } from "@/components/vigil/report-view";
import { ReportVisibilityForm } from "@/components/vigil/visibility-form";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import { VISIBILITY_LABELS } from "@/lib/vigil/visibility";
import { deleteVigilReportAction } from "@/server/actions/vigil";
import { requirePage } from "@/server/context";
import { NotFoundError } from "@/server/errors";
import { getVigilReport } from "@/server/services/vigil";

export const metadata: Metadata = { title: "Vigil report" };

export default async function VigilReportPage({ params }: PageProps<"/[guild]/vigil/reports/[id]">) {
  const { guild: slug, id } = await params;
  const { guild, actor } = await requirePage(slug, "vigil.use", guildHref(slug, `/vigil/reports/${id}`));
  let row;
  try {
    row = await getVigilReport(db, actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { report } = row;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title={row.fightLabel} eyebrow="Vigil report">
        {row.characterName && row.characterClass ? (
          <ClassName wowClass={row.characterClass}>
            {row.characterName} {row.characterSurname}
          </ClassName>
        ) : (
          <span className="text-bone">{row.playerName}</span>
        )}
        {!row.isOwner && row.ownerName && <span> ({row.ownerName})</span>}
        <span>, {formatDateTime(row.fightStartedAt, guild.timezone)}</span>
      </PageHeader>

      {row.isOwner ? (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ReportVisibilityForm slug={slug} id={row.id} value={row.visibility} />
            <ActionForm action={deleteVigilReportAction.bind(null, slug, row.id)} confirm="Delete this report?">
              <SubmitButton size="sm" variant="danger" pendingLabel="Deleting…">
                Delete
              </SubmitButton>
              <FormMessage />
            </ActionForm>
          </div>
        </Panel>
      ) : (
        <p className="text-center text-xs text-muted">{VISIBILITY_LABELS[row.visibility]} by its owner.</p>
      )}

      <FightReportView report={report} />
    </div>
  );
}
