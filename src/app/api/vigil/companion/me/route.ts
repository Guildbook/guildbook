import { db } from "@/db";
import { handleProfile } from "@/server/vigil-companion-api";

/** Who a device token belongs to: guild, member, characters and default visibility. */
export async function GET(request: Request) {
  return handleProfile(db, request);
}
