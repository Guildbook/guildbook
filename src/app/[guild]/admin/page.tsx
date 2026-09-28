import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { db } from "@/db";
import { can } from "@/lib/authz/policy";
import { formatDateTime } from "@/lib/format";
import { guildHref } from "@/lib/paths";
import { requirePage } from "@/server/context";
import { listApplications } from "@/server/services/applications";
import { listAuditLog } from "@/server/services/content";
import { getGuildSetup } from "@/server/services/guild-setup";
import { listMembers } from "@/server/services/ranks";
import { SetupCard } from "./setup/setup-card";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome({ params }: PageProps<"/[guild]/admin">) {
  const { guild: slug } = await params;
  const { guild, actor } = await requirePage(slug, "admin.area", guildHref(slug, "/admin"));
  const [pending, members, audit, setup] = await Promise.all([
    listApplications(db, actor, "pending"),
    listMembers(db, actor),
    listAuditLog(db, actor, 8),
    can(actor, "guild.settings") ? getGuildSetup(db, actor) : null,
  ]);
  const showSetup = setup && !setup.summary.dismissed && !setup.summary.complete;

  return (
    <div className="space-y-6">
      <PageHeader title={guild.preset === "order" ? "Chapter House" : "Guild Admin"} eyebrow="Officer administration" />
      {showSetup && <SetupCard slug={slug} summary={setup.summary} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href={guildHref(slug, "/admin/applications")} className="panel p-4 text-center hover:border-gold-dim">
          <p className="text-3xl font-bold text-gold">{pending.length}</p>
          <p className="text-sm text-muted">Pending applications</p>
        </Link>
        <Link href={guildHref(slug, "/admin/members")} className="panel p-4 text-center hover:border-gold-dim">
          <p className="text-3xl font-bold text-gold">{members.length}</p>
          <p className="text-sm text-muted">Active members</p>
        </Link>
        <div className="panel p-4 text-center">
          <p className="text-3xl font-bold text-gold">{guild.recruitmentOpen ? "Open" : "Closed"}</p>
          <p className="text-sm text-muted">Recruitment</p>
        </div>
      </div>
      <Panel title="Recent officer actions" actions={<Link href={guildHref(slug, "/admin/audit")} className="link text-sm">Full log</Link>}>
        <ul className="divide-y divide-line text-sm">
          {audit.map(({ entry, actorName, targetName }) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-gold">{actorName ?? "System"}</span>
                <code className="font-mono text-xs text-muted">{entry.action}</code>
                {targetName && <span>{targetName}</span>}
              </span>
              <span className="text-muted">{formatDateTime(entry.createdAt, guild.timezone)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
