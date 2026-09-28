"use client";

import clsx from "clsx";
import { useState } from "react";
import { ClassIcon } from "@/components/class-icon";
import { CLASS_INFO, CLASSES, type WowClass } from "@/lib/game";

/** Native class select with the chosen class's icon inside the field. */
export function ClassSelect({ name, className }: { name: string; className?: string }) {
  const [wowClass, setWowClass] = useState<WowClass>(CLASSES[0]);
  return (
    <div className={clsx("relative", className)}>
      <ClassIcon wowClass={wowClass} size={20} decorative className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2" />
      <select
        name={name}
        aria-label="Class"
        value={wowClass}
        onChange={(e) => setWowClass(e.target.value as WowClass)}
        className="field pl-9"
        style={{ color: CLASS_INFO[wowClass].color }}
      >
        {CLASSES.map((c) => (
          <option key={c} value={c} style={{ color: CLASS_INFO[c].color }}>
            {CLASS_INFO[c].label}
          </option>
        ))}
      </select>
    </div>
  );
}
