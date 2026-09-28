import type { Metadata } from "next";
import { GuildThemeStyle } from "@/components/guild-theme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { brandIcons, brandPreviewImage, guildBrand } from "@/lib/brand";
import { getGuild, getViewer } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { primaryCustomDomain } from "@/server/services/domains";

/** Link previews and canonical URLs use the guild's own host: its verified custom domain, else its subdomain. */
export async function generateMetadata({ params }: LayoutProps<"/[guild]">): Promise<Metadata> {
  const { guild: slug } = await params;
  const guild = await getGuild(slug);
  const [current, customDomain] = await Promise.all([getRequestHost(), primaryCustomDomain(db, guild.id)]);
  const brand = guildBrand(guild);
  const description = guild.description || `${guild.name}, a World of Warcraft: Forever guild on Guildbook.`;
  const image = brandPreviewImage(brand);
  return {
    metadataBase: new URL(guildOrigin(guild.slug, current, customDomain)),
    title: { default: guild.name, template: `%s | ${guild.name}` },
    description,
    applicationName: guild.name,
    icons: brandIcons(brand),
    openGraph: { type: "website", siteName: guild.name, title: guild.name, description, url: "/", images: [image] },
    twitter: { card: "summary_large_image", title: guild.name, description, images: [image] },
  };
}

export default async function GuildLayout({ children, params }: LayoutProps<"/[guild]">) {
  const { guild: slug } = await params;
  const guild = await getGuild(slug);
  const viewer = await getViewer(guild.id);

  return (
    <>
      <GuildThemeStyle guild={guild} />
      <SiteHeader guild={guild} viewer={viewer} />
      <main className="mx-auto w-full max-w-6xl min-h-screen flex-1 px-4 py-6 sm:py-10">{children}</main>
      <SiteFooter guild={guild} viewer={viewer} />
    </>
  );
}
