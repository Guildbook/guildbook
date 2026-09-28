"use client";

import { useState } from "react";
import { Field } from "@/components/action-form";
import { CLASS_OPTIONS } from "@/components/class-select";
import { Listbox } from "@/components/listbox";
import { FACTION_OPTIONS, plainOptions, ROLE_OPTIONS } from "@/components/select-options";
import { CLASS_INFO, type Faction, type RaidRole, type WowClass } from "@/lib/game";

/**
 * Faction, class, spec and role pickers. Spec options follow the selected class; any class may be either
 * faction. Single-faction guilds hide the faction picker and the server fills it in. `lockedClass` shows the
 * class read-only (it came from Battle.net) while spec and role stay selectable.
 */
export function ClassSpecFields({
  defaults,
  showFaction = true,
  lockedClass,
}: {
  defaults?: { faction?: Faction; wowClass?: WowClass; spec?: string; role?: RaidRole };
  showFaction?: boolean;
  lockedClass?: WowClass;
}) {
  const [chosenClass, setWowClass] = useState<WowClass>(defaults?.wowClass ?? "warrior");
  const wowClass = lockedClass ?? chosenClass;
  const specs = CLASS_INFO[wowClass].specs;
  const [spec, setSpec] = useState<string>(
    defaults?.spec && specs.includes(defaults.spec) ? defaults.spec : (specs[0] ?? ""),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showFaction && !lockedClass && (
        <Field label="Faction" name="faction">
          <Listbox id="faction" name="faction" options={FACTION_OPTIONS} defaultValue={defaults?.faction ?? "alliance"} />
        </Field>
      )}
      <Field label="Class" name="wowClass">
        {lockedClass ? (
          <>
            <input
              id="wowClass"
              className="field cursor-default opacity-90"
              value={CLASS_INFO[lockedClass].label}
              style={{ color: CLASS_INFO[lockedClass].color }}
              readOnly
            />
            <input type="hidden" name="wowClass" value={lockedClass} />
          </>
        ) : (
          <Listbox
            id="wowClass"
            name="wowClass"
            options={CLASS_OPTIONS}
            value={wowClass}
            onChange={(v) => {
              const next = v as WowClass;
              setWowClass(next);
              setSpec(CLASS_INFO[next].specs[0] ?? "");
            }}
          />
        )}
      </Field>
      <Field label="Spec" name="spec">
        <Listbox id="spec" name="spec" options={plainOptions(specs)} value={spec} onChange={setSpec} />
      </Field>
      <Field label="Raid role" name="role">
        <Listbox id="role" name="role" options={ROLE_OPTIONS} defaultValue={defaults?.role ?? "melee"} />
      </Field>
    </div>
  );
}
