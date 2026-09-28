"use client";

import { useState } from "react";
import { Field } from "@/components/action-form";
import {
  CLASS_INFO,
  CLASSES,
  FACTION_LABELS,
  FACTIONS,
  type Faction,
  ROLE_LABELS,
  ROLES,
  type RaidRole,
  type WowClass,
} from "@/lib/game";

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
          <select id="faction" name="faction" className="field" defaultValue={defaults?.faction ?? "alliance"}>
            {FACTIONS.map((f) => (
              <option key={f} value={f}>
                {FACTION_LABELS[f]}
              </option>
            ))}
          </select>
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
          <select
            id="wowClass"
            name="wowClass"
            className="field"
            value={wowClass}
            style={{ color: CLASS_INFO[wowClass].color }}
            onChange={(e) => {
              const next = e.target.value as WowClass;
              setWowClass(next);
              setSpec(CLASS_INFO[next].specs[0] ?? "");
            }}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c} style={{ color: CLASS_INFO[c].color }}>
                {CLASS_INFO[c].label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Spec" name="spec">
        <select id="spec" name="spec" className="field" value={spec} onChange={(e) => setSpec(e.target.value)}>
          {specs.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Raid role" name="role">
        <select id="role" name="role" className="field" defaultValue={defaults?.role ?? "melee"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
