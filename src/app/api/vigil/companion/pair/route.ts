import { db } from "@/db";
import { handlePair } from "@/server/vigil-companion-api";

/** The Vigil companion trades a pairing code from /vigil/companion for a device token. */
export async function POST(request: Request) {
  return handlePair(db, request);
}
