"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { RANK_PRESETS, isRankPresetKey } from "@/lib/rank-presets";
import { type ActionResult, runAction } from "@/server/action";
import {
  applyRankPreset,
  confirmRanks,
  ensureDraftInvite,
  publishGuild,
  setSetupDismissed,
  setSetupStepSkipped,
  unpublishGuild,
  applyNeutralDefaults,
} from "@/server/services/guild-setup";

type Prev = ActionResult | null;

export async function skipSetupStepAction(slug: string, step: string, skipped: boolean, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await setSetupStepSkipped(db, viewer.actor, step, skipped);
    refresh();
  });
}

export async function dismissSetupAction(slug: string, dismissed: boolean, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await setSetupDismissed(db, viewer.actor, dismissed);
    refresh();
    return dismissed ? "Setup checklist hidden. Find it again under Admin, then Setup." : undefined;
  });
}

export async function confirmRanksAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await confirmRanks(db, viewer.actor);
    refresh();
    return "Ranks confirmed.";
  });
}

export async function applyRankPresetAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { preset, movedMembers } = await applyRankPreset(db, viewer.actor, fd.get("preset"));
    refresh();
    return movedMembers > 0 ? `${preset} ranks applied. ${movedMembers} members moved to a matching rank.` : `${preset} ranks applied.`;
  });
}

export async function neutralDefaultsAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const key = fd.get("preset");
    const result = await applyNeutralDefaults(db, viewer.actor, key);
    refresh();
    const parts = [
      result.ranksReplaced && isRankPresetKey(key) ? `${RANK_PRESETS[key].label} ranks applied` : null,
      result.pagesReplaced > 0 ? "starter pages restored" : null,
    ].filter(Boolean);
    return `Neutral defaults in place: ${parts.join(", ") || "done"}.`;
  });
}

export async function publishGuildAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await publishGuild(db, viewer.actor);
    refresh();
    return "Your guild is published.";
  });
}

export async function unpublishGuildAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await unpublishGuild(db, viewer.actor);
    refresh();
    return "Your guild is a draft again.";
  });
}

export async function createDraftInviteAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await ensureDraftInvite(db, viewer.actor);
    refresh();
    return "Invite link ready.";
  });
}
