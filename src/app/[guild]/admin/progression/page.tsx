import type { Metadata } from "next";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { FactionBadge, PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { FACTION_LABELS, FACTIONS } from "@/lib/game";
import { formatDate } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import {
  createBossAction,
  createInstanceAction,
  deleteBossKillAction,
  recordBossKillAction,
} from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { getProgression } from "@/server/services/content";

export const metadata: Metadata = { title: "Progression" };

export default async function AdminProgressionPage({ params }: PageProps<"/[guild]/admin/progression">) {
  const { guild: slug } = await params;
  const { guild } = await requirePage(slug, "progression.edit", guildHref(slug, "/admin/progression"));
  const progression = await getProgression(db, guild.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: guild.timezone }).format(new Date());

  return (
    <div className="space-y-6">
      <PageHeader title="Progression" />

      <Panel title="Record a kill">
        <ActionForm
          action={recordBossKillAction.bind(null, slug)}
          className={`grid gap-3 sm:items-end ${guild.faction ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}
        >
          <Field label="Boss" name="bossId">
            <select id="bossId" name="bossId" className="field" required>
              {progression.map((i) => (
                <optgroup key={i.id} label={i.name}>
                  {i.bosses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          {!guild.faction && (
            <Field label="Faction" name="faction">
              <select id="faction" name="faction" className="field">
                {FACTIONS.map((f) => (
                  <option key={f} value={f}>
                    {FACTION_LABELS[f]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Date" name="killedOn">
            <input id="killedOn" name="killedOn" type="date" className="field" defaultValue={today} required />
          </Field>
          <SubmitButton>Record kill</SubmitButton>
          <input type="hidden" name="note" value="" />
          <div className="sm:col-span-full">
            <FormMessage />
          </div>
        </ActionForm>
      </Panel>

      {progression.map((instance) => (
        <Panel key={instance.id} title={`${instance.name} (${instance.size})`}>
          <ul className="divide-y divide-line text-sm">
            {instance.bosses.map((boss) => (
              <li key={boss.id} className="py-2">
                <p className="font-semibold">{boss.name}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {boss.kills.map((k) => (
                    <li key={k.id} className="flex items-center gap-1.5 rounded border border-line px-2 py-0.5 text-xs">
                      {!guild.faction && <FactionBadge faction={k.faction} />}
                      {formatDate(k.killedAt, guild.timezone)}
                      <ActionForm action={deleteBossKillAction.bind(null, slug, k.id)} confirm="Delete this kill record?">
                        <button type="submit" className="ml-1 text-red-300" aria-label="Delete kill">
                          ×
                        </button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <ActionForm action={createBossAction.bind(null, slug)} className="mt-3 flex gap-2" resetOnSuccess>
            <input type="hidden" name="instanceId" value={instance.id} />
            <input name="name" className="field" placeholder="New boss name" aria-label="New boss name" required />
            <SubmitButton variant="ghost" size="sm">
              Add boss
            </SubmitButton>
            <FormMessage />
          </ActionForm>
        </Panel>
      ))}

      <Panel title="Add raid instance">
        <ActionForm action={createInstanceAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-4 sm:items-end" resetOnSuccess>
          <Field label="Name" name="name">
            <input id="inst-name" name="name" className="field" required />
          </Field>
          <Field label="Short name" name="shortName">
            <input id="inst-short" name="shortName" className="field" required />
          </Field>
          <Field label="Size" name="size">
            <select id="inst-size" name="size" className="field" defaultValue="40">
              {[10, 20, 25, 40].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <SubmitButton>Add instance</SubmitButton>
          <div className="sm:col-span-4">
            <FormMessage />
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
