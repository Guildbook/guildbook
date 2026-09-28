import { type Actor, can } from "@/lib/authz/policy";

/** Members always see the loot ledger; visitors only when the guild has made it public. */
export function canViewLoot(actor: Actor, guild: { lootPublic: boolean }): boolean {
  return guild.lootPublic || can(actor, "loot.view");
}
