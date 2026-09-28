import type { Metadata } from "next";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClassIcon } from "@/components/class-icon";
import { ClassSelect } from "@/components/class-select";
import { isOpenPriority, PriorityIcon } from "@/components/priority-icon";
import { PrioritySelect } from "@/components/priority-select";
import { ClassName, FactionBadge, PageHeader, Panel, RoleBadge } from "@/components/ui";
import { db } from "@/db";
import { FACTION_LABELS, FACTIONS, ROLE_LABELS, ROLES } from "@/lib/game";
import { guildHref } from "@/lib/paths";
import { setRecruitmentNeedAction, setRecruitmentOpenAction } from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { listRecruitmentNeeds } from "@/server/services/content";

export const metadata: Metadata = { title: "Recruitment" };

export default async function RecruitmentPage({ params }: PageProps<"/[guild]/admin/recruitment">) {
  const { guild: slug } = await params;
  const { guild } = await requirePage(slug, "recruitment.edit", guildHref(slug, "/admin/recruitment"));
  const needs = await listRecruitmentNeeds(db, guild.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Recruitment" />
      <Panel>
        <ActionForm action={setRecruitmentOpenAction.bind(null, slug, !guild.recruitmentOpen)} className="flex flex-wrap items-center gap-3">
          <p>
            Recruitment is <strong className="text-gold">{guild.recruitmentOpen ? "open" : "closed"}</strong>.
          </p>
          <SubmitButton variant={guild.recruitmentOpen ? "danger" : "primary"} size="sm">
            {guild.recruitmentOpen ? "Close recruitment" : "Open recruitment"}
          </SubmitButton>
          <FormMessage />
        </ActionForm>
      </Panel>

      <Panel title="Set a need">
        <ActionForm action={setRecruitmentNeedAction.bind(null, slug)} className="grid gap-3 sm:grid-cols-6 sm:items-end">
          <ClassSelect name="wowClass" className="sm:col-span-1" />
          <select name="role" className="field" aria-label="Role">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {!guild.faction && (
            <select name="faction" className="field" aria-label="Faction">
              <option value="">Either faction</option>
              {FACTIONS.map((f) => (
                <option key={f} value={f}>
                  {FACTION_LABELS[f]}
                </option>
              ))}
            </select>
          )}
          <PrioritySelect name="priority" />
          <input name="note" className="field" placeholder="Note (optional)" aria-label="Note" />
          <SubmitButton>Save</SubmitButton>
          <div className="sm:col-span-6">
            <FormMessage />
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Current needs">
        <ul className="divide-y divide-line text-sm">
          {needs
            .filter((n) => n.priority !== "closed")
            .map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2">
                    <ClassIcon wowClass={n.wowClass} size={24} decorative />
                    <ClassName wowClass={n.wowClass} />
                  </span>
                  <RoleBadge role={n.role} />
                  {!guild.faction && n.faction && <FactionBadge faction={n.faction} />}
                  {n.note && <span className="text-muted italic">{n.note}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {isOpenPriority(n.priority) && <PriorityIcon priority={n.priority} size={18} />}
                  <ActionForm action={setRecruitmentNeedAction.bind(null, slug)}>
                    <input type="hidden" name="wowClass" value={n.wowClass} />
                    <input type="hidden" name="role" value={n.role} />
                    <input type="hidden" name="faction" value={n.faction ?? ""} />
                    <input type="hidden" name="priority" value="closed" />
                    <SubmitButton variant="ghost" size="sm">
                      Close
                    </SubmitButton>
                  </ActionForm>
                </span>
              </li>
            ))}
        </ul>
      </Panel>
    </div>
  );
}
