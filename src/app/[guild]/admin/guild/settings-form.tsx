import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { FactionChoice } from "@/components/faction-choice";
import { GameVersionBadge } from "@/components/game-version";
import { RealmSelect } from "@/components/realm-select";
import { RegionChoice } from "@/components/region";
import { RulesetChoice } from "@/components/ruleset";
import { TimezoneSelect } from "@/components/timezone-select";
import type { Faction, Region, Ruleset } from "@/lib/game";
import { type GuildVersion, VERSION_INFO } from "@/lib/game-versions";
import type { ActionResult } from "@/server/action-types";

/** Summary labels for every field `guildSettingsInput` validates. */
export const GUILD_SETTINGS_LABELS = {
  name: "Name",
  motto: "Motto",
  description: "Home page description",
  timezone: "Server timezone",
  region: "Region",
  realmSlug: "Realm",
  faction: "Faction",
  ruleset: "Ruleset",
  discordInviteUrl: "Discord invite link",
  recruitmentOpen: "Recruitment",
  directoryListed: "Directory listing",
  lootPublic: "Loot ledger visibility",
} as const;

export interface GuildSettingsValues {
  name: string;
  motto: string | null;
  description: string;
  timezone: string;
  gameVersion: GuildVersion;
  realmSlug: string | null;
  region: Region;
  faction: Faction;
  ruleset: Ruleset;
  discordInviteUrl: string | null;
  recruitmentOpen: boolean;
  directoryListed: boolean;
  lootPublic: boolean;
  verifiedAt: Date | null;
}

export function GuildSettingsForm({
  action,
  guild,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  guild: GuildSettingsValues;
}) {
  const realms = VERSION_INFO[guild.gameVersion].realms;
  const verified = Boolean(guild.verifiedAt);
  return (
    <ActionForm action={action} className="space-y-4" labels={GUILD_SETTINGS_LABELS}>
      <Field label="Name" name="name">
        <input id="name" name="name" className="field" defaultValue={guild.name} required />
      </Field>
      <Field label="Motto" name="motto">
        <input id="motto" name="motto" className="field" defaultValue={guild.motto ?? ""} />
      </Field>
      <Field label="Home page description" name="description">
        <textarea id="description" name="description" className="field" defaultValue={guild.description} />
      </Field>
      <Field label="Server timezone" name="timezone" hint="Raid times and loot dates are shown in this timezone.">
        <TimezoneSelect defaultValue={guild.timezone} required />
      </Field>
      <div>
        <p className="field-label">Game version</p>
        <p className="flex items-center gap-2 text-sm text-bone" data-testid="settings-game-version">
          <GameVersionBadge version={guild.gameVersion} always />
          {VERSION_INFO[guild.gameVersion].label}
        </p>
        <p className="mt-1 text-xs text-muted">A guild&apos;s game version can&apos;t be changed.</p>
      </div>
      {realms ? (
        <div>
          <label htmlFor="realmSlug" className="field-label">
            Realm
          </label>
          <input type="hidden" name="region" value={guild.region} />
          <RealmSelect version={guild.gameVersion} defaultValue={guild.realmSlug ?? ""} disabled={verified} />
          <p className="mt-1 text-xs text-muted">
            {verified
              ? "Your guild is verified, so its realm can't change. Changing its name or faction removes the verification until you verify again."
              : "Name, realm and faction identify your guild on Guildbook and must match the in-game guild. The realm sets the region and ruleset."}
          </p>
          <FieldError name="realmSlug" />
          <FieldError name="region" />
        </div>
      ) : (
        <fieldset>
          <legend className="field-label">Region</legend>
          <RegionChoice defaultValue={guild.region} />
          <FieldError name="region" />
        </fieldset>
      )}
      <fieldset>
        <legend className="field-label">Faction</legend>
        <FactionChoice defaultValue={guild.faction} />
        <FieldError name="faction" />
      </fieldset>
      {!realms && (
        <fieldset>
          <legend className="field-label">Ruleset</legend>
          <RulesetChoice defaultValue={guild.ruleset} />
          <p className="mt-1 text-xs text-muted">
            {verified
              ? "Your guild is verified. Changing its name, region, faction or ruleset removes the verification until you verify again."
              : "Name, region, faction and ruleset identify your guild on Guildbook and must match the in-game guild to verify it."}
          </p>
          <FieldError name="ruleset" />
        </fieldset>
      )}
      <Field label="Discord invite link" name="discordInviteUrl" hint="Shown in the site footer, e.g. https://discord.gg/yourcode">
        <input
          id="discordInviteUrl"
          name="discordInviteUrl"
          type="url"
          className="field"
          defaultValue={guild.discordInviteUrl ?? ""}
          placeholder="https://discord.gg/"
        />
      </Field>
      <div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="recruitmentOpen" defaultChecked={guild.recruitmentOpen} className="h-5 w-5 accent-crimson" />
          Recruitment open
        </label>
        <FieldError name="recruitmentOpen" />
      </div>
      <div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="directoryListed" defaultChecked={guild.directoryListed} className="h-5 w-5 accent-crimson" />
          List this guild in the public Guildbook directory
        </label>
        <FieldError name="directoryListed" />
      </div>
      <div>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="lootPublic" defaultChecked={guild.lootPublic} className="h-5 w-5 accent-crimson" />
          Show the loot ledger to visitors (members always see it)
        </label>
        <FieldError name="lootPublic" />
      </div>
      <FormMessage />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}
