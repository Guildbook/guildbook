import type { MetadataRoute } from "next";
import { getSiteIdentity } from "@/server/site";

/** Per host. Preview deployments are never indexed; guild hosts keep member and officer areas out. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { current, guild } = await getSiteIdentity();
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: guild ? ["/admin", "/members", "/vigil", "/login", "/denied", "/api/"] : ["/login", "/create", "/api/"],
    },
    sitemap: `${current.origin}/sitemap.xml`,
  };
}
