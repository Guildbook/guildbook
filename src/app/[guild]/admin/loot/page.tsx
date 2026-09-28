import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { LootTable } from "@/components/loot-table";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { can } from "@/lib/authz/policy";
import { fullName } from "@/lib/game";
import { LOOT_RESPONSE_LABELS, LOOT_RESPONSES } from "@/lib/loot/constants";
import { dateInZone } from "@/lib/loot/time";
import { guildHref } from "@/lib/paths";
import { awardLootAction, reverseLootAction } from "@/server/actions/loot";
import { requirePage } from "@/server/context";
import { awardFormOptions, listLoot } from "@/server/services/loot";

export const metadata: Metadata = { title: "Loot" };

export default async function AdminLootPage({ params }: PageProps<"/[guild]/admin/loot">) {
  const { guild: slug } = await params;
  const { guild, actor } = await requirePage(slug, "loot.award", guildHref(slug, "/admin/loot"));
  const [options, recent] = await Promise.all([awardFormOptions(db, actor), listLoot(db, actor, { limit: 50 })]);
  const today = dateInZone(new Date(), guild.timezone);
  const canReverse = can(actor, "loot.reverse");

  return (
    <div className="space-y-6">
      <PageHeader title="Loot" eyebrow="Record what the raid handed out">
        Award items one at a time here, or{" "}
        <Link href={guildHref(slug, "/admin/loot/import")} className="text-gold hover:underline">
          import a Gargul or RCLootCouncil export
        </Link>
        . Awards can&apos;t be edited; reverse a mistake and record it again.
      </PageHeader>

      <Panel title="Quick award">
        <ActionForm action={awardLootAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Item" name="item" hint="Item ID, in-game link, Wowhead link, or a known item's name">
            <input id="item" name="item" className="field" list="loot-items" required autoComplete="off" />
          </Field>
          <datalist id="loot-items">
            {options.items.map((i) => (
              <option key={i.itemId} value={`${i.name} (#${i.itemId})`} />
            ))}
          </datalist>
          <Field label="Recipient" name="characterId" hint="Leave empty when it was disenchanted or banked">
            <select id="characterId" name="characterId" className="field" defaultValue="">
              <option value="">Nobody</option>
              {options.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c.name, c.surname)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Awarded for" name="response">
            <select id="response" name="response" className="field" defaultValue="main_spec">
              {LOOT_RESPONSES.map((r) => (
                <option key={r} value={r}>
                  {LOOT_RESPONSE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Boss" name="bossId">
            <select id="bossId" name="bossId" className="field" defaultValue="">
              <option value="">Not recorded</option>
              {options.bosses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.instanceName}, {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Raid night" name="awardedOn">
            <input id="awardedOn" name="awardedOn" type="date" className="field" defaultValue={today} max={today} required />
          </Field>
          <Field label="Note" name="note">
            <input id="note" name="note" className="field" maxLength={300} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-full">
            <SubmitButton pendingLabel="Recording…">Record award</SubmitButton>
            <FormMessage />
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Recent loot">
        <LootTable
          slug={slug}
          rows={recent}
          actions={
            canReverse
              ? (row) =>
                  row.reversal ? null : (
                    <ActionForm
                      action={reverseLootAction.bind(null, slug, row.id)}
                      confirm={`Reverse ${row.itemName}? The award stays in the history, struck through.`}
                      className="flex min-w-56 items-start gap-2"
                    >
                      <label className="sr-only" htmlFor={`reason-${row.id}`}>
                        Reason for reversing {row.itemName}
                      </label>
                      <input id={`reason-${row.id}`} name="reason" className="field py-1 text-xs" placeholder="Reason" required maxLength={300} />
                      <SubmitButton size="sm" variant="ghost" pendingLabel="Reversing…">
                        Reverse
                      </SubmitButton>
                      <FormMessage />
                    </ActionForm>
                  )
              : undefined
          }
        />
      </Panel>
    </div>
  );
}
