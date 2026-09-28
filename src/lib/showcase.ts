import { WOWF_LAUNCH_DATE } from "@/lib/game";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MINUTES_PER_WEEK = 7 * 24 * 60;

const minutesOf = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Minutes since Sunday midnight in `timeZone`. */
function weekMinute(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return WEEKDAYS.indexOf(get("weekday")) * 1440 + Number(get("hour")) * 60 + Number(get("minute"));
}

/**
 * The weekly raid slot that starts next after `now`, in the guild's time zone. A slot that has already started
 * this week comes round again next week.
 */
export function nextScheduleSlot<T extends { dayOfWeek: number; startTime: string }>(slots: T[], timeZone: string, now: Date): T | null {
  if (slots.length === 0) return null;
  const at = weekMinute(now, timeZone);
  const wait = (s: T) => (s.dayOfWeek * 1440 + minutesOf(s.startTime) - at + MINUTES_PER_WEEK - 1) % MINUTES_PER_WEEK;
  return slots.reduce((best, s) => (wait(s) < wait(best) ? s : best));
}

export const hasLaunched = (now: Date) => now >= new Date(`${WOWF_LAUNCH_DATE}T00:00:00Z`);

/** Launch day as "Nov 4". */
export const launchLabel = () =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${WOWF_LAUNCH_DATE}T12:00:00Z`));

interface ProgressionInstance {
  name: string;
  bosses: { kills: { killedAt: Date }[] }[];
}

/**
 * The raid a guild is working through: the first (in the guild's order) not yet cleared, else the last one.
 * Only kills up to `now` count, so kills dated ahead of time don't show early.
 */
export function currentTier(progression: ProgressionInstance[], now: Date): { name: string; killed: number; total: number } | null {
  const tiers = progression
    .filter((i) => i.bosses.length > 0)
    .map((i) => ({ name: i.name, total: i.bosses.length, killed: i.bosses.filter((b) => b.kills.some((k) => k.killedAt <= now)).length }));
  return tiers.find((t) => t.killed < t.total) ?? tiers.at(-1) ?? null;
}
