import { execSync } from "node:child_process";

/** Reseed the demo guild so every run starts from the same data. */
export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  execSync("pnpm db:reseed", { stdio: "inherit", env: { ...process.env, ...(url ? { DATABASE_URL: url } : {}) } });
}
