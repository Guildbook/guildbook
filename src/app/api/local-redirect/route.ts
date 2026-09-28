import { type NextRequest, NextResponse } from "next/server";
import { isLocalHost } from "@/lib/hosts";
import { LOCAL_REDIRECT_HEADER } from "@/lib/local-redirect";

/**
 * Dev only: the proxy rewrites here to redirect one local host to another (say `osm.localhost/terms` to the
 * `localhost` apex), because Next would make that redirect relative if the proxy returned it. Only local targets
 * requested from a local host are followed, so this is never an open redirect in production.
 */
export function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  let target: URL;
  try {
    target = new URL(request.headers.get(LOCAL_REDIRECT_HEADER) ?? "");
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!isLocalHost(host) || !isLocalHost(target.host) || (target.protocol !== "http:" && target.protocol !== "https:")) {
    return new NextResponse(null, { status: 400 });
  }
  return NextResponse.redirect(target, 307);
}
