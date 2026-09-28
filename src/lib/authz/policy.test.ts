import { describe, expect, it } from "vitest";
import { type Actor, assertCan, AuthorizationError, can, canAssignRank, POLICY, resolveTier } from "./policy";
import { type Tier, TIERS } from "./tiers";

const actor = (tier: Tier, signedIn = true): Actor => ({
  guildId: "g",
  userId: signedIn ? "u" : null,
  membershipId: tier === "public" || tier === "applicant" ? null : "m",
  tier,
});

describe("resolveTier", () => {
  it("is public without a membership", () => {
    expect(resolveTier(null)).toBe("public");
  });
  it("uses the rank tier for active members", () => {
    expect(resolveTier({ status: "active", rankTier: "officer" })).toBe("officer");
  });
  it("caps applicants at applicant regardless of rank", () => {
    expect(resolveTier({ status: "applicant", rankTier: "admin" })).toBe("applicant");
  });
  it("treats former members as public", () => {
    expect(resolveTier({ status: "former", rankTier: "admin" })).toBe("public");
  });
});

describe("can", () => {
  it("follows the tier hierarchy for every action", () => {
    for (const [action, min] of Object.entries(POLICY) as [keyof typeof POLICY, Tier][]) {
      for (const tier of TIERS) {
        const expected = TIERS.indexOf(tier) >= TIERS.indexOf(min);
        expect(can(actor(tier), action), `${tier} → ${action}`).toBe(expected);
      }
    }
  });

  it("requires a signed-in user even for public-tier actions like applying", () => {
    expect(can(actor("public", false), "application.submit")).toBe(false);
    expect(can(actor("public", true), "application.submit")).toBe(true);
  });

  it("never grants protected actions to signed-out visitors", () => {
    expect(can({ guildId: "g", userId: null, membershipId: null, tier: "admin" }, "admin.area")).toBe(false);
  });

  it("keeps raiders out of officer actions and officers out of admin actions", () => {
    expect(can(actor("raider"), "application.review")).toBe(false);
    expect(can(actor("officer"), "application.review")).toBe(true);
    expect(can(actor("officer"), "rank.manage")).toBe(false);
    expect(can(actor("admin"), "rank.manage")).toBe(true);
  });
});

describe("assertCan", () => {
  it("throws unauthenticated for signed-out visitors", () => {
    try {
      assertCan(actor("public", false), "member.area");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      expect((err as AuthorizationError).code).toBe("unauthenticated");
    }
  });

  it("throws forbidden when the tier is too low", () => {
    try {
      assertCan(actor("member"), "admin.area");
      expect.unreachable();
    } catch (err) {
      expect((err as AuthorizationError).code).toBe("forbidden");
    }
  });

  it("passes when permitted", () => {
    expect(() => assertCan(actor("officer"), "admin.area")).not.toThrow();
  });
});

describe("canAssignRank", () => {
  it("lets officers promote members up to their own tier", () => {
    expect(canAssignRank(actor("officer"), "member", "raider")).toBe(true);
    expect(canAssignRank(actor("officer"), "member", "officer")).toBe(true);
  });
  it("never grants a tier above the actor's own", () => {
    expect(canAssignRank(actor("officer"), "member", "admin")).toBe(false);
  });
  it("stops officers from changing peers or superiors", () => {
    expect(canAssignRank(actor("officer"), "officer", "member")).toBe(false);
    expect(canAssignRank(actor("officer"), "admin", "member")).toBe(false);
  });
  it("lets admins change anyone", () => {
    expect(canAssignRank(actor("admin"), "admin", "member")).toBe(true);
    expect(canAssignRank(actor("admin"), "officer", "admin")).toBe(true);
  });
  it("denies raiders entirely", () => {
    expect(canAssignRank(actor("raider"), "member", "member")).toBe(false);
  });
});
