import type { Metadata } from "next";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { AddonIcon } from "@/components/addon-icon";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import type { addons } from "@/db/schema";
import { ADDON_ICON_INFO, addonIconFor } from "@/lib/addon-icons";
import { guildHref } from "@/lib/paths";
import { deleteAddonAction, saveAddonAction } from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { listAddons } from "@/server/services/content";

export const metadata: Metadata = { title: "Addons" };

const STATUSES = [
  ["planned", "Planned"],
  ["in_development", "In development"],
  ["beta", "Beta"],
  ["released", "Released"],
] as const;

function AddonFields({ addon }: { addon?: typeof addons.$inferSelect }) {
  const p = addon?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addon && <input type="hidden" name="id" value={addon.id} />}
      <Field label="Name" name="name">
        <input id={`${p}-name`} name="name" className="field" defaultValue={addon?.name} required />
      </Field>
      <Field label="Slug" name="slug">
        <input id={`${p}-slug`} name="slug" className="field" defaultValue={addon?.slug} required />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Summary" name="summary">
          <input id={`${p}-summary`} name="summary" className="field" defaultValue={addon?.summary} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description (Markdown)" name="descriptionMd">
          <textarea id={`${p}-desc`} name="descriptionMd" className="field" defaultValue={addon?.descriptionMd} />
        </Field>
      </div>
      <Field label="Status" name="status">
        <select id={`${p}-status`} name="status" className="field" defaultValue={addon?.status ?? "planned"}>
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Version" name="version">
        <input id={`${p}-version`} name="version" className="field" defaultValue={addon?.version ?? ""} />
      </Field>
      <Field label="Download URL (https)" name="downloadUrl">
        <input id={`${p}-dl`} name="downloadUrl" type="url" className="field" defaultValue={addon?.downloadUrl ?? ""} />
      </Field>
      <Field label="Source URL (https)" name="sourceUrl">
        <input id={`${p}-src`} name="sourceUrl" type="url" className="field" defaultValue={addon?.sourceUrl ?? ""} />
      </Field>
    </div>
  );
}

export default async function AdminAddonsPage({ params }: PageProps<"/[guild]/admin/addons">) {
  const { guild: slug } = await params;
  const { guild } = await requirePage(slug, "addons.edit", guildHref(slug, "/admin/addons"));
  const list = await listAddons(db, guild.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Addons" />
      {list.map((a) => (
        <Panel key={a.id}>
          <div className="mb-4 flex items-center gap-3">
            <AddonIcon addon={a} size={32} className="shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gold">{a.name}</h2>
              <p className="text-xs text-muted">Icon: {ADDON_ICON_INFO[addonIconFor(a)].label}, chosen from the slug or name</p>
            </div>
          </div>
          <ActionForm action={saveAddonAction.bind(null, slug)} className="space-y-3">
            <AddonFields addon={a} />
            <div className="flex items-center gap-3">
              <SubmitButton variant="ghost" size="sm">
                Save
              </SubmitButton>
              <FormMessage />
            </div>
          </ActionForm>
          <ActionForm action={deleteAddonAction.bind(null, slug, a.id)} className="mt-2" confirm={`Delete ${a.name}?`}>
            <SubmitButton variant="danger" size="sm">
              Delete
            </SubmitButton>
          </ActionForm>
        </Panel>
      ))}
      <Panel title="Add addon">
        <ActionForm action={saveAddonAction.bind(null, slug)} className="space-y-3" resetOnSuccess>
          <AddonFields />
          <FormMessage />
          <SubmitButton>Add addon</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
