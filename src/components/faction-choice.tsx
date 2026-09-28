import { FactionIcon } from "@/components/faction-icon";
import { FACTION_LABELS, FACTIONS } from "@/lib/game";

/** Alliance / Horde as crest-and-label radio cards. A guild has exactly one faction. */
export function FactionChoice({
  name = "faction",
  defaultValue,
  value,
  onChange,
  disabled,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="faction-choice">
      {FACTIONS.map((f) => (
        <label
          key={f}
          className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 text-sm has-checked:border-gold-dim has-checked:bg-gold/10 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-gold-dim"
        >
          <input
            type="radio"
            name={name}
            value={f}
            required
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            {...(value !== undefined
              ? { checked: value === f, onChange: () => onChange?.(f) }
              : { defaultChecked: defaultValue === f })}
          />
          <FactionIcon faction={f} size={32} decorative />
          <span className="font-display tracking-wide text-bone">{FACTION_LABELS[f]}</span>
        </label>
      ))}
    </div>
  );
}
