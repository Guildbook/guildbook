/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function dateInZone(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** A wall-clock time in `timeZone` as an instant. Null for impossible dates (Feb 30, month 13). */
export function zonedTime(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timeZone: string,
): Date | null {
  const { year, month, day, hour = 0, minute = 0, second = 0 } = parts;
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  // Two passes settle DST boundaries: the offset at the guess, then at the corrected instant.
  let ts = guess - zoneOffsetMs(new Date(guess), timeZone);
  ts = guess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/** Two-digit years in exports are this century. */
export function fullYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}
