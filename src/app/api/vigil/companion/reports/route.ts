import { db } from "@/db";
import { handleUpload } from "@/server/vigil-companion-api";

/** One fight report per request from a paired Vigil companion (Bearer device token). */
export async function POST(request: Request) {
  return handleUpload(db, request);
}
