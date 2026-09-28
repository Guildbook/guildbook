import type { Metadata } from "next";
import { LegalPageView } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "What Guildbook collects, why, who can see it, and your choices." };

export default function PrivacyPage() {
  return <LegalPageView doc="privacy" />;
}
