import { expect, type Page, test } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
/** Bare localhost is the local apex and guilds live on *.localhost, which Chromium resolves itself. */
const APEX = `http://localhost:${PORT}`;
const guildOrigin = (slug: string) => `http://${slug}.localhost:${PORT}`;

function uniqueSuffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

async function signInOnApex(page: Page, discordId: string, name: string, callbackUrl: string) {
  await page.context().clearCookies();
  await page.goto(`${APEX}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  const form = page.getByTestId("test-login-other");
  await form.getByPlaceholder("Discord ID").fill(discordId);
  await form.getByPlaceholder("Name").fill(name);
  await form.getByRole("button", { name: "Test sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("Guildbook platform", () => {
  test("apex landing and directory are served on the apex, guilds on their subdomains", async ({ page }) => {
    await page.goto(`${APEX}/`);
    await expect(page.getByRole("heading", { name: "A home for your guild" })).toBeVisible();
    await expect(page).toHaveTitle(/Guildbook/);
    // The guild site preview links to the Order on its subdomain.
    await expect(page.getByRole("link", { name: "Visit Order of Saint Michael" })).toHaveAttribute("href", guildOrigin("osm"));
    // Its theme picker switches to an example guild, which links to guild creation instead.
    await page.getByRole("button", { name: "Wardens of the Greenwood theme" }).click();
    await expect(page.getByRole("button", { name: "Wardens of the Greenwood theme" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("preview-address")).toHaveText(/^greenwood\./);
    await expect(page.getByRole("link", { name: "Your guild here" })).toHaveAttribute("href", "/create");
    await page.getByRole("button", { name: "Order of Saint Michael theme" }).click();
    await expect(page.getByRole("link", { name: "Visit Order of Saint Michael" })).toBeVisible();

    // www redirects to the bare apex, keeping the path.
    await page.goto(`http://www.localhost:${PORT}/guilds`);
    await expect(page).toHaveURL(`${APEX}/guilds`);

    await page.goto(`${APEX}/guilds`);
    await expect(page.getByRole("heading", { name: "Guild directory" })).toBeVisible();
    await expect(page.getByTestId("directory").getByRole("link", { name: "Order of Saint Michael" })).toHaveAttribute("href", guildOrigin("osm"));

    await page.goto(`${guildOrigin("osm")}/charter`);
    await expect(page.getByRole("heading", { name: /Charter/ }).first()).toBeVisible();
    // Links on a guild subdomain carry no slug prefix.
    await expect(page.locator('a[href^="/osm/"]')).toHaveCount(0);

    // Signing in on a guild subdomain goes through the apex.
    await page.goto(`${guildOrigin("osm")}/login`);
    await expect(page).toHaveURL(new RegExp(`^${APEX}/login\\?callbackUrl=`));
    await expect(page.getByRole("heading", { name: "Sign in to Order of Saint Michael" })).toBeVisible();
  });

  test("create a guild on the apex and land signed in on its admin subdomain", async ({ page }) => {
    const suffix = uniqueSuffix();
    const name = `E2E Keep ${suffix}`;
    const slug = `e2e-keep-${suffix}`;

    await page.goto(`${APEX}/create`);
    await expect(page).toHaveURL(new RegExp(`^${APEX}/login`));

    await signInOnApex(page, `e2e-founder-${suffix}`, `Founder ${suffix}`, "/create");
    await expect(page).toHaveURL(`${APEX}/create`);
    await expect(page.getByRole("heading", { name: "Create your guild" })).toBeVisible();

    const slugInput = page.getByLabel("Subdomain");
    await slugInput.fill("www");
    await expect(page.getByTestId("slug-status")).toHaveText("That name is reserved");
    await slugInput.fill("osm");
    await expect(page.getByTestId("slug-status")).toHaveText("That subdomain is taken");
    await slugInput.fill("");

    await page.getByLabel("Guild name").fill(name);
    // The name suggests a slug until the slug is edited, but the slug was edited above.
    await slugInput.fill(slug);
    await expect(page.getByTestId("slug-status")).toHaveText("Available");
    await page.getByLabel("Horde").check();
    await page.getByLabel("Motto").fill("Hold the line");
    // Left unlisted so repeated runs don't fill the local directory.
    await expect(page.getByLabel(/public Guildbook directory/)).not.toBeChecked();
    await page.getByRole("button", { name: "Create guild" }).click();

    // The handoff sets a session on the new subdomain and lands on its admin.
    await page.waitForURL(`${guildOrigin(slug)}/admin`);
    await expect(page.getByRole("heading", { name: "Chapter House" })).toBeVisible();

    await page.goto(`${guildOrigin(slug)}/`);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText("Hold the line")).toBeVisible();
    await expect(page.getByText("Sancte Michael Archangele")).toHaveCount(0);

    await page.goto(`${guildOrigin(slug)}/charter`);
    await expect(page.getByRole("heading", { name: "Guild Charter" }).first()).toBeVisible();

    // Custom domain foundations: a pending domain with DNS instructions.
    await page.goto(`${guildOrigin(slug)}/admin/guild`);
    await page.getByLabel("Domain").fill(`${slug}.example.com`);
    await page.getByRole("button", { name: "Add domain" }).click();
    const card = page.getByTestId("custom-domain").filter({ hasText: `${slug}.example.com` });
    await expect(card).toBeVisible();
    await expect(card.getByText(`_guildbook.${slug}.example.com`)).toBeVisible();
    await expect(card.getByText("Waiting for DNS")).toBeVisible();

    // The apex session is still there and lists the new guild.
    await page.goto(`${APEX}/`);
    await expect(page.getByTestId("your-guilds").getByRole("link", { name })).toHaveAttribute("href", guildOrigin(slug));
    await expect(page.getByTestId("platform-user")).toHaveText(`Founder ${suffix}`);
  });

  test("the guild subdomain carries the apex session through sign-in", async ({ page }) => {
    const suffix = uniqueSuffix();
    await signInOnApex(page, `e2e-visitor-${suffix}`, `Visitor ${suffix}`, `${guildOrigin("osm")}/apply`);
    await expect(page).toHaveURL(`${guildOrigin("osm")}/apply`);
    await expect(page.getByRole("heading", { name: "Apply to the Order" })).toBeVisible();
    await expect(page.getByText(/Sign in with Discord/)).toHaveCount(0);
  });

  test("rejects foreign callback URLs", async ({ page }) => {
    const suffix = uniqueSuffix();
    await signInOnApex(page, `e2e-redirect-${suffix}`, `Redirect ${suffix}`, "https://evil.example.com/steal");
    expect(new URL(page.url()).host).toBe(`localhost:${PORT}`);
    // The redirect after a server action is rendered on the apex, not a guild.
    await expect(page.getByRole("heading", { name: "A home for your guild" })).toBeVisible();
    await expect(page.getByTestId("platform-user")).toHaveText(`Redirect ${suffix}`);
  });
});
