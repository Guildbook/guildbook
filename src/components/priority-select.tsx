"use client";

import { Listbox } from "@/components/listbox";
import { PriorityIcon } from "@/components/priority-icon";

const PRIORITIES = ["closed", "low", "medium", "high"] as const;
type Priority = (typeof PRIORITIES)[number];

const OPTIONS = PRIORITIES.map((p) => ({
  value: p,
  label: p[0]!.toUpperCase() + p.slice(1),
  icon: p === "closed" ? undefined : <PriorityIcon priority={p} size={18} />,
}));

/** Recruitment priority listbox with each open priority's icon. */
export function PrioritySelect({ name, defaultValue = "medium", className }: { name: string; defaultValue?: Priority; className?: string }) {
  return <Listbox name={name} aria-label="Priority" options={OPTIONS} defaultValue={defaultValue} className={className} />;
}
