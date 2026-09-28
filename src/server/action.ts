import "server-only";
import { actionError } from "@/server/action-error";
import type { ActionResult } from "@/server/action-types";
import { type Guild, getGuild, getViewer, type Viewer } from "@/server/context";

export type { ActionResult };
export { actionError };

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
