import type { ReactNode } from "react";

/** `full` from 64px wide, `mark` for header-sized crests (21 to 63px), `tiny` for favicons (20px or below). */
export type TabardDetail = "full" | "mark" | "tiny";

/**
 * Colours and line weight for one emblem drawing. All plain colours (no gradient references), so an emblem
 * never depends on `<defs>` elsewhere on the page.
 */
export interface EmblemPaint {
  /** The emblem colour. */
  fill: string;
  /** A lighter tone of `fill`, for highlights. */
  light: string;
  /** A darker tone of `fill`, for bevels and shading. */
  shade: string;
  /** The heraldic outline (near-black). */
  outline: string;
  /** Outline stroke width in the emblem's 100 by 100 box, already tuned for `detail`. */
  sw: number;
  detail: TabardDetail;
}

export interface EmblemDef {
  /** Stable slug stored in the database. Never rename one. */
  id: string;
  name: string;
  /** Extra search words for the admin picker. */
  tags: string[];
  /** Draws the emblem in a 100 by 100 box centred on (50, 50), filling roughly 18 to 82 on both axes. */
  draw: (p: EmblemPaint) => ReactNode;
}
