"use client";

import { useEffect, useState, useTransition } from "react";
import { createCompanionPairingCodeAction, type PairingCodeResult } from "@/server/actions/vigil";

/** Custom URL scheme the companion registers; opening it fills in the pairing form in the app. */
const COMPANION_SCHEME = "vigil-companion";

function useSecondsLeft(expiresAt: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return expiresAt ? Math.max(0, Math.round((Date.parse(expiresAt) - now) / 1000)) : 0;
}

export function CompanionPairing({ slug }: { slug: string }) {
  const [result, setResult] = useState<PairingCodeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const code = result?.ok ? result.code : null;
  const secondsLeft = useSecondsLeft(result?.ok ? result.expiresAt : null);
  const expired = Boolean(code) && secondsLeft === 0;

  const create = () =>
    startTransition(async () => {
      setCopied(false);
      setResult(await createCompanionPairingCodeAction(slug));
    });

  // The code alone names the guild: the companion redeems it on the apex, which answers with this site's address.
  const link = code ? `${COMPANION_SCHEME}://pair?code=${encodeURIComponent(code)}` : null;

  return (
    <div className="space-y-4">
      {code && !expired ? (
        <div className="rounded border border-gold-dim bg-ink/40 p-4 text-center" data-testid="companion-pairing-code">
          <p className="text-xs tracking-widest text-muted uppercase">Pairing code</p>
          <p className="my-2 font-display text-4xl font-bold tracking-[0.2em] text-gold-bright select-all" aria-label="Pairing code">
            {code}
          </p>
          <p className="text-sm text-muted" role="timer">
            Works once. Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            {link && (
              <a href={link} className="btn btn-primary btn-sm">
                Open in the companion
              </a>
            )}
          </div>
        </div>
      ) : (
        expired && <p className="text-sm text-muted">That code expired. Create a new one.</p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-sm text-red-300">
          {result.error}
        </p>
      )}
      <button type="button" className="btn btn-primary" onClick={create} disabled={pending}>
        {pending ? "Creating…" : code && !expired ? "Create a new code" : "Create pairing code"}
      </button>
    </div>
  );
}
