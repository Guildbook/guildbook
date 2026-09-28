import { expect, type Page, test } from "@playwright/test";
import { randomCharacterName, signIn } from "./helpers";

// Runs against BATTLENET_MOCK=1: linking skips Battle.net and returns fixture characters
// (Aldric, Brenna and Corwin for the Alliance; a Horde warrior, a Death Knight and Isolde, who is in
// the EU region while the seeded guilds are in the Americas, are filtered out).

async function fillFreeText(page: Page, discord: string) {
  await page.getByLabel("Raid experience").fill("Healed Molten Core and Blackwing Lair in Classic.");
  await page.getByLabel("Availability").fill("Tuesdays and Thursdays, 8-11 PM Eastern.");
  await page.getByLabel("Why the Order of Saint Michael?").fill("Faithful company and steady progression.");
  await page.getByLabel("Discord handle").fill(discord);
  await page.getByRole("checkbox").check();
}

test("an applicant links Battle.net, picks a character, and the officer sees it verified", async ({ page }) => {
  const surname = randomCharacterName();
  const applicantId = `e2e-bnet-${surname.toLowerCase()}`;
  await signIn(page, applicantId, "Pilgrim", "/apply");

  await page.getByRole("link", { name: "Link Battle.net" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Battle.net linked." })).toBeVisible();
  await expect(page.getByTestId("toast").filter({ hasText: "Battle.net linked." })).toBeVisible();
  await expect(page).not.toHaveURL(/bnet=/);
  await expect(page.getByTestId("battlenet-account")).toContainText(/Pilgrim#\d{4}/);

  await expect(page.getByRole("radio", { name: /Aldric/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Grukk/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Mortis/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Isolde/ })).toHaveCount(0);
  // A click that lands before hydration is reset by React, so retry until the form follows the choice.
  await expect(async () => {
    await page.getByRole("radio", { name: /Brenna/ }).check();
    await expect(page.getByLabel("First name")).toHaveValue("Brenna", { timeout: 1000 });
  }).toPass();
  await expect(page.getByLabel("First name")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Level", { exact: true })).toHaveValue("42");
  await expect(page.getByLabel("Class", { exact: true })).toHaveValue("Priest");
  await expect(page.getByLabel("Realm", { exact: true })).toHaveCount(0);
  await page.getByLabel("Surname").fill(surname);
  await page.getByLabel("Spec", { exact: true }).selectOption("Holy");
  await page.getByLabel("Raid role", { exact: true }).selectOption("healer");
  await fillFreeText(page, applicantId);
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByRole("heading", { name: "Your application" })).toBeInViewport();
  await expect(page.getByText("before applying.")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("img", { name: "Verified via Battle.net" })).toBeVisible();

  await signIn(page, "seed-ironvow", "Ironvow", "/admin/applications");
  const row = page.getByRole("link", { name: new RegExp(`Brenna ${surname}`) });
  await expect(row.getByText("Verified via Battle.net", { exact: true })).toBeVisible();
  await row.click();
  await expect(page.getByRole("main").getByText("Verified via Battle.net", { exact: true })).toBeVisible();
  await expect(page.getByText(/were read from Pilgrim#\d{4}/)).toBeVisible();
  await page.getByRole("button", { name: "Accept as member" }).click();
  await expect(page.getByText(/accepted on/)).toBeVisible();

  await signIn(page, applicantId, "Pilgrim", "/members/characters");
  const card = page.getByRole("main").locator("li", { hasText: `Brenna ${surname}` });
  await expect(card.getByRole("img", { name: "Verified via Battle.net" })).toBeVisible();
  await expect(card.getByText("Unverified")).toHaveCount(0);

  await page.goto("/roster");
  const entry = page.getByRole("main").locator("li", { hasText: `Brenna ${surname}` });
  await expect(entry.getByRole("img", { name: "Verified via Battle.net" })).toBeVisible();
});

test("without Battle.net, manual entry still works and the officer sees it unverified", async ({ page }) => {
  const name = randomCharacterName();
  const applicantId = `e2e-manual-${name.toLowerCase()}`;
  await signIn(page, applicantId, name, "/apply");

  await expect(page.getByRole("link", { name: "Link Battle.net" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByLabel("First name").fill(name);
  await page.getByLabel("Surname").fill("Handwritten");
  await page.getByLabel("Class", { exact: true }).selectOption("mage");
  await page.getByLabel("Spec", { exact: true }).selectOption("Frost");
  await page.getByLabel("Raid role", { exact: true }).selectOption("ranged");
  await fillFreeText(page, applicantId);
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByRole("heading", { name: "Your application" })).toBeInViewport();
  await expect(page.getByText("before applying.")).toHaveCount(0);

  await signIn(page, "seed-ironvow", "Ironvow", "/admin/applications");
  const row = page.getByRole("link", { name: new RegExp(`${name} Handwritten`) });
  await expect(row.getByText("Unverified", { exact: true })).toBeVisible();
  await row.click();
  await expect(page.getByText("Entered by hand; not checked against Battle.net.")).toBeVisible();
});

test("a member imports verified characters and an officer syncs their levels", async ({ page }, testInfo) => {
  // One seeded member per project, so both viewports start unlinked after the reseed.
  const [discordId, displayName] =
    testInfo.project.name === "mobile" ? ["seed-perpetua", "Perpetua"] : ["seed-cassian", "Cassian"];
  const surname = randomCharacterName();
  await signIn(page, discordId, displayName, "/members/characters");

  await page.getByRole("link", { name: "Link Battle.net" }).click();
  await expect(page.getByTestId("battlenet-account")).toContainText(/Pilgrim#\d{4}/);
  await expect(page.getByText("Import characters (3)")).toBeVisible();

  for (const [name, spec, role] of [
    ["Aldric", "Holy", "healer"],
    ["Brenna", "Shadow", "ranged"],
  ] as const) {
    await page.getByLabel(`${name} surname`).fill(surname);
    await page.getByLabel(`${name} spec`).selectOption(spec);
    await page.getByLabel(`${name} role`).selectOption(role);
    await page.locator("li", { has: page.getByLabel(`${name} surname`) }).getByRole("button", { name: "Import" }).click();
    await expect(page.getByText(`Imported as ${name} ${surname}`)).toBeVisible();
  }

  const brenna = page.getByRole("main").locator("li.panel", { hasText: `Brenna ${surname}` });
  await expect(brenna.getByRole("img", { name: "Verified via Battle.net" })).toBeVisible();
  await expect(brenna.getByText("Level 42 Shadow")).toBeVisible();

  await signIn(page, "seed-ironvow", "Ironvow", "/admin/members");
  const sync = page.getByTestId("battlenet-sync");
  await sync.getByRole("button", { name: "Sync now" }).click();
  await expect(sync.getByText(/Synced \d+ verified characters?: [1-9]\d* updated/)).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByText("battlenet.sync").first()).toBeVisible();

  await signIn(page, discordId, displayName, "/members/characters");
  await expect(brenna.getByText("Level 44 Shadow")).toBeVisible();
  await expect(brenna.getByText(/Synced from Battle.net/)).toBeVisible();
});

test("the Guild Master verifies the guild through Battle.net", async ({ page }) => {
  // In mock mode Aldric is Guild Master (rank 0) of "Order of Saint Michael" on a Normal realm, Alliance.
  // Tor is the only Guild Master and both projects share the database, so the second project finds Tor linked and
  // the guild already verified; re-checking must still succeed.
  await signIn(page, "seed-tor", "Tor", "/members/characters");
  const link = page.getByRole("link", { name: "Link Battle.net" });
  const account = page.getByTestId("battlenet-account");
  await expect(link.or(account)).toBeVisible();
  if (await link.isVisible()) {
    await link.click();
  } else {
    // The mock answers app-token character lookups with the IDs of whoever last listed their characters, and other
    // tests have linked since; refreshing lists Tor's again.
    await expect(async () => {
      await account.getByRole("button", { name: "Refresh characters" }).click();
      await expect(account.getByRole("status").filter({ hasText: /Found \d+ WoW: Forever characters/ })).toBeVisible({ timeout: 3000 });
    }).toPass();
  }
  await expect(account).toContainText(/Pilgrim#\d{4}/);

  await page.goto("/admin/guild");
  const panel = page.getByTestId("verify-guild");
  await expect(panel.getByText(/Guild Master \(rank 0\) of an in-game guild named exactly/)).toBeVisible();
  await panel.getByRole("button", { name: /^(Check verification|Check again)$/ }).click();
  await expect(panel.getByRole("status").filter({ hasText: "Your guild is verified." })).toBeVisible();
  await expect(panel.getByText(/Aldric is the in-game Guild Master/)).toBeVisible();
  await expect(page.getByRole("banner").getByTestId("verified-seal")).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByText("guild.verify").first()).toBeVisible();
});
