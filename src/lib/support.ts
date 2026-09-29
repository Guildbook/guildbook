import { z } from "zod";

/** What a support request is about, in the order the form lists them. */
export const SUPPORT_CATEGORIES = {
  account: { label: "Account and sign-in", description: "Discord sign-in, your profile, exporting or deleting your data" },
  guild_setup: { label: "Guild setup", description: "Creating a guild, subdomains, custom domains, ranks and pages" },
  battlenet: { label: "Battle.net verification", description: "Linking Battle.net, verifying characters or your guild" },
  vigil: { label: "Vigil desktop app", description: "The companion app, pairing and fight uploads" },
  billing: { label: "Billing", description: "Paid plans aren't live yet; ask about them here" },
  bug: { label: "Bug report", description: "Something is broken or looks wrong" },
  other: { label: "Other", description: "Anything else" },
} as const;

export type SupportCategory = keyof typeof SUPPORT_CATEGORIES;
export const SUPPORT_CATEGORY_KEYS = Object.keys(SUPPORT_CATEGORIES) as [SupportCategory, ...SupportCategory[]];

export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 20;
export const SUPPORT_MESSAGE_MAX = 5000;
/** Tickets one user may send in `SUPPORT_RATE_WINDOW_MS`. */
export const SUPPORT_RATE_LIMIT = 5;
export const SUPPORT_RATE_WINDOW_MS = 60 * 60 * 1000;

/** Recorded with each ticket so a reply doesn't have to ask for it. */
export interface SupportTicketContext {
  discordId?: string | null;
  discordUsername?: string | null;
  displayName?: string | null;
  /** The page the user came from, as the browser reported it. */
  page?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  host?: string | null;
}

const optionalId = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid("Choose one of your guilds").nullable());

export const supportTicketInput = z.object({
  category: z.enum(SUPPORT_CATEGORY_KEYS, "Choose a category"),
  guildId: optionalId,
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(SUPPORT_SUBJECT_MAX, `Subject must be at most ${SUPPORT_SUBJECT_MAX} characters`),
  message: z
    .string()
    .trim()
    .min(SUPPORT_MESSAGE_MIN, `Tell us a little more: at least ${SUPPORT_MESSAGE_MIN} characters`)
    .max(SUPPORT_MESSAGE_MAX, `Message must be at most ${SUPPORT_MESSAGE_MAX} characters`),
  replyTo: z
    .string()
    .trim()
    .max(254, "Email is too long")
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Enter an email address like you@example.com").nullable()),
});

export type SupportTicketInput = z.infer<typeof supportTicketInput>;

/** The short reference shown to the user and in the email subject, e.g. `GB-1A2B3C4D`. */
export function ticketReference(id: string): string {
  return `GB-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
