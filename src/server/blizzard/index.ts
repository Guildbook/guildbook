import "server-only";
import { BlizzardClient } from "./client";
import { blizzardConfigFromEnv } from "./config";
import { tokenKeyFromEnv } from "./crypto";
import { createMockFetch } from "./mock";

export { charactersForGuild, snapshotRegion } from "./filter";
export { battlenetEnabled, blizzardConfigFromEnv, type BlizzardConfig } from "./config";
export { BlizzardClient, type FetchLike, type ItemLookup } from "./client";

const globalForBlizzard = globalThis as unknown as { blizzardClient?: BlizzardClient };

/** The app's client: real Blizzard, or fixtures when BATTLENET_MOCK=1. Cached so the app token is reused. */
export function getBlizzardClient(): BlizzardClient {
  if (!globalForBlizzard.blizzardClient) {
    const config = blizzardConfigFromEnv();
    globalForBlizzard.blizzardClient = new BlizzardClient(config, config.mock ? createMockFetch(config.profileNamespace) : undefined);
  }
  return globalForBlizzard.blizzardClient;
}

export function getBattlenetDeps() {
  const client = getBlizzardClient();
  return { client, tokenKey: tokenKeyFromEnv() };
}
