import type { Metadata } from "next";
import { LegalPageView } from "../legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: "The terms for using Guildbook and its guild sites." };

export default function TermsPage() {
  return <LegalPageView doc="terms" />;
}
