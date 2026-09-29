"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { guildHref } from "@/lib/paths";
import { VISIBILITY_LABELS } from "@/lib/vigil/visibility";
import { type ActionResult, runAction } from "@/server/action";
import { setFlash } from "@/server/flash";
import {
  createVigilReport,
  deleteVigilReport,
  setVigilDefaultVisibility,
  setVigilReportVisibility,
} from "@/server/services/vigil";
import { createPairingCode, revokeCompanionDevice } from "@/server/services/vigil-companion";

export type UploadResult = { ok: true; id: string; warning: string | null } | { ok: false; error: string };

/** One fight per call keeps each request well under the 1 MB server action body limit. */
export async function uploadVigilReportAction(
  slug: string,
  payload: { report: unknown; characterId: string | null; visibility: string | null },
): Promise<UploadResult> {
  let saved = { id: "", warning: null as string | null };
  const result = await runAction(slug, async ({ viewer }) => {
    saved = await createVigilReport(db, viewer.actor, payload);
  });
  return result.ok ? { ok: true, id: saved.id, warning: saved.warning } : { ok: false, error: result.error };
}

export async function setVigilVisibilityAction(
  slug: string,
  id: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const report = await setVigilReportVisibility(db, viewer.actor, id, fd.get("visibility"));
    refresh();
    const label = VISIBILITY_LABELS[report.visibility];
    return report.changed ? `${report.fightLabel} is now ${label.toLowerCase()}.` : `${report.fightLabel} is already ${label.toLowerCase()}.`;
  });
}

export async function setVigilDefaultVisibilityAction(
  slug: string,
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const applyToExisting = fd.get("applyToExisting") === "on";
    await setVigilDefaultVisibility(db, viewer.actor, fd.get("visibility"), applyToExisting);
    refresh();
    return applyToExisting ? "Default saved and applied to all your reports." : "Default saved for new reports.";
  });
}

export type PairingCodeResult = { ok: true; code: string; expiresAt: string } | { ok: false; error: string };

export async function createCompanionPairingCodeAction(slug: string): Promise<PairingCodeResult> {
  const out: { code?: string; expiresAt?: Date } = {};
  const result = await runAction(slug, async ({ viewer }) => {
    Object.assign(out, await createPairingCode(db, viewer.actor));
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, code: out.code!, expiresAt: out.expiresAt!.toISOString() };
}

export async function revokeCompanionDeviceAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    await revokeCompanionDevice(db, viewer.actor, id);
    refresh();
    return "Companion revoked. It can no longer upload.";
  });
}

export async function deleteVigilReportAction(slug: string, id: string, _prev: ActionResult | null): Promise<ActionResult> {
  const result = await runAction(slug, async ({ viewer }) => {
    const report = await deleteVigilReport(db, viewer.actor, id);
    return `Report for ${report.fightLabel} deleted.`;
  });
  if (!result.ok) return result;
  if (result.message) await setFlash(result.message);
  redirect(guildHref(slug, "/vigil"));
}
