import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/types";
import { seedDemoGuild } from "@/db/seed";
import { ADDON_ICON_BY_SLUG, ADDON_ICONS, addonIconFor } from "@/lib/addon-icons";
import { listAddons } from "@/server/services/content";
import { createTestDb } from "../support/db";

let db: Db;
let close: () => Promise<void>;
let guildId: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  guildId = (await seedDemoGuild(db)).id;
});
afterAll(async () => close());

describe("seeded addon icons", () => {
  it("gives every seeded addon its own mapped icon", async () => {
    const seeded = await listAddons(db, guildId);
    expect(seeded.length).toBeGreaterThan(0);
    for (const addon of seeded) {
      expect(ADDON_ICON_BY_SLUG[addon.slug], `${addon.slug} has no icon mapping`).toBeDefined();
      expect(ADDON_ICONS).toContain(addonIconFor(addon));
    }
    expect(new Set(seeded.map(addonIconFor)).size).toBe(seeded.length);
  });
});
