import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm, Field, FormMessage } from "@/components/action-form";
import { ClassName, FactionBadge, PageHeader, Panel, RoleBadge, StatusPill, VerificationBadge } from "@/components/ui";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format";
import { CLASS_INFO, fullName } from "@/lib/game";
import { guildHref } from "@/lib/paths";
import { reviewApplicationAction } from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { getApplication } from "@/server/services/applications";
import { listRanks } from "@/server/services/ranks";

export const metadata: Metadata = { title: "Review Application" };

export default async function ApplicationDetailPage({ params }: PageProps<"/[guild]/admin/applications/[id]">) {
  const { guild: slug, id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { guild, actor } = await requirePage(slug, "application.review", guildHref(slug, `/admin/applications/${id}`));
  const row = await getApplication(db, actor, id);
  if (!row) notFound();
  const { application: a, applicant } = row;
  const applicantRank = (await listRanks(db, guild.id)).find((r) => r.id === guild.applicantRankId);

  const answers = [
    { label: "Raid experience", value: a.raidExperience },
    { label: "Availability", value: a.availability },
    { label: "Why this guild", value: a.whyThisGuild },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={fullName(a.characterName, a.characterSurname)} eyebrow={applicantRank?.name ?? "Applicant"} />
      <Panel actions={<StatusPill status={a.status} />} title="Application">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span>
            <span className="text-muted">Level {a.level}</span>{" "}
            <ClassName wowClass={a.wowClass}>
              {a.spec} {CLASS_INFO[a.wowClass].label}
            </ClassName>
          </span>
          {!guild.faction && <FactionBadge faction={a.faction} />}
          <RoleBadge role={a.role} />
          <VerificationBadge verified={a.verified} />
        </div>
        <dl className="space-y-4">
          <div>
            <dt className="field-label">Battle.net</dt>
            <dd>
              {a.verified ? (
                <>
                  Name, class and level were read from {a.battletag ?? "the applicant's Battle.net account"}
                  {a.bnetSnapshotAt && <span className="text-muted"> ({formatDateTime(a.bnetSnapshotAt, guild.timezone)})</span>}
                  . Surname, spec and role are the applicant&apos;s own.
                </>
              ) : (
                <span className="text-muted">Entered by hand; not checked against Battle.net.</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="field-label">Discord</dt>
            <dd>
              {a.discordHandle} <span className="text-muted">(signed in as {applicant.discordUsername ?? applicant.name})</span>
            </dd>
          </div>
          {answers.map((q) => (
            <div key={q.label}>
              <dt className="field-label">{q.label}</dt>
              <dd className="whitespace-pre-wrap text-bone/90">{q.value}</dd>
            </div>
          ))}
          <div>
            <dt className="field-label">Submitted</dt>
            <dd>{formatDateTime(a.createdAt, guild.timezone)}</dd>
          </div>
          {a.reviewedAt && (
            <div>
              <dt className="field-label">Decision</dt>
              <dd>
                {a.status} on {formatDateTime(a.reviewedAt, guild.timezone)}
                {a.decisionNote && <p className="mt-1 text-muted italic">{a.decisionNote}</p>}
              </dd>
            </div>
          )}
        </dl>
      </Panel>

      {a.status === "pending" && (
        <Panel title="Decision">
          <ActionForm action={reviewApplicationAction.bind(null, slug)} className="space-y-4">
            <input type="hidden" name="applicationId" value={a.id} />
            <Field label="Note (optional, visible to officers)" name="note">
              <textarea id="note" name="note" className="field" />
            </Field>
            <FormMessage />
            <div className="flex flex-wrap gap-2">
              <button type="submit" name="decision" value="accepted" className="btn btn-primary">
                Accept as member
              </button>
              <button type="submit" name="decision" value="trial" className="btn btn-ghost">
                Offer trial
              </button>
              <button type="submit" name="decision" value="declined" className="btn btn-danger">
                Decline
              </button>
            </div>
          </ActionForm>
          <p className="mt-4 text-xs text-muted">
            Accepting assigns the guild&apos;s configured member rank; a trial assigns the trial rank. Both add the
            applied character to the roster, verified if the application was.
          </p>
        </Panel>
      )}
    </div>
  );
}
