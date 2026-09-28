import { describe, expect, it } from "vitest";
import { decodeFlash, encodeFlash, readFlashCookie } from "@/lib/flash";

describe("flash cookie", () => {
  it("round-trips through the URI encoding a Set-Cookie header applies", () => {
    const value = encodeURIComponent(encodeFlash({ kind: "success", message: "Joanofarc Domremy added; welcome!" }));
    expect(decodeFlash(value)).toEqual({ kind: "success", message: "Joanofarc Domremy added; welcome!" });
  });

  it("rejects malformed or unknown payloads", () => {
    expect(decodeFlash(undefined)).toBeNull();
    expect(decodeFlash("not json")).toBeNull();
    expect(decodeFlash(JSON.stringify({ k: "info", m: "Hi" }))).toBeNull();
    expect(decodeFlash(JSON.stringify({ k: "error", m: "" }))).toBeNull();
  });

  it("finds the flash among other cookies", () => {
    expect(readFlashCookie("a=1; gb_flash=abc%20d; b=2")).toBe("abc%20d");
    expect(readFlashCookie("a=1; not_gb_flash=x")).toBeNull();
  });
});
