import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import { AuthorizationError } from "@/lib/authz/policy";
import { DEFAULT_TABARD, ORDER_TABARD } from "@/lib/tabard/config";
import { DomainError } from "@/server/errors";
import { createGuildWithDefaults } from "@/server/services/guilds";
import { updateGuildTabard } from "@/server/services/tabard";
import { createGuild, createMember, createTestDb, reloadActor } from "../support/db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(async () => close());

let n = 0;
const standardGuild = () => createGuildWithDefaults(db, { slug: `banner-${++n}`, name: `Banner ${n}`, preset: "standard" });
const readGuild = async (id: string) => (await db.select().from(schema.guilds).where(eq(schema.guilds.id, id)))[0]!;

const form = {
  background: "25",
  border: "14",
  borderStyle: "studded",
  emblem: "wolf",
  emblemColor: "15",
  themeBase: "parchment",
  overridePrimary: "",
  overrideTrim: "#7A1020",
  overrideHighlight: "",
};

describe("guild tabard defaults", () => {
  it("gives new guilds the default tabard on the dark tome base", async () => {
    const { guild } = await standardGuild();
    expect(guild).toMatchObject({
      tabardBackground: DEFAULT_TABARD.background,
      tabardBorder: DEFAULT_TABARD.border,
      tabardEmblem: DEFAULT_TABARD.emblem,
      themeBase: "tome",
      themeOverrides: {},
    });
  });

  it("gives the Order preset its locked crest and theme", async () => {
    const { guild } = await createGuild(db);
    expect(guild).toMatchObject({ themeBase: "order", tabardBackground: ORDER_TABARD.background, tabardEmblem: "cross-pattee", tabardEmblemColor: 14 });
  });
});

describe("saving the tabard", () => {
  it("lets an admin save the tabard, base style and overrides, and audits it", async () => {
    const g = await standardGuild();
    const admin = await createMember(db, g, "Guild Master");
    await updateGuildTabard(db, admin, form);
    const saved = await readGuild(g.guild.id);
    expect(saved).toMatchObject({
      tabardBackground: 25,
      tabardBorder: 14,
      tabardBorderStyle: "studded",
      tabardEmblem: "wolf",
      tabardEmblemColor: 15,
      themeBase: "parchment",
      themeOverrides: { trim: "#7a1020" },
    });
    const [entry] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "guild.tabard"));
    expect(entry).toMatchObject({ guildId: g.guild.id, actorUserId: admin.userId });
    expect(entry!.after).toMatchObject({ emblem: "wolf", themeBase: "parchment" });
  });

  it("clears overrides left blank", async () => {
    const g = await standardGuild();
    const admin = await createMember(db, g, "Guild Master");
    await updateGuildTabard(db, admin, form);
    await updateGuildTabard(db, admin, { ...form, overrideTrim: "" });
    expect((await readGuild(g.guild.id)).themeOverrides).toEqual({});
  });

  it("refuses officers, members and visitors", async () => {
    const g = await standardGuild();
    for (const rank of ["Officer", "Raider", "Member"]) {
      const actor = await createMember(db, g, rank);
      await expect(updateGuildTabard(db, actor, form)).rejects.toBeInstanceOf(AuthorizationError);
    }
    await expect(updateGuildTabard(db, { guildId: g.guild.id, userId: null, membershipId: null, tier: "public" }, form)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    expect((await readGuild(g.guild.id)).tabardEmblem).toBe(DEFAULT_TABARD.emblem);
  });

  it("only changes the admin's own guild", async () => {
    const mine = await standardGuild();
    const theirs = await standardGuild();
    const admin = await createMember(db, mine, "Guild Master");
    await updateGuildTabard(db, admin, form);
    expect((await readGuild(mine.guild.id)).tabardEmblem).toBe("wolf");
    expect(await readGuild(theirs.guild.id)).toMatchObject({ tabardEmblem: DEFAULT_TABARD.emblem, themeBase: "tome" });
    // An admin of another guild has no tier here: the app resolves the actor per guild from the database.
    const otherAdmin = await createMember(db, theirs, "Guild Master");
    const here = await reloadActor(db, { ...otherAdmin, guildId: mine.guild.id });
    expect(here.tier).toBe("public");
    await expect(updateGuildTabard(db, here, { ...form, emblem: "skull" })).rejects.toBeInstanceOf(AuthorizationError);
    expect((await readGuild(mine.guild.id)).tabardEmblem).toBe("wolf");
  });

  it("rejects unknown emblems, out-of-range colours and malformed overrides", async () => {
    const g = await standardGuild();
    const admin = await createMember(db, g, "Guild Master");
    await expect(updateGuildTabard(db, admin, { ...form, emblem: "rubber-duck" })).rejects.toBeInstanceOf(ZodError);
    await expect(updateGuildTabard(db, admin, { ...form, background: "51" })).rejects.toBeInstanceOf(ZodError);
    await expect(updateGuildTabard(db, admin, { ...form, borderStyle: "lace" })).rejects.toBeInstanceOf(ZodError);
    await expect(updateGuildTabard(db, admin, { ...form, overridePrimary: "red; } body { display: none" })).rejects.toBeInstanceOf(ZodError);
  });
});

describe("the Order's theme is exclusive", () => {
  it("can't be chosen by another guild through the form", async () => {
    const g = await standardGuild();
    const admin = await createMember(db, g, "Guild Master");
    await expect(updateGuildTabard(db, admin, { ...form, themeBase: "order" })).rejects.toBeInstanceOf(ZodError);
    expect((await readGuild(g.guild.id)).themeBase).toBe("tome");
  });

  it("is refused by the database for any guild without the Order preset", async () => {
    const g = await standardGuild();
    await expect(db.execute(sql`update guilds set theme_base = 'order' where id = ${g.guild.id}`)).rejects.toThrow();
    await expect(
      db.insert(schema.guilds).values({ slug: `copycat-${++n}`, name: "Copycat", preset: "standard", themeBase: "order" }),
    ).rejects.toThrow();
  });

  it("stays locked for the Order itself", async () => {
    const order = await createGuild(db);
    const admin = await createMember(db, order, "Grand Master");
    await expect(updateGuildTabard(db, admin, form)).rejects.toBeInstanceOf(DomainError);
    expect(await readGuild(order.guild.id)).toMatchObject({ themeBase: "order", tabardEmblem: "cross-pattee" });
  });

  it("still lets other guilds use crimson and gold tabard colours on a generic base", async () => {
    const g = await standardGuild();
    const admin = await createMember(db, g, "Guild Master");
    await updateGuildTabard(db, admin, { ...form, background: "2", border: "3", emblem: "cross-pattee", emblemColor: "14", themeBase: "tome", overrideTrim: "" });
    expect(await readGuild(g.guild.id)).toMatchObject({ tabardBackground: 2, tabardBorder: 3, themeBase: "tome" });
  });
});
