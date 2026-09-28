import { expect, type Page } from "@playwright/test";

/** Signs in through the test-only credentials provider (AUTH_TEST_MODE=1). Seeded users use `seed-<name>`. */
export async function signIn(page: Page, discordId: string, name: string, callbackUrl = "/") {
  await page.context().clearCookies();
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const form = page.getByTestId("test-login-other");
  await form.getByPlaceholder("Discord ID").fill(discordId);
  await form.getByPlaceholder("Name").fill(name);
  await form.getByRole("button", { name: "Test sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export function randomCharacterName(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 8; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return `E${s}`;
}

export async function expectOnPage(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
