import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Vercel Cron (see vercel.json) sends `Authorization: Bearer $CRON_SECRET`. */
export function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
