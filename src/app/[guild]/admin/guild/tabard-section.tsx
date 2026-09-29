import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Crest } from "@/components/crest";
import { TabardBuilder } from "@/components/tabard-builder";
import { Panel, Tag } from "@/components/ui";
import { brandFile, guildBrand } from "@/lib/brand";
import { tabardKey } from "@/lib/tabard/config";
import { guildLook, isOrderLook } from "@/lib/tabard/look";
import type { SelectableBase } from "@/lib/tabard/theme";
import { importInGameTabardAction, updateGuildTabardAction } from "@/server/actions/tabard";
import { battlenetEnabled, blizzardConfigFromEnv } from "@/server/blizzard";
import type { Guild } from "@/server/context";
import { isPreLaunch, verificationSupported } from "@/server/services/guild-verification";
import { type GuildVersion, VERSION_INFO } from "@/lib/game-versions";

const ORDER_SIZES = [16, 32, 44, 80, 128, 176];

function DiscordIconLink({ href }: { href: string }) {
  return (
    <a href={href} download className="btn btn-ghost btn-sm" data-testid="discord-icon-download">
      Download Discord icon (512px PNG)
    </a>
  );
}

/** Copies the crest from the guild's in-game profile. Before launch there are no Forever guilds to read. */
function ImportTabard({ slug, gameVersion }: { slug: string; gameVersion: GuildVersion }) {
  const supported = verificationSupported(gameVersion);
  const enabled = supported && battlenetEnabled(blizzardConfigFromEnv());
  const preLaunch = isPreLaunch(new Date(), gameVersion);
  return (
    <ActionForm action={importInGameTabardAction.bind(null, slug)} className="mb-6 rounded border border-line bg-ink/40 p-4" toast={false}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-prose">
          <h3 className="font-display text-sm tracking-wide text-bone">Import your in-game tabard</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted" data-testid="tabard-import-note">
            {!supported
              ? `Importing from ${VERSION_INFO[gameVersion].label} is coming soon. Design your tabard below for now.`
              : !enabled
              ? "Battle.net isn't connected on this site, so the tabard can't be read from the game. Design it below instead."
              : preLaunch
                ? "Importing opens once WoW: Forever characters exist. Until launch, design your tabard below; after it, one click copies the emblem and colours from your guild in game."
                : "Copies the emblem and colours from your guild in game, using the Guild Master's linked Battle.net character. You can still adjust it afterwards."}
          </p>
        </div>
        {enabled && (
          <SubmitButton variant="ghost" size="sm" pendingLabel="Importing...">
            Import from the game
          </SubmitButton>
        )}
      </div>
      <FormMessage className="mt-3" />
    </ActionForm>
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
        Recreate your in-game guild tabard with the same emblems and colours as the game, on a Guildbook banner. Its background colour becomes the site&apos;s primary accent, the border colour
        its trim (headings, dividers, panel borders), and the emblem colour its highlights. Saving also regenerates the
        favicon, app icons, link preview and Discord icon.
      </p>
      <ImportTabard slug={guild.slug} gameVersion={guild.gameVersion} />
      <TabardBuilder
        key={tabardKey(look.tabard)}
        action={updateGuildTabardAction.bind(null, guild.slug)}
        initial={{ tabard: look.tabard, base: look.base as SelectableBase, overrides: look.overrides }}
        guild={{ name: guild.name, motto: guild.motto }}
      />
    </Panel>
  );
}
