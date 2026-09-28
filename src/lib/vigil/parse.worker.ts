/// <reference lib="webworker" />
import { FightSplitter } from "@/lib/combatlog/fights";
import { readLines } from "@/lib/combatlog/lines";
import { LogReader, PlayerScanner } from "@/lib/combatlog/scan";
import { buildReports } from "./analyze";
import { parseVigilSnapshots } from "./saved-variables";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

const post = (msg: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(msg);

async function stream(file: File, phase: "scan" | "analyze", onLine: (reader: LogReader, line: string) => void) {
  const reader = new LogReader(new Date(file.lastModified || Date.now()).getUTCFullYear());
  let last = 0;
  for await (const line of readLines(file.stream(), (bytes) => {
    const pct = file.size ? bytes / file.size : 1;
    if (pct - last >= 0.01 || pct === 1) {
      last = pct;
      post({ type: "progress", phase, pct });
    }
  })) {
    onLine(reader, line);
  }
  return reader;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === "scan") {
      const scanner = new PlayerScanner();
      const reader = await stream(req.file, "scan", (r, line) => {
        const ev = r.read(line);
        if (ev) scanner.push(ev);
      });
      post({ type: "scanned", scan: scanner.result(reader) });
    } else {
      const splitter = new FightSplitter(req.playerGuid);
      const reader = await stream(req.file, "analyze", (r, line) => {
        const ev = r.read(line);
        if (ev) splitter.push(ev);
      });
      const snapshots = req.snapshotsText ? parseVigilSnapshots(req.snapshotsText) : [];
      const reports = buildReports(splitter.finish(), {
        playerGuid: req.playerGuid,
        playerName: req.playerName,
        modelId: req.modelId,
        header: reader.header,
        snapshots,
      });
      post({ type: "analyzed", reports });
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : "Could not read the log." });
  }
};
