import "server-only";
import { Resend } from "resend";

export interface EmailMessage {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
}

export interface EmailTransport {
  name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

export type EmailOutcome =
  | { status: "sent"; transport: string; id: string | null }
  | { status: "skipped"; reason: string }
  | { status: "failed"; transport: string; error: string };

export function resendTransport(apiKey: string): EmailTransport {
  const client = new Resend(apiKey);
  return {
    name: "resend",
    async send(message) {
      const { data, error } = await client.emails.send({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });
      if (error) throw new Error(`${error.name}: ${error.message}`);
      return { id: data?.id ?? null };
    },
  };
}

const globalOutbox = globalThis as unknown as { __guildbookMockOutbox?: EmailMessage[] };

/** Messages the mock transport has "sent" in this process, newest last. */
export function mockOutbox(): EmailMessage[] {
  return (globalOutbox.__guildbookMockOutbox ??= []);
}

/** Records messages instead of sending them; test mode and e2e use it so nothing leaves the machine. */
export function mockTransport(outbox: EmailMessage[] = mockOutbox()): EmailTransport {
  return {
    name: "mock",
    async send(message) {
      outbox.push(message);
      if (outbox.length > 100) outbox.shift();
      console.info(`[email] mock transport recorded "${message.subject}"`);
      return { id: `mock-${outbox.length}` };
    },
  };
}

/**
 * The mock transport under AUTH_TEST_MODE or EMAIL_MOCK, Resend when RESEND_API_KEY is set, otherwise none (callers
 * log the send as skipped).
 */
export function emailTransportFromEnv(env: Record<string, string | undefined> = process.env): EmailTransport | null {
  if (env.AUTH_TEST_MODE === "1" || env.EMAIL_MOCK === "1") return mockTransport();
  const key = env.RESEND_API_KEY?.trim();
  return key ? resendTransport(key) : null;
}

/** Sends through `transport`, turning a missing transport or a provider error into an outcome instead of throwing. */
export async function sendEmail(transport: EmailTransport | null, message: EmailMessage): Promise<EmailOutcome> {
  if (!transport) return { status: "skipped", reason: "No email provider is configured" };
  try {
    const { id } = await transport.send(message);
    return { status: "sent", transport: transport.name, id };
  } catch (err) {
    return { status: "failed", transport: transport.name, error: err instanceof Error ? err.message : String(err) };
  }
}
