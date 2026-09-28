import { describe, expect, it } from "vitest";
import { ADDON_ICON_BY_SLUG, ADDON_ICON_INFO, ADDON_ICONS, addonIconFor, FALLBACK_ADDON_ICON } from "@/lib/addon-icons";

describe("addonIconFor", () => {
  it("maps the Order's own addons by slug", () => {
    expect(addonIconFor({ slug: "order-assist", name: "Order Assist" })).toBe("scroll");
    expect(addonIconFor({ slug: "vigil", name: "Vigil" })).toBe("eye");
    expect(addonIconFor({ slug: "compline", name: "Compline" })).toBe("bell");
  });

  it("matches common raiding addons by name when the slug differs", () => {
    expect(addonIconFor({ slug: "details-meter-fork", name: "Details!" })).toBe("meter");
    expect(addonIconFor({ slug: "boss-alerts", name: "Deadly Boss Mods" })).toBe("sigil");
    expect(addonIconFor({ slug: "loot-helper", name: "Order Loot" })).toBe("scales");
  });

  it("falls back to the quill for anything unrecognized", () => {
    expect(addonIconFor({ slug: "mystery", name: "Something New" })).toBe(FALLBACK_ADDON_ICON);
  });

  it("only maps to icons that exist", () => {
    for (const icon of Object.values(ADDON_ICON_BY_SLUG)) expect(ADDON_ICONS).toContain(icon);
    for (const icon of ADDON_ICONS) expect(ADDON_ICON_INFO[icon].label).toBeTruthy();
  });
});
