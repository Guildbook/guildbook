import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { testModeEnabled } from "@/auth";
import { GuildEmblem } from "@/components/guild-emblem";
import { LegalConsent } from "@/components/legal-consent";
import { Panel } from "@/components/ui";
import { guildHref } from "@/lib/paths";
import { signInWithDiscord } from "@/server/actions/member";
import { getGuild, getViewer } from "@/server/context";
import { getRequestHost } from "@/server/hosts";
import { TestLogin } from "@/components/test-login";

export const metadata: Metadata = { title: "Sign in" };

function safeCallback(raw: string | string[] | undefined, fallback: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[guild]/login">) {
  const { guild: slug } = await params;
  const sp = await searchParams;
  const guild = await getGuild(slug);
  const callbackUrl = safeCallback(sp.callbackUrl, guildHref(slug, "/"));

  // Guild subdomains and custom domains sign in on the apex, where the OAuth redirect URIs are registered.
  const current = await getRequestHost();
  if (current.centralSignIn) {
    const login = new URL("/login", current.apexOrigin);
    login.searchParams.set("callbackUrl", `${current.origin}${callbackUrl}`);
    redirect(login.toString());
  }

  const viewer = await getViewer(guild.id);
  // Test mode keeps the page reachable while signed in, so testers can switch accounts.
  if (viewer.user && !testModeEnabled) redirect(callbackUrl);

  return (
    <div className="mx-auto max-w-sm pt-6">
      <Panel>
        <div className="flex flex-col items-center text-center">
          <GuildEmblem guild={guild} className="h-24 w-20" />
          <h1 className="mt-4 text-xl font-bold text-gold">{guild.preset === "order" ? "Enter the Order" : `Sign in to ${guild.name}`}</h1>
          <hr className="rule-gold my-4 w-24" />
          <p className="mb-6 text-sm text-muted">We sign you in with your Discord account. We don&apos;t use passwords.</p>
          <form action={signInWithDiscord.bind(null, callbackUrl)} className="w-full">
            <button type="submit" className="btn btn-primary w-full">
              Sign in with Discord
            </button>
          </form>
          <LegalConsent apexOrigin={current.apexOrigin} />
          {testModeEnabled && <TestLogin guildId={guild.id} callbackUrl={callbackUrl} currentName={viewer.user ? (viewer.user.name ?? "an unnamed user") : null} />}
        </div>
      </Panel>
    </div>
  );
}
