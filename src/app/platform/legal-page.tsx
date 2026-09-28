import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { PageHeader } from "@/components/ui";
import { type LegalDoc, readLegal } from "@/server/legal";

export async function LegalPageView({ doc }: { doc: LegalDoc }) {
  const page = await readLegal(doc);
  const other = doc === "terms" ? { href: "/privacy", label: "Privacy Policy" } : { href: "/terms", label: "Terms of Service" };
  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader title={page.title} eyebrow="Guildbook">
        {page.updated && <>Last updated {page.updated}</>}
      </PageHeader>
      <div className="panel p-6 sm:p-8" data-testid="legal-body">
        <Markdown tone="dark">{page.body}</Markdown>
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        See also the{" "}
        <Link href={other.href} className="link">
          {other.label}
        </Link>
        .
      </p>
    </article>
  );
}
