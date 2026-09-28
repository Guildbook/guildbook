"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { type ActionResult, actionError } from "@/server/action";
import { getSessionUser } from "@/server/context";
import { sessionReachUrl } from "@/server/handoff";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { createRateLimiter } from "@/server/rate-limit";
import { checkSlugAvailability, createGuildForUser, type SlugAvailability } from "@/server/services/platform";

const createLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const slugCheckLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function checkSlugAction(slug: string): Promise<SlugAvailability> {
  const user = await getSessionUser();
  if (!user) return { available: false, reason: "Sign in to check availability" };
  if (!slugCheckLimiter(user.id).ok) return { available: false, reason: "Too many checks. Wait a moment." };
  return checkSlugAvailability(db, String(slug ?? "").slice(0, 64));
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
  redirect(await sessionReachUrl(db, user, `${guildOrigin(slug, current)}/admin`, current));
}
