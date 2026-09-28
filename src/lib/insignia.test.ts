import { describe, expect, it } from "vitest";
import { DEFAULT_INSIGNIA_BY_TIER, insigniaFor } from "@/lib/insignia";
import { rankInput } from "@/lib/validation";

describe("insigniaFor", () => {
  it("uses the rank's own insignia", () => {
    expect(insigniaFor({ insignia: "chalice", tier: "officer" })).toBe("chalice");
  });

  it("falls back to the tier default when unset or unknown", () => {
    expect(insigniaFor({ insignia: null, tier: "raider" })).toBe(DEFAULT_INSIGNIA_BY_TIER.raider);
    expect(insigniaFor({ insignia: "dragon", tier: "applicant" })).toBe(DEFAULT_INSIGNIA_BY_TIER.applicant);
  });
});

describe("rank insignia input", () => {
  const base = { name: "Knight", tier: "raider" };

  it("accepts a known insignia", () => {
    expect(rankInput.parse({ ...base, insignia: "cross-pattee" }).insignia).toBe("cross-pattee");
  });

  it("treats an empty or missing choice as the tier default", () => {
    expect(rankInput.parse({ ...base, insignia: "" }).insignia).toBeNull();
    expect(rankInput.parse(base).insignia).toBeNull();
  });

  it("rejects an unknown insignia", () => {
    expect(rankInput.safeParse({ ...base, insignia: "dragon" }).success).toBe(false);
  });
});
