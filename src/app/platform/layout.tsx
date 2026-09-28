import type { Metadata } from "next";
import Link from "next/link";
import { GitHubIcon } from "@/components/github-icon";
import { GuildbookWordmark } from "@/components/guildbook-mark";
import { db } from "@/db";
import { brandIcons, brandPreviewImage, GUILDBOOK_DESCRIPTION, SOURCE_URL } from "@/lib/brand";
import { getSessionUser } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { listUserGuilds } from "@/server/services/platform";
import { PlatformAccountMenu } from "./account-menu";

/** The platform apex (guildbook.io). The proxy rewrites apex paths here; this segment is never linked directly. */
export async function generateMetadata(): Promise<Metadata> {
  const current = await getRequestHost();
  const image = brandPreviewImage("guildbook");
  return {
    metadataBase: new URL(current.apexOrigin),
    title: { absolute: "Guildbook: guild sites for World of Warcraft: Forever", template: "%s | Guildbook" },
    description: GUILDBOOK_DESCRIPTION,
    applicationName: "Guildbook",
    icons: brandIcons("guildbook"),
    openGraph: { type: "website", siteName: "Guildbook", title: "Guildbook", description: GUILDBOOK_DESCRIPTION, url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: "Guildbook", description: GUILDBOOK_DESCRIPTION, images: [image] },
  };
}

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const [user, current] = await Promise.all([getSessionUser(), getRequestHost()]);
  const myGuilds = user ? await listUserGuilds(db, user.id) : [];
  const year = new Date().getFullYear();

  return (
    <div className="platform flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="Guildbook home">
            <GuildbookWordmark />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-3 sm:gap-5">
            <Link href="/guilds" className="font-display text-sm tracking-wider text-bone hover:text-gold">
              Directory
            </Link>
            <Link href="/create" className="btn btn-gold btn-sm hidden sm:inline-flex">
              Create a guild
            </Link>
            {user ? (
              <PlatformAccountMenu
                user={user}
                guilds={myGuilds}
                guildHref={(g, path = "") => `${guildOrigin(g.slug, current, g.customDomain)}${path}`}
              />
            ) : (
              <Link href="/login" className="btn btn-ghost btn-sm">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center">
          <GuildbookWordmark />
          <p className="text-xs text-muted">
            &copy; {year} Guildbook. Fan-made guild sites, not affiliated with Blizzard Entertainment. World of Warcraft is a
            trademark of Blizzard Entertainment, Inc.
          </p>
          <nav aria-label="Legal" className="flex gap-4 text-xs">
            <Link href="/terms" className="text-bone/70 hover:text-gold">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-bone/70 hover:text-gold">
              Privacy Policy
            </Link>
            <a
              href={SOURCE_URL}
              aria-label="Source on GitHub"
              className="inline-flex items-center gap-1.5 text-bone/70 hover:text-gold"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon size={13} />
              Source
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
