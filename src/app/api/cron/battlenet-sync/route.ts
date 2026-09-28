import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { getBlizzardClient } from "@/server/blizzard";
import { cronAuthorized } from "@/server/cron";
import { DomainError } from "@/server/errors";
import { syncAllGuilds } from "@/server/services/battlenet";

export const maxDuration = 300;

/** Battle.net sync on its own; the scheduled job is /api/cron/daily. */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await syncAllGuilds(db, getBlizzardClient());
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    throw err;
  }
}
