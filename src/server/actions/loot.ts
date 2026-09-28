"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { guildHref } from "@/lib/paths";
import { type ActionResult, runAction } from "@/server/action";
import { getBlizzardClient } from "@/server/blizzard";
import { battlenetEnabled } from "@/server/blizzard/config";
import { setFlash } from "@/server/flash";
import { awardLoot, commitImport, discardImport, previewImport, reverseLoot } from "@/server/services/loot";

type Prev = ActionResult | null;
const obj = (fd: FormData) => Object.fromEntries(fd.entries());

/** Blizzard's item API only fills gaps, and only with real credentials (the mock knows no items). */
function itemClient() {
  const client = getBlizzardClient();
  return battlenetEnabled(client.config) && !client.config.mock ? client : null;
}

export async function awardLootAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const award = await awardLoot(db, viewer.actor, obj(fd), { client: itemClient() });
    refresh();
    return award.recipientName ? `${award.itemName} awarded to ${award.recipientName}.` : `${award.itemName} recorded.`;
  });
}

export async function reverseLootAction(slug: string, entryId: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const r = await reverseLoot(db, viewer.actor, { entryId, reason: fd.get("reason") });
    refresh();
    return `${r.itemName} reversed.`;
  });
}

export async function previewLootImportAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  let batchId: string | null = null;
  const result = await runAction(slug, async ({ viewer }) => {
    const preview = await previewImport(db, viewer.actor, obj(fd), { client: itemClient() });
    batchId = preview.batchId;
    const skipped = preview.warnings ? ` ${preview.warnings} line${preview.warnings === 1 ? "" : "s"} couldn't be read.` : "";
    return `Read ${preview.rows} award${preview.rows === 1 ? "" : "s"} from the ${preview.parser} export.${skipped}`;
  });
  if (!result.ok || !batchId) return result;
  if (result.message) await setFlash(result.message);
  redirect(guildHref(slug, `/admin/loot/import?batch=${batchId}`));
}

export async function commitLootImportAction(slug: string, batchId: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  const decisions: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (key.startsWith("decision:") && typeof value === "string") decisions[key.slice("decision:".length)] = value;
  }
  const result = await runAction(slug, async ({ viewer }) => {
    const r = await commitImport(db, viewer.actor, { batchId, decisions, remember: fd.get("remember") });
    const parts = [`${r.inserted} award${r.inserted === 1 ? "" : "s"} added to the ledger.`];
    if (r.duplicates) parts.push(`${r.duplicates} already recorded.`);
    if (r.skipped) parts.push(`${r.skipped} left out.`);
    return parts.join(" ");
  });
  if (!result.ok) return result;
  if (result.message) await setFlash(result.message);
  redirect(guildHref(slug, "/admin/loot"));
}

export async function discardLootImportAction(slug: string, batchId: string, _prev: Prev): Promise<ActionResult> {
  const result = await runAction(slug, async ({ viewer }) => {
    await discardImport(db, viewer.actor, batchId);
    return "Import discarded.";
  });
  if (!result.ok) return result;
  if (result.message) await setFlash(result.message);
  redirect(guildHref(slug, "/admin/loot/import"));
}
