import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import { db } from "@/db";
import { guildPreviewImage, PREVIEW_PAGES, type PreviewPage } from "@/lib/brand";
import { getGuild } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { primaryCustomDomain } from "@/server/services/domains";

/** The guild's public origin (verified custom domain, else subdomain), resolved once per render. */
export const guildPublicOrigin = cache(async (slug: string) => {
  const guild = await getGuild(slug);
  const [current, customDomain] = await Promise.all([getRequestHost(), primaryCustomDomain(db, guild.id)]);
  return guildOrigin(guild.slug, current, customDomain);
});

export const guildDescription = (guild: { name: string; description: string }) =>
  guild.description || `${guild.name}, a World of Warcraft: Forever guild on Guildbook.`;

/**
 * Open Graph and X card tags for a guild page: its link preview (with the page title above the guild's name on
 * key pages), title and description. Pages that set `openGraph` replace the layout's whole block, so this builds
 * all of it.
 */
export async function guildSocialMetadata(
  slug: string,
  page?: PreviewPage,
  override: { title?: string; description?: string } = {},
): Promise<Pick<Metadata, "openGraph" | "twitter">> {
  const [guild, origin] = await Promise.all([getGuild(slug), guildPublicOrigin(slug)]);
  const image = guildPreviewImage(guild, new URL(origin).host, page);
  const pageTitle = override.title ?? (page ? PREVIEW_PAGES[page] : null);
  const title = pageTitle ? `${pageTitle} | ${guild.name}` : guild.name;
  const description = override.description ?? guildDescription(guild);
  return {
    openGraph: { type: "website", siteName: guild.name, title, description, url: page ? `/${page}` : "/", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
