import type { Metadata } from "next";
import { GuildThemeStyle } from "@/components/guild-theme";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brandIcons, guildBrand } from "@/lib/brand";
import { getGuild, getViewer } from "@/server/context";
import { guildDescription, guildPublicOrigin, guildSocialMetadata } from "@/server/guild-metadata";

/** Link previews and canonical URLs use the guild's own host: its verified custom domain, else its subdomain. */
export async function generateMetadata({ params }: LayoutProps<"/[guild]">): Promise<Metadata> {
  const { guild: slug } = await params;
  const [guild, origin, social] = await Promise.all([getGuild(slug), guildPublicOrigin(slug), guildSocialMetadata(slug)]);
  return {
    metadataBase: new URL(origin),
    title: { default: guild.name, template: `%s | ${guild.name}` },
    description: guildDescription(guild),
    applicationName: guild.name,
    icons: brandIcons(guildBrand(guild)),
    ...social,
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
