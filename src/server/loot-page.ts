import "server-only";
import { redirect } from "next/navigation";
import { canViewLoot } from "@/lib/loot/access";
import { guildHref } from "@/lib/paths";
import { getGuild, getViewer } from "@/server/context";

/** Like `requirePage`, for loot pages: members, or anyone when the guild has made its loot public. */
export async function requireLootPage(slug: string, returnTo: string) {
  const guild = await getGuild(slug);
  const viewer = await getViewer(guild.id);
  if (!canViewLoot(viewer.actor, guild)) {
    if (!viewer.user) redirect(`${guildHref(slug, "/login")}?callbackUrl=${encodeURIComponent(returnTo)}`);
    redirect(guildHref(slug, "/denied"));
  }
  return { guild, viewer, actor: viewer.actor };
}
