import clsx from "clsx";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { GitHubIcon } from "@/components/github-icon";
import { Markdown } from "@/components/markdown";
import { brandPreviewImage } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import {
  COMPANION_RELEASES_URL,
  COMPANION_REPO_URL,
  type CompanionPlatform,
  type CompanionRelease,
  detectPlatform,
  formatBytes,
  PLATFORM_LABELS,
  primaryAsset,
} from "@/lib/vigil/companion-release";
import { latestCompanionRelease } from "@/server/companion-release";
import { FEATURE_ICONS, type FeatureIcon } from "../feature-icons";
import { AppScreenshot } from "./app-screenshot";
import detailShot from "./shots/detail.webp";
import intelShot from "./shots/intel.webp";
import liveShot from "./shots/live.webp";

const TITLE = "Vigil, the combat log companion";
const DESCRIPTION =
  "Vigil watches your World of Warcraft: Forever combat log, calls out mistakes as you play and uploads every fight to your guild's Guildbook. Free for Windows, macOS and Linux.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/vigil" },
  openGraph: { type: "website", siteName: "Guildbook", title: TITLE, description: DESCRIPTION, url: "/vigil", images: [brandPreviewImage("vigil")] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [brandPreviewImage("vigil")] },
};

const PLATFORMS: CompanionPlatform[] = ["mac", "windows", "linux"];

const PLATFORM_DETAIL: Record<CompanionPlatform, string> = {
  mac: "universal for Apple silicon and Intel",
  windows: "64-bit, Windows 10 and 11",
  linux: "AppImage, 64-bit",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function External({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={clsx("link", FOCUS, className)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** The big button for the visitor's system, the other systems beside it, or all three when the system is unknown. */
function Downloads({
  release,
  platform,
  hero = false,
}: {
  release: CompanionRelease;
  platform: CompanionPlatform | null;
  /** The hero copy: left-aligned on wide screens and carrying the test IDs. */
  hero?: boolean;
}) {
  const main = platform ? primaryAsset(release, platform) : null;
  const others = PLATFORMS.filter((p) => p !== platform && primaryAsset(release, p));
  return (
    <div className={clsx("flex flex-col items-center gap-4", hero && "lg:items-start")}>
      {main && platform ? (
        <div className={clsx("flex flex-col items-center gap-2", hero && "lg:items-start")}>
          <a
            href={main.url}
            className={clsx("btn btn-gold min-h-13 px-8 text-sm shadow-[0_8px_28px_rgb(201_164_76/0.25)]", FOCUS)}
            data-testid={hero ? "vigil-download-primary" : undefined}
          >
            <DownloadIcon />
            Download for {PLATFORM_LABELS[platform]}
          </a>
          <p className="text-xs text-muted">
            Version {release.version}, {formatBytes(main.size)}, {PLATFORM_DETAIL[platform]}
          </p>
        </div>
      ) : (
        <p className="max-w-md text-sm text-muted">
          {platform
            ? `There is no ${PLATFORM_LABELS[platform]} build of version ${release.version} yet.`
            : `Vigil is a desktop app. Download version ${release.version} on the computer you play on.`}
        </p>
      )}
      {others.length > 0 && (
        <div
          className={clsx(
            "flex items-center justify-center gap-2",
            main ? "flex-wrap" : "w-full max-w-xs flex-col sm:w-auto sm:max-w-none sm:flex-row",
            hero && "lg:justify-start",
          )}
        >
          {main && <span className="text-xs text-muted">Also for</span>}
          {others.map((p) => {
            const asset = primaryAsset(release, p)!;
            return (
              <a
                key={p}
                href={asset.url}
                className={clsx("btn btn-ghost btn-sm", !main && "w-full sm:w-auto", FOCUS)}
                aria-label={`Download for ${PLATFORM_LABELS[p]}, ${formatBytes(asset.size)}`}
              >
                <DownloadIcon />
                {PLATFORM_LABELS[p]}
                <span className="font-sans text-[0.65rem] font-normal tracking-normal text-muted normal-case">{formatBytes(asset.size)}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NoRelease({ ok, hero = false }: { ok: boolean; hero?: boolean }) {
  return (
    <div className={clsx("flex flex-col items-center gap-3", hero && "lg:items-start")} data-testid={hero ? "vigil-no-release" : undefined}>
      <a href={COMPANION_RELEASES_URL} className={clsx("btn btn-gold min-h-13 px-8 text-sm", FOCUS)} target="_blank" rel="noopener noreferrer">
        <DownloadIcon />
        Get Vigil on GitHub
      </a>
      <p className="max-w-md text-xs text-muted">
        {ok ? "The first release is on its way." : "The latest version could not be loaded just now."} Every build is published on
        the releases page.
      </p>
    </div>
  );
}

const STEPS: { title: string; body: ReactNode }[] = [
  {
    title: "Install Vigil",
    body: "Download it for Windows, macOS or Linux and open it. It finds your World of Warcraft folder on its own and offers to install the Vigil addon in one click.",
  },
  {
    title: "Turn on combat logging",
    body: (
      <>
        The Vigil addon does this for you, turning on combat logging and Advanced Combat Logging every time you log in. Without it, enable
        Advanced Combat Logging under System, Network, then type <code className="text-gold">/combatlog</code> each time you log in.
      </>
    ),
  },
  {
    title: "Pair it with your guild",
    body: "On your guild's site, open Vigil and choose Connect Vigil companion for a pairing code. Enter it in the app and you're set.",
  },
];

const FEATURES: { icon: FeatureIcon; title: string; body: string }[] = [
  {
    icon: "callouts",
    title: "Callouts as you play",
    body: "Missed procs, idle time, dropped buffs and capped rage show up the moment they happen, alongside a live score, GCD use and uptimes marked with their spell icons.",
  },
  {
    icon: "intel",
    title: "Boss Intel",
    body: "Molten Core and Onyxia's Lair, ability by ability: what each one does and what to do about it, with Blizzard's spell icons and boss portraits, plus what Vigil saw in your pull.",
  },
  {
    icon: "reports",
    title: "The whole raid at a glance",
    body: "A damage and healing meter for your party or raid with class icons, every death with its killing blow, and the damage each boss ability did and who it hit.",
  },
  {
    icon: "upload",
    title: "Every pull, reviewed",
    body: "Each finished fight uploads to your guild's site, retried if your connection drops, and becomes a report with rotation priority, uptimes, cooldowns and a timeline. You choose who sees it.",
  },
  {
    icon: "window",
    title: "Made for a second screen",
    body: "A slim window beside the game or a compact view pinned on top. Close it and Vigil keeps uploading from the menu bar or system tray, where you can pause uploads or open your guild's site.",
  },
  {
    icon: "privacy",
    title: "Reads the log, nothing else",
    body: "Vigil never touches the game client. Fights are analysed on your computer and only the report is sent. It's free and open source under the AGPL-3.0, so anyone can check.",
  },
];

function Faq({ release, platform }: { release: CompanionRelease | null; platform: CompanionPlatform | null }) {
  const items: { key: string; question: string; answer: ReactNode; open?: boolean }[] = [];
  const unsigned = (p: "mac" | "windows") => !release || (!release.signed[p] && primaryAsset(release, p) !== null);
  if (unsigned("mac")) {
    items.push({
      key: "mac",
      question: "macOS says Vigil can't be opened",
      open: platform === "mac",
      answer: (
        <>
          <p>
            This build isn&apos;t notarized by Apple yet, so macOS stops it the first time. Open the disk image and drag Vigil to
            Applications. Then right-click (or Control-click) Vigil in Applications, choose Open, and confirm Open.
          </p>
          <p>
            On macOS 15 and later, try opening Vigil once, then go to System Settings, Privacy &amp; Security, and click Open Anyway.
            Until builds are notarized, Vigil can&apos;t update itself on macOS; it tells you when a new version is out.
          </p>
        </>
      ),
    });
  }
  if (unsigned("windows")) {
    items.push({
      key: "windows",
      question: "Windows says it protected my PC",
      open: platform === "windows",
      answer: (
        <p>
          The installer isn&apos;t code-signed yet, so Microsoft Defender SmartScreen may warn you. Click More info, then Run anyway.
          Updates after that install on their own.
        </p>
      ),
    });
  }
  items.push(
    {
      key: "linux",
      question: "How do I run it on Linux?",
      answer: (
        <p>
          Download the AppImage, make it executable (right-click, Properties, or <code className="text-gold">chmod +x</code> in a terminal)
          and open it.
        </p>
      ),
    },
    {
      key: "safe",
      question: "Can Vigil get my account in trouble?",
      answer: (
        <p>
          Vigil only reads the combat log file the game writes to your Logs folder. It doesn&apos;t inject anything, automate anything or
          talk to the game. The optional Vigil addon, which the app offers to install when it finds your game, is an ordinary addon.
        </p>
      ),
    },
    {
      key: "pairing",
      question: "Where do I get a pairing code?",
      answer: (
        <p>
          Sign in to your guild&apos;s site, open Vigil, then Connect Vigil companion, and create a code. You can also click Open in the
          companion to pair in one step. Each computer shows up on that page, where you can revoke it. Not in a guild on Guildbook yet?{" "}
          <Link href="/guilds" className={clsx("link", FOCUS)}>
            Find one
          </Link>{" "}
          or{" "}
          <Link href="/create" className={clsx("link", FOCUS)}>
            create your own
          </Link>
          .
        </p>
      ),
    },
  );
  return (
    <div className="space-y-3" data-testid="vigil-faq">
      {items.map((item) => (
        <details key={item.key} open={item.open} className="panel group overflow-hidden">
          <summary
            className={clsx(
              "flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-sm font-semibold text-bone hover:text-gold [&::-webkit-details-marker]:hidden",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-bright",
            )}
          >
            {item.question}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 shrink-0 text-gold transition-transform group-open:rotate-45 motion-reduce:transition-none">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </summary>
          <div className="space-y-2 px-5 pb-5 text-sm leading-relaxed text-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

function SectionHeading({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 id={id} className="text-2xl font-semibold text-gold sm:text-3xl">
        {title}
      </h2>
      {lead && <p className="mx-auto mt-2 max-w-xl text-sm text-muted">{lead}</p>}
    </div>
  );
}

export default async function VigilDownloadPage() {
  const h = await headers();
  const platform = detectPlatform(h.get("user-agent"), h.get("sec-ch-ua-platform"));
  const { ok, release } = await latestCompanionRelease();
  const released = release?.publishedAt ? formatDate(new Date(release.publishedAt), "UTC") : null;

  return (
    <div className="space-y-20 sm:space-y-24">
      <section aria-labelledby="vigil-title" className="grid items-center gap-12 pt-2 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="flex items-center gap-5">
            <Image
              src="/brand/vigil/icon-512.png"
              alt="Vigil app icon"
              width={96}
              height={96}
              priority
              className="h-20 w-20 drop-shadow-[0_0_30px_rgba(168,24,47,0.55)] sm:h-24 sm:w-24"
            />
            <div className="text-left">
              <p className="font-display text-xs tracking-[0.3em] text-gold/80 uppercase">Guildbook companion</p>
              <h1 id="vigil-title" className="mt-1 font-title text-5xl text-gold sm:text-6xl">
                Vigil
              </h1>
            </div>
          </div>
          <p className="mt-7 font-display text-xl text-bone sm:text-2xl">Keep watch over every pull.</p>
          <hr className="rule-gold mt-5 w-48 lg:ml-0" />
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-bone/85">
            Vigil watches your World of Warcraft: Forever combat log while you play, calls out mistakes as they happen, briefs you on every
            boss and uploads each raid fight to your guild&apos;s Guildbook for a full review.
          </p>
          <div className="mt-8 w-full">
            {release ? <Downloads release={release} platform={platform} hero /> : <NoRelease ok={ok} hero />}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <GitHubIcon size={13} />
              Free and open source,{" "}
              <External href={COMPANION_REPO_URL}>AGPL-3.0</External>
            </span>
            <External href={COMPANION_RELEASES_URL}>See all releases</External>
          </div>
        </div>
        <AppScreenshot
          src={liveShot}
          alt="The Vigil window during a Ragnaros kill: a live score of 88 with GCD use, idle time and threat per second, Shield Block and Sunder Armor uptimes, Boss Intel listing Ragnaros's abilities with the damage each has done, a group damage meter with class icons, and a death to Wrath of Ragnaros."
          caption="Demo data from a synthetic Ragnaros kill."
          sizes="(min-width: 432px) 384px, calc(100vw - 3rem)"
          priority
          glow
          className="max-w-sm"
        />
      </section>

      <section aria-labelledby="how-heading">
        <SectionHeading id="how-heading" title="Up and running in three steps" lead="A few minutes of setup, then Vigil keeps watch every time you play." />
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel flex flex-col items-center p-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-dim bg-gold/5 font-display text-sm font-semibold text-gold">
                {["I", "II", "III"][i]}
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-bone">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="features-heading">
        <SectionHeading id="features-heading" title="Built for raid night" lead="Everything you need to learn from each pull, without alt-tabbing out of the fight." />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="panel p-5 transition-colors hover:border-gold-dim">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gold-dim/60 bg-gold/10 text-gold shadow-[inset_0_1px_0_rgb(230_200_119/0.15)]">
                  {FEATURE_ICONS[f.icon]}
                </span>
                <h3 className="font-display text-base font-semibold text-gold">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-12 grid max-w-4xl items-start gap-10 sm:grid-cols-2">
          <AppScreenshot
            src={intelShot}
            alt="Boss Intel for Ragnaros: his portrait and a summary, then Wrath of Ragnaros, Elemental Fire and Magma Blast, each with its spell icon, role tags, what it does, what to do and the damage it did in the last fight."
            caption="Boss Intel for Ragnaros. Demo data."
            sizes="(min-width: 1024px) 428px, (min-width: 640px) calc(50vw - 3rem), calc(100vw - 3rem)"
            fade
            className="max-w-md"
          />
          <AppScreenshot
            src={detailShot}
            alt="Damage taken by ability after a Ragnaros kill: each ability with its icon, total damage, hits, players hit and deaths, and the players it hit shown with their class icons."
            caption="Damage taken, from a finished fight. Demo data."
            sizes="(min-width: 1024px) 428px, (min-width: 640px) calc(50vw - 3rem), calc(100vw - 3rem)"
            className="max-w-md"
          />
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-muted">
          Spell icons and boss portraits are from Blizzard Entertainment&apos;s World of Warcraft. Vigil is not affiliated with Blizzard.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
        <SectionHeading id="faq-heading" title="Questions" />
        <Faq release={release} platform={platform} />
        <p className="mt-4 text-center text-sm text-muted">
          Still stuck?{" "}
          <Link href="/support?category=vigil" className="text-gold underline-offset-2 hover:underline">
            Contact support
          </Link>
          .
        </p>
      </section>

      {release && (
        <section aria-labelledby="release-heading" className="grid items-start gap-4 lg:grid-cols-2">
          <h2 id="release-heading" className="sr-only">
            Version {release.version}
          </h2>
          <div className="panel p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-gold">What&apos;s new in {release.version}</h3>
            {released && <p className="mt-1 text-xs text-muted">Released {released}</p>}
            <div className="mt-4 text-sm">
              {release.notes ? <Markdown tone="dark">{release.notes}</Markdown> : <p className="text-muted">No release notes for this version.</p>}
            </div>
          </div>
          <div className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-gold">All downloads</h3>
              <External href={release.url} className="text-sm">
                Release on GitHub
              </External>
            </div>
            <ul className="mt-4 divide-y divide-line text-sm" data-testid="vigil-assets">
              {release.assets
                .filter((a) => a.platform)
                .map((a) => (
                  <li key={a.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                    <a href={a.url} className={clsx("link min-w-0 flex-1 break-all", FOCUS)}>
                      {a.name}
                    </a>
                    <span className="text-xs text-muted">
                      {PLATFORM_LABELS[a.platform!]} {a.kind === "AppImage" ? a.kind : a.kind.toLowerCase()}
                    </span>
                    <span className="w-16 text-right text-xs text-muted tabular-nums">{formatBytes(a.size)}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Update feeds and block maps, which the app reads to update itself, are on the <External href={release.url}>release page</External>.
            </p>
          </div>
        </section>
      )}

      <section className="panel relative overflow-hidden px-6 py-12 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(168_24_47/0.18),transparent_65%)]" />
        <div className="relative flex flex-col items-center">
          <Image src="/brand/vigil/icon-512.png" alt="" width={56} height={56} className="h-14 w-14" />
          <h2 className="mt-4 font-title text-2xl text-gold sm:text-3xl">Keep watch tonight</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Install Vigil before your next raid and every pull lands on your guild&apos;s site, ready to review.
          </p>
          <div className="mt-6 flex justify-center">
            {release ? <Downloads release={release} platform={platform} /> : <NoRelease ok={ok} />}
          </div>
          {release && (
            <p className="mt-6 text-xs text-muted">
              Vigil {release.version}
              {released && `, released ${released}`}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
