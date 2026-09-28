import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { StatusToast } from "@/components/status-toast";
import { formatDateTime } from "@/lib/format";
import { refreshBattlenetAction, unlinkBattlenetAction } from "@/server/actions/battlenet";
import type { BattlenetLink } from "@/server/services/battlenet";

export function battlenetLinkHref(slug: string, returnTo: string): string {
  return `/api/battlenet/link?${new URLSearchParams({ guild: slug, returnTo })}`;
}

/** Full-page navigation (not next/link): the route redirects off-site to Battle.net. */
export function LinkBattlenetButton({
  slug,
  returnTo,
  children = "Link Battle.net",
  variant = "primary",
}: {
  slug: string;
  returnTo: string;
  children?: string;
  variant?: "primary" | "ghost";
}) {
  return (
    <a href={battlenetLinkHref(slug, returnTo)} className={`btn btn-${variant} btn-sm`}>
      {children}
    </a>
  );
}

const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  linked: { tone: "ok", text: "Battle.net linked." },
  denied: { tone: "error", text: "Battle.net authorization was cancelled." },
  taken: { tone: "error", text: "That Battle.net account is already linked to another Discord account." },
  error: { tone: "error", text: "We couldn't reach Battle.net. Please try again." },
  unavailable: { tone: "error", text: "Battle.net linking isn't set up on this site yet." },
};

/** Result of the OAuth round trip (`?bnet=`). */
export function BattlenetNotice({ status }: { status: string | string[] | undefined }) {
  const notice = typeof status === "string" ? NOTICES[status] : undefined;
  if (!notice) return null;
  return (
    <>
      <StatusToast param="bnet" kind={notice.tone === "ok" ? "success" : "error"} message={notice.text} />
      <p
        role={notice.tone === "ok" ? "status" : "alert"}
        className={`rounded border px-3 py-2 text-sm ${notice.tone === "ok" ? "border-gold-dim text-gold" : "border-crimson text-red-300"}`}
      >
        {notice.text}
      </p>
    </>
  );
}

/** Linked account line: BattleTag, snapshot age, refresh (while the token lasts) or reconnect, and unlink. */
export function BattlenetAccount({
  link,
  slug,
  returnTo,
  timezone,
}: {
  link: BattlenetLink;
  slug: string;
  returnTo: string;
  timezone: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="battlenet-account">
      <div className="min-w-0 text-sm">
        <p>
          Battle.net: <span className="font-semibold text-bone">{link.battletag}</span>
        </p>
        <p className="text-xs text-muted">Characters read {formatDateTime(link.snapshotAt, timezone)}</p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {link.canRefresh ? (
          <ActionForm action={refreshBattlenetAction.bind(null, slug)}>
            <SubmitButton variant="ghost" size="sm" pendingLabel="Refreshing…">
              Refresh characters
            </SubmitButton>
            <FormMessage className="mt-1" />
          </ActionForm>
        ) : (
          <LinkBattlenetButton slug={slug} returnTo={returnTo} variant="ghost">
            Reconnect to refresh
          </LinkBattlenetButton>
        )}
        <ActionForm action={unlinkBattlenetAction.bind(null, slug)} confirm="Unlink your Battle.net account? Your characters stay, but they'll be unverified and stop syncing.">
          <SubmitButton variant="ghost" size="sm" pendingLabel="Unlinking…">
            Unlink
          </SubmitButton>
          <FormMessage className="mt-1" />
        </ActionForm>
      </div>
    </div>
  );
}

/** Why a linked account offers no characters. */
export function EmptySnapshotNote({ link, factionLabel }: { link: BattlenetLink; factionLabel: string | null }) {
  const who = factionLabel ? `${factionLabel} characters` : "characters";
  const text =
    link.snapshotStatus === "forbidden"
      ? "Battle.net didn't share your character list. Reconnect and allow access to your World of Warcraft profile."
      : link.snapshotStatus === "error"
        ? "Battle.net didn't respond when we read your characters. Try refreshing or reconnecting later."
        : `We found no eligible ${who} on ${link.battletag}. Before World of Warcraft: Forever launches on Nov 4, 2026, that's expected.`;
  return <p className="text-sm text-muted">{text}</p>;
}
