import type { Db } from "@/db/types";
import {
  applications,
  bossKills,
  characterProfessions,
  characters,
  lootEntries,
  memberships,
  users,
  wowItems,
} from "@/db/schema";
import type { Profession, RaidRole, WowClass } from "@/lib/game";
import { createOrderGuild, ORDER_FACTION } from "@/db/order";

export { CHARTER_CONTENT } from "@/db/order";

const FACTION = ORDER_FACTION;

type SeedMember = {
  name: string;
  surname: string;
  wowClass: WowClass;
  spec: string;
  role: RaidRole;
  rank: string;
  level?: number;
  professions?: [Profession, number][];
  alts?: { name: string; surname: string; wowClass: WowClass; spec: string; role: RaidRole; level: number }[];
};

export const SEED_MEMBERS: SeedMember[] = [
  {
    name: "Tor", surname: "Whitecross", wowClass: "paladin", spec: "Holy", role: "healer", rank: "Grand Master",
    professions: [["mining", 300], ["blacksmithing", 300]],
    alts: [{ name: "Raphael", surname: "Whitecross", wowClass: "mage", spec: "Frost", role: "ranged", level: 42 }],
  },
  { name: "Gabrielle", surname: "Vesperlight", wowClass: "priest", spec: "Holy", role: "healer", rank: "Seneschal", professions: [["tailoring", 300], ["enchanting", 300]] },
  { name: "Ironvow", surname: "Thornwall", wowClass: "warrior", spec: "Protection", role: "tank", rank: "Marshal", professions: [["mining", 300], ["engineering", 300]] },
  { name: "Aldric", surname: "Ashford", wowClass: "warrior", spec: "Fury", role: "melee", rank: "Commander", professions: [["mining", 285], ["blacksmithing", 290]] },
  { name: "Benedicta", surname: "Rosemont", wowClass: "druid", spec: "Restoration", role: "healer", rank: "Chaplain", professions: [["herbalism", 300], ["alchemy", 300]] },
  { name: "Thomasin", surname: "Frostvale", wowClass: "mage", spec: "Frost", role: "ranged", rank: "Commander", professions: [["tailoring", 300], ["enchanting", 275]] },
  {
    name: "Cassian", surname: "Blackmere", wowClass: "rogue", spec: "Combat", role: "melee", rank: "Knight",
    professions: [["skinning", 300], ["leatherworking", 300]],
    alts: [{ name: "Anselm", surname: "Blackmere", wowClass: "priest", spec: "Shadow", role: "ranged", level: 60 }],
  },
  { name: "Seraphine", surname: "Candlewood", wowClass: "priest", spec: "Discipline", role: "healer", rank: "Knight", professions: [["herbalism", 300], ["alchemy", 300]] },
  { name: "Leontius", surname: "Hawkridge", wowClass: "hunter", spec: "Marksmanship", role: "ranged", rank: "Knight", professions: [["skinning", 300], ["leatherworking", 300]] },
  { name: "Ambrose", surname: "Duskmantle", wowClass: "warlock", spec: "Destruction", role: "ranged", rank: "Knight", professions: [["tailoring", 300], ["enchanting", 300]] },
  { name: "Cecilia", surname: "Emberlyn", wowClass: "mage", spec: "Fire", role: "ranged", rank: "Knight", professions: [["tailoring", 290], ["alchemy", 250]] },
  { name: "Godfrey", surname: "Shieldmere", wowClass: "paladin", spec: "Protection", role: "tank", rank: "Knight", professions: [["mining", 300], ["engineering", 280]] },
  { name: "Isidore", surname: "Nightbrook", wowClass: "rogue", spec: "Subtlety", role: "melee", rank: "Sergeant", professions: [["engineering", 300], ["mining", 300]] },
  { name: "Lucian", surname: "Greywood", wowClass: "hunter", spec: "Survival", role: "ranged", rank: "Sergeant", professions: [["herbalism", 250], ["skinning", 250]] },
  { name: "Monica", surname: "Hollowell", wowClass: "warlock", spec: "Affliction", role: "ranged", rank: "Sergeant", professions: [["tailoring", 240], ["enchanting", 225]] },
  { name: "Perpetua", surname: "Oakenfield", wowClass: "druid", spec: "Feral", role: "tank", rank: "Squire", level: 38, professions: [["herbalism", 150], ["skinning", 140]] },
  { name: "Bartholomew", surname: "Stoutheart", wowClass: "warrior", spec: "Arms", role: "melee", rank: "Novice", level: 57, professions: [["mining", 230], ["blacksmithing", 225]] },
  { name: "Longinus", surname: "Spearwright", wowClass: "shaman", spec: "Restoration", role: "healer", rank: "Marshal", professions: [["herbalism", 300], ["alchemy", 300]] },
  { name: "Hildegard", surname: "Clearbrook", wowClass: "shaman", spec: "Elemental", role: "ranged", rank: "Commander", professions: [["mining", 300], ["engineering", 300]] },
  { name: "Dismas", surname: "Redmarsh", wowClass: "rogue", spec: "Assassination", role: "melee", rank: "Knight", professions: [["skinning", 300], ["leatherworking", 300]] },
  { name: "Athanasius", surname: "Highcrest", wowClass: "warrior", spec: "Protection", role: "tank", rank: "Knight", professions: [["mining", 300], ["blacksmithing", 300]] },
  { name: "Sebastian", surname: "Arrowood", wowClass: "hunter", spec: "Beast Mastery", role: "ranged", rank: "Sergeant", professions: [["skinning", 280], ["leatherworking", 275]] },
  { name: "Agnes", surname: "Lambsbury", wowClass: "warlock", spec: "Demonology", role: "ranged", rank: "Sergeant", professions: [["tailoring", 300], ["enchanting", 290]] },
  { name: "Jerome", surname: "Quillfeather", wowClass: "priest", spec: "Shadow", role: "ranged", rank: "Squire", level: 44, professions: [["herbalism", 190], ["alchemy", 180]] },
  { name: "Brigid", surname: "Hearthfire", wowClass: "paladin", spec: "Retribution", role: "melee", rank: "Novice", level: 60, professions: [["mining", 260], ["engineering", 240]] },
];

/** A raid-night time in the guild's time zone. Every seeded night falls between DST ending (Nov 1, 2026) and resuming (Mar 14, 2027), so Eastern is UTC-5. */
const est = (date: string, time: string) => new Date(`${date}T${time}:00-05:00`);

/**
 * First kills on the Tuesday and Thursday raid nights. WoW: Forever launches Nov 4, 2026, and the core
 * needs about five weeks to level to 60 and get attuned, so the first raid night is Dec 8. No raids in Christmas week.
 */
export const SEED_KILLS: { boss: string; killedAt: Date }[] = [
  { boss: "Onyxia", killedAt: est("2026-12-08", "20:40") },
  { boss: "Lucifron", killedAt: est("2026-12-08", "21:25") },
  { boss: "Magmadar", killedAt: est("2026-12-08", "22:15") },
  { boss: "Gehennas", killedAt: est("2026-12-10", "21:05") },
  { boss: "Garr", killedAt: est("2026-12-10", "22:20") },
  { boss: "Shazzrah", killedAt: est("2026-12-15", "21:10") },
  { boss: "Baron Geddon", killedAt: est("2026-12-17", "22:30") },
  { boss: "Golemagg the Incinerator", killedAt: est("2026-12-29", "21:50") },
  { boss: "Sulfuron Harbinger", killedAt: est("2027-01-07", "22:05") },
  { boss: "Majordomo Executus", killedAt: est("2027-01-14", "22:40") },
  { boss: "Ragnaros", killedAt: est("2027-01-26", "22:50") },
];

const DAY = 24 * 60 * 60 * 1000;

/** Item names and qualities as a Gargul or RCLootCouncil import would supply them. No icons: those come from Blizzard's API. */
export const SEED_ITEMS: { itemId: number; name: string; quality: number }[] = [
  { itemId: 16921, name: "Halo of Transcendence", quality: 4 },
  { itemId: 17064, name: "Shard of the Scale", quality: 4 },
  { itemId: 18423, name: "Head of Onyxia", quality: 4 },
  { itemId: 16805, name: "Felheart Gloves", quality: 4 },
  { itemId: 17109, name: "Choker of Enlightenment", quality: 4 },
  { itemId: 18203, name: "Eskhandar's Right Claw", quality: 4 },
  { itemId: 17073, name: "Earthshaker", quality: 4 },
  { itemId: 16867, name: "Legplates of Might", quality: 4 },
  { itemId: 16796, name: "Arcanist Leggings", quality: 4 },
  { itemId: 18264, name: "Plans: Elemental Sharpening Stone", quality: 3 },
  { itemId: 16863, name: "Gauntlets of Might", quality: 4 },
  { itemId: 16860, name: "Lawbringer Gauntlets", quality: 4 },
  { itemId: 18564, name: "Bindings of the Windseeker", quality: 5 },
  { itemId: 17105, name: "Aurastone Hammer", quality: 4 },
  { itemId: 16842, name: "Earthfury Helmet", quality: 4 },
  { itemId: 18822, name: "Obsidian Edged Blade", quality: 4 },
];

type SeedResponse = (typeof lootEntries.$inferInsert)["response"];

/** The first two raid nights' loot, matching SEED_KILLS. One award is reversed and given to the right player. */
const SEED_LOOT: { itemId: number; to: string | null; boss: string; at: Date; response: SeedResponse; note?: string }[] = [
  { itemId: 16921, to: "Gabrielle", boss: "Onyxia", at: est("2026-12-08", "20:44"), response: "main_spec" },
  { itemId: 17064, to: "Benedicta", boss: "Onyxia", at: est("2026-12-08", "20:45"), response: "council" },
  { itemId: 18423, to: "Tor", boss: "Onyxia", at: est("2026-12-08", "20:46"), response: "council", note: "Turned in for the Order" },
  { itemId: 16805, to: "Ambrose", boss: "Lucifron", at: est("2026-12-08", "21:28"), response: "main_spec" },
  { itemId: 17109, to: "Seraphine", boss: "Lucifron", at: est("2026-12-08", "21:29"), response: "main_spec" },
  { itemId: 18203, to: "Cassian", boss: "Magmadar", at: est("2026-12-08", "22:18"), response: "council", note: "Best in slot for the core rogue" },
  { itemId: 17073, to: "Athanasius", boss: "Magmadar", at: est("2026-12-08", "22:19"), response: "off_spec" },
  { itemId: 16867, to: "Ironvow", boss: "Magmadar", at: est("2026-12-08", "22:20"), response: "main_spec" },
  { itemId: 16796, to: "Thomasin", boss: "Magmadar", at: est("2026-12-08", "22:21"), response: "main_spec" },
  { itemId: 18264, to: null, boss: "Magmadar", at: est("2026-12-08", "22:22"), response: "bank" },
  { itemId: 16863, to: "Aldric", boss: "Gehennas", at: est("2026-12-10", "21:08"), response: "main_spec" },
  { itemId: 16860, to: "Godfrey", boss: "Gehennas", at: est("2026-12-10", "21:09"), response: "main_spec" },
  { itemId: 16860, to: "Tor", boss: "Gehennas", at: est("2026-12-10", "21:14"), response: "main_spec", note: "Holy set; re-awarded" },
  { itemId: 18564, to: "Athanasius", boss: "Garr", at: est("2026-12-10", "22:23"), response: "council", note: "First binding" },
  { itemId: 17105, to: "Longinus", boss: "Garr", at: est("2026-12-10", "22:24"), response: "main_spec" },
  { itemId: 16842, to: "Hildegard", boss: "Garr", at: est("2026-12-10", "22:25"), response: "main_spec" },
  { itemId: 18822, to: "Aldric", boss: "Garr", at: est("2026-12-10", "22:26"), response: "off_spec" },
];

async function seedLoot(
  db: Db,
  guildId: string,
  ctx: {
    characterIds: Map<string, string>;
    recordedBy: string | null;
    bossIds: Map<string, string>;
    bossInstance: Map<string, { id: string; name: string }>;
  },
) {
  await db
    .insert(wowItems)
    .values(SEED_ITEMS.map((i) => ({ ...i, gameVersion: "forever" as const, nameSource: "import" as const, detailsSource: "import" as const })))
    .onConflictDoNothing();
  const names = new Map(SEED_ITEMS.map((i) => [i.itemId, i.name]));
  const member = new Map(SEED_MEMBERS.map((m) => [m.name, m]));
  const rows = await db
    .insert(lootEntries)
    .values(
      SEED_LOOT.map((l) => {
        const m = l.to ? member.get(l.to) : undefined;
        const instance = ctx.bossInstance.get(l.boss)!;
        return {
          guildId,
          kind: "award" as const,
          itemId: l.itemId,
          itemName: names.get(l.itemId)!,
          characterId: l.to ? ctx.characterIds.get(l.to)! : null,
          recipientName: m ? `${m.name} ${m.surname}` : null,
          response: l.response,
          instanceId: instance.id,
          instanceName: instance.name,
          bossId: ctx.bossIds.get(l.boss)!,
          bossName: l.boss,
          awardedAt: l.at,
          raidDate: l.at.toLocaleDateString("en-CA", { timeZone: "America/New_York" }),
          source: "manual" as const,
          note: l.note ?? null,
          recordedByUserId: ctx.recordedBy,
        };
      }),
    )
    .returning();
  const wrong = rows.find((r) => r.itemId === 16860 && r.recipientName === "Godfrey Shieldmere")!;
  await db.insert(lootEntries).values({
    ...wrong,
    id: undefined,
    createdAt: undefined,
    kind: "reversal",
    reversesEntryId: wrong.id,
    awardedAt: est("2026-12-10", "21:13"),
    note: "Clicked the wrong paladin; the gauntlets went to Tor",
  });
}

/** Seeds the demo guild. Seeded users sign in via test-login with Discord IDs `seed-<name>` (lowercase). */
export async function seedDemoGuild(db: Db, slug = "osm") {
  const { guild, rankId, bossIds, bossInstance } = await createOrderGuild(db, slug);

  const now = Date.now();
  const characterIds = new Map<string, string>();
  const userIds = new Map<string, string>();
  for (const [i, m] of SEED_MEMBERS.entries()) {
    const discordId = `seed-${m.name.toLowerCase()}`;
    const [user] = await db
      .insert(users)
      .values({ name: m.name, discordId, discordUsername: m.name.toLowerCase() })
      .onConflictDoUpdate({ target: users.discordId, set: { name: m.name } })
      .returning();
    const [membership] = await db
      .insert(memberships)
      .values({
        guildId: guild.id,
        userId: user!.id,
        rankId: rankId(m.rank),
        status: "active",
        joinedAt: new Date(now - (200 - i * 5) * DAY),
      })
      .returning();
    const [main] = await db
      .insert(characters)
      .values({
        guildId: guild.id,
        membershipId: membership!.id,
        name: m.name,
        surname: m.surname,
        faction: FACTION,
        wowClass: m.wowClass,
        spec: m.spec,
        role: m.role,
        level: m.level ?? 60,
        isMain: true,
      })
      .returning();
    characterIds.set(m.name, main!.id);
    userIds.set(m.name, user!.id);
    if (m.professions?.length) {
      await db.insert(characterProfessions).values(
        m.professions.map(([profession, skill]) => ({ guildId: guild.id, characterId: main!.id, profession, skill })),
      );
    }
    for (const alt of m.alts ?? []) {
      await db.insert(characters).values({ guildId: guild.id, membershipId: membership!.id, ...alt, faction: FACTION, isMain: false });
    }
  }

  // Applicants
  const applicants = [
    { name: "Joanofarc", surname: "Domremy", wowClass: "warrior", spec: "Protection", role: "tank", status: "pending" },
    { name: "Francis", surname: "Greyfriar", wowClass: "hunter", spec: "Marksmanship", role: "ranged", status: "pending" },
    { name: "Mordred", surname: "Blackthorn", wowClass: "warlock", spec: "Affliction", role: "ranged", status: "declined" },
  ] as const;
  for (const a of applicants) {
    const [user] = await db
      .insert(users)
      .values({ name: a.name, discordId: `seed-${a.name.toLowerCase()}`, discordUsername: a.name.toLowerCase() })
      .onConflictDoUpdate({ target: users.discordId, set: { name: a.name } })
      .returning();
    await db.insert(memberships).values({
      guildId: guild.id,
      userId: user!.id,
      rankId: rankId("Postulant"),
      status: a.status === "pending" ? "applicant" : "former",
    });
    await db.insert(applications).values({
      guildId: guild.id,
      userId: user!.id,
      characterName: a.name,
      characterSurname: a.surname,
      faction: FACTION,
      wowClass: a.wowClass,
      spec: a.spec,
      role: a.role,
      level: 60,
      raidExperience: "Cleared MC, BWL and AQ40 in Classic Era as a main-spec raider.",
      availability: "Tuesday and Thursday evenings, 8–11 PM Eastern. Sundays most weeks.",
      whyThisGuild: "I want a guild where I can raid seriously without the toxicity, and where faith is respected.",
      discordHandle: a.name.toLowerCase(),
      respectsFaith: true,
      status: a.status,
      reviewedAt: a.status === "declined" ? new Date(now - 3 * DAY) : null,
    });
  }

  await db.insert(bossKills).values(
    SEED_KILLS.map(({ boss, killedAt }) => ({
      guildId: guild.id,
      bossId: bossIds.get(boss)!,
      faction: FACTION,
      killedAt,
    })),
  );

  await seedLoot(db, guild.id, { characterIds, recordedBy: userIds.get("Gabrielle") ?? null, bossIds, bossInstance });

  return guild;
}
