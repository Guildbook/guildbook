import clsx from "clsx";
import { RULESET_INFO, RULESETS, type Ruleset } from "@/lib/game";

const PATHS: Record<Ruleset, string> = {
  // A shield.
  normal: "M8 1.5 13.5 3.5v4c0 3.3-2.3 5.9-5.5 7-3.2-1.1-5.5-3.7-5.5-7v-4Z",
  // Crossed swords.
  pvp: "M2.5 2.5 9 9M13.5 2.5 7 9M2.5 2.5h2.5M2.5 2.5v2.5M13.5 2.5H11M13.5 2.5V5M5.5 10.5l-2 2M10.5 10.5l2 2M4.5 9.5l2 2M11.5 9.5l-2 2",
  // A theatre mask.
  rp: "M3 3h10v4.5c0 3-2.2 5.5-5 5.5S3 10.5 3 7.5ZM5.5 6.5h1.5M9 6.5h1.5M6 9.5c1.2.8 2.8.8 4 0",
  // A skull.
  hardcore: "M8 2c3 0 5 2 5 4.8 0 1.6-.8 2.7-2 3.3V12H5v-1.9C3.8 9.5 3 8.4 3 6.8 3 4 5 2 8 2ZM6 7h.01M10 7h.01M7 12v1.5M9 12v1.5",
};

export function RulesetIcon({ ruleset, size = 16, className }: { ruleset: Ruleset; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden className={clsx("shrink-0", className)}>
      <path d={PATHS[ruleset]} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small ruleset label for cards and lists, alongside `FactionBadge`. */
export function RulesetBadge({ ruleset }: { ruleset: Ruleset }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-ink-2 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wider text-bone/80 uppercase ring-1 ring-line"
      data-testid="ruleset-badge"
    >
      <RulesetIcon ruleset={ruleset} size={12} className="text-gold-dim" />
      {RULESET_INFO[ruleset].label}
    </span>
  );
}

/** The WoW: Forever rulesets as radio cards, matching `FactionChoice`. */
export function RulesetChoice({
  name = "ruleset",
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
    <div className="grid gap-2 sm:grid-cols-2" data-testid="ruleset-choice">
      {RULESETS.map((r) => {
        const info = RULESET_INFO[r];
        return (
          <label
            key={r}
            className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded border border-line px-3 py-2 text-sm has-checked:border-gold-dim has-checked:bg-gold/10 has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-gold-dim"
          >
            <input
              type="radio"
              name={name}
              value={r}
              required
              disabled={disabled}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              {...(value !== undefined
                ? { checked: value === r, onChange: () => onChange?.(r) }
                : { defaultChecked: defaultValue === r })}
            />
            <RulesetIcon ruleset={r} size={26} className="text-gold" />
            <span className="min-w-0 leading-tight">
              <span className="block font-display tracking-wide text-bone">
                {info.label}
                {info.note && <span className="ml-2 text-[0.65rem] tracking-wider text-gold-dim uppercase">{info.note}</span>}
              </span>
              <span className="block text-xs text-muted">{info.description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
