/**
 * Fixed-window limiter held in memory. On serverless hosts each instance keeps its own window, so treat it
 * as a brake on abuse from one client, not an exact global quota (device uploads use a database counter).
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { start: number; count: number }>();
  return function take(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterS: number } {
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
    }
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return { ok: true };
    }
    entry.count++;
    if (entry.count <= limit) return { ok: true };
    return { ok: false, retryAfterS: Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)) };
  };
}

/** The client address as the proxy in front of us reports it. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
