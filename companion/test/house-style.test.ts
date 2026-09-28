import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.resolve(__dirname, "..", "src");
const MIDDOT = String.fromCharCode(0xb7);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("house style", () => {
  // ESLint covers string literals; this also covers the window's HTML and CSS (content: "..." and so on).
  it("has no middots anywhere in the app's source, markup or styles", () => {
    const offenders = files(src)
      .filter((f) => /\.(ts|html|css)$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes(MIDDOT))
      .map((f) => path.relative(src, f));
    expect(offenders).toEqual([]);
  });
});
