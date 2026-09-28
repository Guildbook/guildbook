import type { ListboxOption } from "@/lib/listbox";

/** For runtimes without `Intl.supportedValuesOf`. */
const FALLBACK = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Asia/Seoul",
  "Asia/Taipei",
  "Australia/Perth",
  "Australia/Sydney",
];

/** Every IANA timezone the runtime knows, plus UTC. */
export function timezoneNames(): string[] {
  let names: string[];
  try {
    names = Intl.supportedValuesOf("timeZone");
  } catch {
    names = FALLBACK;
  }
  return names.includes("UTC") ? names : [...names, "UTC"];
}

export const timezoneLabel = (tz: string) => tz.replaceAll("_", " ");

/** "UTC-04:00" and, where the locale has one, the abbreviation ("EDT"). */
export function timezoneOffset(tz: string, at: Date = new Date()): { offset: string; abbrev?: string } {
  try {
    const part = (timeZoneName: "longOffset" | "short") =>
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
    const offset = part("longOffset").replace(/^GMT$/, "GMT+00:00").replace(/^GMT/, "UTC");
    const short = part("short");
    return { offset, abbrev: /^(GMT|UTC)/.test(short) ? undefined : short };
  } catch {
    return { offset: "" };
  }
}

/** Listbox options for every timezone, keeping `current` even when the runtime doesn't list it. */
export function timezoneOptions(current?: string, at: Date = new Date()): ListboxOption[] {
  const names = timezoneNames();
  if (current && !names.includes(current)) names.unshift(current);
  return names.map((tz) => {
    const { offset, abbrev } = timezoneOffset(tz, at);
    return {
      value: tz,
      label: timezoneLabel(tz),
      description: [offset, abbrev].filter(Boolean).join(", ") || undefined,
      keywords: [offset.replace("UTC", "GMT"), abbrev].filter(Boolean).join(" "),
    };
  });
}
