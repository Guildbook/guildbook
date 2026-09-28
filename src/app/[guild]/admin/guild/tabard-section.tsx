import { Crest } from "@/components/crest";
import { TabardBuilder } from "@/components/tabard-builder";
import { Panel, Tag } from "@/components/ui";
import { brandFile, guildBrand } from "@/lib/brand";
import { guildLook, isOrderLook } from "@/lib/tabard/look";
import type { SelectableBase } from "@/lib/tabard/theme";
import { updateGuildTabardAction } from "@/server/actions/tabard";
import type { Guild } from "@/server/context";

const ORDER_SIZES = [16, 32, 44, 80, 128, 176];

function DiscordIconLink({ href }: { href: string }) {
  return (
    <a href={href} download className="btn btn-ghost btn-sm" data-testid="discord-icon-download">
      Download Discord icon (512px PNG)
    </a>
  );
}

// TODO: a banner image for the home hero. The project has no file storage yet (no Vercel Blob or similar); add
// the upload here once it does.

/** Guild settings: the in-game tabard (crest and icons) and the site theme it drives. */
export function TabardSection({ guild }: { guild: Guild }) {
  const brand = guildBrand(guild);
  const discordHref = isOrderLook(guild) ? "/brand/discord-icon.png" : `${brandFile(brand, "discord-icon.png")}&download`;

  if (isOrderLook(guild)) {
    return (
      <Panel title="Tabard and theme" actions={<Tag>Locked</Tag>}>
        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-muted">
            The Order of Saint Michael keeps its hand-drawn crest (a crimson banner, gold border and white cross pattee) and
            its own crimson and gold theme. They are locked and exclusive to the Order, so there is nothing to change here.
          </p>
          <div className="flex flex-wrap items-end gap-4 rounded border border-line bg-ink/40 p-3">
            {ORDER_SIZES.map((px) => (
              <span key={px} className="inline-flex" style={{ width: px, height: px * 1.2 }}>
                <Crest className="h-full w-full" />
              </span>
            ))}
          </div>
          <DiscordIconLink href={discordHref} />
        </div>
      </Panel>
    );
  }

  const look = guildLook(guild);
  return (
    <Panel title="Tabard and theme" actions={<DiscordIconLink href={discordHref} />}>
      <p className="mb-5 text-sm leading-relaxed text-muted">
        Recreate your in-game guild tabard. Its background colour becomes the site&apos;s primary accent, the border colour
        its trim (headings, dividers, panel borders), and the emblem colour its highlights. Saving also regenerates the
        favicon, app icons, link preview and Discord icon.
      </p>
      <TabardBuilder
        action={updateGuildTabardAction.bind(null, guild.slug)}
        initial={{ tabard: look.tabard, base: look.base as SelectableBase, overrides: look.overrides }}
        guild={{ name: guild.name, motto: guild.motto }}
      />
    </Panel>
  );
}
