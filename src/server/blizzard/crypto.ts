import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

/** `BATTLENET_TOKEN_KEY`: 32 random bytes, base64 (`openssl rand -base64 32`). */
export function tokenKeyFromEnv(env: Record<string, string | undefined> = process.env): Buffer {
  const raw = env.BATTLENET_TOKEN_KEY?.trim();
  if (!raw) throw new Error("BATTLENET_TOKEN_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("BATTLENET_TOKEN_KEY must be 32 bytes, base64-encoded");
  return key;
}

/** AES-256-GCM. Output: `v1.<iv>.<tag>.<ciphertext>`, each part base64url. */
export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptToken(encoded: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = encoded.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Unrecognized token format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
