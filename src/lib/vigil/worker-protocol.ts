import type { LogScan } from "@/lib/combatlog/scan";
import type { FightReport } from "./report";

export type WorkerRequest =
  | { type: "scan"; file: File }
  | { type: "analyze"; file: File; playerGuid: string; playerName: string; modelId: string | null; snapshotsText?: string };

export type WorkerResponse =
  | { type: "progress"; phase: "scan" | "analyze"; pct: number }
  | { type: "scanned"; scan: LogScan }
  | { type: "analyzed"; reports: FightReport[] }
  | { type: "error"; message: string };
