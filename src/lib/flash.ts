import type { ToastKind } from "@/lib/toast";

/**
 * A toast carried across a redirect: the server action sets this short-lived cookie and the next page's
 * `Toaster` reads and clears it. Not httpOnly, since the client clears it after showing it.
 */
export const FLASH_COOKIE = "gb_flash";
export const FLASH_MAX_AGE_SECONDS = 30;

export interface Flash {
  kind: ToastKind;
  message: string;
}

export function encodeFlash(flash: Flash): string {
  return JSON.stringify({ k: flash.kind, m: flash.message });
}

export function decodeFlash(raw: string | undefined | null): Flash | null {
  if (!raw) return null;
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Already decoded.
  }
  try {
    const parsed = JSON.parse(text) as { k?: unknown; m?: unknown };
    if ((parsed.k !== "success" && parsed.k !== "error") || typeof parsed.m !== "string" || !parsed.m.trim()) return null;
    return { kind: parsed.k, message: parsed.m.slice(0, 300) };
  } catch {
    return null;
  }
}

/** The flash cookie's value from a `document.cookie` string. */
export function readFlashCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq).trim() === FLASH_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}
