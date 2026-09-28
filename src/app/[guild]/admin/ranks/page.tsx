import type { Metadata } from "next";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { RankInsignia } from "@/components/rank-insignia";
import { PageHeader, Panel } from "@/components/ui";
import { Listbox } from "@/components/listbox";
import { db } from "@/db";
import { RANK_TIERS, type RankTier, TIER_LABELS } from "@/lib/authz/tiers";
import { MAX_IN_GAME_RANKS } from "@/lib/game";
import { DEFAULT_INSIGNIA_BY_TIER, INSIGNIA, INSIGNIA_INFO, insigniaFor, insigniaMeaning } from "@/lib/insignia";
import { guildHref } from "@/lib/paths";
import {
  createRankAction,
  deleteRankAction,
  moveRankAction,
  setRankDefaultsAction,
  updateRankAction,
} from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { listRanks } from "@/server/services/ranks";

export const metadata: Metadata = { title: "Ranks" };

function InsigniaPicker({ value, tier, preset }: { value: string | null; tier: RankTier; preset: string }) {
  const options = [
    { key: "", label: `Tier default (${INSIGNIA_INFO[DEFAULT_INSIGNIA_BY_TIER[tier]].label})`, insignia: DEFAULT_INSIGNIA_BY_TIER[tier] },
    ...INSIGNIA.map((key) => ({ key, label: INSIGNIA_INFO[key].label, insignia: key })),
  ];
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">Insignia</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
        {options.map((o) => (
          <label
            key={o.key || "default"}
            title={insigniaMeaning(o.insignia, { preset })}
            className="relative flex cursor-pointer flex-col items-center gap-1 rounded border border-line p-2 text-center text-[11px] leading-tight text-muted hover:border-gold-dim has-[:checked]:border-gold has-[:checked]:text-gold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold"
          >
            <input type="radio" name="insignia" value={o.key} defaultChecked={(value ?? "") === o.key} className="sr-only" />
            <RankInsignia insignia={o.insignia} tier={tier} size={36} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RankFields({
  preset,
  defaults,
}: {
  preset: string;
  defaults?: { name: string; description: string; tier: RankTier; insignia: string | null; inGame: boolean };
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
        <Field label="Name" name="name">
          <input id="name" name="name" className="field" defaultValue={defaults?.name} required />
        </Field>
        <Field label="Description" name="description">
          <input id="description" name="description" className="field" defaultValue={defaults?.description} />
        </Field>
        <Field label="Tier" name="tier">
          <Listbox
            id="tier"
            name="tier"
            options={RANK_TIERS.map((t) => ({ value: t, label: TIER_LABELS[t] }))}
            defaultValue={defaults?.tier ?? "member"}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="inGame" defaultChecked={defaults?.inGame ?? true} className="h-5 w-5 accent-crimson" />
          In-game
        </label>
      </div>
      <InsigniaPicker value={defaults?.insignia ?? null} tier={defaults?.tier ?? "member"} preset={preset} />
    </div>
  );
}

export default async function RanksPage({ params }: PageProps<"/[guild]/admin/ranks">) {
  const { guild: slug } = await params;
  const { guild } = await requirePage(slug, "rank.manage", guildHref(slug, "/admin/ranks"));
  const ranks = await listRanks(db, guild.id);
  const inGameCount = ranks.filter((r) => r.inGame).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Ranks" eyebrow={`${inGameCount} of ${MAX_IN_GAME_RANKS} in-game ranks used`}>
        The permission tier decides what a rank can do. Renaming or reordering a rank does not change its permissions.
        List ranks from highest to lowest, as in game, where a guild has up to {MAX_IN_GAME_RANKS} ranks of up to 15
        characters each.
      </PageHeader>

      <ol className="space-y-3">
        {ranks.map((r, i) => (
          <li key={r.id} className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 font-display text-gold">
                <RankInsignia insignia={insigniaFor(r)} tier={r.tier} size={32} />
                {r.sortOrder}. {r.name}
              </span>
              <div className="flex gap-1">
                <ActionForm action={moveRankAction.bind(null, slug, r.id, "up")}>
                  <button type="submit" className="btn btn-ghost btn-sm" disabled={i === 0} aria-label={`Move ${r.name} up`}>
                    ↑
                  </button>
                </ActionForm>
                <ActionForm action={moveRankAction.bind(null, slug, r.id, "down")}>
                  <button type="submit" className="btn btn-ghost btn-sm" disabled={i === ranks.length - 1} aria-label={`Move ${r.name} down`}>
                    ↓
                  </button>
                </ActionForm>
                <ActionForm action={deleteRankAction.bind(null, slug, r.id)} confirm={`Delete the rank ${r.name}?`}>
                  <SubmitButton variant="danger" size="sm">
                    Delete
                  </SubmitButton>
                  <FormMessage />
                </ActionForm>
              </div>
            </div>
            <ActionForm action={updateRankAction.bind(null, slug, r.id)} className="space-y-2">
              <RankFields preset={guild.preset} defaults={r} />
              <div className="flex items-center gap-3">
                <SubmitButton variant="ghost" size="sm">
                  Save
                </SubmitButton>
                <FormMessage />
              </div>
            </ActionForm>
          </li>
        ))}
      </ol>

      <Panel title="Add rank">
        <ActionForm action={createRankAction.bind(null, slug)} className="space-y-3">
          <RankFields preset={guild.preset} />
          <FormMessage />
          <SubmitButton>Add rank</SubmitButton>
        </ActionForm>
      </Panel>

      <Panel title="Application ranks">
        <ActionForm action={setRankDefaultsAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-3 sm:items-end">
          {(
            [
              ["applicantRankId", "Applicants (website)", guild.applicantRankId],
              ["acceptRankId", "Accepted applicants", guild.acceptRankId],
              ["trialRankId", "Trial members", guild.trialRankId],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label} name={name}>
              <Listbox
                id={name}
                name={name}
                options={ranks.map((r) => ({ value: r.id, label: r.name, description: TIER_LABELS[r.tier] }))}
                defaultValue={value ?? undefined}
              />
            </Field>
          ))}
          <div className="sm:col-span-3">
            <FormMessage />
            <SubmitButton variant="ghost">Save</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
