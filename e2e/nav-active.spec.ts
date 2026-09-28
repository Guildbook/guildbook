import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./helpers";

/** The header nav that is visible at this viewport: the Menu dropdown on mobile, the Main nav on desktop. */
async function headerNav(page: Page, isMobile: boolean) {
  const banner = page.getByRole("banner");
  if (!isMobile) return banner.getByRole("navigation", { name: "Main" });
  const menu = banner.locator('details:has(> summary[aria-label="Menu"])');
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open");
  return menu;
}

test("the navbar marks the current section, including child pages", async ({ page, isMobile }) => {
  for (const [path, label] of [
    ["/charter", "Charter"],
    ["/lore", "Lore"],
    ["/roster", "Roster"],
    ["/progression", "Progression"],
    ["/addons", "Addons"],
  ] as const) {
    await page.goto(path);
    const nav = await headerNav(page, isMobile);
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
    if (isMobile) await page.keyboard.press("Escape");
  }

  await page.goto("/roster");
  await page.getByRole("main").getByRole("link", { name: "Tor Whitecross", exact: true }).click();
  await expect(page).toHaveURL(/\/roster\/[^/]+$/);
  const nav = await headerNav(page, isMobile);
  await expect(nav.getByRole("link", { name: "Roster", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/");
  const home = await headerNav(page, isMobile);
  await expect(home.locator('a[aria-current="page"]')).toHaveCount(0);
});

test("the admin nav marks only the current section", async ({ page, isMobile }) => {
  await signIn(page, "seed-tor", "Tor", "/admin");
  const admin = page.getByRole("navigation", { name: "Admin" });

  await expect(admin.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(admin.locator('a[aria-current="page"]')).toHaveCount(1);

  for (const label of ["Applications", "Members", "Ranks", "Schedule", "Recruitment", "Progression", "Addons", "Guild", "Audit log"]) {
    await admin.getByRole("link", { name: label, exact: true }).click();
    await expect(admin.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(admin.locator('a[aria-current="page"]')).toHaveCount(1);
  }

  const nav = await headerNav(page, isMobile);
  await expect(nav.getByRole("link", { name: "Admin", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Progression", exact: true })).not.toHaveAttribute("aria-current", "page");
});
