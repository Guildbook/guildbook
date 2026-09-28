import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    // Guild specs run on the Order's subdomain; bare localhost is the Guildbook apex (see e2e/guildbook.spec.ts).
    baseURL: `http://osm.localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_TEST_MODE: "1",
      BATTLENET_MOCK: "1",
      // Fixed key for throwaway e2e tokens only; never reuse it.
      BATTLENET_TOKEN_KEY: process.env.BATTLENET_TOKEN_KEY ?? Buffer.alloc(32, 7).toString("base64"),
      ...(DATABASE_URL ? { DATABASE_URL } : {}),
    },
  },
});
