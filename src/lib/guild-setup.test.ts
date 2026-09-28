import { describe, expect, it } from "vitest";
import { RANK_TIERS } from "@/lib/authz/tiers";
import { MAX_IN_GAME_RANKS } from "@/lib/game";
import { computeSetup, guildRobots, type SetupFacts, setupUrl } from "@/lib/guild-setup";
import { guildSubdomainOrigin, hostConfigFromEnv } from "@/lib/hosts";
import { RANK_PRESET_KEYS, RANK_PRESETS } from "@/lib/rank-presets";

const fresh: SetupFacts = {
  order: false,
  published: false,
  lookSaved: false,
  ranksEdited: false,
  ranksMatchOrder: false,
  contentMatchesOrder: false,
  charterEdited: false,
  loreEdited: false,
  recruitingSet: false,
  activeMembers: 1,
  pendingApplications: 0,
  discordInvite: false,
  verified: false,
  vigilUsed: false,
};

const status = (s: ReturnType<typeof computeSetup>, key: string) => s.steps.find((x) => x.key === key)?.status;

describe("computeSetup", () => {
  it("starts a new guild with everything to do and publishing blocked on the three minimum steps", () => {
    const s = computeSetup(fresh, {});
    expect(s.done).toBe(0);
    expect(s.steps.every((x) => x.status === "todo")).toBe(true);
    expect(s.canPublish).toBe(false);
    expect(s.publishMissing).toHaveLength(3);
    expect(s.steps.filter((x) => x.requiredToPublish).map((x) => x.key)).toEqual(["look", "ranks", "charter"]);
    expect(s.offerNeutralDefaults).toBe(false);
  });

  it("computes each step from the guild's data", () => {
    const s = computeSetup(
      { ...fresh, lookSaved: true, ranksEdited: true, charterEdited: true, loreEdited: true, recruitingSet: true, discordInvite: true, verified: true, vigilUsed: true },
      {},
    );
    expect(s.steps.filter((x) => x.status === "done").map((x) => x.key)).toEqual([
      "look", "ranks", "charter", "lore", "recruiting", "invite", "verify", "vigil",
    ]);
    expect(s.canPublish).toBe(true);
    expect(s.publishMissing).toEqual([]);
    expect(computeSetup({ ...fresh, published: true }, {}).steps.at(-1)!.status).toBe("done");
  });

  it("counts a confirmed ladder as reviewed, but never the Order's ladder", () => {
    expect(status(computeSetup(fresh, { ranksConfirmedAt: "2026-09-28T00:00:00Z" }), "ranks")).toBe("done");
    const leaked = computeSetup({ ...fresh, ranksEdited: true, ranksMatchOrder: true }, { ranksConfirmedAt: "2026-09-28T00:00:00Z" });
    expect(status(leaked, "ranks")).toBe("todo");
    expect(leaked.offerNeutralDefaults).toBe(true);
  });

  it("doesn't count the charter while the Order's pages are still there", () => {
    expect(status(computeSetup({ ...fresh, charterEdited: true, contentMatchesOrder: true }, {}), "charter")).toBe("todo");
  });

  it("marks skipped steps without letting a skip satisfy publishing", () => {
    const s = computeSetup(fresh, { skipped: ["lore", "look", "publish"] });
    expect(status(s, "lore")).toBe("skipped");
    expect(status(s, "look")).toBe("skipped");
    expect(status(s, "publish")).toBe("todo");
    expect(s.canPublish).toBe(false);
    expect(s.publishMissing[0]).toMatch(/tabard/);
  });

  it("counts members, applications or a Discord invite as inviting", () => {
    expect(status(computeSetup({ ...fresh, activeMembers: 2 }, {}), "invite")).toBe("done");
    expect(status(computeSetup({ ...fresh, pendingApplications: 1 }, {}), "invite")).toBe("done");
    expect(status(computeSetup({ ...fresh, discordInvite: true }, {}), "invite")).toBe("done");
  });

  it("treats the Order as set up and never offers it neutral defaults", () => {
    const s = computeSetup({ ...fresh, order: true, published: true, ranksMatchOrder: true, contentMatchesOrder: true }, {});
    expect(s.offerNeutralDefaults).toBe(false);
    for (const key of ["look", "ranks", "charter", "lore", "publish"]) expect(status(s, key)).toBe("done");
  });

  it("reports dismissal and completion", () => {
    expect(computeSetup(fresh, { dismissedAt: "2026-09-28T00:00:00Z" }).dismissed).toBe(true);
    const all = computeSetup(
      { ...fresh, published: true, lookSaved: true, ranksEdited: true, charterEdited: true },
      { skipped: ["lore", "recruiting", "invite", "verify", "vigil"] },
    );
    expect(all.complete).toBe(true);
  });
});

describe("guildRobots", () => {
  it("keeps drafts out of search engines and leaves published guilds alone", () => {
    expect(guildRobots({ publishedAt: null })).toMatchObject({ index: false, follow: false });
    expect(guildRobots({ publishedAt: new Date() })).toBeUndefined();
  });
});

describe("setupUrl", () => {
  it("lands on the new guild's setup checklist, locally and in production", () => {
    const local = hostConfigFromEnv({});
    expect(setupUrl(guildSubdomainOrigin("oathbound", local, { protocol: "http:", host: "localhost:3000" }))).toBe(
      "http://oathbound.localhost:3000/admin/setup",
    );
    const prod = hostConfigFromEnv({ ROOT_DOMAIN: "guildbook.io" });
    expect(setupUrl(guildSubdomainOrigin("oathbound", prod, { protocol: "https:", host: "guildbook.io" }))).toBe(
      "https://oathbound.guildbook.io/admin/setup",
    );
  });
});

describe("rank presets", () => {
  it.each(RANK_PRESET_KEYS)("%s covers every tier and fits in game", (key) => {
    const preset = RANK_PRESETS[key];
    expect(new Set(preset.ranks.map((r) => r.tier))).toEqual(new Set(RANK_TIERS));
    expect(preset.ranks.filter((r) => r.inGame).length).toBeLessThanOrEqual(MAX_IN_GAME_RANKS);
    expect(new Set(preset.ranks.map((r) => r.name)).size).toBe(preset.ranks.length);
    for (const r of preset.ranks) expect(r.name.length).toBeLessThanOrEqual(15);
    const tierOf = (name: string) => preset.ranks.find((r) => r.name === name)?.tier;
    expect(tierOf(preset.applicantRank)).toBe("applicant");
    expect(["member", "raider"]).toContain(tierOf(preset.acceptRank));
    expect(["member", "raider"]).toContain(tierOf(preset.trialRank));
    expect(preset.ranks[0]!.tier).toBe("admin");
  });
});
