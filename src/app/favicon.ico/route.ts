import { NextResponse } from "next/server";
import { brandFile } from "@/lib/brand";
import { getSiteIdentity } from "@/server/site";

/** Browsers and crawlers ask for /favicon.ico directly; send each host's own icon. */
export async function GET(request: Request) {
  const { brand } = await getSiteIdentity();
  return NextResponse.redirect(new URL(brandFile(brand, "favicon.ico"), request.url), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
