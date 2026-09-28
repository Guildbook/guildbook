import { CLASSES, type WowClass } from "@/lib/game";

/**
 * The comparable form of an import name: realm suffix dropped ("Cassian-Forever"), lower case, single spaces.
 * WoW: Forever names are a first and a last name, which addons may write with a space or run together.
 */
export function normalizeLootName(raw: string): string {
  const withoutRealm = raw.includes("-") ? raw.slice(0, raw.indexOf("-")) : raw;
  return withoutRealm.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** A display form for a recipient who isn't a guild character: the realm dropped, each word capitalised. */
export function displayLootName(raw: string): string {
  return normalizeLootName(raw)
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function lootRecipient(raw: string, wowClass: string | null | undefined) {
  const cls = wowClass?.trim().toLowerCase();
  return {
    raw: raw.trim(),
    name: displayLootName(raw),
    wowClass: cls && (CLASSES as readonly string[]).includes(cls) ? (cls as WowClass) : null,
  };
}

/** cyrb53: a fast, stable 53-bit string hash, used for external IDs when an export row has none. */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** External ID for a row without one: the same item, recipient and minute always hash the same. */
export function derivedExternalId(itemId: number, recipient: string | null, awardedAt: Date): string {
  const minute = new Date(Math.floor(awardedAt.getTime() / 60_000) * 60_000).toISOString();
  return `h:${stableHash(`${itemId}|${recipient ? normalizeLootName(recipient) : "-"}|${minute}`)}`;
}
