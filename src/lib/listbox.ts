import type { ReactNode } from "react";

export interface ListboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  /** Consecutive options with the same group render under one heading. */
  group?: string;
  disabled?: boolean;
  /** Extra words the search matches, e.g. a timezone's offset. */
  keywords?: string;
  /** Text colour for the label, e.g. a class colour. */
  color?: string;
}

type Navigable = Pick<ListboxOption, "label" | "disabled">;

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/,()-]+/g, " ");

/** Options whose label, value, description, group or keywords contain every word of the query. */
export function filterOptions<T extends ListboxOption>(options: readonly T[], query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...options];
  return options.filter((o) => {
    const haystack = normalize([o.label, o.value, o.description, o.group, o.keywords].filter(Boolean).join(" "));
    return words.every((w) => haystack.includes(w));
  });
}

/** The next enabled option from `from` in `step` direction, clamped to the ends; `from` itself if none. */
export function stepIndex(options: readonly Navigable[], from: number, step: number): number {
  const dir = step < 0 ? -1 : 1;
  let target = from;
  let remaining = Math.abs(step);
  for (let i = from + dir; i >= 0 && i < options.length && remaining > 0; i += dir) {
    if (options[i]!.disabled) continue;
    target = i;
    remaining--;
  }
  return target;
}

export function firstEnabled(options: readonly Navigable[]): number {
  return options.findIndex((o) => !o.disabled);
}

export function lastEnabled(options: readonly Navigable[]): number {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i]!.disabled) return i;
  return -1;
}

/**
 * Type-ahead per the APG: repeating one letter cycles through the options starting with it, a longer string matches
 * from the current option onwards. Returns -1 when nothing matches.
 */
export function typeaheadIndex(options: readonly Navigable[], buffer: string, from: number): number {
  const q = buffer.toLowerCase();
  if (!q || options.length === 0) return -1;
  const repeated = [...q].every((c) => c === q[0]);
  const needle = repeated ? q[0]! : q;
  const start = repeated ? from + 1 : Math.max(from, 0);
  for (let i = 0; i < options.length; i++) {
    const idx = (((start + i) % options.length) + options.length) % options.length;
    const o = options[idx]!;
    if (!o.disabled && o.label.toLowerCase().startsWith(needle)) return idx;
  }
  return -1;
}

export interface KeyInput {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export interface KeyState {
  open: boolean;
  /** Highlighted option, an index into the visible options; -1 for none. */
  active: number;
  /** Index of the selected value among the visible options; -1 when it isn't shown. */
  selected: number;
  /** Type-ahead characters typed so far. */
  buffer: string;
}

export interface KeyOutcome extends KeyState {
  /** Commit this option's value. */
  commit?: number;
  /** The key was used; the caller should `preventDefault()`. */
  handled: boolean;
}

const PAGE = 10;

/**
 * Keyboard behaviour of a select-only combobox (WAI-ARIA APG), plus the arrow, Enter and Escape keys of its search box
 * when `searching` (printable keys and Space then belong to the text field).
 */
export function listboxKey(e: KeyInput, state: KeyState, options: readonly Navigable[], searching = false): KeyOutcome {
  const unchanged: KeyOutcome = { ...state, handled: false };
  const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
  const opening = state.selected >= 0 && !options[state.selected]?.disabled ? state.selected : firstEnabled(options);

  if (!state.open) {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        return { ...state, open: true, active: opening, buffer: "", handled: true };
      case "Home":
        return { ...state, open: true, active: firstEnabled(options), buffer: "", handled: true };
      case "End":
        return { ...state, open: true, active: lastEnabled(options), buffer: "", handled: true };
    }
    if (printable) {
      const buffer = state.buffer + e.key;
      const match = typeaheadIndex(options, buffer, state.selected);
      return { ...state, open: true, buffer, active: match >= 0 ? match : opening, handled: true };
    }
    return unchanged;
  }

  const commitActive = (handled: boolean): KeyOutcome => ({
    ...state,
    open: false,
    buffer: "",
    handled,
    ...(state.active >= 0 && !options[state.active]?.disabled ? { commit: state.active } : {}),
  });

  switch (e.key) {
    case "ArrowDown":
      return { ...state, active: state.active < 0 ? firstEnabled(options) : stepIndex(options, state.active, 1), buffer: "", handled: true };
    case "ArrowUp":
      if (e.altKey) return commitActive(true);
      return { ...state, active: state.active < 0 ? lastEnabled(options) : stepIndex(options, state.active, -1), buffer: "", handled: true };
    case "PageDown":
      return { ...state, active: stepIndex(options, Math.max(state.active, 0), PAGE), buffer: "", handled: true };
    case "PageUp":
      return { ...state, active: stepIndex(options, Math.max(state.active, 0), -PAGE), buffer: "", handled: true };
    case "Home":
      return { ...state, active: firstEnabled(options), buffer: "", handled: true };
    case "End":
      return { ...state, active: lastEnabled(options), buffer: "", handled: true };
    case "Enter":
      return commitActive(true);
    case "Escape":
      return { ...state, open: false, buffer: "", handled: true };
    case "Tab":
      return searching ? { ...state, open: false, buffer: "", handled: false } : commitActive(false);
  }
  if (searching) return unchanged;
  if (e.key === " " && !state.buffer) return commitActive(true);
  if (printable) {
    const buffer = state.buffer + e.key;
    const match = typeaheadIndex(options, buffer, state.active);
    return { ...state, buffer, active: match >= 0 ? match : state.active, handled: true };
  }
  return unchanged;
}
