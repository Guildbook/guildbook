import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { Settings } from "../core/protocol";

declare const __DEFAULT_SITE_URL__: string;

export function defaultSiteUrl(): string {
  if (process.env.VIGIL_SITE_URL) return process.env.VIGIL_SITE_URL;
  return app.isPackaged ? __DEFAULT_SITE_URL__ : "http://osm.localhost:3000";
}

export const DEFAULT_SETTINGS = (): Settings => ({
  siteUrl: defaultSiteUrl(),
  logsDirOverride: null,
  autoUpload: true,
  minFightSeconds: 20,
  visibility: "default",
  alwaysOnTop: false,
  mode: "full",
  modelId: "auto",
});

const file = (name: string) => path.join(app.getPath("userData"), name);

function readJson<T>(name: string): Partial<T> | null {
  try {
    return JSON.parse(readFileSync(file(name), "utf8")) as Partial<T>;
  } catch {
    return null;
  }
}

function writeJson(name: string, value: unknown) {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(file(name), JSON.stringify(value, null, 2));
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS(), ...readJson<Settings>("settings.json") };
}

export function saveSettings(settings: Settings) {
  writeJson("settings.json", settings);
}

export interface PairingRecord {
  siteUrl: string;
  guild: { slug: string; name: string };
  device: { id: string; name: string };
}

export function loadPairing(): PairingRecord | null {
  const p = readJson<PairingRecord>("pairing.json");
  return p?.siteUrl && p.guild && p.device ? (p as PairingRecord) : null;
}

export function savePairing(p: PairingRecord | null) {
  if (p) writeJson("pairing.json", p);
  else rmSync(file("pairing.json"), { force: true });
}

/**
 * The device token, encrypted with Electron safeStorage (Keychain on macOS, DPAPI on Windows, the secret
 * service on Linux). Without OS encryption the token stays in memory for this run and is never written.
 */
export class TokenStore {
  private memory: string | null = null;
  private read = false;

  get storage(): "keychain" | "memory" {
    return safeStorage.isEncryptionAvailable() ? "keychain" : "memory";
  }

  load(): string | null {
    if (this.memory || this.read) return this.memory;
    this.read = true;
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      this.memory = safeStorage.decryptString(readFileSync(file("device-token.bin")));
      return this.memory;
    } catch {
      return null;
    }
  }

  save(token: string) {
    this.memory = token;
    if (!safeStorage.isEncryptionAvailable()) return;
    mkdirSync(app.getPath("userData"), { recursive: true });
    writeFileSync(file("device-token.bin"), safeStorage.encryptString(token), { mode: 0o600 });
  }

  clear() {
    this.memory = null;
    rmSync(file("device-token.bin"), { force: true });
  }
}
