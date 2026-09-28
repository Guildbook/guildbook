import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ApplicationForm } from "@/components/application-form";
import { BattlenetAccount, BattlenetNotice, EmptySnapshotNote, LinkBattlenetButton } from "@/components/battlenet";
import { ClassName, PageHeader, Panel, StatusPill, VerifiedMark } from "@/components/ui";
import { db } from "@/db";
import { can } from "@/lib/authz/policy";
import { formatDate } from "@/lib/format";
import { FACTION_LABELS, fullName } from "@/lib/game";
import { guildHref } from "@/lib/paths";
import { applyAction, withdrawApplicationAction } from "@/server/actions/member";
import { getGuild, getViewer } from "@/server/context";
import { battlenetEnabled, blizzardConfigFromEnv } from "@/server/blizzard";
import { listOwnApplications } from "@/server/services/applications";
import { getEligibleCharacters } from "@/server/services/battlenet";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage({ params, searchParams }: PageProps<"/[guild]/apply">) {
  const { guild: slug } = await params;
  const sp = await searchParams;
  const guild = await getGuild(slug);
  const viewer = await getViewer(guild.id);
  const order = guild.preset === "order";
  const title = order ? "Apply to the Order" : `Apply to ${guild.name}`;
  const eyebrow = order ? "Postulancy" : "Recruitment";

  if (!viewer.user) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={title} eyebrow={eyebrow} />
        <Panel>
          <p className="mb-4 leading-relaxed">
            {order && "The Order of Saint Michael is a Catholic guild, open to every player who respects the faith. "}
            Sign in with Discord to begin your application. We use your Discord account to contact you and to give you
            guild roles.
          </p>
          <Link
            href={`${guildHref(slug, "/login")}?callbackUrl=${encodeURIComponent(guildHref(slug, "/apply"))}`}
            className="btn btn-primary w-full"
          >
            Sign in with Discord to apply
          </Link>
        </Panel>
      </div>
    );
  }

  if (can(viewer.actor, "member.area")) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title={title} />
        <Panel>
          <p>
            You are already a member of {order ? "the Order" : guild.name}
            {viewer.rank ? ` (${viewer.rank.name})` : ""}.{order && " Pax tecum."}
          </p>
        </Panel>
      </div>
    );
  }

  const history = await listOwnApplications(db, viewer.actor);
  const pending = history.find((a) => a.status === "pending");
  const bnetEnabled = battlenetEnabled(blizzardConfigFromEnv());
  const bnet = bnetEnabled ? await getEligibleCharacters(db, viewer.actor) : { link: null, characters: [] };
  const applyHref = guildHref(slug, "/apply");
  const showForm = !pending && guild.recruitmentOpen;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={title} eyebrow={eyebrow}>
        {showForm && (
          <>
            Please read the{" "}
            <Link href={guildHref(slug, "/charter")} className="link">
              Charter
            </Link>{" "}
            before applying.
          </>
        )}
      </PageHeader>

      <BattlenetNotice status={sp.bnet} />

      {pending ? (
        <Panel title="Your application" actions={<StatusPill status={pending.status} />}>
          <p className="mb-4">
            <ClassName wowClass={pending.wowClass}>{fullName(pending.characterName, pending.characterSurname)}</ClassName>
            {pending.verified && <VerifiedMark className="ml-1" />} — submitted{" "}
            {formatDate(pending.createdAt, guild.timezone)}. An officer will review it and contact you on Discord.
          </p>
          <ActionForm action={withdrawApplicationAction.bind(null, slug, pending.id)} confirm="Withdraw your application?">
            <SubmitButton variant="ghost" size="sm">
              Withdraw application
            </SubmitButton>
            <FormMessage className="mt-2" />
          </ActionForm>
        </Panel>
      ) : !guild.recruitmentOpen ? (
        <Panel>
          <p>Recruitment is closed at the moment. Please check back soon, or reach out on Discord.</p>
        </Panel>
      ) : (
        <Panel>
          {bnetEnabled && (
            <div className="mb-5 space-y-3 border-b border-line pb-5">
              {bnet.link ? (
                <>
                  <BattlenetAccount link={bnet.link} slug={slug} returnTo={applyHref} timezone={guild.timezone} />
                  {bnet.characters.length === 0 && (
                    <EmptySnapshotNote link={bnet.link} factionLabel={guild.faction ? FACTION_LABELS[guild.faction] : null} />
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm text-muted">
                    Link Battle.net to pick your character, so officers see verified name, class and level. You can also
                    enter your character by hand below; officers will see it as Unverified.
                  </p>
                  <LinkBattlenetButton slug={slug} returnTo={applyHref} />
                </div>
              )}
            </div>
          )}
          <ApplicationForm
            action={applyAction.bind(null, slug)}
            characters={bnet.characters}
            showFaction={!guild.faction}
            defaultDiscord={viewer.user.name ?? ""}
            guildName={guild.name}
            faithPledge={order}
          />
        </Panel>
      )}

      {history.filter((a) => a.status !== "pending").length > 0 && (
        <Panel title="Previous applications">
          <ul className="divide-y divide-line text-sm">
            {history
              .filter((a) => a.status !== "pending")
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span className="flex flex-wrap items-baseline gap-x-3">
                    <span>{fullName(a.characterName, a.characterSurname)}</span>
                    <span className="text-xs text-muted">Applied {formatDate(a.createdAt, guild.timezone)}</span>
                  </span>
                  <StatusPill status={a.status} />
                </li>
              ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
