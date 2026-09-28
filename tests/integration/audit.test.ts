import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLog, characters } from "@/db/schema";
import type { Db } from "@/db/types";
import { reviewApplication, submitApplication } from "@/server/services/applications";
import { archiveCharacter, createCharacter } from "@/server/services/characters";
import { listAuditLog } from "@/server/services/content";
import { assignRank, removeMember } from "@/server/services/ranks";
import { createGuild, createMember, createTestDb, createVisitor, reloadActor, validApplication } from "../support/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

const character = { faction: "alliance", wowClass: "paladin", spec: "Holy", role: "healer", level: "60", professions: [] };

async function logFor(actor: Parameters<typeof listAuditLog>[1]) {
  const rows = await listAuditLog(db, actor);
  return rows.map((r) => ({ action: r.entry.action, actor: r.actorName, target: r.targetName, entry: r.entry }));
}

describe("audit log names", () => {
  it("shows actors and targets by full character name and stores the full name at write time", async () => {
    const guild = await createGuild(db);
    const marshal = await createMember(db, guild, "Marshal");
    await createCharacter(db, marshal, { ...character, name: "Ironvow", surname: "Thornwall" });
    const visitor = await createVisitor(db, guild.guild.id);

    const app = await submitApplication(db, visitor, validApplication);
    await reviewApplication(db, marshal, { applicationId: app.id, decision: "accepted" });
    const member = await reloadActor(db, visitor);
    await assignRank(db, marshal, { membershipId: member.membershipId, rankId: guild.rankId("Knight") });
    await removeMember(db, marshal, member.membershipId!);

    const log = await logFor(marshal);
    expect(log.map(({ action, actor, target }) => ({ action, actor, target }))).toEqual([
      { action: "member.remove", actor: "Ironvow Thornwall", target: "Joanofarc Domremy" },
      { action: "member.assignRank", actor: "Ironvow Thornwall", target: "Joanofarc Domremy" },
      { action: "application.accept", actor: "Ironvow Thornwall", target: "Joanofarc Domremy" },
      { action: "application.submit", actor: "Joanofarc Domremy", target: "Joanofarc Domremy" },
    ]);
    for (const { entry } of log) {
      expect(JSON.stringify([entry.before, entry.after])).toContain('"characterName":"Joanofarc Domremy"');
    }
  });

  it("stores the archived character's full name", async () => {
    const guild = await createGuild(db);
    const knight = await createMember(db, guild, "Knight");
    const officer = await createMember(db, guild, "Marshal");
    const alt = await createCharacter(db, knight, { ...character, name: "Raphael", surname: "Whitecross" });
    await archiveCharacter(db, knight, alt.id);

    const [row] = await logFor(officer);
    expect(row).toMatchObject({ action: "character.archive", target: "Raphael Whitecross" });
    expect(row!.entry.before).toEqual({ characterName: "Raphael Whitecross" });
  });

  it("resolves older rows written without a surname through the target ID, else shows what was stored", async () => {
    const guild = await createGuild(db);
    const officer = await createMember(db, guild, "Marshal");
    const knight = await createMember(db, guild, "Knight");
    const brigid = await createCharacter(db, knight, { ...character, name: "Brigid", surname: "Hearthfire" });
    await db.insert(auditLog).values([
      {
        guildId: guild.guild.id,
        actorUserId: knight.userId,
        action: "legacy.orphan",
        targetType: "character",
        targetId: "00000000-0000-0000-0000-000000000000",
        after: { characterName: "Dismas" },
        createdAt: new Date(Date.now() - 2000),
      },
      {
        guildId: guild.guild.id,
        actorUserId: officer.userId,
        action: "legacy.known",
        targetType: "character",
        targetId: brigid.id,
        after: { characterName: "Brigid" },
        createdAt: new Date(Date.now() - 1000),
      },
    ]);

    const log = await logFor(officer);
    expect(log.map(({ action, actor, target }) => ({ action, actor, target }))).toEqual([
      { action: "legacy.known", actor: expect.stringMatching(/^User \d+$/), target: "Brigid Hearthfire" },
      { action: "legacy.orphan", actor: "Brigid Hearthfire", target: "Dismas" },
    ]);

    await db.update(characters).set({ surname: "Candlewood" }).where(eq(characters.id, brigid.id));
    expect((await logFor(officer))[0]!.target).toBe("Brigid Candlewood");
  });
});
