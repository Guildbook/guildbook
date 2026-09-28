import clsx from "clsx";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { ClassSpecFields } from "@/components/class-spec-fields";
import { VerifiedMark } from "@/components/ui";
import type { CharacterWithProfessions } from "@/server/services/characters";
import type { ActionResult } from "@/server/action-types";
import { MAX_LEVEL, MAX_PROFESSION_SKILL, PROFESSION_LABELS, PROFESSIONS } from "@/lib/game";

export function CharacterForm({
  action,
  character,
  submitLabel,
  showFaction,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  character?: CharacterWithProfessions;
  submitLabel: string;
  showFaction: boolean;
}) {
  const skillFor = (p: string) => character?.professions.find((x) => x.profession === p);
  const verified = Boolean(character?.verified);
  const lockedStyle = verified ? "cursor-default opacity-90" : undefined;
  return (
    <ActionForm action={action} className="space-y-5">
      {verified && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <VerifiedMark size={12} decorative />
          Name, class and level come from Battle.net and update when the guild syncs.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="name">
          <input id="name" name="name" className={clsx("field", lockedStyle)} required maxLength={12} defaultValue={character?.name} readOnly={verified} autoComplete="off" />
        </Field>
        <Field label="Surname" name="surname">
          <input id="surname" name="surname" className="field" required maxLength={12} defaultValue={character?.surname} autoComplete="off" />
        </Field>
      </div>
      <ClassSpecFields
        showFaction={showFaction && !verified}
        lockedClass={verified ? character?.wowClass : undefined}
        defaults={character && { faction: character.faction, wowClass: character.wowClass, spec: character.spec, role: character.role }}
      />
      <Field label="Level" name="level">
        <input id="level" name="level" type="number" min={1} max={MAX_LEVEL} className={clsx("field", lockedStyle)} required defaultValue={character?.level ?? MAX_LEVEL} readOnly={verified} />
      </Field>
      <fieldset>
        <legend className="field-label">Professions</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFESSIONS.map((p) => {
            const current = skillFor(p);
            return (
              <div key={p} className="flex items-center gap-2 rounded border border-line px-3 py-2">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input type="checkbox" name="professions" value={p} defaultChecked={Boolean(current)} className="h-5 w-5 accent-crimson" />
                  {PROFESSION_LABELS[p]}
                </label>
                <input
                  type="number"
                  name={`skill_${p}`}
                  min={1}
                  max={MAX_PROFESSION_SKILL}
                  placeholder="Skill"
                  aria-label={`${PROFESSION_LABELS[p]} skill`}
                  defaultValue={current?.skill ?? undefined}
                  className="field w-20 min-h-9 py-1 text-sm"
                />
              </div>
            );
          })}
        </div>
        <FieldError name="professions" />
      </fieldset>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="isMain" defaultChecked={character?.isMain} className="h-5 w-5 accent-crimson" />
        This is my main character
      </label>
      <FormMessage />
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
