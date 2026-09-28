import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { AddonIcon } from "@/components/addon-icon";
import { BattlenetAccount, BattlenetNotice, EmptySnapshotNote, LinkBattlenetButton } from "@/components/battlenet";
import {
  CharacterLink,
  ClassName,
  EmptyState,
  FactionBadge,
  PageHeader,
  Panel,
  RoleBadge,
  Tag,
  VerifiedMark,
} from "@/components/ui";
import { db } from "@/db";
import type { BattlenetCharacterSnapshot } from "@/db/schema";
import { formatDateTime } from "@/lib/format";
import { CLASS_INFO, fullName, PROFESSION_LABELS, ROLE_LABELS, ROLES } from "@/lib/game";
import { guildHref } from "@/lib/paths";
import { importBattlenetCharacterAction } from "@/server/actions/battlenet";
import { archiveCharacterAction, setMainCharacterAction } from "@/server/actions/member";
import { battlenetEnabled, blizzardConfigFromEnv } from "@/server/blizzard";
import { requirePage } from "@/server/context";
import { getEligibleCharacters } from "@/server/services/battlenet";
import { type CharacterWithProfessions, listOwnCharacters } from "@/server/services/characters";

export const metadata: Metadata = { title: "My Characters" };

function ImportRow({
  slug,
  bnet,
  existing,
}: {
  slug: string;
  bnet: BattlenetCharacterSnapshot;
  existing: CharacterWithProfessions | undefined;
}) {
  const info = CLASS_INFO[bnet.wowClass];
  const summary = (
    <div className="min-w-0">
      <p className="font-semibold" style={{ color: info.color }}>
        {bnet.name}
      </p>
      <p className="text-xs text-muted">
        Level {bnet.level} {bnet.race} {info.label}
      </p>
      {bnet.guildName && <p className="text-xs text-gold-dim">&lt;{bnet.guildName}&gt;</p>}
    </div>
  );

  if (existing?.bnetCharacterId === bnet.id) {
    return (
      <li className="flex items-center justify-between gap-3 py-3">
        {summary}
        <span className="flex items-center gap-1.5 text-xs text-gold">
          <VerifiedMark size={12} decorative />
          Imported as {fullName(existing.name, existing.surname)}
        </span>
      </li>
    );
  }

  return (
    <li className="py-3">
      <ActionForm action={importBattlenetCharacterAction.bind(null, slug)} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="bnetCharacterId" value={bnet.id} />
        <div className="w-full">{summary}</div>
        {bnet.surname ? (
          <input type="hidden" name="surname" value={bnet.surname} />
        ) : (
          <label className="flex flex-col text-xs text-muted">
            Surname
            <input
              name="surname"
              required
              maxLength={12}
              autoComplete="off"
              defaultValue={existing?.surname}
              aria-label={`${bnet.name} surname`}
              className="field mt-1 min-h-9 w-32 py-1 text-sm"
            />
          </label>
        )}
        <label className="flex flex-col text-xs text-muted">
          Spec
          <select
            name="spec"
            defaultValue={existing?.spec}
            aria-label={`${bnet.name} spec`}
            className="field mt-1 min-h-9 w-36 py-1 text-sm"
          >
            {info.specs.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-muted">
          Role
          <select
            name="role"
            defaultValue={existing?.role}
            aria-label={`${bnet.name} role`}
            className="field mt-1 min-h-9 w-32 py-1 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton size="sm" pendingLabel="Importing…">
          {existing ? "Verify" : "Import"}
        </SubmitButton>
        <FormMessage className="w-full" />
      </ActionForm>
    </li>
  );
}

export default async function CharactersPage({ params, searchParams }: PageProps<"/[guild]/members/characters">) {
  const { guild: slug } = await params;
  const sp = await searchParams;
  const returnTo = guildHref(slug, "/members/characters");
  const { guild, actor } = await requirePage(slug, "character.manageOwn", returnTo);
  const bnetEnabled = battlenetEnabled(blizzardConfigFromEnv());
  const [characters, bnet] = await Promise.all([
    listOwnCharacters(db, actor),
    bnetEnabled ? getEligibleCharacters(db, actor) : Promise.resolve({ link: null, characters: [] }),
  ]);
  const matchFor = (b: BattlenetCharacterSnapshot) =>
    characters.find((c) => c.bnetCharacterId === b.id) ??
    characters.find((c) => !c.bnetCharacterId && c.name.toLowerCase() === b.name.toLowerCase());
  const toImport = bnet.characters.filter((b) => characters.every((c) => c.bnetCharacterId !== b.id)).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="My Characters" />
      <BattlenetNotice status={sp.bnet} />

      {bnetEnabled && (
        <Panel>
          {bnet.link ? (
            <div className="space-y-3">
              <BattlenetAccount link={bnet.link} slug={slug} returnTo={returnTo} timezone={guild.timezone} />
              {bnet.characters.length === 0 ? (
                <EmptySnapshotNote link={bnet.link} faction={guild.faction} />
              ) : (
                <details className="group" open={sp.bnet === "linked" || undefined}>
                  <summary className="btn btn-primary btn-sm cursor-pointer list-none">
                    Import characters{toImport > 0 ? ` (${toImport})` : ""}
                  </summary>
                  <p className="mt-3 text-xs text-muted">
                    Name, class and level come from Battle.net and are kept in sync. Pick your spec and role, and
                    enter your surname if Battle.net doesn&apos;t provide it.
                  </p>
                  <ul className="divide-y divide-line">
                    {bnet.characters.map((b) => (
                      <ImportRow key={b.id} slug={slug} bnet={b} existing={matchFor(b)} />
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm text-muted">
                Link Battle.net to import your characters as verified and keep their levels in sync.
              </p>
              <LinkBattlenetButton slug={slug} returnTo={returnTo} />
            </div>
          )}
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link href={guildHref(slug, "/vigil")} className="inline-flex items-center gap-2 text-sm text-gold hover:underline">
          <AddonIcon icon="eye" size={24} />
          Review your fights in Vigil
        </Link>
        <Link href={guildHref(slug, "/members/characters/new")} className={`btn ${bnetEnabled ? "btn-ghost" : "btn-primary"}`}>
          Register character
        </Link>
      </div>
      {characters.length === 0 && <EmptyState>Register your first character to appear on the roster.</EmptyState>}
      <ul className="space-y-3">
        {characters.map((c) => (
          <li key={c.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-x-1.5 text-lg">
                  <CharacterLink guildSlug={slug} character={c} />
                  {c.verified && <VerifiedMark />}
                  {c.isMain && <span className="ml-1 text-xs tracking-widest text-gold uppercase">Main</span>}
                </p>
                <p className="text-sm text-muted">
                  Level {c.level} {c.spec} <ClassName wowClass={c.wowClass} />
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!guild.faction && <FactionBadge faction={c.faction} />}
                  <RoleBadge role={c.role} />
                  {!c.verified && <Tag>Unverified</Tag>}
                </div>
                {c.verified && c.syncedAt && (
                  <p className="mt-1 text-xs text-muted">Synced from Battle.net {formatDateTime(c.syncedAt, guild.timezone)}</p>
                )}
                {c.professions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.professions.map((p) => (
                      <Tag key={p.profession}>
                        {PROFESSION_LABELS[p.profession]}
                        {p.skill && <span className="ml-1 text-gold">{p.skill}</span>}
                      </Tag>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={guildHref(slug, `/members/characters/${c.id}`)} className="btn btn-ghost btn-sm">
                  Edit
                </Link>
                {!c.isMain && (
                  <ActionForm action={setMainCharacterAction.bind(null, slug, c.id)}>
                    <SubmitButton variant="ghost" size="sm">
                      Make main
                    </SubmitButton>
                  </ActionForm>
                )}
                <ActionForm action={archiveCharacterAction.bind(null, slug, c.id)} confirm={`Remove ${fullName(c.name, c.surname)} from your characters?`}>
                  <SubmitButton variant="danger" size="sm">
                    Remove
                  </SubmitButton>
                  <FormMessage />
                </ActionForm>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
