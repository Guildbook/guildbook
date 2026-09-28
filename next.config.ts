import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The legal pages read their Markdown at runtime; make sure it ships with the serverless functions.
  outputFileTracingIncludes: {
    "/platform/terms": ["./src/content/legal/**/*"],
    "/platform/privacy": ["./src/content/legal/**/*"],
    // Guild link previews are drawn with the bundled Cinzel fonts, the faction crests and the Order's crest; icons and
    // previews tint Blizzard's tabard emblems on the server.
    "/api/brand/[slug]/[file]": [
      "./scripts/fonts/*.ttf",
      "./public/icons/factions/*.png",
      "./public/brand/osm/icon-512.png",
      "./public/tabard/emblems/*.png",
    ],
  },
};

export default nextConfig;
