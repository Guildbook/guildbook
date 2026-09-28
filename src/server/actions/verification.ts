"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { type ActionResult, runAction } from "@/server/action";
import { getBlizzardClient } from "@/server/blizzard";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { claimGuildName, claimGuildSlug, dismissAdminNotice, verifyGuild } from "@/server/services/guild-verification";

type Prev = ActionResult | null;

export async function verifyGuildAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { state, result } = await verifyGuild(db, viewer.actor, getBlizzardClient());
    refresh();
    if (state === "verified" && result.verified) return "Your guild is verified.";
    if (state === "verified") return `Still verified, but this check failed: ${result.message}`;
    if (state === "failing") return `Verification check failed. The badge stays for now: ${result.message}`;
    if (state === "lapsed") return `Verification removed: ${result.message}`;
    return result.message;
  });
}

export async function claimGuildNameAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { name, renamedHolder } = await claimGuildName(db, viewer.actor, getBlizzardClient());
    refresh();
    return renamedHolder
      ? `Your guild is now ${name} and verified. The unverified guild that held the name is now ${renamedHolder}.`
      : `Your guild is now ${name} and verified.`;
  });
}

export async function claimGuildSlugAction(slug: string, _prev: Prev): Promise<ActionResult> {
  let claimed: string | null = null;
  const result = await runAction(slug, async ({ viewer }) => {
    claimed = (await claimGuildSlug(db, viewer.actor)).slug;
  });
  if (!result.ok || !claimed) return result;
  redirect(`${guildOrigin(claimed, await getRequestHost())}/admin/guild`);
}

export async function dismissAdminNoticeAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await dismissAdminNotice(db, viewer.actor);
    refresh();
  });
}
