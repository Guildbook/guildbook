export function formatClock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function timezoneAbbrev(timeZone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export function formatDate(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(d);
}

/** A calendar date stored as `YYYY-MM-DD` (already in the guild's zone), e.g. a raid night. */
export function formatCalendarDate(ymd: string, style: "medium" | "full" = "medium"): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: style, timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
}

export function formatDateTime(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);
}
