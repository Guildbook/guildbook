"use client";

import { useEffect, useState } from "react";
import { ActionForm, Field, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { Listbox, type ListboxOption } from "@/components/listbox";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_KEYS,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_SUBJECT_MAX,
  type SupportCategory,
} from "@/lib/support";
import { submitSupportTicketAction } from "@/server/actions/support";

/** Summary labels for every field `supportTicketInput` validates. */
export const SUPPORT_LABELS = {
  category: "Category",
  guildId: "Related guild",
  subject: "Subject",
  message: "Message",
  replyTo: "Reply-to email",
} as const;

const CATEGORY_OPTIONS: ListboxOption[] = SUPPORT_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: SUPPORT_CATEGORIES[key].label,
  description: SUPPORT_CATEGORIES[key].description,
}));

export function SupportForm({
  guilds,
  defaultCategory,
  defaultEmail,
  context,
}: {
  guilds: { id: string; name: string; detail: string }[];
  defaultCategory?: SupportCategory;
  defaultEmail: string;
  context: { userId: string; discordName: string; appVersion: string };
}) {
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("");
  const [userAgent, setUserAgent] = useState("");

  useEffect(() => {
    // The referring page and browser are only known in the browser, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(document.referrer);
    setUserAgent(navigator.userAgent);
  }, []);

  const guildOptions: ListboxOption[] = [
    { value: "", label: "No specific guild" },
    ...guilds.map((g) => ({ value: g.id, label: g.name, description: g.detail })),
  ];
  const length = message.trim().length;

  return (
    <ActionForm action={submitSupportTicketAction} className="space-y-5" labels={SUPPORT_LABELS}>
      <input type="hidden" name="page" value={page} />

      <Field label="Category" name="category">
        <Listbox
          id="category"
          name="category"
          options={CATEGORY_OPTIONS}
          defaultValue={defaultCategory}
          placeholder="Choose a category"
          required
          requiredMessage="Choose a category"
          data-testid="support-category"
        />
      </Field>

      {guilds.length > 0 && (
        <Field label="Related guild" name="guildId" hint="Optional. Pick the guild this is about, if any.">
          <Listbox id="guildId" name="guildId" options={guildOptions} defaultValue="" data-testid="support-guild" />
        </Field>
      )}

      <Field label="Subject" name="subject">
        <input id="subject" name="subject" className="field" required maxLength={SUPPORT_SUBJECT_MAX} placeholder="Short summary" />
      </Field>

      <div>
        <label htmlFor="message" className="field-label">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          className="field min-h-40"
          required
          maxLength={SUPPORT_MESSAGE_MAX}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-describedby="message-hint"
          placeholder="What happened, what you expected, and any steps to reproduce it"
        />
        <p id="message-hint" className="mt-1 flex justify-between gap-2 text-xs text-muted">
          <span>At least {SUPPORT_MESSAGE_MIN} characters.</span>
          <span className={length > 0 && length < SUPPORT_MESSAGE_MIN ? "text-red-300" : undefined} data-testid="support-message-count">
            {length}/{SUPPORT_MESSAGE_MAX}
          </span>
        </p>
        <FieldError name="message" />
      </div>

      <Field
        label="Reply-to email"
        name="replyTo"
        hint="Optional. Discord doesn't always share your email with us; leave this blank and we'll reply via Discord."
      >
        <input id="replyTo" name="replyTo" type="email" className="field" defaultValue={defaultEmail} maxLength={254} autoComplete="email" />
      </Field>

      <details className="rounded border border-line px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer text-bone/80">Sent with your request</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all">
          <dt className="text-gold-dim">User ID</dt>
          <dd className="font-mono">{context.userId}</dd>
          <dt className="text-gold-dim">Discord</dt>
          <dd>{context.discordName}</dd>
          <dt className="text-gold-dim">Page</dt>
          <dd>{page || "This page"}</dd>
          <dt className="text-gold-dim">Browser</dt>
          <dd>{userAgent || "Your browser"}</dd>
          <dt className="text-gold-dim">App version</dt>
          <dd className="font-mono">{context.appVersion}</dd>
        </dl>
      </details>

      <FormMessage />
      <SubmitButton variant="gold" pendingLabel="Sending…">
        Send request
      </SubmitButton>
    </ActionForm>
  );
}
