import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@/db/types";
import {
  addons,
  auditLog,
  bosses,
  contentPages,
  guilds,
  instances,
  memberships,
  raidScheduleSlots,
  ranks,
  recruitmentNeeds,
  users,
} from "@/db/schema";
import type { Faction, Ruleset } from "@/lib/game";
import { createGuildWithDefaults } from "@/server/services/guilds";

/**
 * The Order of Saint Michael as it exists on Guildbook: profile, charter, schedule, recruitment, raid catalog and
 * addons. Both the production bootstrap and the local demo seed build the guild from here.
 */
export const ORDER_FACTION: Faction = "alliance";
/** Not confirmed yet: Normal until the Order says otherwise. */
export const ORDER_RULESET: Ruleset = "normal";

export const ORDER_PROFILE = {
  name: "Order of Saint Michael",
  motto: "Quis ut Deus",
  description:
    "A Catholic raiding guild for World of Warcraft: Forever, open to every player who respects the faith. We raid with discipline, speak with charity, and begin every raid with the Prayer to Saint Michael.",
  timezone: "America/New_York",
  /** The Order is a WoW: Forever guild; the `guilds_order_forever` check keeps the preset there. */
  gameVersion: "forever",
  faction: ORDER_FACTION,
  ruleset: ORDER_RULESET,
  preset: "order",
  directoryListed: true,
} as const;

export const ORDER_RAIDS: { name: string; shortName: string; size: number; bosses: string[] }[] = [
  {
    name: "Molten Core", shortName: "MC", size: 40,
    bosses: ["Lucifron", "Magmadar", "Gehennas", "Garr", "Shazzrah", "Baron Geddon", "Golemagg the Incinerator", "Sulfuron Harbinger", "Majordomo Executus", "Ragnaros"],
  },
  { name: "Onyxia's Lair", shortName: "Ony", size: 40, bosses: ["Onyxia"] },
  {
    name: "Blackwing Lair", shortName: "BWL", size: 40,
    bosses: ["Razorgore the Untamed", "Vaelastrasz the Corrupt", "Broodlord Lashlayer", "Firemaw", "Ebonroc", "Flamegor", "Chromaggus", "Nefarian"],
  },
  {
    name: "Zul'Gurub", shortName: "ZG", size: 20,
    bosses: ["High Priestess Jeklik", "High Priest Venoxis", "High Priestess Mar'li", "High Priest Thekal", "High Priestess Arlokk", "Jin'do the Hexxer", "Hakkar"],
  },
  {
    name: "Ruins of Ahn'Qiraj", shortName: "AQ20", size: 20,
    bosses: ["Kurinnaxx", "General Rajaxx", "Moam", "Buru the Gorger", "Ayamiss the Hunter", "Ossirian the Unscarred"],
  },
  {
    name: "Temple of Ahn'Qiraj", shortName: "AQ40", size: 40,
    bosses: ["The Prophet Skeram", "Silithid Royalty", "Battleguard Sartura", "Fankriss the Unyielding", "Viscidus", "Princess Huhuran", "Twin Emperors", "Ouro", "C'Thun"],
  },
  {
    name: "Naxxramas", shortName: "Naxx", size: 40,
    bosses: ["Anub'Rekhan", "Grand Widow Faerlina", "Maexxna", "Noth the Plaguebringer", "Heigan the Unclean", "Loatheb", "Instructor Razuvious", "Gothik the Harvester", "The Four Horsemen", "Patchwerk", "Grobbulus", "Gluth", "Thaddius", "Sapphiron", "Kel'Thuzad"],
  },
];

export const CHARTER_CONTENT: Record<string, string> = {
  charter: `> We are Catholics who play. We come to Azeroth as pilgrims from a far country, to raid with discipline and to carry charity into a digital land. [Read the Lore of the Order](lore) to see how we understand the world we play in.

The **Order of Saint Michael** is a Catholic guild. Every player who respects the faith is welcome, whether or not they share it.

### The Rule

1. **Charity first.** Treat every guildmate, pug and rival as you would treat Christ. No harassment, no slurs, no drama in public channels.
2. **Honour your word.** If you sign up for a raid, come prepared and on time. If plans change, update your signup before the deadline.
3. **Come prepared.** Bring consumables, repair, know the fights and have your addons updated.
4. **Respect the faith.** Mockery of the Catholic faith, or of any sincere believer, has no place here.
5. **Follow the chain of command.** Marshals lead raids. Take disagreements to an officer in private.

### Ranks

The Order is led by the Grand Master and the Seneschal. Marshals lead our raids, Commanders lead classes and roles, and the Chaplain leads our prayer life. Knights and Sergeants form the raiding core. Squires and Novices are members still growing into their place.`,
  "clean-chat": `We keep guild chat, Discord and voice clean, so that anyone, including children who may be in the room, can listen in.

- No profanity, crude humour or innuendo.
- No taking the Lord's name in vain.
- No politics in guild channels. Keep it in DMs.
- When you disagree, do it kindly. Give feedback on what went wrong in the fight, never attack the player.

A first slip gets a gentle reminder. Repeated slips are handled by an officer in private.`,
  "loot-policy": `Loot serves the Order's progression first.

- **Loot council** decides contested items for core raiders, weighing attendance, preparation and benefit to the raid.
- **Soft reserve** may be used for farm content, announced at the start of the raid.
- **Off-spec** rolls happen only after main-spec interest is settled.
- Items no one needs are **disenchanted** for the guild bank.

Every award is recorded in the loot ledger. Mistakes are corrected with a new entry. Nothing is ever erased.`,
  prayer: `> Saint Michael the Archangel, defend us in battle. Be our protection against the wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, O Prince of the heavenly host, by the power of God, cast into hell Satan and all the evil spirits who prowl about the world seeking the ruin of souls. Amen.

*Pope Leo XIII, 1886*

---

> *Sancte Michael Archangele, defende nos in proelio; contra nequitiam et insidias diaboli esto praesidium. Imperet illi Deus, supplices deprecamur: tuque, Princeps militiae caelestis, Satanam aliosque spiritus malignos, qui ad perditionem animarum pervagantur in mundo, divina virtute in infernum detrude. Amen.*

We pray this together in voice at the start of every raid, and again before the final boss or a first-kill attempt. Anyone may pray privately at any time, and after a first kill we pause for a short thanksgiving.`,
};

const ORDER_SCHEDULE = [
  { dayOfWeek: 2, startTime: "20:00", endTime: "23:00", label: "Main raid" },
  { dayOfWeek: 4, startTime: "20:00", endTime: "23:00", label: "Main raid" },
  { dayOfWeek: 0, startTime: "19:00", endTime: "22:00", label: "Alt raid" },
];

const ORDER_RECRUITMENT: Omit<typeof recruitmentNeeds.$inferInsert, "guildId">[] = [
  { wowClass: "warrior", role: "tank", priority: "high", note: "Main tank candidate" },
  { wowClass: "priest", role: "healer", priority: "high" },
  { wowClass: "shaman", role: "healer", priority: "medium" },
  { wowClass: "mage", role: "ranged", priority: "low" },
  { wowClass: "druid", role: "healer", priority: "medium" },
];

const ORDER_ADDONS: Omit<typeof addons.$inferInsert, "guildId">[] = [
  {
    slug: "order-assist",
    name: "Order Assist",
    summary: "Raid assignments, consumable checks and ready-check reminders pushed from the raid leader.",
    descriptionMd: "- Marshals publish tank and healer assignments per boss\n- Checks flasks, elixirs and world buffs on pull\n- Syncs with signups on this site (coming soon)",
    status: "in_development",
    sortOrder: 1,
  },
  {
    slug: "vigil",
    name: "Vigil",
    summary: "Personal performance review after every pull: rotation, uptimes, cooldowns and threat, from your combat log.",
    status: "beta",
    sortOrder: 2,
  },
  {
    slug: "compline",
    name: "Compline",
    summary: "Feast-day and prayer-time reminders, plus the Prayer to Saint Michael in a popup when the raid begins.",
    status: "beta",
    version: "0.3.0",
    sortOrder: 3,
  },
];

/** Creates the Order with its guild content and no people: no members, characters, applications, kills or loot. */
export async function createOrderGuild(db: Db, slug = "osm") {
  return db.transaction(async (tx) => {
    const { guild, rankId } = await createGuildWithDefaults(tx, { slug, ...ORDER_PROFILE });

    for (const [pageSlug, bodyMd] of Object.entries(CHARTER_CONTENT)) {
      await tx
        .update(contentPages)
        .set({ bodyMd })
        .where(and(eq(contentPages.guildId, guild.id), eq(contentPages.slug, pageSlug)));
    }

    await tx.insert(raidScheduleSlots).values(ORDER_SCHEDULE.map((s) => ({ ...s, guildId: guild.id, faction: ORDER_FACTION })));
    await tx.insert(recruitmentNeeds).values(ORDER_RECRUITMENT.map((r) => ({ ...r, guildId: guild.id })));

    const bossIds = new Map<string, string>();
    const bossInstance = new Map<string, { id: string; name: string }>();
    for (const [i, raid] of ORDER_RAIDS.entries()) {
      const [instance] = await tx
        .insert(instances)
        .values({ guildId: guild.id, name: raid.name, shortName: raid.shortName, size: raid.size, sortOrder: i + 1 })
        .returning();
      const rows = await tx
        .insert(bosses)
        .values(raid.bosses.map((name, j) => ({ guildId: guild.id, instanceId: instance!.id, name, sortOrder: j + 1 })))
        .returning();
      for (const b of rows) {
        bossIds.set(b.name, b.id);
        bossInstance.set(b.name, { id: instance!.id, name: instance!.name });
      }
    }

    await tx.insert(addons).values(ORDER_ADDONS.map((a) => ({ ...a, guildId: guild.id })));

    return { guild, rankId, bossIds, bossInstance };
  });
}

/** Production bootstrap: creates the Order if no guild has the slug yet. Safe to run again; never touches an existing guild. */
export async function bootstrapOrderGuild(db: Db, slug = "osm") {
  const [existing] = await db.select().from(guilds).where(eq(guilds.slug, slug));
  if (existing) return { guild: existing, created: false };
  const { guild } = await createOrderGuild(db, slug);
  return { guild, created: true };
}

/**
 * Makes a signed-in user the guild's leader: an active membership at the top admin rank, recorded in the audit log.
 * `discord` is a Discord user ID or username; the user must have signed in once so the row exists.
 */
export async function grantGuildOwner(db: Db, input: { guildSlug: string; discord: string }) {
  const discord = input.discord.trim().replace(/^@/, "");
  if (!discord) throw new Error("Pass a Discord user ID or username");
  return db.transaction(async (tx) => {
    const [guild] = await tx.select().from(guilds).where(eq(guilds.slug, input.guildSlug));
    if (!guild) throw new Error(`No guild with slug "${input.guildSlug}"`);

    const matches = await tx
      .select()
      .from(users)
      .where(or(eq(users.discordId, discord), ilike(users.discordUsername, discord.replace(/[\\%_]/g, "\\$&"))));
    const byId = matches.filter((u) => u.discordId === discord);
    const candidates = byId.length ? byId : matches;
    if (candidates.length === 0) {
      throw new Error(`No user with Discord ID or username "${discord}". Sign in with Discord once, then run this again.`);
    }
    if (candidates.length > 1) throw new Error(`Several users match "${discord}"; pass the Discord user ID instead.`);
    const user = candidates[0]!;

    const [top] = await tx
      .select()
      .from(ranks)
      .where(and(eq(ranks.guildId, guild.id), eq(ranks.tier, "admin")))
      .orderBy(asc(ranks.sortOrder))
      .limit(1);
    if (!top) throw new Error(`Guild "${guild.slug}" has no admin rank`);

    const [current] = await tx
      .select({ id: memberships.id, rankId: memberships.rankId, status: memberships.status, rankName: ranks.name })
      .from(memberships)
      .innerJoin(ranks, eq(ranks.id, memberships.rankId))
      .where(and(eq(memberships.guildId, guild.id), eq(memberships.userId, user.id)));
    if (current?.rankId === top.id && current.status === "active") {
      return { guild, user, rank: top, membershipId: current.id, changed: false };
    }

    const now = new Date();
    const [membership] = current
      ? await tx
          .update(memberships)
          .set({
            rankId: top.id,
            status: "active",
            ...(current.status === "active" ? {} : { joinedAt: now, leftAt: null }),
            updatedAt: now,
          })
          .where(eq(memberships.id, current.id))
          .returning()
      : await tx
          .insert(memberships)
          .values({ guildId: guild.id, userId: user.id, rankId: top.id, status: "active", joinedAt: now })
          .returning();

    await tx.insert(auditLog).values({
      guildId: guild.id,
      actorUserId: null,
      action: "member.grantOwner",
      targetType: "membership",
      targetId: membership!.id,
      before: current ? { rankId: current.rankId, rankName: current.rankName, status: current.status } : null,
      after: { rankId: top.id, rankName: top.name, status: "active", userId: user.id, discordId: user.discordId },
    });

    return { guild, user, rank: top, membershipId: membership!.id, changed: true };
  });
}
