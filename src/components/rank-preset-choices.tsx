import { TIER_LABELS } from "@/lib/authz/tiers";
import { RANK_PRESET_KEYS, RANK_PRESETS, type RankPresetKey } from "@/lib/rank-presets";

export function PresetChoices({ name, defaultKey }: { name: string; defaultKey: RankPresetKey }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {RANK_PRESET_KEYS.map((key) => {
        const preset = RANK_PRESETS[key];
        return (
          <label
            key={key}
            className="flex cursor-pointer flex-col gap-2 rounded border border-line p-3 hover:border-gold-dim has-[:checked]:border-gold has-[:checked]:bg-gold/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold"
          >
            <span className="flex items-center gap-2">
              <input type="radio" name={name} value={key} defaultChecked={key === defaultKey} className="h-4 w-4 accent-gold" />
              <span className="font-display text-sm text-gold">{preset.label}</span>
            </span>
            <span className="text-xs text-muted">{preset.summary}</span>
            <ol className="space-y-0.5 text-xs text-bone">
              {preset.ranks.map((r) => (
                <li key={r.name} className="flex justify-between gap-2">
                  <span>{r.name}</span>
                  <span className="text-muted">{TIER_LABELS[r.tier]}</span>
                </li>
              ))}
            </ol>
          </label>
        );
      })}
    </div>
  );
}
