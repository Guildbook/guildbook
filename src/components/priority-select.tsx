"use client";

import clsx from "clsx";
import { useState } from "react";
import { isOpenPriority, PriorityIcon } from "@/components/priority-icon";

const PRIORITIES = ["closed", "low", "medium", "high"] as const;
type Priority = (typeof PRIORITIES)[number];

/** Native priority select with the chosen priority's icon inside the field. */
export function PrioritySelect({ name, defaultValue = "medium", className }: { name: string; defaultValue?: Priority; className?: string }) {
  const [priority, setPriority] = useState<Priority>(defaultValue);
  const icon = isOpenPriority(priority);
  return (
    <div className={clsx("relative", className)}>
      {icon && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 flex -translate-y-1/2">
          <PriorityIcon priority={priority} size={18} />
        </span>
      )}
      <select
        name={name}
        aria-label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority)}
        className={clsx("field", icon && "pl-9")}
      >
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p[0]!.toUpperCase() + p.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
