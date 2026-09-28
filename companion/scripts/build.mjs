// Bundles the main process, preload and window with esbuild. `@/` resolves to the site's src/, so the
// combat log parser and Vigil analysis are shared rather than copied.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, "..");
const site = path.resolve(pkg, "..");
const dist = path.join(pkg, "dist");
const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

const siteUrl = process.env.VIGIL_SITE_URL ?? "http://osm.localhost:3000";
if (production && !process.env.VIGIL_SITE_URL) {
  console.warn("VIGIL_SITE_URL is not set; the packaged app will default to http://osm.localhost:3000.");
}

const common = {
  bundle: true,
  sourcemap: production ? false : "inline",
  minify: production,
  logLevel: "info",
  alias: { "@": path.join(site, "src") },
  define: { __DEFAULT_SITE_URL__: JSON.stringify(siteUrl) },
};

function copyStatic() {
  const out = path.join(dist, "renderer");
  mkdirSync(path.join(out, "fonts"), { recursive: true });
  for (const f of ["index.html", "styles.css"]) cpSync(path.join(pkg, "src", "renderer", f), path.join(out, f));
  const fonts = [
    ["cinzel", "cinzel-latin-400-normal.woff2"],
    ["cinzel", "cinzel-latin-700-normal.woff2"],
    ["inter", "inter-latin-400-normal.woff2"],
    ["inter", "inter-latin-600-normal.woff2"],
  ];
  for (const [family, file] of fonts) {
    cpSync(path.join(pkg, "node_modules", "@fontsource", family, "files", file), path.join(out, "fonts", file));
  }
  const addon = path.join(site, "addons", "Vigil");
  const dest = path.join(pkg, "resources", "addon", "Vigil");
  if (existsSync(addon)) {
    rmSync(dest, { recursive: true, force: true });
    cpSync(addon, dest, { recursive: true });
  }
}

const copyPlugin = {
  name: "copy-static",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) copyStatic();
    });
  },
};

rmSync(dist, { recursive: true, force: true });

const configs = [
  {
    ...common,
    entryPoints: { main: path.join(pkg, "src/main/main.ts"), preload: path.join(pkg, "src/main/preload.ts") },
    outdir: dist,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["electron"],
  },
  {
    ...common,
    entryPoints: { main: path.join(pkg, "src/renderer/main.ts") },
    outdir: path.join(dist, "renderer"),
    platform: "browser",
    format: "iife",
    target: "chrome138",
    plugins: [copyPlugin],
  },
];

if (watch) {
  for (const config of configs) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  }
  // Static files are not part of the renderer graph; copy them again when they change.
  const { watch: fsWatch } = await import("node:fs");
  fsWatch(path.join(pkg, "src", "renderer"), (_event, file) => {
    if (file && /\.(html|css)$/.test(file)) copyStatic();
  });
} else {
  await Promise.all(configs.map((c) => esbuild.build(c)));
}
