import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { guildHref } from "@/lib/paths";

export default async function DeniedPage({ params }: PageProps<"/[guild]/denied">) {
  const { guild: slug } = await params;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="The Gate Is Barred" />
      <Panel>
        <p className="mb-4">Your rank does not grant access to that page.</p>
        <Link href={guildHref(slug, "/")} className="btn btn-ghost">
          Return home
        </Link>
      </Panel>
    </div>
  );
}
