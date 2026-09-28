import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { memberships } from "@/db/schema";
import type { Db } from "@/db/types";
import type { Actor } from "@/lib/authz/policy";
import { archiveCharacter, createCharacter, getPublicCharacter, getRoster } from "@/server/services/characters";
import { createGuild, createMember, createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

const paladin = {
  name: "Tor",
  surname: "Whitecross",
  faction: "alliance",
  wowClass: "paladin",
  spec: "Holy",
  role: "healer",
  level: "60",
  isMain: "on",
  professions: [
    { profession: "mining", skill: 300 },
    { profession: "blacksmithing", skill: 275 },
  ],
};
const mage = { ...paladin, name: "Raphael", wowClass: "mage", spec: "Frost", role: "ranged", level: "42", isMain: "", professions: [] };

async function registerMain(db: Db, actor: Actor) {
  const main = await createCharacter(db, actor, paladin);
  const alt = await createCharacter(db, actor, mage);
  return { main: main!, alt: alt! };
}

describe("getPublicCharacter", () => {
  it("returns the character sheet with rank, join date, professions and linked alts", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    const gm = await createMember(db, guild, "Grand Master");
    const joinedAt = new Date("2026-11-04T12:00:00Z");
    await db.update(memberships).set({ joinedAt }).where(eq(memberships.id, gm.membershipId!));
    const { main, alt } = await registerMain(db, gm);

    const sheet = await getPublicCharacter(db, guild.guild.id, main.id);
    expect(sheet).toMatchObject({
      id: main.id,
      name: "Tor",
      surname: "Whitecross",
      wowClass: "paladin",
      spec: "Holy",
      level: 60,
      isMain: true,
      rankName: "Grand Master",
      rankTier: "admin",
      joinedAt,
      professions: [
        { profession: "mining", skill: 300 },
        { profession: "blacksmithing", skill: 275 },
      ],
      otherCharacters: [{ id: alt.id, name: "Raphael", isMain: false, level: 42 }],
    });

    const altSheet = await getPublicCharacter(db, guild.guild.id, alt.id);
    expect(altSheet?.isMain).toBe(false);
    expect(altSheet?.otherCharacters).toEqual([expect.objectContaining({ id: main.id, isMain: true })]);
  });

  it("exposes nothing about the owning user", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    const knight = await createMember(db, guild, "Knight");
    const { main } = await registerMain(db, knight);
    const sheet = await getPublicCharacter(db, guild.guild.id, main.id);
    const keys = Object.keys(sheet!);
    for (const privateKey of ["membershipId", "userId", "discordId", "discordUsername", "userName"]) {
      expect(keys).not.toContain(privateKey);
    }
  });

  it("does not return another guild's character", async () => {
    const home = await createGuild(db, { faction: "alliance" });
    const other = await createGuild(db, { faction: "alliance" });
    const knight = await createMember(db, other, "Knight");
    const { main } = await registerMain(db, knight);
    expect(await getPublicCharacter(db, home.guild.id, main.id)).toBeNull();
    expect(await getPublicCharacter(db, other.guild.id, main.id)).not.toBeNull();
  });

  it("returns nothing for an archived character and hides it from its siblings", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    const knight = await createMember(db, guild, "Knight");
    const { main, alt } = await registerMain(db, knight);
    await archiveCharacter(db, knight, alt.id);
    expect(await getPublicCharacter(db, guild.guild.id, alt.id)).toBeNull();
    expect((await getPublicCharacter(db, guild.guild.id, main.id))?.otherCharacters).toEqual([]);
  });

  it("returns nothing when the owner is no longer an active member", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    const knight = await createMember(db, guild, "Knight");
    const { main } = await registerMain(db, knight);
    await db.update(memberships).set({ status: "former" }).where(eq(memberships.id, knight.membershipId!));
    expect(await getPublicCharacter(db, guild.guild.id, main.id)).toBeNull();
  });

  it("returns nothing for unknown or malformed ids", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    expect(await getPublicCharacter(db, guild.guild.id, crypto.randomUUID())).toBeNull();
    expect(await getPublicCharacter(db, guild.guild.id, "tor-whitecross")).toBeNull();
  });
});

describe("getRoster", () => {
  it("lists mains with their unarchived alts", async () => {
    const guild = await createGuild(db, { faction: "alliance" });
    const gm = await createMember(db, guild, "Grand Master");
    const { main, alt } = await registerMain(db, gm);
    const roster = await getRoster(db, guild.guild.id);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ id: main.id, alts: [{ id: alt.id, name: "Raphael", surname: "Whitecross" }] });
  });
});
