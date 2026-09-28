import { redirect } from "next/navigation";
import { guildHref } from "@/lib/paths";

export default async function MembersIndex({ params }: PageProps<"/[guild]/members">) {
  const { guild: slug } = await params;
  redirect(guildHref(slug, "/members/characters"));
}
