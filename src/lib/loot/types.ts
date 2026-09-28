import type { WowClass } from "@/lib/game";
import type { ItemQuality, LootResponse, LootSource } from "./constants";

/** One award read from an export, before names are matched to guild characters. */
export interface ParsedAward {
  /** Stable per award, so importing the same export twice adds nothing. Derived from the row when the tool has none. */
  externalId: string;
  itemId: number;
  itemName: string | null;
  itemQuality: ItemQuality | null;
  /** Null for disenchanted or banked items. */
  recipient: { raw: string; name: string; wowClass: WowClass | null } | null;
  awardedAt: Date;
  /** "day" when the export only has a date (Gargul's TMB format); the time is then noon in the guild's time zone. */
  timePrecision: "exact" | "minute" | "day";
  response: LootResponse;
  responseText: string | null;
  votes: number | null;
  instance: string | null;
  boss: string | null;
  note: string | null;
}

export interface ParseWarning {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedAward[];
  warnings: ParseWarning[];
}

export interface ParseContext {
  /** IANA time zone used for exports whose dates carry no zone (the exporter's local time). */
  timezone: string;
  /** Gargul custom export template, e.g. `@ID;@DATE @TIME;@WINNER`. */
  template?: string;
}

/** A loot export format. Parsers are pure: they never touch the database. */
export interface LootParser {
  id: string;
  label: string;
  source: Exclude<LootSource, "manual">;
  /** How confident this parser is that `raw` is its format, from 0 to 1. The best match wins auto-detection. */
  detect(raw: string): number;
  parse(raw: string, ctx: ParseContext): ParseResult;
}
