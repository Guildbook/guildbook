import "server-only";
import { cookies } from "next/headers";
import { encodeFlash, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS } from "@/lib/flash";
import type { ToastKind } from "@/lib/toast";

/** Queue a toast for the page a server action is about to `redirect()` to. */
export async function setFlash(message: string, kind: ToastKind = "success") {
  (await cookies()).set(FLASH_COOKIE, encodeFlash({ kind, message }), {
    path: "/",
    sameSite: "lax",
    maxAge: FLASH_MAX_AGE_SECONDS,
  });
}
