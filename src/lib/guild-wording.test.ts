import { describe, expect, it } from "vitest";
import { guildWording } from "@/lib/guild-wording";

const ORDER_SPECIFIC = /\bthe Order\b|Order of|Catholic|pray|Saint|Grand Master|brothers?\b|sisters?\b|knight/i;

function strings(w: ReturnType<typeof guildWording>) {
  return Object.values(w).flatMap((v) => (typeof v === "function" ? [v(1), v(12)] : [v]));
}

describe("guildWording", () => {
  it("keeps the Order's wording exactly", () => {
    const w = guildWording({ preset: "order", name: "Order of Saint Michael" });
    expect(w.ranksHeading).toBe("Ranks of the Order");
    expect(w.progressionEyebrow).toBe("Deeds of the Order");
    expect(w.joined).toBe("Joined the Order");
    expect(w.lootEyebrow).toBe("The spoils of the Order");
    expect(w.addonsTitle).toBe("Addons of the Order");
    expect(w.addonsIntro).toBe("Custom tools our members write to help the Order prepare, execute and improve.");
    expect(w.rosterEyebrow(20)).toBe("20 brothers and sisters in arms");
    expect(w.characterOf).toBe("of the Order of Saint Michael");
  });

  it("names any other guild and says nothing of the Order", () => {
    const w = guildWording({ preset: "standard", name: "Silver Dawn" });
    for (const s of strings(w)) expect(s).not.toMatch(ORDER_SPECIFIC);
    expect(w.ranksHeading).toBe("Ranks of Silver Dawn");
    expect(w.joined).toBe("Joined Silver Dawn");
    expect(w.addonsTitle).toBe("Guild Addons");
    expect(w.rosterEyebrow(1)).toBe("1 member of Silver Dawn");
    expect(w.rosterEyebrow(12)).toBe("12 members of Silver Dawn");
    expect(w.characterOf).toBe("of Silver Dawn");
  });
});
