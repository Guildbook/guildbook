"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { setupUrl } from "@/lib/guild-setup";
import { type ActionResult, actionError } from "@/server/action";
import { getSessionUser } from "@/server/context";
import { sessionReachUrl } from "@/server/handoff";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { createRateLimiter } from "@/server/rate-limit";
import { FACTIONS, REGIONS, RULESETS } from "@/lib/game";
import { checkSlugAvailability, createGuildForUser, type SlugAvailability } from "@/server/services/platform";

const createLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const slugCheckLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

const oneOf = <T extends string>(values: readonly T[], v: unknown): T | null =>
  (values as readonly unknown[]).includes(v) ? (v as T) : null;

/** Live availability for the create form; `identity` is what's chosen so far, for meaningful suggestions. */
export async function checkSlugAction(
  slug: string,
  identity: { region?: string; faction?: string; ruleset?: string } = {},
): Promise<SlugAvailability> {
  const user = await getSessionUser();
  if (!user) return { available: false, reason: "Sign in to check availability" };
  if (!slugCheckLimiter(user.id).ok) return { available: false, reason: "Too many checks. Wait a moment." };
  return checkSlugAvailability(db, String(slug ?? "").slice(0, 64), {
    region: oneOf(REGIONS, identity?.region),
    faction: oneOf(FACTIONS, identity?.faction),
    ruleset: oneOf(RULESETS, identity?.ruleset),
  });
}

export async function createGuildAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in with Discord to create a guild." };
  const limited = createLimiter(user.id);
  if (!limited.ok) return { ok: false, error: `Too many attempts. Try again in ${limited.retryAfterS} seconds.` };

  let slug: string;
  try {
    const created = await createGuildForUser(db, user.id, Object.fromEntries(fd.entries()));
    slug = created.guild.slug;
  } catch (err) {
    return actionError(err);
  }
  const current = await getRequestHost();
  redirect(await sessionReachUrl(db, user, setupUrl(guildOrigin(slug, current)), current));
}
