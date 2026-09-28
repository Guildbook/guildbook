import clsx from "clsx";
import type { ReactNode } from "react";
import { Panel, Tag } from "@/components/ui";
import { formatDuration, formatNumber, formatPct, formatSeconds, METRIC_LABELS, scoreTone } from "@/lib/vigil/format";
import type { FightReport } from "@/lib/vigil/report";
import { FightTimeline } from "./timeline";

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded border border-line bg-ink/40 px-3 py-2">
      <p className="text-[0.65rem] tracking-widest text-muted uppercase">{label}</p>
      <p className="text-lg font-semibold text-bone">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Bar({ value, target = 1, tone = "gold" }: { value: number; target?: number; tone?: "gold" | "crimson" }) {
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded bg-ink">
      <div
        className={clsx("h-full rounded", tone === "gold" ? "bg-gold" : "bg-crimson-bright")}
        style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }}
      />
      {target < 1 && <div className="absolute top-0 h-full w-0.5 bg-bone/70" style={{ left: `${target * 100}%` }} title="Target" />}
    </div>
  );
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`Score ${score} of 100`} className="shrink-0">
      <circle cx={50} cy={50} r={r} fill="none" stroke="var(--color-line)" strokeWidth={8} />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={score >= 60 ? "var(--color-gold)" : "var(--color-crimson-bright)"}
        strokeWidth={8}
        strokeDasharray={`${(score / 100) * c} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x={50} y={58} textAnchor="middle" fontSize={26} fontWeight={700} fill="var(--color-bone)">
        {score}
      </text>
    </svg>
  );
}

export function FightReportView({ report }: { report: FightReport }) {
  const { totals, activity, estimate, model } = report;
  const seconds = report.fight.durationMs / 1000;
  const metric = model?.metric ?? "damage";
  const perSecond = metric === "threat" ? totals.tps : metric === "healing" ? totals.hps : totals.dps;

  return (
    <div className="space-y-4" data-testid="vigil-report">
      <Panel>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <ScoreRing score={report.score.overall} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={clsx("text-xl font-semibold", scoreTone(report.score.overall))}>
                {report.score.overall >= 85 ? "Well kept" : report.score.overall >= 60 ? "Steady" : "Room to grow"}
              </h2>
              <Tag>{model?.label ?? "General review"}</Tag>
              <Tag>{report.fight.kind === "boss" ? "Boss" : "Trash"}</Tag>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {report.score.parts.map((p) => (
                <li key={p.label} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <span className="text-muted">{p.label}</span>
                    <span className="text-bone">{formatPct(p.value)}</span>
                  </div>
                  <Bar value={p.value} tone={p.value >= 0.6 ? "gold" : "crimson"} />
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Duration" value={formatDuration(report.fight.durationMs)} />
          <Stat label={`${METRIC_LABELS[metric]} per second`} value={formatNumber(perSecond)} />
          <Stat
            label="GCD usage"
            value={formatPct(activity.gcdUsage)}
            hint={`${activity.gcdCasts} casts, ${formatSeconds(activity.gcdMs)} GCD`}
          />
          <Stat
            label={activity.readyIdleMs !== null ? "Idle while ready" : "Idle gaps"}
            value={
              activity.readyIdleMs !== null
                ? formatSeconds(activity.readyIdleMs)
                : formatSeconds(activity.idleGaps.reduce((a, [s, e]) => a + (e - s), 0))
            }
          />
        </div>
      </Panel>

      <Panel title="Timeline">
        <FightTimeline report={report} />
      </Panel>

      {estimate && (
        <Panel title="Estimate versus actual">
          <p className="mb-3 text-sm text-muted">
            A perfect-timing replay of this same fight. It is an estimate: read the assumptions below before taking the
            number literally.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label={`Your ${METRIC_LABELS[estimate.metric].toLowerCase()}`} value={formatNumber(estimate.actual)} hint={`${formatNumber(estimate.actual / seconds)} per second`} />
            <Stat
              label="Estimated with perfect timing"
              value={formatNumber(estimate.estimated)}
              hint={`${formatNumber(estimate.estimated / seconds)} per second`}
            />
            <Stat label="Efficiency" value={formatPct(estimate.efficiency)} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gold">Where the difference comes from</h3>
              {estimate.gains.length === 0 ? (
                <p className="text-sm text-muted">Nothing measurable left on the table.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {estimate.gains.map((g) => (
                    <li key={g.label} className="flex justify-between gap-2">
                      <span>{g.label}</span>
                      <span className={g.amount >= 0 ? "text-gold" : "text-muted"}>
                        {g.amount >= 0 ? "+" : ""}
                        {formatNumber(g.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {estimate.simCasts.length > 0 && (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1 font-normal">Ability</th>
                      <th className="py-1 text-right font-normal">You</th>
                      <th className="py-1 text-right font-normal">Replay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.simCasts.map((c) => (
                      <tr key={c.label} className="border-t border-line">
                        <td className="py-1">{c.label}</td>
                        <td className="py-1 text-right">{c.actual}</td>
                        <td className="py-1 text-right text-gold">{c.simulated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gold">Assumptions</h3>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
                {estimate.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {report.adherence && (
          <Panel title="Priority adherence">
            <p className="mb-3 text-sm text-muted">
              {report.adherence.matched} of {report.adherence.decisions} global cooldowns went to the highest ability that
              was ready.
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 font-normal">Step</th>
                  <th className="py-1 text-right font-normal">Called for</th>
                  <th className="py-1 text-right font-normal">Done</th>
                </tr>
              </thead>
              <tbody>
                {report.adherence.steps.map((s) => (
                  <tr key={s.label} className="border-t border-line">
                    <td className="py-1">{s.label}</td>
                    <td className="py-1 text-right">{s.expected}</td>
                    <td className={clsx("py-1 text-right", s.done < s.expected ? "text-crimson-bright" : "text-gold")}>{s.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.adherence.misses.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-gold">Off-priority casts ({report.adherence.misses.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {report.adherence.misses.map((m, i) => (
                    <li key={i}>
                      {formatSeconds(m.t)}: {m.actual} when the priority was {m.expected.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>
        )}

        {(report.uptimes.length > 0 || report.procs.length > 0 || report.cooldowns.length > 0) && (
          <Panel title="Uptimes and cooldowns">
            <ul className="space-y-3 text-sm">
              {report.uptimes.map((u) => (
                <li key={u.key}>
                  <div className="mb-1 flex justify-between gap-2">
                    <span>
                      {u.label}
                      {u.scored && <span className="ml-1 text-xs text-muted">(target {formatPct(u.targetPct)})</span>}
                    </span>
                    <span>{formatPct(u.pct)}</span>
                  </div>
                  <Bar value={u.pct} target={u.scored ? u.targetPct : 1} tone={!u.scored || u.pct >= u.targetPct * 0.8 ? "gold" : "crimson"} />
                </li>
              ))}
              {report.procs.map((p) => (
                <li key={p.key}>
                  <div className="mb-1 flex justify-between gap-2">
                    <span>{p.label}</span>
                    <span>
                      {p.used} of {p.usable} possible
                    </span>
                  </div>
                  <Bar value={p.pct} tone={p.pct >= 0.7 ? "gold" : "crimson"} />
                </li>
              ))}
              {report.cooldowns.map((c) => (
                <li key={c.key} className="flex justify-between gap-2 border-t border-line pt-2">
                  <span>{c.label}</span>
                  <span className="text-muted">
                    {c.casts} of {c.possible} possible uses
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Checks">
          <ul className="space-y-2 text-sm">
            {report.swings && (
              <li className="flex justify-between gap-2">
                <span>Auto-attacks lost to gaps</span>
                <span className={report.swings.lostSwings > 0 ? "text-crimson-bright" : "text-gold"}>
                  {report.swings.lostSwings} (swing every {formatSeconds(report.swings.medianIntervalMs)})
                </span>
              </li>
            )}
            {report.extras.seal && (
              <>
                <li className="flex justify-between gap-2">
                  <span>Time without a seal</span>
                  <span className={report.extras.seal.timeWithoutSealMs > 0 ? "text-crimson-bright" : "text-gold"}>
                    {formatSeconds(report.extras.seal.timeWithoutSealMs)}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Judgements</span>
                  <span>
                    {report.extras.seal.judgements}
                    {report.extras.seal.medianJudgementIntervalMs !== null &&
                      `, every ${formatSeconds(report.extras.seal.medianJudgementIntervalMs)}`}
                  </span>
                </li>
                <li className="flex justify-between gap-2">
                  <span>Judgement consumes the seal</span>
                  <span className="text-muted">{report.extras.seal.consumesSeal ? "Yes (read from log)" : "No (read from log)"}</span>
                </li>
              </>
            )}
            {report.extras.rageDump && (
              <li className="flex justify-between gap-2">
                <span>Heroic Strike on swings at {report.extras.rageDump.threshold}+ rage</span>
                <span>
                  {report.extras.rageDump.used} of {report.extras.rageDump.opportunities}
                </span>
              </li>
            )}
            {report.resource && (
              <>
                <li className="flex justify-between gap-2">
                  <span>Time at {report.resource.name.toLowerCase()} cap</span>
                  <span>{formatSeconds(report.resource.timeAtCapMs)}</span>
                </li>
                {report.resource.name === "Rage" && (
                  <li className="flex justify-between gap-2">
                    <span>Rage wasted at cap (estimate)</span>
                    <span>{formatNumber(report.resource.wastedEstimate)}</span>
                  </li>
                )}
              </>
            )}
            <li className="flex justify-between gap-2">
              <span>Damage taken</span>
              <span>{formatNumber(totals.damageTaken)}</span>
            </li>
          </ul>
        </Panel>

        <Panel title="Targets">
          <ul className="space-y-1 text-sm">
            {report.fight.targets.map((t, i) => (
              <li key={`${t.name}-${i}`} className="flex justify-between gap-2">
                <span>
                  {t.name}
                  {t.npcId && <span className="ml-1 text-xs text-muted">NPC {t.npcId}</span>}
                  {t.died && <span className="ml-1 text-xs text-gold-dim">slain</span>}
                </span>
                <span className="text-muted">{formatNumber(t.damageTaken)} dealt</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Abilities">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1 font-normal">Ability</th>
                <th className="py-1 text-right font-normal">Casts</th>
                <th className="py-1 text-right font-normal">Hits</th>
                <th className="py-1 text-right font-normal">Crit</th>
                <th className="py-1 text-right font-normal">Miss</th>
                <th className="py-1 text-right font-normal">Damage</th>
                {totals.healing > 0 && <th className="py-1 text-right font-normal">Healing</th>}
                <th className="py-1 text-right font-normal">Threat</th>
              </tr>
            </thead>
            <tbody>
              {report.spells.map((s) => (
                <tr key={s.name} className="border-t border-line">
                  <td className="py-1">{s.name}</td>
                  <td className="py-1 text-right">{s.casts || ""}</td>
                  <td className="py-1 text-right">{s.hits || ""}</td>
                  <td className="py-1 text-right">{s.hits ? formatPct(s.crits / s.hits) : ""}</td>
                  <td className="py-1 text-right">{s.misses || ""}</td>
                  <td className="py-1 text-right">{s.damage ? formatNumber(s.damage) : ""}</td>
                  {totals.healing > 0 && <td className="py-1 text-right">{s.healing ? formatNumber(s.healing) : ""}</td>}
                  <td className="py-1 text-right text-gold">{s.threat ? formatNumber(s.threat) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Threat is an estimate from damage, ability bonuses and stance; the game does not log threat.</p>
      </Panel>

      {(report.notes.length > 0 || report.snapshot) && (
        <Panel title="About this log">
          {report.snapshot && (
            <p className="mb-2 text-sm">
              Gear snapshot from Vigil: {report.snapshot.name}
              {report.snapshot.level ? `, level ${report.snapshot.level}` : ""}, {report.snapshot.gear.length} items,{" "}
              {report.snapshot.talents.length} talent entries.
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-center text-xs text-muted">
        Log format {report.log.version ?? "unknown"}
        {report.log.build && `, build ${report.log.build}`}
        {report.log.advanced ? ", advanced logging on" : ", advanced logging off"}.
      </p>
    </div>
  );
}
