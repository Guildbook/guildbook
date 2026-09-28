"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { fullName } from "@/lib/game";
import { getBattlenetDeps, getBlizzardClient } from "@/server/blizzard";
import { type ActionResult, runAction } from "@/server/action";
import {
  importBattlenetCharacter,
  refreshBattlenetSnapshot,
  syncGuildCharacters,
  unlinkBattlenet,
} from "@/server/services/battlenet";

type Prev = ActionResult | null;

export async function unlinkBattlenetAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { battletag, charactersUnverified } = await unlinkBattlenet(db, viewer.actor);
    refresh();
    const lapsed = charactersUnverified
      ? ` ${charactersUnverified} ${charactersUnverified === 1 ? "character is" : "characters are"} now unverified.`
      : "";
    return `Battle.net account ${battletag} unlinked.${lapsed}`;
  });
}

export async function refreshBattlenetAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const snapshot = await refreshBattlenetSnapshot(db, viewer.actor, getBattlenetDeps());
    refresh();
    const n = snapshot.characters.length;
    return `Found ${n} WoW: Forever ${n === 1 ? "character" : "characters"}.`;
  });
}

export async function importBattlenetCharacterAction(slug: string, _prev: Prev, fd: FormData): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const { character, created } = await importBattlenetCharacter(db, viewer.actor, Object.fromEntries(fd.entries()));
    refresh();
    return `${fullName(character.name, character.surname)} ${created ? "imported from Battle.net" : "verified via Battle.net"}.`;
  });
}

export async function syncCharactersAction(slug: string, _prev: Prev): Promise<ActionResult> {
  return runAction(slug, async ({ viewer }) => {
    const s = await syncGuildCharacters(db, viewer.actor, getBlizzardClient());
    refresh();
    if (s.checked === 0) return "No verified characters to sync.";
    const parts = [`${s.updated} updated`, `${s.unchanged} unchanged`];
    if (s.missing > 0) parts.push(`${s.missing} not found on Battle.net`);
    return `Synced ${s.checked} verified ${s.checked === 1 ? "character" : "characters"}: ${parts.join(", ")}.`;
  });
}
