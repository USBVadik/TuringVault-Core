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

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Check = { name: string; status: string; detail?: string };
type HistoryEntry = {
  at: string;
  decisionId: number | null;
  verdict: 'ACCEPTED' | 'BLOCKED' | 'SKIPPED' | 'ERROR' | 'UNKNOWN';
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
};

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store, max-age=0' };
const KNOWN_GATES = ['tx_proof', 'price_freshness', 'drift_detection'] as const;

function backendPath(...segments: string[]): string {
  return path.resolve(process.cwd(), '..', ...segments);
}

function safeReadJson<T>(p: string): T | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) as T; } catch { return null; }
}

/**
 * Build the aggregate summary in pure TypeScript (mirror of the
 * backend `disciplineHistory.summary`, kept in sync via this comment).
 */
function buildSummary(history: HistoryEntry[]): Summary {
  const counts = { ACCEPTED: 0, BLOCKED: 0, SKIPPED: 0, ERROR: 0, UNKNOWN: 0 };
  const gateStats: Record<string, { pass: number; fail: number; warn: number; skip: number }> = {};
  for (const g of KNOWN_GATES) gateStats[g] = { pass: 0, fail: 0, warn: 0, skip: 0 };

  for (const e of history) {
    const v = (e?.verdict ?? 'UNKNOWN') as keyof typeof counts;
    counts[v] = (counts[v] ?? 0) + 1;
    for (const c of e?.checks ?? []) {
      if (!KNOWN_GATES.includes(c.name as typeof KNOWN_GATES[number])) continue;
      const s = String(c.status ?? '').toLowerCase();
      const stats = gateStats[c.name];
      if (s === 'pass') stats.pass++;
      else if (s === 'fail') stats.fail++;
      else if (s === 'warn') stats.warn++;
      else if (s === 'skip') stats.skip++;
    }
  }

  const gatePassRates: Record<string, number | null> = {};
  for (const g of KNOWN_GATES) {
    const s = gateStats[g];
    const total = s.pass + s.fail + s.warn;
    gatePassRates[g] = total > 0 ? Math.round((s.pass / total) * 1000) / 10 : null;
  }

  return {
    totalEntries: history.length,
    acceptedCount: counts.ACCEPTED,
    blockedCount: counts.BLOCKED,
    skippedCount: counts.SKIPPED,
    errorCount: counts.ERROR,
    gatePassRates,
    firstCycleAt: history[0]?.at ?? null,
    latestCycleAt: history[history.length - 1]?.at ?? null,
  };
}

/**
 * Pull `disciplineDetail` from the latest entry of outcomes.json.
 * Used to enrich the strip with the full check list (history file
 * stores compact checks only).
 */
function readLatestDetail(): DisciplineDetail | null {
  const outcomes = safeReadJson<{ pending?: OutcomeRow[]; settled?: OutcomeRow[] }>(
    backendPath('src', 'data', 'outcomes.json'),
  );
  if (!outcomes) return null;
  const all = [...(outcomes.pending ?? []), ...(outcomes.settled ?? [])];
  // Sort newest-first by recordedAt/settledAt.
  all.sort((a, b) => {
    const ta = Date.parse(a.recordedAt ?? a.settledAt ?? '');
    const tb = Date.parse(b.recordedAt ?? b.settledAt ?? '');
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  for (const e of all) {
    if (e?.disciplineDetail) return e.disciplineDetail;
  }
  return null;
}

export async function GET() {
  const historyPath = backendPath('data', 'discipline-history.json');
  const history = (safeReadJson<HistoryEntry[]>(historyPath) ?? []) as HistoryEntry[];

  const last30 = history.slice(-30).reverse(); // newest first for display
  const summary = buildSummary(history);
  const latestDetail = readLatestDetail();

  // Best-effort: if outcomes.json has no disciplineDetail (older entries),
  // fall back to the latest history entry as a compact "latest".
  const latestFromHistory = history[history.length - 1] ?? null;

  return NextResponse.json(
    {
      latest: latestDetail ?? (latestFromHistory
        ? {
            status: latestFromHistory.verdict,
            checks: latestFromHistory.checks,
            blockReason: latestFromHistory.blockReason ?? null,
            timestamp: Date.parse(latestFromHistory.at) || null,
            _source: 'history-compact',
          }
        : null),
      latestEntry: latestFromHistory,
      history: last30,
      summary,
      gatesKnown: KNOWN_GATES,
      dataScope: 'agent-lifetime',
    },
    { headers: NO_STORE },
  );
}
