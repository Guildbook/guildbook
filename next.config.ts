import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The legal pages read their Markdown at runtime; make sure it ships with the serverless functions.
  outputFileTracingIncludes: {
    "/platform/terms": ["./src/content/legal/**/*"],
    "/platform/privacy": ["./src/content/legal/**/*"],
    // Guild link previews are drawn with the bundled Cinzel fonts.
    "/api/brand/[slug]/[file]": ["./scripts/fonts/*.ttf"],
  },
};

export default nextConfig;
