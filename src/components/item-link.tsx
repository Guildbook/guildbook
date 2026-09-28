import Image from "next/image";
import { ITEM_QUALITY_INFO, type ItemQuality } from "@/lib/loot/constants";
import { itemIconUrl, wowheadItemUrl } from "@/lib/loot/items";

/**
 * An item name in its quality colour, linking to Wowhead. The icon is hotlinked from Blizzard's render CDN (never
 * stored), and only when the item cache knows it.
 */
export function ItemLink({
  itemId,
  name,
  quality,
  icon,
  size = 20,
  className = "",
}: {
  itemId: number;
  name: string;
  quality: ItemQuality | null;
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  // Poor and common read as muted and plain text on the dark theme; the rest use the in-game colours.
  const tone = quality === 0 ? "text-muted" : quality === null || quality === 1 ? "text-bone" : "";
  const style = quality !== null && quality > 1 ? { color: ITEM_QUALITY_INFO[quality].color } : undefined;
  return (
    <a
      href={wowheadItemUrl(itemId)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 font-medium hover:underline ${tone} ${className}`}
      style={style}
      title={quality !== null ? `${ITEM_QUALITY_INFO[quality].label} item, opens Wowhead` : "Opens Wowhead"}
    >
      {icon ? (
        <Image
          src={itemIconUrl(icon)}
          width={size}
          height={size}
          alt=""
          unoptimized
          className="shrink-0 rounded-sm border border-line"
        />
      ) : null}
      <span>{name}</span>
    </a>
  );
}

/** Required wherever item details from Blizzard's Game Data API are shown. */
export function BlizzardItemAttribution() {
  return (
    <p className="mt-4 text-xs text-muted">
      Some item names and icons are provided by Blizzard Entertainment. World of Warcraft and Blizzard Entertainment are
      trademarks or registered trademarks of Blizzard Entertainment, Inc.
    </p>
  );
}
