import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { RankInsignia } from "@/components/rank-insignia";
import { PresetChoices } from "@/components/rank-preset-choices";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { db } from "@/db";
import { TIER_LABELS } from "@/lib/authz/tiers";
import { can } from "@/lib/authz/policy";
import type { SetupStep } from "@/lib/guild-setup";
import { insigniaFor } from "@/lib/insignia";
import { DEFAULT_RANK_PRESET } from "@/lib/rank-presets";
import { guildHref } from "@/lib/paths";
import {
  applyRankPresetAction,
  confirmRanksAction,
  createDraftInviteAction,
  dismissSetupAction,
  neutralDefaultsAction,
  publishGuildAction,
  skipSetupStepAction,
  unpublishGuildAction,
} from "@/server/actions/setup";
import { requirePage } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { getGuildSetup } from "@/server/services/guild-setup";
import { isPreLaunch, verificationSupported } from "@/server/services/guild-verification";
import { VERSION_INFO } from "@/lib/game-versions";
import { listRanks } from "@/server/services/ranks";
import { SetupProgress, STEP_COPY, StepStatusIcon } from "./steps";

export const metadata: Metadata = { title: "Setup" };

function SkipButton({ slug, step }: { slug: string; step: SetupStep }) {
  if (step.status === "done" || step.key === "publish") return null;
  const skipped = step.status === "skipped";
  return (
    <ActionForm action={skipSetupStepAction.bind(null, slug, step.key, !skipped)} toast={false}>
      <SubmitButton variant="ghost" size="sm" pendingLabel={skipped ? "Restoring…" : "Skipping…"}>
        {skipped ? "Undo skip" : "Skip for now"}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function SetupPage({ params }: PageProps<"/[guild]/admin/setup">) {
  const { guild: slug } = await params;
  const { actor } = await requirePage(slug, "guild.settings", guildHref(slug, "/admin/setup"));
  const [{ guild, facts, summary }, ranks, current] = await Promise.all([getGuildSetup(db, actor), listRanks(db, actor.guildId), getRequestHost()]);
  const siteUrl = guildOrigin(guild.slug, current);
  const h = (path: string) => guildHref(slug, path);
  const order = guild.preset === "order";
  const canManageRanks = can(actor, "rank.manage");
  const founderNotGm = !guild.verifiedAt ? guild.setup.founderNotGm : undefined;
  const inviteUrl = guild.setup.inviteCode ? `${siteUrl}/apply?invite=${guild.setup.inviteCode}` : null;

  const extra: Partial<Record<SetupStep["key"], ReactNode>> = {
    ranks: !order && canManageRanks && (
      <div className="space-y-4">
        <div>
          <p className="field-label">Your ranks now</p>
          <ol className="flex flex-wrap gap-2">
            {ranks.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-bone">
                <RankInsignia insignia={insigniaFor(r)} tier={r.tier} size={18} />
                {r.name}
                <span className="text-muted">{TIER_LABELS[r.tier]}</span>
              </li>
            ))}
          </ol>
        </div>
        {!summary.offerNeutralDefaults && (
          <>
            <ActionForm
              action={applyRankPresetAction.bind(null, slug)}
              className="space-y-3"
              confirm="Replace your rank names with this preset? Members keep their permission level, and anyone on a rank the preset doesn't have moves to the closest one."
            >
              <PresetChoices name="preset" defaultKey={DEFAULT_RANK_PRESET} />
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton variant="ghost" size="sm" pendingLabel="Applying…">
                  Apply preset
                </SubmitButton>
                <FormMessage />
              </div>
            </ActionForm>
            {summary.steps.find((s) => s.key === "ranks")?.status !== "done" && (
              <ActionForm action={confirmRanksAction.bind(null, slug)} className="flex flex-wrap items-center gap-3">
                <SubmitButton size="sm" pendingLabel="Confirming…">
                  Keep these ranks
                </SubmitButton>
                <span className="text-xs text-muted">You can still edit them any time.</span>
                <FormMessage />
              </ActionForm>
            )}
          </>
        )}
      </div>
    ),
    invite: (
      <div className="space-y-2 text-sm">
        <p>
          Your site: <a href={siteUrl} className="link font-mono break-all">{siteUrl.replace(/^https?:\/\//, "")}</a>
        </p>
        {!guild.publishedAt &&
          (guild.setup.inviteCode ? (
            <p data-testid="draft-invite">
              While you are a draft, guildmates apply through this private link:{" "}
              <span className="font-mono break-all text-bone">{`${siteUrl}/apply?invite=${guild.setup.inviteCode}`}</span>
            </p>
          ) : (
            <ActionForm action={createDraftInviteAction.bind(null, slug)} className="flex flex-wrap items-center gap-3">
              <span className="text-muted">Applications open when you publish. Until then, guildmates can apply through a private link.</span>
              <SubmitButton variant="ghost" size="sm" pendingLabel="Creating…">
                Create invite link
              </SubmitButton>
              <FormMessage />
            </ActionForm>
          ))}
      </div>
    ),
    verify: !verificationSupported(guild.gameVersion) ? (
      <p className="rounded border border-gold-dim/60 bg-gold/5 px-3 py-2 text-sm text-bone" data-testid="setup-verify-coming-soon">
        This can wait. Battle.net verification for {VERSION_INFO[guild.gameVersion].label} guilds is coming soon; skip this step
        for now.
      </p>
    ) : isPreLaunch(new Date(), guild.gameVersion) && (
      <p className="rounded border border-gold-dim/60 bg-gold/5 px-3 py-2 text-sm text-bone">
        This can wait. Verification opens once WoW: Forever characters exist, from launch on Nov 4, 2026, and it needs the
        in-game Guild Master&apos;s own Battle.net account.
      </p>
    ),
    publish: (
      <div id="publish" className="scroll-mt-24 space-y-3">
        {guild.publishedAt ? (
          <ActionForm
            action={unpublishGuildAction.bind(null, slug)}
            confirm="Return the guild to a draft? It leaves the directory and search engines, and applications close until you publish again."
            className="flex flex-wrap items-center gap-3"
          >
            <p className="text-sm text-bone">Your guild is public.</p>
            <SubmitButton variant="ghost" size="sm" pendingLabel="Unpublishing…">
              Return to draft
            </SubmitButton>
            <FormMessage />
          </ActionForm>
        ) : (
          <>
            {summary.publishMissing.length > 0 && (
              <div className="text-sm" data-testid="publish-missing">
                <p className="text-bone">Before you publish:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  {summary.publishMissing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <ActionForm action={publishGuildAction.bind(null, slug)} className="flex flex-wrap items-center gap-3">
              <fieldset disabled={!summary.canPublish} className="disabled:opacity-50">
                <SubmitButton variant="gold" pendingLabel="Publishing…">
                  Publish guild
                </SubmitButton>
              </fieldset>
              <FormMessage />
            </ActionForm>
          </>
        )}
      </div>
    ),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`Set up ${guild.name}`} eyebrow="Guild setup">
        <div className="mx-auto max-w-md space-y-2">
          <p className="text-sm" data-testid="setup-progress">
            {summary.done} of {summary.total} steps done
          </p>
          <SetupProgress done={summary.done} total={summary.total} />
        </div>
      </PageHeader>

      {founderNotGm && (
        <Panel title="The Guild Master verifies" className="border-gold-dim/70" actions={<Tag>Unverified</Tag>}>
          <div className="space-y-2 text-sm" data-testid="founder-not-gm">
            <p className="leading-relaxed text-bone">
              {founderNotGm.characterName} is in {guild.name} in game
              {founderNotGm.rank != null ? ` (rank ${founderNotGm.rank})` : ""}, but isn&apos;t its Guild Master. Your guild
              works fully as an unverified draft; only the in-game Guild Master can verify it.
            </p>
            <p className="leading-relaxed text-muted">
              Send the Guild Master this invite link. Once they have joined, give them an admin rank under Members; they link
              Battle.net on My Characters and check verification under Guild Settings. After that you can hand them the top
              rank from the same panel.
            </p>
            {inviteUrl && (
              <p data-testid="founder-invite">
                Invite link: <span className="font-mono break-all text-bone">{inviteUrl}</span>
              </p>
            )}
          </div>
        </Panel>
      )}

      {summary.offerNeutralDefaults && (
        <Panel title="Start from neutral defaults" className="border-gold-dim/70" actions={<Tag>Recommended</Tag>}>
          <div className="space-y-4 text-sm" data-testid="neutral-defaults">
            <p className="leading-relaxed text-muted">
              Your guild still has the Order of Saint Michael&apos;s{" "}
              {facts.ranksMatchOrder && facts.contentMatchesOrder ? "ranks and pages" : facts.ranksMatchOrder ? "ranks" : "pages"}, from
              before new guilds got neutral defaults. Replace them with a starter ladder and starter pages. Members keep their permission level, pages you
              have rewritten stay as they are, and the old text is kept in the page history.
            </p>
            <ActionForm
              action={neutralDefaultsAction.bind(null, slug)}
              className="space-y-3"
              confirm="Replace the Order of Saint Michael's ranks and unedited pages with neutral defaults?"
            >
              <PresetChoices name="preset" defaultKey={DEFAULT_RANK_PRESET} />
              <div className="flex flex-wrap items-center gap-3">
                <SubmitButton pendingLabel="Replacing…">Use neutral defaults</SubmitButton>
                <FormMessage />
              </div>
            </ActionForm>
          </div>
        </Panel>
      )}

      <ol className="space-y-3" data-testid="setup-steps">
        {summary.steps.map((step, i) => {
          const copy = STEP_COPY[step.key];
          return (
            <li key={step.key} className="panel p-4 sm:p-5" data-testid={`setup-step-${step.key}`} data-status={step.status}>
              <div className="flex items-start gap-3">
                <StepStatusIcon status={step.status} className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={step.status === "todo" ? "font-display text-gold" : "font-display text-gold-dim"}>
                      <span className="text-muted">{i + 1}.</span> {copy.title}
                    </h2>
                    {step.requiredToPublish && step.status !== "done" && !guild.publishedAt && <Tag>Needed to publish</Tag>}
                    {step.status === "skipped" && <Tag>Skipped</Tag>}
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{copy.body}</p>
                  {extra[step.key]}
                  {step.key !== "publish" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={h(copy.href)} className={step.status === "done" ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
                        {step.status === "done" ? "Review" : copy.cta}
                      </Link>
                      <SkipButton slug={slug} step={step} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted">
        {summary.dismissed ? (
          <ActionForm action={dismissSetupAction.bind(null, slug, false)}>
            <SubmitButton variant="ghost" size="sm">
              Show this checklist on the admin home
            </SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={dismissSetupAction.bind(null, slug, true)}>
            <SubmitButton variant="ghost" size="sm">
              Hide this checklist from the admin home
            </SubmitButton>
          </ActionForm>
        )}
        <Link href={h("/admin")} className="link">
          Go to the admin home
        </Link>
      </div>
    </div>
  );
}
