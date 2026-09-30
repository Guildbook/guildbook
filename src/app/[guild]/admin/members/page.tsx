import type { Metadata } from "next";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { RankInsignia } from "@/components/rank-insignia";
import { CharacterLink, FactionBadge, PageHeader, Tag, VerifiedMark } from "@/components/ui";
import { Listbox } from "@/components/listbox";
import { db } from "@/db";
import { canAssignRank } from "@/lib/authz/policy";
import { TIER_LABELS, tierLevel } from "@/lib/authz/tiers";
import { formatDateTime } from "@/lib/format";
import { fullName } from "@/lib/game";
import { insigniaFor } from "@/lib/insignia";
import { guildHref } from "@/lib/paths";
import { assignRankAction, removeMemberAction } from "@/server/actions/admin";
import { syncCharactersAction } from "@/server/actions/battlenet";
import { battlenetEnabled, blizzardConfigFromEnv } from "@/server/blizzard";
import { requirePage } from "@/server/context";
import { getSyncStatus } from "@/server/services/battlenet";
import { listMembers, listRanks } from "@/server/services/ranks";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/[guild]/admin/members">) {
  const { guild: slug } = await params;
  const { guild, actor } = await requirePage(slug, "admin.area", guildHref(slug, "/admin/members"));
  const [members, ranks, sync] = await Promise.all([
    listMembers(db, actor),
    listRanks(db, guild.id),
    getSyncStatus(db, actor),
  ]);
  const bnetEnabled = battlenetEnabled(blizzardConfigFromEnv());
  const assignable = ranks.filter((r) => r.tier !== "applicant" && tierLevel(r.tier) <= tierLevel(actor.tier));

  return (
    <div>
      <PageHeader title="Members" eyebrow={`${members.length} active`} />
      {(bnetEnabled || sync.verified > 0) && (
        <section className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-3" data-testid="battlenet-sync">
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-1.5">
              <VerifiedMark size={12} decorative />
              {sync.verified} Battle.net verified {sync.verified === 1 ? "character" : "characters"}
            </p>
            <p className="text-xs text-muted">
              {sync.lastSyncedAt ? `Last synced ${formatDateTime(sync.lastSyncedAt, guild.timezone)}` : "Not synced yet"}. Levels
              also sync daily.
            </p>
          </div>
          {bnetEnabled && (
            <ActionForm action={syncCharactersAction.bind(null, slug)} className="flex flex-col items-end gap-1">
              <SubmitButton variant="ghost" size="sm" pendingLabel="Syncing…">
                Sync now
              </SubmitButton>
              <FormMessage />
            </ActionForm>
          )}
        </section>
      )}
      <ul className="space-y-2">
        {members.map((m) => {
          const editable = m.membershipId !== actor.membershipId && canAssignRank(actor, m.rankTier, "member");
          return (
            <li key={m.membershipId} className="panel flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {m.mainId && m.mainClass && m.mainName && m.mainSurname !== null ? (
                    <CharacterLink guildSlug={slug} character={{ id: m.mainId, name: m.mainName, surname: m.mainSurname, wowClass: m.mainClass }} />
                  ) : (
                    <span className="text-muted">No main</span>
                  )}
                  <span className="ml-2 text-sm font-normal text-muted">
                    {m.userName} {m.discordUsername && `(@${m.discordUsername})`}
                  </span>
                </p>
                <p className="flex items-center gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5 text-gold-dim">
                    <RankInsignia insignia={insigniaFor({ insignia: m.rankInsignia, tier: m.rankTier })} tier={m.rankTier} size={18} />
                    {m.rankName}
                  </span>
                  <Tag>{TIER_LABELS[m.rankTier]}</Tag>
                  {m.leftInGameGuild && (
                    <span className="rounded border border-gold-dim px-1.5 py-0.5 text-gold" data-testid="left-in-game-guild">
                      Left the in-game guild
                    </span>
                  )}
                  {!guild.faction && m.mainFaction && <FactionBadge faction={m.mainFaction} />}
                </p>
              </div>
              {editable && (
                <div className="flex flex-wrap items-center gap-2">
                  <ActionForm action={assignRankAction.bind(null, slug)} className="flex items-center gap-2">
                    <input type="hidden" name="membershipId" value={m.membershipId} />
                    <Listbox
                      name="rankId"
                      aria-label="Rank"
                      options={assignable.map((r) => ({
                        value: r.id,
                        label: r.name,
                        icon: <RankInsignia insignia={insigniaFor(r)} tier={r.tier} size={16} />,
                      }))}
                      defaultValue={m.rankId}
                      size="sm"
                      className="w-44"
                    />
                    <SubmitButton variant="ghost" size="sm">
                      Set
                    </SubmitButton>
                    <FormMessage />
                  </ActionForm>
                  <ActionForm
                    action={removeMemberAction.bind(null, slug, m.membershipId)}
                    confirm={`Remove ${m.mainName && m.mainSurname !== null ? fullName(m.mainName, m.mainSurname) : m.userName} from the guild?`}
                  >
                    <SubmitButton variant="danger" size="sm">
                      Remove
                    </SubmitButton>
                    <FormMessage />
                  </ActionForm>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
