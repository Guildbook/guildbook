import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { Listbox } from "@/components/listbox";
import { Panel, Tag } from "@/components/ui";
import { db } from "@/db";
import { TIER_LABELS } from "@/lib/authz/tiers";
import type { Guild } from "@/server/context";
import { updateConfirmedJoinSettingsAction } from "@/server/actions/admin";
import { CONFIRMED_JOIN_TIERS } from "@/server/services/confirmed-members";
import { listRanks } from "@/server/services/ranks";

/** Whether members Battle.net confirms in the in-game guild join without review, and at which rank. */
export async function ConfirmedJoinPanel({ guild }: { guild: Guild }) {
  const ranks = await listRanks(db, guild.id);
  const accept = ranks.find((r) => r.id === guild.acceptRankId);
  const choices = ranks.filter((r) => CONFIRMED_JOIN_TIERS.includes(r.tier));
  const options = [
    {
      value: "",
      label: accept ? `Same as accepted applicants (${accept.name})` : "Same as accepted applicants",
      description: "Follows the rank set under Ranks",
    },
    ...choices.map((r) => ({ value: r.id, label: r.name, description: TIER_LABELS[r.tier] })),
  ];

  return (
    <Panel title="Members confirmed in game" actions={guild.verifiedAt ? undefined : <Tag>Needs verification</Tag>}>
      <ActionForm action={updateConfirmedJoinSettingsAction.bind(null, guild.slug)} className="space-y-4 text-sm">
        <p className="leading-relaxed text-muted">
          When someone with a linked Battle.net account opens your application page and Battle.net shows one of their
          characters in your in-game guild, they can join in one click after accepting the charter. Admins get a notice
          for every join.
          {!guild.verifiedAt && " This only applies once the guild is verified."}
        </p>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="autoApproveInGuild"
            defaultChecked={guild.autoApproveInGuild}
            className="mt-0.5 h-5 w-5 accent-crimson"
            data-testid="auto-approve-toggle"
          />
          <span>Let members confirmed in game join without application review</span>
        </label>
        <Field label="Rank they join at" name="autoApproveRankId">
          <Listbox id="autoApproveRankId" name="autoApproveRankId" options={options} defaultValue={guild.autoApproveRankId ?? ""} />
        </Field>
        <FormMessage />
        <SubmitButton variant="ghost">Save</SubmitButton>
      </ActionForm>
    </Panel>
  );
}
