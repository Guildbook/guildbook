"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { type ActionResult, runAction } from "@/server/action";
import { updateGuildTabard } from "@/server/services/tabard";

/** Saving changes the tabard key in every icon URL, so browsers and caches fetch the regenerated icons. */
export async function updateGuildTabardAction(slug: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await updateGuildTabard(db, viewer.actor, Object.fromEntries(fd.entries()));
    refresh();
    return "Tabard and theme saved. Icons regenerated.";
  });
}
