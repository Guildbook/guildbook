import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tabardColors } from "@/components/tabard-art";
import type { TabardConfig } from "@/lib/tabard/config";
import { emblemFile } from "@/lib/tabard/crest";
import { tintedDataUri } from "@/lib/tabard/tint-png";

const masks = new Map<string, Promise<Buffer>>();
function loadMask(rel: string) {
  let mask = masks.get(rel);
  if (!mask) {
    mask = readFile(path.join(process.cwd(), "public", rel));
    mask.catch(() => masks.delete(rel));
    masks.set(rel, mask);
  }
  return mask;
}

const TINT_CACHE_SIZE = 256;
const tinted = new Map<string, Promise<string>>();

/** A mask under public/ tinted with `hex`, as a PNG data URI. Cached (least recently used first out). */
export function tintedMask(rel: string, hex: string): Promise<string> {
  const key = `${rel}|${hex}`;
  const hit = tinted.get(key);
  if (hit) {
    tinted.delete(key);
    tinted.set(key, hit);
    return hit;
  }
  const uri = loadMask(rel).then((png) => tintedDataUri(png, hex));
  uri.catch(() => tinted.delete(key));
  tinted.set(key, uri);
  if (tinted.size > TINT_CACHE_SIZE) tinted.delete(tinted.keys().next().value!);
  return uri;
}

/** A tabard's emblem tinted on the server, for `TabardArt`'s `images`. */
export async function crestImages(tabard: TabardConfig): Promise<{ mode: "tinted"; emblem: string }> {
  return { mode: "tinted", emblem: await tintedMask(emblemFile(tabard.emblemId), tabardColors(tabard).emblem) };
}
