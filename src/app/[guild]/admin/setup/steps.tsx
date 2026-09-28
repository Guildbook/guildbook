import clsx from "clsx";
import type { SetupStatus, SetupStepKey } from "@/lib/guild-setup";
import { LORE_SLUG } from "@/lib/lore";

export interface StepCopy {
  title: string;
  body: string;
  /** Admin path of the editor for this step. */
  href: string;
  cta: string;
}

export const STEP_COPY: Record<SetupStepKey, StepCopy> = {
  look: {
    title: "Tabard and colours",
    body: "Design your in-game tabard, or import it from the game once WoW: Forever launches. It becomes your crest, icons and link previews, and sets your site's colours.",
    href: "/admin/guild#tabard",
    cta: "Design tabard",
  },
  ranks: {
    title: "Ranks",
    body: "Name your ranks and choose what each one can do. Start from a preset below or build your own ladder.",
    href: "/admin/ranks",
    cta: "Edit ranks",
  },
  charter: {
    title: "Charter",
    body: "Replace the starter charter with your guild's rules, so applicants know what you expect.",
    href: "/admin/content/charter",
    cta: "Edit charter",
  },
  lore: {
    title: "Your story",
    body: "Tell visitors who you are: how the guild started, what you value and what a night with you feels like.",
    href: `/admin/content/${LORE_SLUG}`,
    cta: "Write your story",
  },
  recruiting: {
    title: "Recruiting",
    body: "List the classes and roles you are looking for, or close recruitment if you are full.",
    href: "/admin/recruitment",
    cta: "Set recruiting",
  },
  invite: {
    title: "Invite members",
    body: "Share your site with your guild and add your Discord invite. Members sign in with Discord and apply through the site.",
    href: "/admin/guild",
    cta: "Add Discord invite",
  },
  verify: {
    title: "Verify with Battle.net",
    body: "Verified guilds get a seal and come first in the directory. The in-game Guild Master links Battle.net and Guildbook checks their character.",
    href: "/admin/guild#verify",
    cta: "Open verification",
  },
  vigil: {
    title: "Vigil companion",
    body: "Vigil reviews each pull from your combat log: rotation, uptimes and cooldowns. The desktop companion uploads logs as you play.",
    href: "/vigil",
    cta: "Set up Vigil",
  },
  publish: {
    title: "Publish",
    body: "Drafts are unlisted: anyone with the link can visit, but the guild stays out of the directory and search engines, and applications stay closed.",
    href: "/admin/setup#publish",
    cta: "Publish",
  },
};

const STATUS_LABEL: Record<SetupStatus, string> = { done: "Done", skipped: "Skipped", todo: "To do" };

/** A step's status as a small seal: a gold check when done, a dash when skipped, an open ring when still to do. */
export function StepStatusIcon({ status, className }: { status: SetupStatus; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      role="img"
      aria-label={STATUS_LABEL[status]}
      className={clsx("shrink-0", status === "done" ? "text-gold" : "text-muted", className)}
    >
      <circle cx="12" cy="12" r="10" fill={status === "done" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} />
      {status === "done" && (
        <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === "skipped" && <path d="M8 12h8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />}
    </svg>
  );
}

export function SetupProgress({ done, total }: { done: number; total: number }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label="Setup progress"
    >
      <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${Math.round((done / total) * 100)}%` }} />
    </div>
  );
}
