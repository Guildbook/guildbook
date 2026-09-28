import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "@/db";
import { characters, guilds, memberships, ranks, users } from "@/db/schema";
import { type Action, type Actor, can, resolveTier } from "@/lib/authz/policy";
import type { RankTier } from "@/lib/authz/tiers";
import type { WowClass } from "@/lib/game";
import { guildHref } from "@/lib/paths";

export const getGuild = cache(async (slug: string) => {
  const [guild] = await db.select().from(guilds).where(eq(guilds.slug, slug));
  if (!guild) notFound();
  return guild;
});

export type Guild = Awaited<ReturnType<typeof getGuild>>;

export interface Viewer {
  actor: Actor;
  user: { id: string; name: string | null; image: string | null } | null;
  rank: { name: string; tier: RankTier; insignia: string | null } | null;
  membershipStatus: "applicant" | "active" | "former" | null;
  main: {
    id: string;
    name: string;
    surname: string;
    wowClass: WowClass;
    spec: string;
    level: number;
    verified: boolean;
  } | null;
}

/**
 * The session's user row. Falls back to the Discord ID when the user ID is gone (a demo reseed recreates
 * seeded users with new IDs); a token matching no user is treated as signed out.
 */
async function resolveUser(id: string | undefined, discordId: string | undefined) {
  const columns = { id: users.id, name: users.name, image: users.image, discordId: users.discordId };
  if (id) {
    const [byId] = await db.select(columns).from(users).where(eq(users.id, id));
    if (byId) return byId;
  }
  if (!discordId) return null;
  const [byDiscord] = await db.select(columns).from(users).where(eq(users.discordId, discordId));
  return byDiscord ?? null;
}

/** The signed-in user on this host, independent of any guild (the platform apex uses this). */
export const getSessionUser = cache(async () => {
  const session = await auth();
  return session?.user ? resolveUser(session.user.id, session.user.discordId) : null;
});

/** The current user's identity and permission tier for a guild. Tier comes from the database, never the session. */
export const getViewer = cache(async (guildId: string): Promise<Viewer> => {
  const user = await getSessionUser();
  const userId = user?.id ?? null;
  if (!user || !userId) {
    return {
      actor: { guildId, userId: null, membershipId: null, tier: "public" },
      user: null,
      rank: null,
      membershipStatus: null,
      main: null,
    };
  }
  const [row] = await db
    .select({
      id: memberships.id,
      status: memberships.status,
      rankTier: ranks.tier,
      rankName: ranks.name,
      rankInsignia: ranks.insignia,
    })
    .from(memberships)
    .innerJoin(ranks, eq(ranks.id, memberships.rankId))
    .where(and(eq(memberships.guildId, guildId), eq(memberships.userId, userId)));
  const tier = resolveTier(row ? { status: row.status, rankTier: row.rankTier } : null);
  const rank = row && row.status !== "former" ? { name: row.rankName, tier: row.rankTier, insignia: row.rankInsignia } : null;
  const [main] =
    row?.status === "active"
      ? await db
          .select({
            id: characters.id,
            name: characters.name,
            surname: characters.surname,
            wowClass: characters.wowClass,
            spec: characters.spec,
            level: characters.level,
            verified: characters.verified,
          })
          .from(characters)
          .where(and(eq(characters.membershipId, row.id), eq(characters.isMain, true), isNull(characters.archivedAt)))
      : [];
  return {
    actor: { guildId, userId, membershipId: row?.status === "active" ? row.id : null, tier },
    user: { id: userId, name: user.name, image: user.image },
    rank,
    membershipStatus: row?.status ?? null,
    main: main ?? null,
  };
});

/** Whether nav should offer "Apply": signed-out visitors and non-members without a pending application. */
export function offersApply(viewer: Viewer): boolean {
  return viewer.membershipStatus !== "active" && viewer.membershipStatus !== "applicant";
}

/** For pages: resolve guild + viewer and redirect away if the viewer may not perform `action`. */
export async function requirePage(slug: string, action: Action, returnTo: string) {
  const guild = await getGuild(slug);
  const viewer = await getViewer(guild.id);
  if (!can(viewer.actor, action)) {
    if (!viewer.user) redirect(`${guildHref(slug, "/login")}?callbackUrl=${encodeURIComponent(returnTo)}`);
    redirect(guildHref(slug, "/denied"));
  }
  return { guild, viewer, actor: viewer.actor as Actor & { userId: string } };
}
