import type { Metadata } from "next";
import Link from "next/link";
import { GuildbookMark } from "@/components/guildbook-mark";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { CONTACT_EMAIL } from "@/lib/brand";
import { SUPPORT_CATEGORIES, type SupportCategory, ticketReference } from "@/lib/support";
import { signInWithDiscord } from "@/server/actions/member";
import { getSessionUser } from "@/server/context";
import { getRequestHost } from "@/server/hosts";
import { appVersion, getOwnSupportTicket, getSupportProfile, listSupportGuilds } from "@/server/services/support";
import { SupportForm } from "./support-form";

export const metadata: Metadata = { title: "Support", robots: { index: false } };

const isCategory = (v: unknown): v is SupportCategory => typeof v === "string" && Object.hasOwn(SUPPORT_CATEGORIES, v);

function FallbackLine() {
  return (
    <p className="text-xs text-muted" data-testid="support-fallback">
      Can&apos;t sign in? Email{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold underline-offset-2 hover:underline">
        {CONTACT_EMAIL}
      </a>{" "}
      with your Discord username and what went wrong.
    </p>
  );
}

export default async function SupportPage({ searchParams }: PageProps<"/platform/support">) {
  const sp = await searchParams;
  const [user, current] = await Promise.all([getSessionUser(), getRequestHost()]);

  if (!user) {
    return (
      <div className="mx-auto max-w-md pt-4">
        <Panel>
          <div className="flex flex-col items-center gap-4 text-center" data-testid="support-signed-out">
            <GuildbookMark className="h-14 w-14" />
            <h1 className="text-xl font-bold text-gold">Guildbook support</h1>
            <p className="text-sm text-muted">
              Sign in with Discord to send a support request. It lets us see your account and guilds, so we can help faster.
            </p>
            <form action={signInWithDiscord.bind(null, `${current.origin}/support`)} className="w-full">
              <button type="submit" className="btn btn-gold w-full">
                Sign in with Discord
              </button>
            </form>
            <Link href="/login?callbackUrl=%2Fsupport" className="text-xs text-bone/70 hover:text-gold">
              Other sign-in options
            </Link>
            <FallbackLine />
          </div>
        </Panel>
      </div>
    );
  }

  const ticketId = typeof sp.ticket === "string" ? sp.ticket : null;
  const [profile, guilds, ticket] = await Promise.all([
    getSupportProfile(db, user.id),
    listSupportGuilds(db, user.id),
    ticketId ? getOwnSupportTicket(db, user.id, ticketId) : null,
  ]);

  if (ticket) {
    const reference = ticketReference(ticket.id);
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Request sent" eyebrow="Guildbook support" />
        <Panel>
          <div role="status" className="space-y-4" data-testid="support-success">
            <p className="text-sm text-muted">Your reference number</p>
            <p className="font-mono text-2xl tracking-wider text-gold" data-testid="support-reference">
              {reference}
            </p>
            <p>
              Thanks. We&apos;ve received your request about <strong className="text-bone">{ticket.subject}</strong>.{" "}
              {ticket.replyTo ? (
                <>
                  We&apos;ll reply by email to <strong className="text-bone">{ticket.replyTo}</strong>.
                </>
              ) : (
                <>
                  You didn&apos;t leave an email, so we&apos;ll reply via Discord
                  {profile?.discordUsername ? (
                    <>
                      {" "}
                      to <strong className="text-bone">@{profile.discordUsername}</strong>
                    </>
                  ) : null}
                  .
                </>
              )}
            </p>
            <p className="text-sm text-muted">Mention {reference} if you write to us about this again.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/support" className="btn btn-ghost btn-sm">
                Send another request
              </Link>
              <Link href="/" className="btn btn-ghost btn-sm">
                Back to Guildbook
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  const discordName = profile?.discordUsername ? `@${profile.discordUsername}` : (profile?.name ?? "Unknown");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Support" eyebrow="Guildbook">
        Tell us what&apos;s wrong or what you need. A person reads every request and replies, usually within a few days.
      </PageHeader>
      <Panel>
        <SupportForm
          guilds={guilds.map((g) => ({ id: g.id, name: g.name, detail: g.status === "applicant" ? "Applicant" : g.rankName }))}
          defaultCategory={isCategory(sp.category) ? sp.category : undefined}
          defaultEmail={profile?.email ?? ""}
          context={{ userId: user.id, discordName, appVersion: appVersion() }}
        />
      </Panel>
      <p className="text-center text-xs text-muted">
        To export or delete your data yourself, use{" "}
        <Link href="/account" className="text-gold underline-offset-2 hover:underline">
          Account and privacy
        </Link>
        . See the{" "}
        <Link href="/privacy" className="text-gold underline-offset-2 hover:underline">
          Privacy Policy
        </Link>{" "}
        for how we handle support requests.
      </p>
    </div>
  );
}
