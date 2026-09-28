import clsx from "clsx";
import { scoreTone } from "@/lib/vigil/format";

/**
 * An illustration of the companion's live view, drawn with the site's own styles. The layout follows the app
 * (current fight, callouts, recent fights) and the callout wording matches what it says; the numbers are made up.
 */

const UPTIMES = [
  { label: "Shield Block", pct: 58, target: 60, up: true },
  { label: "Sunder Armor", pct: 96, target: 90, up: true },
];

const CALLOUTS: { t: string; kind: "proc" | "idle" | "resource"; text: string }[] = [
  { t: "2:51", kind: "proc", text: "Revenge was available for 2.4 s and went unused" },
  { t: "1:37", kind: "idle", text: "Idle for 2.1 s while Shield Slam was ready" },
  { t: "0:44", kind: "resource", text: "Rage capped for 1.8 s" },
];

const FIGHTS = [
  { name: "Garr", score: 91, detail: "2:58, 95% GCD, 1.1k TPS" },
  { name: "Magmadar", score: 78, detail: "3:12, 88% GCD, 986 TPS" },
];

const CALLOUT_TONE = { proc: "border-gold", idle: "border-crimson-bright", resource: "border-gold-dim" } as const;

function Label({ children }: { children: string }) {
  return <p className="font-display text-[0.65rem] font-semibold tracking-[0.2em] text-gold/80 uppercase">{children}</p>;
}

export function AppWindowMock() {
  return (
    <figure className="relative isolate mx-auto w-full max-w-md">
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgb(168_24_47/0.28),transparent_70%)] blur-2xl"
      />
      <div
        role="img"
        aria-label="Illustration of the Vigil window during a boss fight: a live score of 87, GCD use, idle time and threat per second, Shield Block and Sunder Armor uptimes, three callouts about a missed Revenge, idle time and capped rage, and two earlier fights marked as uploaded."
        className="overflow-hidden rounded-xl border border-line bg-ink-2 text-left shadow-[0_24px_60px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(201_164_76/0.12)]"
      >
        <div className="flex items-center gap-2 border-b border-line bg-ink-3 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#b3423f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#b58a3a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#5f7f4a]" />
          <span className="ml-2 font-display text-xs font-semibold tracking-[0.3em] text-gold">VIGIL</span>
          <span className="ml-auto flex items-center gap-1.5 truncate text-[0.7rem] text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6fbf73] shadow-[0_0_6px_#6fbf73]" />
            Protection Warrior
          </span>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="rounded-md border border-line bg-ink/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label>Current fight</Label>
                <p className="mt-1 truncate font-display text-base font-semibold text-bone">Ragnaros</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className="rounded-sm border border-crimson-bright/60 bg-crimson/30 px-1.5 text-[0.65rem] tracking-wider text-bone uppercase">
                    Boss
                  </span>
                  3:42
                </p>
              </div>
              <p className={clsx("text-right font-display text-3xl leading-none font-bold", scoreTone(87))}>
                87
                <span className="block text-[0.6rem] font-normal tracking-[0.2em] text-muted uppercase">score</span>
              </p>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["GCD use", "94%"],
                ["Idle now", "0.4 s"],
                ["TPS", "1.2k"],
              ].map(([k, v]) => (
                <div key={k} className="rounded border border-line/70 bg-ink-3/60 px-1 py-1.5">
                  <dt className="text-[0.6rem] tracking-wider text-muted uppercase">{k}</dt>
                  <dd className="text-sm font-semibold text-bone tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 space-y-2">
              {UPTIMES.map((u) => (
                <div key={u.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-bone/90">{u.label}</span>
                    <span className="text-muted tabular-nums">{u.pct}%</span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-ink-3">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-gold-dim to-gold" style={{ width: `${u.pct}%` }} />
                    <span className="absolute -top-0.5 h-2.5 w-0.5 bg-bone/70" style={{ left: `${u.target}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-line bg-ink/60 p-3">
            <Label>Callouts</Label>
            <ul className="mt-2 space-y-1.5">
              {CALLOUTS.map((c) => (
                <li key={c.t} className={clsx("flex gap-2 border-l-2 bg-ink-3/50 py-1 pr-2 pl-2 text-xs", CALLOUT_TONE[c.kind])}>
                  <span className="shrink-0 text-muted tabular-nums">{c.t}</span>
                  <span className="text-bone/90">{c.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-line bg-ink/60 p-3">
            <Label>Recent fights</Label>
            <ul className="mt-2 divide-y divide-line/70">
              {FIGHTS.map((f) => (
                <li key={f.name} className="flex items-center gap-3 py-1.5">
                  <span className={clsx("w-7 text-center font-display text-lg font-bold", scoreTone(f.score))}>{f.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-bone">{f.name}</span>
                    <span className="block text-[0.7rem] text-muted">{f.detail}</span>
                  </span>
                  <span className="text-[0.7rem] text-gold">Uploaded</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-muted">An illustration of the live view. Your numbers come from your own log.</figcaption>
    </figure>
  );
}
