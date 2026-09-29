"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClassIcon } from "@/components/class-icon";
import { Listbox } from "@/components/listbox";
import { classColor } from "@/components/ui";
import type { LogScan } from "@/lib/combatlog/scan";
import { CLASS_INFO, type WowClass } from "@/lib/game";
import { guildHref } from "@/lib/paths";
import { formatDuration, formatPct, METRIC_LABELS } from "@/lib/vigil/format";
import type { FightReport } from "@/lib/vigil/report";
import { detectModel, ROTATION_MODELS } from "@/lib/vigil/rotations";
import { VISIBILITIES, VISIBILITY_LABELS, type Visibility } from "@/lib/vigil/visibility";
import type { WorkerRequest, WorkerResponse } from "@/lib/vigil/worker-protocol";
import { uploadVigilReportAction } from "@/server/actions/vigil";

export interface UploadCharacter {
  id: string;
  name: string;
  surname: string;
  wowClass: WowClass;
  level: number;
  isMain: boolean;
}

type Phase =
  | { step: "pick" }
  | { step: "scanning"; pct: number }
  | { step: "scanned"; scan: LogScan }
  | { step: "analyzing"; scan: LogScan; pct: number }
  | { step: "review"; scan: LogScan; reports: FightReport[] }
  | { step: "uploading"; scan: LogScan; reports: FightReport[]; done: number; total: number }
  | { step: "uploaded"; ids: { id: string; label: string }[]; failed: string[]; warnings: string[] };

function Progress({ label, pct }: { label: string; pct: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-gold">{Math.round(pct * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-ink" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-gold transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
    </div>
  );
}

export function VigilUploadFlow({
  slug,
  characters,
  defaultVisibility,
}: {
  slug: string;
  characters: UploadCharacter[];
  defaultVisibility: Visibility;
}) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [snapshotsText, setSnapshotsText] = useState<string | undefined>();
  const [playerGuid, setPlayerGuid] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [characterId, setCharacterId] = useState<string>("");
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = (req: WorkerRequest, onDone: (res: WorkerResponse) => void, onProgress: (pct: number) => void) => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../../lib/vigil/parse.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") onProgress(msg.pct);
      else if (msg.type === "error") {
        setError(msg.message);
        setPhase({ step: "pick" });
        worker.terminate();
      } else {
        onDone(msg);
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setError("The log could not be read in this browser.");
      setPhase({ step: "pick" });
    };
    worker.postMessage(req);
  };

  const pickCharacterFor = (name: string) => {
    const lower = name.toLowerCase();
    return characters.find((c) => c.name.toLowerCase() === lower)?.id ?? "";
  };

  const choosePlayer = (scan: LogScan, guid: string) => {
    const player = scan.players.find((p) => p.guid === guid);
    setPlayerGuid(guid);
    if (!player) return;
    const charId = pickCharacterFor(player.name);
    setCharacterId(charId);
    const wowClass = characters.find((c) => c.id === charId && c.name.toLowerCase() === player.name.toLowerCase())?.wowClass;
    setModelId(detectModel(player.spells, wowClass)?.id ?? detectModel(player.spells)?.id ?? "");
  };

  const startScan = (f: File) => {
    setError(null);
    setFile(f);
    setPhase({ step: "scanning", pct: 0 });
    run(
      { type: "scan", file: f },
      (res) => {
        if (res.type !== "scanned") return;
        if (res.scan.players.length === 0) {
          setError("No player actions were found. Is this a WoWCombatLog file?");
          setPhase({ step: "pick" });
          return;
        }
        choosePlayer(res.scan, res.scan.players[0]!.guid);
        setPhase({ step: "scanned", scan: res.scan });
      },
      (pct) => setPhase({ step: "scanning", pct }),
    );
  };

  const startAnalyze = (scan: LogScan) => {
    if (!file) return;
    const player = scan.players.find((p) => p.guid === playerGuid);
    if (!player) return;
    setError(null);
    setPhase({ step: "analyzing", scan, pct: 0 });
    run(
      { type: "analyze", file, playerGuid, playerName: player.name, modelId: modelId || null, snapshotsText },
      (res) => {
        if (res.type !== "analyzed") return;
        if (res.reports.length === 0) {
          setError(`No fights were found for ${player.name}. Fights need at least two seconds of combat.`);
          setPhase({ step: "scanned", scan });
          return;
        }
        setSelected(new Set(res.reports.map((_, i) => i)));
        setPhase({ step: "review", scan, reports: res.reports });
      },
      (pct) => setPhase({ step: "analyzing", scan, pct }),
    );
  };

  const upload = async (scan: LogScan, reports: FightReport[]) => {
    const chosen = reports.map((r, i) => ({ r, i })).filter(({ i }) => selected.has(i));
    const ids: { id: string; label: string }[] = [];
    const failed: string[] = [];
    const warnings = new Set<string>();
    setPhase({ step: "uploading", scan, reports, done: 0, total: chosen.length });
    for (const [n, { r }] of chosen.entries()) {
      const res = await uploadVigilReportAction(slug, { report: r, characterId: characterId || null, visibility });
      if (res.ok) {
        ids.push({ id: res.id, label: r.fight.label });
        if (res.warning) warnings.add(res.warning);
      }
      else failed.push(`${r.fight.label}: ${res.error}`);
      setPhase({ step: "uploading", scan, reports, done: n + 1, total: chosen.length });
    }
    if (ids.length === 1 && failed.length === 0) {
      router.push(guildHref(slug, `/vigil/reports/${ids[0]!.id}`));
      return;
    }
    setPhase({ step: "uploaded", ids, failed, warnings: [...warnings] });
    router.refresh();
  };

  const scan = "scan" in phase ? phase.scan : null;
  const player = scan?.players.find((p) => p.guid === playerGuid);
  const model = ROTATION_MODELS.find((m) => m.id === modelId);
  const logInfo = useMemo(() => {
    if (!scan) return null;
    const minutes = scan.startedAt && scan.endedAt ? Math.round((scan.endedAt - scan.startedAt) / 60000) : null;
    return [
      scan.header.version ? `Combat log version ${scan.header.version}` : "No version header",
      scan.header.build ? `build ${scan.header.build}` : null,
      scan.header.advanced ? "advanced logging on" : "advanced logging off",
      `${scan.lines.toLocaleString("en-US")} lines`,
      minutes !== null ? `${minutes} min` : null,
      scan.encounters ? `${scan.encounters} boss encounters` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }, [scan]);

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded border border-crimson bg-crimson-deep/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="panel space-y-4 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gold">1. Choose your combat log</h2>
        <p className="text-sm text-muted">
          Your log never leaves this browser. Vigil reads it here and uploads only a short summary of each fight you pick.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Combat log (WoWCombatLog.txt)</span>
            <input
              type="file"
              accept=".txt,.log,text/plain"
              className="field"
              data-testid="vigil-log-input"
              disabled={phase.step === "scanning" || phase.step === "analyzing" || phase.step === "uploading"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) startScan(f);
              }}
            />
          </label>
          <label className="block">
            <span className="field-label">Vigil snapshot (optional)</span>
            <input
              type="file"
              accept=".lua,.json,.txt"
              className="field"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setSnapshotsText(f ? await f.text() : undefined);
              }}
            />
            <span className="mt-1 block text-xs text-muted">WTF/Account/NAME/SavedVariables/Vigil.lua attaches your gear and talents.</span>
          </label>
        </div>
        {phase.step === "scanning" && <Progress label="Reading the log" pct={phase.pct} />}
        {logInfo && <p className="text-xs text-muted" data-testid="vigil-log-info">{logInfo}</p>}
      </section>

      {scan && phase.step !== "uploaded" && (
        <section className="panel space-y-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gold">2. Who and how to judge</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="field-label">Player in the log</span>
              <Listbox
                aria-label="Player in the log"
                value={playerGuid}
                onChange={(guid) => choosePlayer(scan, guid)}
                options={scan.players.map((p) => ({
                  value: p.guid,
                  label: `${p.name}${p.isLogger ? " (you)" : ""}`,
                  description: p.level ? `Level ${p.level}` : undefined,
                }))}
                searchable={scan.players.length > 12}
                searchPlaceholder="Search players"
              />
            </div>
            <div>
              <span className="field-label">Rotation model</span>
              <Listbox
                aria-label="Rotation model"
                value={modelId}
                onChange={setModelId}
                options={[{ value: "", label: "General review (any class)" }, ...ROTATION_MODELS.map((m) => ({ value: m.id, label: m.label }))]}
              />
            </div>
            <div>
              <span className="field-label">Your character</span>
              <Listbox
                aria-label="Your character"
                value={characterId}
                onChange={setCharacterId}
                options={[
                  { value: "", label: "Not linked" },
                  ...characters.map((c) => ({
                    value: c.id,
                    label: `${c.name} ${c.surname}`,
                    description: `Level ${c.level} ${CLASS_INFO[c.wowClass].label}`,
                    icon: <ClassIcon wowClass={c.wowClass} size={18} decorative />,
                    color: classColor(c.wowClass),
                  })),
                ]}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            {model
              ? `${model.label}: judged on ${METRIC_LABELS[model.metric].toLowerCase()}, priority, uptimes and ${model.procs.length ? "procs" : "cooldowns"}.`
              : "General review: damage, healing, GCD usage, idle time and abilities, for any class."}
            {player && player.spells.length > 0 && ` ${player.name} cast ${player.spells.length} different spells.`}
          </p>
          {phase.step === "scanned" && (
            <button type="button" className="btn btn-primary" onClick={() => startAnalyze(scan)}>
              Find fights
            </button>
          )}
          {phase.step === "analyzing" && <Progress label="Splitting fights and scoring" pct={phase.pct} />}
        </section>
      )}

      {(phase.step === "review" || phase.step === "uploading") && (
        <section className="panel space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gold">3. Pick fights to keep</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSelected(selected.size === phase.reports.length ? new Set() : new Set(phase.reports.map((_, i) => i)))
              }
            >
              {selected.size === phase.reports.length ? "Select none" : "Select all"}
            </button>
          </div>
          <ul className="divide-y divide-line" data-testid="vigil-fights">
            {phase.reports.map((r, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setSelected(next);
                    }}
                    className="h-4 w-4 accent-[var(--color-gold)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-bone">{r.fight.label}</span>
                    <span className="block text-xs text-muted">
                      {r.fight.kind === "boss" ? "Boss" : "Trash"}, {formatDuration(r.fight.durationMs)},{" "}
                      {new Date(r.fight.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      {r.estimate && `, ${formatPct(r.estimate.efficiency)} of estimate`}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "rounded border px-2 py-0.5 text-sm font-semibold",
                      r.score.overall >= 60 ? "border-gold-dim text-gold" : "border-crimson text-crimson-bright",
                    )}
                  >
                    {r.score.overall}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <fieldset>
            <legend className="field-label">Who can see these reports</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {VISIBILITIES.map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                    className="accent-[var(--color-gold)]"
                  />
                  {v === "private" ? "Only me" : VISIBILITY_LABELS[v]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Private reports are hidden from officers too. You can change this later.</p>
          </fieldset>
          {phase.step === "uploading" ? (
            <Progress label={`Uploading ${phase.done} of ${phase.total}`} pct={phase.total ? phase.done / phase.total : 1} />
          ) : (
            <button type="button" className="btn btn-primary" disabled={selected.size === 0} onClick={() => upload(phase.scan, phase.reports)}>
              Upload {selected.size} {selected.size === 1 ? "report" : "reports"}
            </button>
          )}
        </section>
      )}

      {phase.step === "uploaded" && (
        <section className="panel space-y-3 p-4 sm:p-6" role="status">
          <h2 className="text-lg font-semibold text-gold">Saved</h2>
          <ul className="space-y-1 text-sm">
            {phase.ids.map((r) => (
              <li key={r.id}>
                <Link className="link" href={guildHref(slug, `/vigil/reports/${r.id}`)}>
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
          {phase.warnings.map((w) => (
            <p key={w} className="rounded border border-gold-dim/60 bg-gold/5 px-3 py-2 text-sm text-bone" data-testid="vigil-version-warning">
              {w}
            </p>
          ))}
          {phase.failed.length > 0 && (
            <ul className="space-y-1 text-sm text-red-300">
              {phase.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <Link href={guildHref(slug, "/vigil")} className="btn btn-ghost btn-sm">
            My reports
          </Link>
        </section>
      )}
    </div>
  );
}
