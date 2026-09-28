import { BothFactionsIcon, FactionIcon } from "@/components/faction-icon";
import { FACTION_LABELS, FACTIONS } from "@/lib/game";

const OPTIONS = [...FACTIONS.map((f) => ({ value: f, label: FACTION_LABELS[f] })), { value: "", label: "Both factions" }];

/** Alliance / Horde / Both as crest-and-label radio cards. The empty value means both factions. */
export function FactionChoice({
  name = "faction",
  defaultValue,
  value,
  onChange,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" data-testid="faction-choice">
      {OPTIONS.map((o) => (
        <label
          key={o.value || "both"}
          className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 text-sm has-checked:border-gold-dim has-checked:bg-gold/10 has-focus-visible:outline-2 has-focus-visible:outline-gold-dim"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            className="absolute inset-0 cursor-pointer opacity-0"
            {...(value !== undefined
              ? { checked: value === o.value, onChange: () => onChange?.(o.value) }
              : { defaultChecked: (defaultValue ?? "") === o.value })}
          />
          {o.value === "alliance" || o.value === "horde" ? (
            <FactionIcon faction={o.value} size={32} decorative />
          ) : (
            <BothFactionsIcon size={26} />
          )}
          <span className="font-display tracking-wide text-bone">{o.label}</span>
        </label>
      ))}
    </div>
  );
}
