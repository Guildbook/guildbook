import "server-only";
import { z } from "zod";
import { AuthorizationError } from "@/lib/authz/policy";
import { DomainError } from "@/server/errors";
import type { ActionResult } from "@/server/action-types";
import { type Guild, getGuild, getViewer, type Viewer } from "@/server/context";

export type { ActionResult };

/** Expected failures (validation, permissions, domain rules) as a form result; anything else is rethrown. */
export function actionError(err: unknown): ActionResult {
  if (err instanceof z.ZodError) {
    const flat = z.flattenError(err);
    return {
      ok: false,
      error: flat.formErrors[0] ?? "Please fix the highlighted fields.",
      fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
    };
  }
  if (err instanceof AuthorizationError || err instanceof DomainError) {
    return { ok: false, error: err.message };
  }
  throw err;
}

/**
 * Resolve guild + viewer for a server action and translate expected failures into form errors.
 * Authorization itself happens inside each service via `assertCan`.
 */
export async function runAction(
  guildSlug: string,
  fn: (ctx: { guild: Guild; viewer: Viewer }) => Promise<string | void>,
): Promise<ActionResult> {
  try {
    const guild = await getGuild(guildSlug);
    const viewer = await getViewer(guild.id);
    const message = await fn({ guild, viewer });
    return { ok: true, message: message ?? undefined };
  } catch (err) {
    return actionError(err);
  }
}
