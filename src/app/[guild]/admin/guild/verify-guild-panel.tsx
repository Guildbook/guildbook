import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Panel, Tag } from "@/components/ui";
import { VerifiedSeal } from "@/components/verified-seal";
import { db } from "@/db";
import { formatDate } from "@/lib/format";
import { FACTION_LABELS, RULESET_INFO } from "@/lib/game";
import { VERIFICATION_GRACE_DAYS } from "@/lib/guild-identity";
import { guildHref } from "@/lib/paths";
import { claimGuildNameAction, claimGuildSlugAction, verifyGuildAction } from "@/server/actions/verification";
import { battlenetEnabled, blizzardConfigFromEnv } from "@/server/blizzard";
import type { Guild } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { getSlugClaim, isPreLaunch } from "@/server/services/guild-verification";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Guild Settings: explains verification, runs the check on demand, and offers name and subdomain claims. */
export async function VerifyGuildPanel({ guild }: { guild: Guild }) {
  const [slugClaim, current] = await Promise.all([getSlugClaim(db, guild), getRequestHost()]);
  const enabled = battlenetEnabled(blizzardConfigFromEnv());
  const verified = Boolean(guild.verifiedAt);
  const result = guild.verificationResult;
  const preLaunch = isPreLaunch(new Date());
  const claim = !verified && result?.claim ? result.claim : null;
  const lapseOn = guild.verificationFailingSince
    ? new Date(guild.verificationFailingSince.getTime() + VERIFICATION_GRACE_DAYS * DAY_MS)
    : null;
  const claimHost = slugClaim ? guildOrigin(slugClaim.slug, current).replace(/^https?:\/\//, "") : null;

  return (
    <Panel
      title="Verify guild"
      actions={verified ? <VerifiedSeal label size={14} /> : <Tag>Not verified</Tag>}
    >
      <div className="space-y-4 text-sm" data-testid="verify-guild">
        <p className="leading-relaxed text-muted">
          Verified guilds show a seal across Guildbook and come first in the directory. To verify, the Guild Master links
          Battle.net on{" "}
          <Link href={guildHref(guild.slug, "/members/characters")} className="link">
            My Characters
          </Link>
          . One of their WoW: Forever characters must be Guild Master (rank 0) of an in-game guild named exactly{" "}
          <strong className="text-bone">{guild.name}</strong>, {FACTION_LABELS[guild.faction]}, on the{" "}
          {RULESET_INFO[guild.ruleset].label} ruleset. Guildbook checks again every day; after {VERIFICATION_GRACE_DAYS} days of
          failed checks the seal is removed.
        </p>

        {!verified && preLaunch && (
          <p className="rounded border border-gold-dim/60 bg-gold/5 px-3 py-2 text-bone" data-testid="verify-prelaunch">
            Verification opens once WoW: Forever characters are available. Forever launches on Nov 4, 2026, and Blizzard
            doesn&apos;t publish Forever characters before then.
          </p>
        )}
        {!enabled && <p className="text-muted italic">Battle.net isn&apos;t configured on this site yet.</p>}

        {verified && guild.verifiedAt && (
          <p className="text-bone">
            Verified on {formatDate(guild.verifiedAt, guild.timezone)}
            {guild.verifiedCharacterName && <>: {guild.verifiedCharacterName} is the in-game Guild Master</>}.
          </p>
        )}
        {verified && lapseOn && (
          <p className="text-red-300" data-testid="verify-grace">
            The last checks failed. Unless a check succeeds, the seal is removed on {formatDate(lapseOn, guild.timezone)}.
          </p>
        )}
        {result && (!verified || !result.verified) && (
          <div className="rounded border border-line px-3 py-2" data-testid="verify-result">
            <p className={result.verified ? "text-emerald-300" : "text-bone"}>{result.message}</p>
            {guild.verificationCheckedAt && (
              <p className="mt-1 text-xs text-muted">Checked {formatDate(guild.verificationCheckedAt, guild.timezone)}</p>
            )}
          </div>
        )}

        <ActionForm action={verifyGuildAction.bind(null, guild.slug)}>
          <SubmitButton variant="ghost" size="sm" pendingLabel="Checking…">
            {verified ? "Check again" : "Check verification"}
          </SubmitButton>
          <FormMessage className="mt-2" />
        </ActionForm>

        {claim && (
          <div className="space-y-2 border-t border-line pt-4" data-testid="claim-name">
            <h3 className="font-display text-sm tracking-wide text-gold">Your in-game guild is {claim.name}</h3>
            {claim.holderVerified ? (
              <p className="text-muted">
                A verified guild on Guildbook already uses that name, faction and ruleset, so it can&apos;t be claimed. Contact the
                Guildbook team if you think this is a mistake.
              </p>
            ) : (
              <>
                <p className="text-muted">
                  {claim.holderName
                    ? `An unverified guild, ${claim.holderName}, holds that name on Guildbook. As the in-game Guild Master you can claim it: your guild is renamed ${claim.name} and verified, and the other guild is renamed "${claim.name} (unverified)" with a notice to its admins. Subdomains and custom domains don't move.`
                    : `No other guild uses that name. Take it to rename your guild ${claim.name} and verify it.`}
                </p>
                <ActionForm
                  action={claimGuildNameAction.bind(null, guild.slug)}
                  confirm={
                    claim.holderName
                      ? `Claim the name ${claim.name}? ${claim.holderName} will be renamed.`
                      : `Rename your guild ${claim.name} and verify it?`
                  }
                >
                  <SubmitButton size="sm" pendingLabel="Claiming…">
                    {claim.holderName ? `Claim ${claim.name}` : `Take the name ${claim.name}`}
                  </SubmitButton>
                  <FormMessage className="mt-2" />
                </ActionForm>
              </>
            )}
          </div>
        )}

        {slugClaim && claimHost && (
          <div className="space-y-2 border-t border-line pt-4" data-testid="claim-slug">
            <h3 className="font-display text-sm tracking-wide text-gold">Subdomain</h3>
            <p className="text-muted">
              {slugClaim.holderName
                ? `${claimHost} matches your guild's name and is held by an unverified guild, ${slugClaim.holderName}. As a verified guild you can claim it: that guild moves to a numbered subdomain and its admins are told why.`
                : `${claimHost} matches your guild's name and is free.`}{" "}
              Your current subdomain is released and won&apos;t redirect, so update links you&apos;ve shared (and re-pair Vigil
              companions). Custom domains keep working.
            </p>
            <ActionForm
              action={claimGuildSlugAction.bind(null, guild.slug)}
              confirm={`Move your guild to ${claimHost}? Your current subdomain stops working.`}
            >
              <SubmitButton size="sm" variant="ghost" pendingLabel="Moving…">
                Move to {claimHost}
              </SubmitButton>
              <FormMessage className="mt-2" />
            </ActionForm>
          </div>
        )}
      </div>
    </Panel>
  );
}
