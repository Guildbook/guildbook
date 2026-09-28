import { z } from "zod";
import type { Db } from "@/db/types";
import { AuthorizationError } from "@/lib/authz/policy";
import { guildHref } from "@/lib/paths";
import { MAX_REPORT_BYTES } from "@/lib/vigil/report";
import { DomainError, NotFoundError } from "@/server/errors";
import { clientIp, createRateLimiter } from "@/server/rate-limit";
import {
  authenticateDevice,
  companionProfile,
  exchangePairingCode,
  takeUploadQuota,
  uploadCompanionReport,
} from "@/server/services/vigil-companion";

/**
 * HTTP handlers behind /api/vigil/companion/*. They take the database as an argument so the integration
 * tests can drive them with real Requests against PGlite.
 */

const pairLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

function errorResponse(err: unknown): Response {
  if (err instanceof z.ZodError) return json({ error: "The request was not in the expected format." }, 400);
  if (err instanceof AuthorizationError) return json({ error: err.message }, err.code === "unauthenticated" ? 401 : 403);
  if (err instanceof NotFoundError) return json({ error: err.message }, 404);
  if (err instanceof DomainError) return json({ error: err.message }, 400);
  throw err;
}

const bearer = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
};

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new PayloadTooLarge();
  const text = await request.text();
  if (text.length > maxBytes) throw new PayloadTooLarge();
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError("The request body was not valid JSON.");
  }
}

class PayloadTooLarge extends Error {}

export async function handlePair(db: Db, request: Request): Promise<Response> {
  const limit = pairLimiter(clientIp(request));
  if (!limit.ok) return json({ error: "Too many pairing attempts. Wait a minute." }, 429, { "Retry-After": String(limit.retryAfterS) });
  try {
    const result = await exchangePairingCode(db, await readJson(request, 4096));
    return json(result, 201);
  } catch (err) {
    if (err instanceof PayloadTooLarge) return json({ error: "Request too large." }, 413);
    return errorResponse(err);
  }
}

export async function handleProfile(db: Db, request: Request): Promise<Response> {
  try {
    const auth = await authenticateDevice(db, bearer(request));
    return json(await companionProfile(db, auth));
  } catch (err) {
    return errorResponse(err);
  }
}

/** The origin the companion called. In dev, Next's `request.url` is the server's own localhost whatever the host. */
function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return url.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${proto ? `${proto}:` : url.protocol}//${host}`;
}

export async function handleUpload(db: Db, request: Request): Promise<Response> {
  try {
    const auth = await authenticateDevice(db, bearer(request));
    const body = await readJson(request, MAX_REPORT_BYTES + 4096);
    const quota = await takeUploadQuota(db, auth.device.id);
    if (!quota.ok) {
      return json({ error: "Uploading too fast. The companion will retry." }, 429, { "Retry-After": String(quota.retryAfterS) });
    }
    const { id } = await uploadCompanionReport(db, auth, body);
    const url = new URL(guildHref(auth.guild.slug, `/vigil/reports/${id}`), requestOrigin(request)).toString();
    return json({ id, url }, 201);
  } catch (err) {
    if (err instanceof PayloadTooLarge) return json({ error: "This fight's report is too large to upload." }, 413);
    return errorResponse(err);
  }
}
