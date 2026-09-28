import "server-only";
import { unstable_cache } from "next/cache";
import { COMPANION_REPO, type CompanionRelease, pickCompanionRelease } from "@/lib/vigil/companion-release";

const REVALIDATE_S = 3600;
/** After a failed call, serve the last good answer for a while instead of asking GitHub on every request. */
const FAILURE_BACKOFF_MS = 5 * 60_000;

/** Thrown out of the cache when there is no release yet, so the first one shows up within the backoff, not the hour. */
class NoReleaseYet extends Error {}

/**
 * The latest Vigil release from GitHub's public API, cached for an hour across instances. No token is needed for a
 * public repository (60 requests an hour per IP); `GITHUB_TOKEN`, if set, raises that limit. Failures aren't cached.
 */
const fetchLatest = unstable_cache(
  async (): Promise<CompanionRelease> => {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "guildbook.io",
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`https://api.github.com/repos/${COMPANION_REPO}/releases?per_page=30`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const release = pickCompanionRelease(await res.json());
    if (!release) throw new NoReleaseYet();
    return release;
  },
  ["vigil-companion-release-v2", COMPANION_REPO],
  { revalidate: REVALIDATE_S },
);

let lastGood: CompanionRelease | null = null;
let failedAt = 0;
/** Whether the last call reached GitHub and found no release, as opposed to failing. */
let noneYet = false;

/** `ok` is false when GitHub could not be reached and there is no earlier answer to fall back on. */
export interface ReleaseLookup {
  ok: boolean;
  release: CompanionRelease | null;
}

export async function latestCompanionRelease(): Promise<ReleaseLookup> {
  if (Date.now() - failedAt < FAILURE_BACKOFF_MS) return { ok: Boolean(lastGood) || noneYet, release: lastGood };
  try {
    lastGood = await fetchLatest();
    noneYet = false;
    return { ok: true, release: lastGood };
  } catch (err) {
    failedAt = Date.now();
    noneYet = err instanceof NoReleaseYet;
    if (!noneYet) console.warn("Could not load the Vigil release from GitHub:", err instanceof Error ? err.message : err);
    return { ok: Boolean(lastGood) || noneYet, release: lastGood };
  }
}
