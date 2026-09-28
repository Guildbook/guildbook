import { z } from "zod";
import { BACKGROUND_COLORS, BORDER_COLORS, EMBLEM_COLORS } from "@/lib/tabard/palette";

export const BORDER_STYLES = [
  { id: "plain", name: "Plain" },
  { id: "double", name: "Double" },
  { id: "wide", name: "Wide" },
  { id: "studded", name: "Studded" },
  { id: "stitched", name: "Stitched" },
] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number]["id"];
export const BORDER_STYLE_IDS = BORDER_STYLES.map((s) => s.id) as [BorderStyle, ...BorderStyle[]];

/** A guild's in-game tabard: palette indexes for the three colours, a border style and an emblem id. */
export interface TabardConfig {
  background: number;
  border: number;
  borderStyle: BorderStyle;
  emblem: string;
  emblemColor: number;
}

/**
 * The Order of Saint Michael's tabard: crimson field, gold border, white cross pattee. Stored for reference; the
 * Order renders its locked hand-drawn crest (components/crest.tsx), not the generic renderer.
 */
export const ORDER_TABARD: TabardConfig = { background: 2, border: 3, borderStyle: "plain", emblem: "cross-pattee", emblemColor: 14 };

/** New guilds start with a navy field, gold border and gold star until an officer designs their tabard. */
export const DEFAULT_TABARD: TabardConfig = { background: 32, border: 3, borderStyle: "plain", emblem: "star", emblemColor: 3 };

/** A short stable key for a tabard, used to version icon URLs so browsers refetch after a change. */
export function tabardKey(t: TabardConfig): string {
  return [t.background, t.border, t.borderStyle, t.emblem, t.emblemColor].join("-");
}

/** Validates palette indexes and the border style; the emblem id is checked against the emblem catalogue. */
export function tabardSchema(emblemIds: readonly string[]) {
  const index = (max: number) => z.coerce.number().int().min(0).max(max);
  return z.object({
    background: index(BACKGROUND_COLORS.length - 1),
    border: index(BORDER_COLORS.length - 1),
    borderStyle: z.enum(BORDER_STYLE_IDS),
    emblem: z.string().refine((id) => emblemIds.includes(id), "Choose an emblem from the list."),
    emblemColor: index(EMBLEM_COLORS.length - 1),
  });
}
