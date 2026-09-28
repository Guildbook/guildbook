import type { Db } from "@/db/types";
import { auditLog } from "@/db/schema";
import type { Actor } from "@/lib/authz/policy";

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}

/** Call inside the same transaction as the change it records. */
export async function recordAudit(tx: Db, actor: Actor, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    guildId: actor.guildId,
    actorUserId: actor.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}
