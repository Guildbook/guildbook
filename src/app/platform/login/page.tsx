import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { testModeEnabled } from "@/auth";
import { GuildbookMark } from "@/components/guildbook-mark";
import { LegalConsent } from "@/components/legal-consent";
import { TestLogin } from "@/components/test-login";
import { Panel } from "@/components/ui";
import { db } from "@/db";
import { guilds } from "@/db/schema";
import { signInWithDiscord } from "@/server/actions/member";
import { getSessionUser } from "@/server/context";
import { afterSignInUrl, getRequestHost, resolveHost, validateDestination } from "@/server/hosts";

export const metadata: Metadata = { title: "Sign in" };

/** The guild a sign-in is headed for, so the test login can label seeded accounts by their standing there. */
async function targetGuild(target: string) {
  const route = await resolveHost(new URL(target).host);
  const slug = route.kind === "guild" ? route.slug : route.kind === "fallback" ? route.defaultGuildSlug : null;
  if (!slug) return null;
  const [guild] = await db.select({ id: guilds.id, name: guilds.name }).from(guilds).where(eq(guilds.slug, slug));
  return guild ?? null;
}

/**
 * Central sign-in on the apex. Every OAuth round trip happens here, so Discord (and Battle.net) only need the
 * apex redirect URIs. `callbackUrl` may point at a guild subdomain or verified custom domain; anything else
 * falls back to the apex home.
 */
export default async function PlatformLoginPage({ searchParams }: PageProps<"/platform/login">) {
  const sp = await searchParams;
  const current = await getRequestHost();
  const raw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
  const target = (await validateDestination(raw, current.origin)) ?? `${current.origin}/`;
  const redirectTo = afterSignInUrl(target, current);
  const user = await getSessionUser();
  if (user && !testModeEnabled) redirect(redirectTo);
  const guild = await targetGuild(target);

  return (
    <div className="mx-auto max-w-sm pt-4">
      <Panel>
        <div className="flex flex-col items-center text-center">
          <GuildbookMark className="h-16 w-16" />
          <h1 className="mt-4 text-xl font-bold text-gold">{guild ? `Sign in to ${guild.name}` : "Sign in to Guildbook"}</h1>
          <hr className="rule-gold my-4 w-24" />
          <p className="mb-6 text-sm text-muted">
            One Guildbook account works for every guild. We sign you in with Discord and never ask for a password.
          </p>
          {user && (
            <a href={redirectTo} className="btn btn-ghost mb-3 w-full">
              Continue as {user.name ?? "yourself"}
            </a>
          )}
          <form action={signInWithDiscord.bind(null, redirectTo)} className="w-full">
            <button type="submit" className="btn btn-gold w-full">
              Sign in with Discord
            </button>
          </form>
          <LegalConsent />
          {testModeEnabled && (
            <TestLogin guildId={guild?.id ?? null} callbackUrl={target} currentName={user ? (user.name ?? "an unnamed user") : null} />
          )}
        </div>
      </Panel>
    </div>
  );
}
