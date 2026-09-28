import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { BlizzardItemAttribution, ItemLink } from "@/components/item-link";
import { ClassName, PageHeader, Panel, Tag } from "@/components/ui";
import { Listbox } from "@/components/listbox";
import { db } from "@/db";
import { fullName } from "@/lib/game";
import { formatDateTime } from "@/lib/format";
import { LOOT_RESPONSE_LABELS, LOOT_SOURCE_LABELS } from "@/lib/loot/constants";
import { GARGUL_DEFAULT_TEMPLATE } from "@/lib/loot/parsers/gargul";
import { LOOT_PARSERS } from "@/lib/loot/parsers";
import { guildHref } from "@/lib/paths";
import { commitLootImportAction, discardLootImportAction, previewLootImportAction } from "@/server/actions/loot";
import { requirePage } from "@/server/context";
import { DomainError } from "@/server/errors";
import { getImportPreview, type MatchVia } from "@/server/services/loot";

export const metadata: Metadata = { title: "Import loot" };

const VIA_LABELS: Record<MatchVia, string> = {
  alias: "Remembered from an earlier import",
  name: "Matched by full name",
  first_name: "Matched by first name, please check",
};

export default async function ImportLootPage({ params, searchParams }: PageProps<"/[guild]/admin/loot/import">) {
  const { guild: slug } = await params;
  const { batch: batchId } = await searchParams;
  const { guild, actor } = await requirePage(slug, "loot.import", guildHref(slug, "/admin/loot/import"));
  const crumbs = [{ label: "Loot", href: guildHref(slug, "/admin/loot") }, { label: "Import" }];

  if (typeof batchId === "string") {
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) notFound();
    let preview;
    try {
      preview = await getImportPreview(db, actor, batchId);
    } catch (err) {
      if (err instanceof DomainError) notFound();
      throw err;
    }
    const { batch, rows, names, characters, duplicateCount } = preview;
    const parser = LOOT_PARSERS.find((p) => p.id === batch.parserId);
    const fresh = rows.length - duplicateCount;
    const decisionOptions = [
      { value: "name", label: "Keep the name only" },
      { value: "skip", label: "Leave these awards out" },
      ...characters.map((c) => ({ value: `char:${c.id}`, label: fullName(c.name, c.surname), group: "Guild characters" })),
    ];

    return (
      <div className="space-y-6">
        <Breadcrumbs items={[...crumbs.slice(0, 1), { label: "Import", href: guildHref(slug, "/admin/loot/import") }, { label: "Review" }]} />
        <PageHeader title="Review import" eyebrow={parser?.label ?? LOOT_SOURCE_LABELS[batch.source]}>
          {rows.length} award{rows.length === 1 ? "" : "s"} read
          {duplicateCount > 0 && `, ${duplicateCount} already in the ledger and skipped`}. Nothing is recorded until you commit.
        </PageHeader>

        {batch.warnings.length > 0 && (
          <Panel title="Lines that couldn't be read">
            <ul className="space-y-1 text-sm text-muted">
              {batch.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>
                  Line {w.line}: {w.message}
                </li>
              ))}
              {batch.warnings.length > 20 && <li>And {batch.warnings.length - 20} more.</li>}
            </ul>
          </Panel>
        )}

        <ActionForm action={commitLootImportAction.bind(null, slug, batch.id)} className="space-y-6">
          <Panel title="Recipients">
            {names.length === 0 ? (
              <p className="text-sm text-muted">No player names in this export.</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted">
                  Match each name in the export to a character. Pugs and players who aren&apos;t on the roster can keep just their name.
                </p>
                <ul className="divide-y divide-line">
                  {names.map((n) => (
                    <li key={n.key} className="grid gap-2 py-2 sm:grid-cols-[1fr_minmax(0,18rem)] sm:items-center">
                      <div>
                        <p className="font-semibold text-bone">
                          {n.display} <span className="text-xs font-normal text-muted">({n.count})</span>
                        </p>
                        <p className="text-xs text-muted">{n.match ? VIA_LABELS[n.match.via] : "No match on the roster"}</p>
                      </div>
                      <Listbox
                        name={`decision:${n.key}`}
                        aria-label={`Who is ${n.display}?`}
                        options={decisionOptions}
                        defaultValue={n.match ? `char:${n.match.character.id}` : "name"}
                        searchable={characters.length > 12}
                        searchPlaceholder="Search characters"
                      />
                    </li>
                  ))}
                </ul>
                <label className="mt-4 flex items-center gap-3 text-sm">
                  <input type="checkbox" name="remember" defaultChecked className="h-5 w-5 accent-crimson" />
                  Remember these matches for future imports
                </label>
              </>
            )}
          </Panel>

          <Panel title="Awards">
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full text-left text-sm">
                <thead className="text-xs tracking-wider text-muted uppercase">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-4 font-normal">When</th>
                    <th className="py-2 pr-4 font-normal">Item</th>
                    <th className="py-2 pr-4 font-normal">Player</th>
                    <th className="py-2 pr-4 font-normal">Awarded for</th>
                    <th className="py-2 font-normal">Boss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.index} className={r.duplicate ? "opacity-50" : undefined}>
                      <td className="py-2 pr-4 whitespace-nowrap text-muted">
                        {formatDateTime(new Date(r.row.awardedAt), guild.timezone)}
                        {r.row.timePrecision === "day" && <span className="block text-xs">Date only</span>}
                      </td>
                      <td className="py-2 pr-4">
                        <ItemLink itemId={r.row.itemId} name={r.itemName} quality={r.quality} icon={r.icon} />
                        {r.duplicate && <Tag className="ml-2">Already recorded</Tag>}
                      </td>
                      <td className="py-2 pr-4">
                        {r.row.recipient ? (
                          r.row.recipient.wowClass ? (
                            <ClassName wowClass={r.row.recipient.wowClass}>{r.row.recipient.name}</ClassName>
                          ) : (
                            <span className="text-bone">{r.row.recipient.name}</span>
                          )
                        ) : (
                          <span className="text-muted">Nobody</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-muted">
                        {LOOT_RESPONSE_LABELS[r.row.response]}
                        {r.row.responseText && <span className="block text-xs">{r.row.responseText}</span>}
                      </td>
                      <td className="py-2 text-muted">{[r.row.instance, r.row.boss].filter(Boolean).join(", ") || "Unknown"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.some((r) => r.itemFromBlizzard || r.icon) && <BlizzardItemAttribution />}
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Committing…">
              Commit {fresh} award{fresh === 1 ? "" : "s"}
            </SubmitButton>
            <FormMessage />
          </div>
        </ActionForm>

        <ActionForm action={discardLootImportAction.bind(null, slug, batch.id)} confirm="Discard this import?">
          <SubmitButton variant="ghost" size="sm" pendingLabel="Discarding…">
            Discard import
          </SubmitButton>
          <FormMessage />
        </ActionForm>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={crumbs} />
      <PageHeader title="Import loot" eyebrow="Gargul and RCLootCouncil">
        Paste an export from the addon. You&apos;ll review names and awards before anything is recorded, and awards already in
        the ledger are skipped, so importing the same raid twice is safe.
      </PageHeader>

      <Panel title="Paste an export">
        <ActionForm action={previewLootImportAction.bind(null, slug)} className="space-y-4">
          <Field label="Export" name="raw" hint="Gargul: open the award history and export it (JSON, TMB or custom). RCLootCouncil: /rc history, then export as CSV or JSON.">
            <textarea id="raw" name="raw" className="field min-h-64 font-mono text-xs" required spellCheck={false} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Format" name="parserId">
              <Listbox
                id="parserId"
                name="parserId"
                options={[{ value: "", label: "Detect automatically" }, ...LOOT_PARSERS.map((p) => ({ value: p.id, label: p.label }))]}
                defaultValue=""
              />
            </Field>
            <Field label="Gargul custom format" name="template" hint={`Only for Gargul's custom export. Default: ${GARGUL_DEFAULT_TEMPLATE}`}>
              <input id="template" name="template" className="field font-mono text-xs" placeholder={GARGUL_DEFAULT_TEMPLATE} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Reading…">Preview import</SubmitButton>
            <FormMessage />
          </div>
        </ActionForm>
      </Panel>
    </div>
  );
}
