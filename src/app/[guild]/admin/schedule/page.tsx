import type { Metadata } from "next";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { PageHeader, Panel } from "@/components/ui";
import { Listbox } from "@/components/listbox";
import { FACTION_OPTIONS } from "@/components/select-options";
import { db } from "@/db";
import type { raidScheduleSlots } from "@/db/schema";
import { DAYS_OF_WEEK } from "@/lib/game";
import { timezoneAbbrev } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import { deleteScheduleSlotAction, saveScheduleSlotAction } from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { listScheduleSlots } from "@/server/services/content";

export const metadata: Metadata = { title: "Raid Schedule" };

function SlotFields({ slot, showFaction }: { slot?: typeof raidScheduleSlots.$inferSelect; showFaction: boolean }) {
  return (
    <div className={`grid gap-3 sm:items-end ${showFaction ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
      {slot && <input type="hidden" name="id" value={slot.id} />}
      <Field label="Day" name="dayOfWeek">
        <Listbox
          name="dayOfWeek"
          aria-label="Day"
          options={DAYS_OF_WEEK.map((d, i) => ({ value: String(i), label: d }))}
          defaultValue={String(slot?.dayOfWeek ?? 2)}
        />
      </Field>
      <Field label="Start" name="startTime">
        <input name="startTime" type="time" className="field" defaultValue={slot?.startTime ?? "20:00"} required />
      </Field>
      <Field label="End" name="endTime">
        <input name="endTime" type="time" className="field" defaultValue={slot?.endTime ?? "23:00"} required />
      </Field>
      <Field label="Label" name="label">
        <input name="label" className="field" defaultValue={slot?.label ?? "Main raid"} required />
      </Field>
      {showFaction && (
        <Field label="Faction" name="faction">
          <Listbox name="faction" aria-label="Faction" options={[{ value: "", label: "Both" }, ...FACTION_OPTIONS]} defaultValue={slot?.faction ?? ""} />
        </Field>
      )}
    </div>
  );
}

export default async function SchedulePage({ params }: PageProps<"/[guild]/admin/schedule">) {
  const { guild: slug } = await params;
  const { guild } = await requirePage(slug, "schedule.edit", guildHref(slug, "/admin/schedule"));
  const slots = await listScheduleSlots(db, guild.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Raid Schedule" eyebrow={`Times in server time (${timezoneAbbrev(guild.timezone)})`} />
      {slots.map((slot) => (
        <Panel key={slot.id}>
          <ActionForm action={saveScheduleSlotAction.bind(null, slug)} className="space-y-3">
            <SlotFields slot={slot} showFaction={!guild.faction} />
            <div className="flex items-center gap-3">
              <SubmitButton variant="ghost" size="sm">
                Save
              </SubmitButton>
              <FormMessage />
            </div>
          </ActionForm>
          <ActionForm action={deleteScheduleSlotAction.bind(null, slug, slot.id)} className="mt-2" confirm="Delete this raid night?">
            <SubmitButton variant="danger" size="sm">
              Delete
            </SubmitButton>
          </ActionForm>
        </Panel>
      ))}
      <Panel title="Add raid night">
        <ActionForm action={saveScheduleSlotAction.bind(null, slug)} className="space-y-3">
          <SlotFields showFaction={!guild.faction} />
          <FormMessage />
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
