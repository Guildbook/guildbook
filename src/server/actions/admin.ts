"use server";

import { resolveTxt } from "node:dns/promises";
import { refresh } from "next/cache";
import { db } from "@/db";
import { type ActionResult, runAction } from "@/server/action";
import { addGuildDomain, type DomainDeps, removeGuildDomain, verifyGuildDomain } from "@/server/services/domains";
import { DomainError } from "@/server/errors";
import { getDomainProvider } from "@/server/vercel-domains";
import { CLASS_INFO, DAYS_OF_WEEK, fullName, ROLE_LABELS } from "@/lib/game";
import { reviewApplication } from "@/server/services/applications";
import {
  createBoss,
  createInstance,
  deleteAddon,
  deleteBossKill,
  deleteScheduleSlot,
  recordBossKill,
  saveAddon,
  saveScheduleSlot,
  setRecruitmentNeed,
  updateContentPage,
} from "@/server/services/content";
import {
  assignRank,
  createRank,
  deleteRank,
  moveRank,
  removeMember,
  setRankDefaults,
  setRecruitmentOpen,
  updateGuildSettings,
  updateRank,
} from "@/server/services/ranks";

type Prev = ActionResult | null;
const obj = (fd: FormData) => Object.fromEntries(fd.entries());

export async function reviewApplicationAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const app = await reviewApplication(db, viewer.actor, obj(fd));
    refresh();
    const name = fullName(app.characterName, app.characterSurname);
    const rank = app.rankName ? ` as ${app.rankName}` : "";
    if (app.status === "accepted") return `${name} accepted${rank}.`;
    if (app.status === "trial") return `${name} placed on trial${rank}.`;
    return `Application from ${name} declined.`;
  });
}

export async function assignRankAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { characterName, rankName } = await assignRank(db, viewer.actor, obj(fd));
    refresh();
    return characterName ? `${characterName} is now ${rankName}.` : `Rank changed to ${rankName}.`;
  });
}

export async function removeMemberAction(slug: string, membershipId: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { characterName } = await removeMember(db, viewer.actor, membershipId);
    refresh();
    return characterName ? `${characterName} removed from the guild.` : "Member removed from the guild.";
  });
}

export async function createRankAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await createRank(db, viewer.actor, obj(fd));
    refresh();
    return "Rank created.";
  });
}

export async function updateRankAction(slug: string, id: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await updateRank(db, viewer.actor, id, obj(fd));
    refresh();
    return "Saved.";
  });
}

export async function moveRankAction(slug: string, id: string, direction: "up" | "down", _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await moveRank(db, viewer.actor, id, direction);
    refresh();
  });
}

export async function deleteRankAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await deleteRank(db, viewer.actor, id);
    refresh();
    return "Rank deleted.";
  });
}

export async function setRankDefaultsAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await setRankDefaults(db, viewer.actor, obj(fd));
    refresh();
    return "Saved.";
  });
}

export async function updateGuildSettingsAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await updateGuildSettings(db, viewer.actor, obj(fd));
    refresh();
    return "Guild settings saved.";
  });
}

export async function updateContentAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const page = await updateContentPage(db, viewer.actor, obj(fd));
    refresh();
    return `${page.title} saved.`;
  });
}

export async function saveScheduleSlotAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const slot = await saveScheduleSlot(db, viewer.actor, obj(fd));
    refresh();
    return `${DAYS_OF_WEEK[slot.dayOfWeek]} ${slot.label} ${slot.created ? "added to" : "saved on"} the schedule.`;
  });
}

export async function deleteScheduleSlotAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await deleteScheduleSlot(db, viewer.actor, id);
    refresh();
    return "Raid night deleted.";
  });
}

export async function setRecruitmentNeedAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const need = await setRecruitmentNeed(db, viewer.actor, obj(fd));
    refresh();
    return `${CLASS_INFO[need.wowClass].label} ${ROLE_LABELS[need.role]} need set to ${need.priority}.`;
  });
}

export async function setRecruitmentOpenAction(slug: string, open: boolean, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await setRecruitmentOpen(db, viewer.actor, open);
    refresh();
    return open ? "Recruitment opened." : "Recruitment closed.";
  });
}

export async function createInstanceAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await createInstance(db, viewer.actor, obj(fd));
    refresh();
    return "Instance added.";
  });
}

export async function createBossAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await createBoss(db, viewer.actor, obj(fd));
    refresh();
    return "Boss added.";
  });
}

export async function recordBossKillAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ guild, viewer }) => {
    const { bossName } = await recordBossKill(db, viewer.actor, obj(fd));
    refresh();
    return `${bossName ?? "Boss"} kill recorded.${guild.preset === "order" ? " Deo gratias!" : ""}`;
  });
}

export async function deleteBossKillAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await deleteBossKill(db, viewer.actor, id);
    refresh();
    return "Kill record deleted.";
  });
}

export async function saveAddonAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const addon = await saveAddon(db, viewer.actor, obj(fd));
    refresh();
    return `${addon.name} ${addon.created ? "added" : "saved"}.`;
  });
}

export async function deleteAddonAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await deleteAddon(db, viewer.actor, id);
    refresh();
    return "Addon deleted.";
  });
}

const domainDeps = (): DomainDeps => ({ provider: getDomainProvider(), resolveTxt });

export async function addDomainAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const domain = await addGuildDomain(db, viewer.actor, obj(fd), domainDeps());
    refresh();
    return `${domain.domain} added. Add the DNS records below, then check verification.`;
  });
}

export async function verifyDomainAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const domain = await verifyGuildDomain(db, viewer.actor, id, domainDeps());
    refresh();
    if (domain.status !== "verified") throw new DomainError(`${domain.domain} is not verified yet. See the details above.`);
    return `${domain.domain} is verified.`;
  });
}

export async function removeDomainAction(slug: string, id: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await removeGuildDomain(db, viewer.actor, id, domainDeps());
    refresh();
    return "Domain removed.";
  });
}
