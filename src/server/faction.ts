import { eq } from "drizzle-orm";
import type { Db } from "@/db/types";
import { guilds } from "@/db/schema";
import { type Faction, FACTION_LABELS } from "@/lib/game";
import { DomainError, NotFoundError } from "@/server/errors";

export async function getGuildFaction(tx: Db, guildId: string): Promise<Faction | null> {
  const [guild] = await tx.select({ faction: guilds.faction }).from(guilds).where(eq(guilds.id, guildId));
  if (!guild) throw new NotFoundError("Guild");
  return guild.faction;
}

/** A single-faction guild forces its faction; a two-faction guild requires one to be chosen. */
export async function resolveFaction(tx: Db, guildId: string, requested: Faction | null | undefined): Promise<Faction> {
  const locked = await getGuildFaction(tx, guildId);
  if (locked) {
    if (requested && requested !== locked) throw new DomainError(`This guild is ${FACTION_LABELS[locked]} only.`);
    return locked;
  }
  if (!requested) throw new DomainError("Choose a faction.");
  return requested;
}

/** For rows where faction is optional (schedule, recruitment): single-faction guilds always store their faction. */
export async function resolveOptionalFaction(
  tx: Db,
  guildId: string,
  requested: Faction | null | undefined,
): Promise<Faction | null> {
  const locked = await getGuildFaction(tx, guildId);
  if (locked) {
    if (requested && requested !== locked) throw new DomainError(`This guild is ${FACTION_LABELS[locked]} only.`);
    return locked;
  }
  return requested ?? null;
}
