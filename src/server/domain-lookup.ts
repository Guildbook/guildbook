import { and, eq } from "drizzle-orm";
import { guildDomains, guilds } from "@/db/schema";
import type { Db } from "@/db/types";

/**
 * Verified custom domain to guild slug, cached per server instance. Imported by the proxy, so no `server-only`.
 * Hits are kept for a minute and misses for 30 seconds; verifying or removing a domain clears the entry here,
 * and other instances pick the change up when their entry expires.
 */
const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 30_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { slug: string | null; expires: number }>();

export async function lookupCustomDomainSlug(host: string, db?: Db, now = Date.now()): Promise<string | null> {
  const cached = cache.get(host);
  if (cached && cached.expires > now) return cached.slug;
  let slug: string | null = null;
  try {
    // Loaded lazily so importing this module doesn't open the shared pool (tests pass their own database).
    const conn = db ?? (await import("@/db/client")).db;
    const [row] = await conn
      .select({ slug: guilds.slug })
      .from(guildDomains)
      .innerJoin(guilds, eq(guilds.id, guildDomains.guildId))
      .where(and(eq(guildDomains.domain, host), eq(guildDomains.status, "verified")));
    slug = row?.slug ?? null;
  } catch (err) {
    console.error("Custom domain lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(host, { slug, expires: now + (slug ? HIT_TTL_MS : MISS_TTL_MS) });
  return slug;
}

export function forgetCustomDomain(host: string) {
  cache.delete(host);
}
