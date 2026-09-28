import type { LootResponse } from "./constants";

/** Maps a tool's free-text response ("Upgrade", "Offspec", "SR", "Disenchant") onto a ledger response. */
export function responseFromText(text: string | null | undefined, fallback: LootResponse): LootResponse {
  const t = text?.trim().toLowerCase() ?? "";
  if (!t || t === "nil" || t === "-") return fallback;
  if (/disenchant|\bde\b|shard/.test(t)) return "disenchant";
  if (/\bbank\b|guild bank/.test(t)) return "bank";
  if (/soft.?res|\bsr\b|reserve/.test(t)) return "soft_reserve";
  if (/off.?spec|\bos\b|transmog|minor/.test(t)) return "off_spec";
  if (/main.?spec|\bms\b|need|upgrade|\bbis\b|best in slot|stat|ilvl|tier/.test(t)) return "main_spec";
  if (/greed|roll|free/.test(t)) return "roll";
  if (/council/.test(t)) return "council";
  return fallback;
}
