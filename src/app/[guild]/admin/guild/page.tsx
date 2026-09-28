import type { Metadata } from "next";
import { ActionForm, Field, FormMessage, SubmitButton } from "@/components/action-form";
import { FactionChoice } from "@/components/faction-choice";
import { RulesetChoice } from "@/components/ruleset";
import { PageHeader, Panel, Tag } from "@/components/ui";
import { db } from "@/db";
import { formatDate } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import { addDomainAction, removeDomainAction, updateGuildSettingsAction, verifyDomainAction } from "@/server/actions/admin";
import { requirePage } from "@/server/context";
import { getRequestHost, guildOrigin } from "@/server/hosts";
import { dnsInstructions, type GuildDomain, listGuildDomains, MAX_DOMAINS_PER_GUILD } from "@/server/services/domains";
import { vercelConfigFromEnv } from "@/server/vercel-domains";
import { DeleteGuildPanel } from "./delete-guild-panel";
import { TabardSection } from "./tabard-section";
import { VerifyGuildPanel } from "./verify-guild-panel";

export const metadata: Metadata = { title: "Guild Settings" };

const STATUS_LABELS: Record<GuildDomain["status"], { label: string; className: string }> = {
  pending: { label: "Waiting for DNS", className: "border-gold-dim text-gold" },
  verified: { label: "Verified", className: "border-emerald-700 text-emerald-300" },
  failed: { label: "Not verified", className: "border-crimson text-red-300" },
};

function DomainCard({ slug, domain, timezone }: { slug: string; domain: GuildDomain; timezone: string }) {
  const status = STATUS_LABELS[domain.status];
  return (
    <li className="space-y-3 rounded border border-line p-4" data-testid="custom-domain">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm break-all text-bone">{domain.domain}</p>
        <span className={`rounded border px-2 py-0.5 text-xs ${status.className}`}>{status.label}</span>
      </div>
      {domain.lastError && <p className="text-sm text-red-300">{domain.lastError}</p>}
      {domain.status !== "verified" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gold-dim">
              <tr>
                <th className="py-1 pr-3 font-normal">Type</th>
                <th className="py-1 pr-3 font-normal">Name</th>
                <th className="py-1 font-normal">Value</th>
              </tr>
            </thead>
            <tbody className="font-mono text-bone">
              {dnsInstructions(domain).map((r) => (
                <tr key={r.type} className="border-t border-line align-top">
                  <td className="py-1.5 pr-3">{r.type}</td>
                  <td className="py-1.5 pr-3 break-all">{r.name}</td>
                  <td className="py-1.5 break-all">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Added {formatDate(domain.createdAt, timezone)}
        {domain.lastCheckedAt && <>. Last checked {formatDate(domain.lastCheckedAt, timezone)}</>}
        {domain.verifiedAt && <>. Verified {formatDate(domain.verifiedAt, timezone)}</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionForm action={verifyDomainAction.bind(null, slug, domain.id)}>
          <SubmitButton size="sm" variant="ghost">
            {domain.status === "verified" ? "Recheck" : "Check verification"}
          </SubmitButton>
          <FormMessage className="mt-2" />
        </ActionForm>
        <ActionForm action={removeDomainAction.bind(null, slug, domain.id)} confirm={`Disconnect ${domain.domain}?`}>
          <SubmitButton size="sm" variant="danger">
            Remove
          </SubmitButton>
        </ActionForm>
      </div>
    </li>
  );
}

export default async function GuildSettingsPage({ params }: PageProps<"/[guild]/admin/guild">) {
  const { guild: slug } = await params;
  const { guild, actor } = await requirePage(slug, "guild.settings", guildHref(slug, "/admin/guild"));
  const [domains, current] = await Promise.all([listGuildDomains(db, guild.id), getRequestHost()]);
  const subdomain = guildOrigin(guild.slug, current);
  const vercelManaged = vercelConfigFromEnv() !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Guild Settings" />
      <Panel>
        <ActionForm action={updateGuildSettingsAction.bind(null, slug)} className="space-y-4">
          <Field label="Name" name="name">
            <input id="name" name="name" className="field" defaultValue={guild.name} required />
          </Field>
          <Field label="Motto" name="motto">
            <input id="motto" name="motto" className="field" defaultValue={guild.motto ?? ""} />
          </Field>
          <Field label="Home page description" name="description">
            <textarea id="description" name="description" className="field" defaultValue={guild.description} />
          </Field>
          <Field label="Server timezone" name="timezone" hint="IANA name, e.g. America/New_York or America/Los_Angeles">
            <input id="timezone" name="timezone" className="field" defaultValue={guild.timezone} required />
          </Field>
          <fieldset>
            <legend className="field-label">Faction</legend>
            <FactionChoice defaultValue={guild.faction} />
          </fieldset>
          <fieldset>
            <legend className="field-label">Ruleset</legend>
            <RulesetChoice defaultValue={guild.ruleset} />
            <p className="mt-1 text-xs text-muted">
              {guild.verifiedAt
                ? "Your guild is verified. Changing its name, faction or ruleset removes the verification until you verify again."
                : "Name, faction and ruleset identify your guild on Guildbook and must match the in-game guild to verify it."}
            </p>
          </fieldset>
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
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="recruitmentOpen" defaultChecked={guild.recruitmentOpen} className="h-5 w-5 accent-crimson" />
            Recruitment open
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="directoryListed" defaultChecked={guild.directoryListed} className="h-5 w-5 accent-crimson" />
            List this guild in the public Guildbook directory
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="lootPublic" defaultChecked={guild.lootPublic} className="h-5 w-5 accent-crimson" />
            Show the loot ledger to visitors (members always see it)
          </label>
          <FormMessage />
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
      </Panel>

      <VerifyGuildPanel guild={guild} />

      <TabardSection guild={guild} />

      <Panel title="Custom domains" actions={<Tag>Optional</Tag>}>
        <div className="space-y-4 text-sm">
          <p className="leading-relaxed text-muted">
            Your guild always lives at <span className="font-mono text-bone">{subdomain.replace(/^https?:\/\//, "")}</span>. You can
            also serve it on a domain you own, like <span className="font-mono text-bone">yourguild.org</span>. Add the domain, create the
            DNS records shown at your registrar, then check verification.
            {!vercelManaged && " Once it is verified, the Guildbook team connects it to the hosting project."}
          </p>
          {domains.length > 0 && (
            <ul className="space-y-3">
              {domains.map((d) => (
                <DomainCard key={d.id} slug={slug} domain={d} timezone={guild.timezone} />
              ))}
            </ul>
          )}
          {domains.length < MAX_DOMAINS_PER_GUILD && (
            <ActionForm action={addDomainAction.bind(null, slug)} className="space-y-3">
              <Field label="Domain" name="domain" hint="Without https://, e.g. yourguild.org or www.yourguild.org">
                <input id="domain" name="domain" className="field" placeholder="yourguild.org" autoComplete="off" required />
              </Field>
              <FormMessage />
              <SubmitButton variant="ghost">Add domain</SubmitButton>
            </ActionForm>
          )}
        </div>
      </Panel>

      <DeleteGuildPanel slug={slug} name={guild.name} actor={actor} />
    </div>
  );
}
