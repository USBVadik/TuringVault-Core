/**
 * GET /api/discipline
 *
 * Returns the latest cycle's full Discipline Layer detail + the
 * rolling history (last 30) + an aggregate summary.
 *
 * Sources (best-effort, all guarded):
 *   - data/discipline-history.json — rolling 100 cycles
 *   - src/data/outcomes.json       — latest entry's `disciplineDetail`
 *
 * Honesty rule: empty / missing / stale states are surfaced as such.
 * The endpoint NEVER fabricates checks. HTTP 200 always (no 5xx),
 * frontend uses defaults for empty fields.
 *
 * Spec: discipline-layer-ui R2.
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const disciplineSummary = require("../../lib/discipline-summary.shared.js") as {
  buildSummary: (history: HistoryEntry[]) => Summary;
  KNOWN_GATES: string[];
};

export const dynamic = "force-dynamic";
// Audit Section 3 weakness #3 — was 0. The route reads from
// outcomes.json + discipline-history.json (small files via GitHub
// raw on Vercel). Adding 30s ISR + s-maxage cache cuts cold-start
// pressure when GitHub raw is slow (502s during stampede).
export const revalidate = 30;

type Check = { name: string; status: string; detail?: string };
type HistoryEntry = {
  at: string;
  decisionId: number | null;
  decisionLogId?: number | null;
  registryDecisionId?: number | null;
  verdict: "ACCEPTED" | "BLOCKED" | "SKIPPED" | "ERROR" | "UNKNOWN";
  checks: Check[];
  blockReason?: string | null;
  error?: string;
};

type DisciplineDetail = {
  status: string;
  checks: Check[];
  blockReason?: string | null;
  repairStep?: string | null;
  timestamp?: number;
};

type OutcomeRow = {
  decisionId?: number;
  recordedAt?: string;
  settledAt?: string;
  disciplineDetail?: DisciplineDetail;
};

type Summary = {
  totalEntries: number;
  acceptedCount: number;
  blockedCount: number;
  skippedCount: number;
  errorCount: number;
  gatePassRates: Record<string, number | null>;
  firstCycleAt: string | null;
  latestCycleAt: string | null;
  cyclesWithTx: number;
  cyclesWithoutTx: number;
  txProofPassCount: number;
  txProofFailCount: number;
  txProofWarnCount: number;
  txProofErrorCount: number;
  txProofSkipCount: number;
  txProofPassRateExecutedOnly: number | null;
};

/**
 * SWR cache headers — same pattern as /api/health, /api/decisions,
 * /api/market. Use SWR for the happy path so a transient GitHub raw
 * 502 doesn't break the dashboard.
 */
const SWR_CACHE: HeadersInit = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  "X-Cache-Mode": "swr",
};
const KNOWN_GATES = disciplineSummary.KNOWN_GATES;

function backendPath(...segments: string[]): string {
  return path.resolve(process.cwd(), "..", ...segments);
}

function safeReadJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function withDisplayIds(entry: HistoryEntry): HistoryEntry {
  const registryDecisionId = entry.decisionId ?? null;
  const decisionLogId =
    typeof registryDecisionId === "number" && registryDecisionId > 0
      ? registryDecisionId - 1
      : registryDecisionId;

  return {
    ...entry,
    registryDecisionId,
    decisionLogId,
  };
}

async function fetchFromGitHub<T>(filePath: string): Promise<T | null> {
  try {
    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Pull `disciplineDetail` from the latest entry of outcomes.json.
 * Used to enrich the strip with the full check list (history file
 * stores compact checks only).
 */
function readLatestDetail(): DisciplineDetail | null {
  const outcomes = safeReadJson<{
    pending?: OutcomeRow[];
    settled?: OutcomeRow[];
  }>(backendPath("src", "data", "outcomes.json"));
  if (!outcomes) return null;
  const all = [...(outcomes.pending ?? []), ...(outcomes.settled ?? [])];
  // Sort newest-first by recordedAt/settledAt.
  all.sort((a, b) => {
    const ta = Date.parse(a.recordedAt ?? a.settledAt ?? "");
    const tb = Date.parse(b.recordedAt ?? b.settledAt ?? "");
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  for (const e of all) {
    if (e?.disciplineDetail) return e.disciplineDetail;
  }
  return null;
}

export async function GET() {
  const historyPath = backendPath("data", "discipline-history.json");
  let history = safeReadJson<HistoryEntry[]>(historyPath);
  if (!history) {
    history = await fetchFromGitHub<HistoryEntry[]>("data/discipline-history.json");
  }
  history = history ?? [];

  const last30 = history.slice(-30).map(withDisplayIds).reverse(); // newest first for display
  const summary = disciplineSummary.buildSummary(history);
  const latestDetail = readLatestDetail();

  // Best-effort: if outcomes.json has no disciplineDetail (older entries),
  // fall back to the latest history entry as a compact "latest".
  const latestFromHistory = history[history.length - 1]
    ? withDisplayIds(history[history.length - 1])
    : null;

  return NextResponse.json(
    {
      latest:
        latestDetail ??
        (latestFromHistory
          ? {
              status: latestFromHistory.verdict,
              checks: latestFromHistory.checks,
              blockReason: latestFromHistory.blockReason ?? null,
              timestamp: Date.parse(latestFromHistory.at) || null,
              _source: "history-compact",
            }
          : null),
      latestEntry: latestFromHistory,
      history: last30,
      summary,
      gatesKnown: KNOWN_GATES,
      dataScope: "agent-lifetime",
    },
    { headers: SWR_CACHE }
  );
}
