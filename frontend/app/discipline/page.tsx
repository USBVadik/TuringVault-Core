"use client";

/**
 * /discipline — full Discipline Layer history.
 *
 * Shows aggregate summary (counts + per-gate pass rates) at the top
 * and a table of the last 30 cycles with click-to-expand for full
 * check detail.
 *
 * Spec: discipline-layer-ui R4.
 */

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { Skeleton } from "../components/Skeleton";

function DisciplineSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-7 h-7 text-purple-400" />
            <Skeleton className="w-48 h-8" />
          </div>
          <Skeleton className="w-96 h-4" />
        </div>

        {/* Summary skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <Skeleton className="w-24 h-3 mb-2" />
              <Skeleton className="w-12 h-6" />
            </div>
          ))}
        </div>

        {/* Latest cycle skeleton */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-6">
          <Skeleton className="w-24 h-4 mb-4" />
          <Skeleton className="w-32 h-6 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-5" />
            ))}
          </div>
        </div>

        {/* History table skeleton */}
        <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <Skeleton className="w-40 h-4 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-8" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Check = { name: string; status: string; detail?: string };

type HistoryEntry = {
  at: string;
  decisionId: number | null;
  verdict: "ACCEPTED" | "BLOCKED" | "SKIPPED" | "ERROR" | "UNKNOWN";
  checks: Check[];
  blockReason?: string | null;
  error?: string;
};

type Latest = {
  status: string;
  checks: Check[];
  blockReason?: string | null;
  repairStep?: string | null;
  timestamp?: number | null;
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

type ApiResponse = {
  latest: Latest | null;
  latestEntry: HistoryEntry | null;
  history: HistoryEntry[];
  summary: Summary;
  gatesKnown: string[];
};

const KNOWN_GATES = ["tx_proof", "price_freshness", "drift_detection"] as const;
const GATE_LABEL: Record<string, string> = {
  tx_proof: "TX Proof",
  price_freshness: "Freshness",
  drift_detection: "Drift",
};

function statusColor(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "pass") return "text-emerald-400";
  if (s === "fail") return "text-red-400";
  if (s === "warn") return "text-yellow-400";
  if (s === "skip") return "text-white/30";
  if (s === "error") return "text-red-300";
  return "text-white/40";
}

function statusSymbol(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (s === "pass") return "✓";
  if (s === "fail") return "✗";
  if (s === "warn") return "⚠";
  if (s === "skip") return "○";
  return "·";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function DisciplinePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/discipline", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function toggle(i: number) {
    const next = new Set(expanded);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setExpanded(next);
  }

  if (loading) return <DisciplineSkeleton />;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Shield className="w-7 h-7 text-purple-400" />
            Discipline Layer
          </h1>
          <p className="text-white/40 text-sm">
            Post-execution proof verification — Synrail-inspired. Every
            multi-agent cycle passes through three gates:
            <span className="text-white/30">
              {" "}
              TX exists on chain · price data &lt; 60s old · action aligns with
              declared regime.
            </span>
          </p>
        </div>

        {data && (
          <>
            {/* Summary */}
            <SummaryCard summary={data.summary} />

            {/* Latest with full detail */}
            {data.latest && (
              <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02] mb-6">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
                  Latest Cycle
                </h3>
                <div className="flex items-center gap-4 mb-3">
                  <span
                    className={`text-base font-bold ${
                      data.latest.status === "ACCEPTED"
                        ? "text-emerald-400"
                        : data.latest.status === "BLOCKED"
                        ? "text-red-400"
                        : data.latest.status === "ERROR"
                        ? "text-yellow-400"
                        : "text-white/50"
                    }`}
                  >
                    {data.latest.status}
                  </span>
                  {data.latestEntry?.at && (
                    <span className="text-[10px] text-white/30 font-mono">
                      {relativeTime(data.latestEntry.at)} · cycle #
                      {data.latestEntry.decisionId ?? "?"}
                    </span>
                  )}
                </div>
                {data.latest.blockReason && (
                  <div className="mb-3 p-3 bg-red-500/5 border border-red-500/20 rounded text-xs text-red-300/80 font-mono">
                    blockReason: {data.latest.blockReason}
                  </div>
                )}
                {data.latest.repairStep && (
                  <div className="mb-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded text-xs text-yellow-300/80 font-mono">
                    repairStep: {data.latest.repairStep}
                  </div>
                )}
                <div className="space-y-1">
                  {data.latest.checks.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-xs font-mono"
                    >
                      <span className={`${statusColor(c.status)} w-4`}>
                        {statusSymbol(c.status)}
                      </span>
                      <span className="text-white/70 w-32">
                        {GATE_LABEL[c.name] ?? c.name}
                      </span>
                      <span className="text-white/40 flex-1">
                        {c.detail ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History table */}
            <div className="p-6 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4">
                History — last {data.history.length} cycles
              </h3>
              {data.history.length === 0 ? (
                <p className="text-white/30 text-sm">
                  No cycles recorded yet. New cycles auto-populate.
                </p>
              ) : (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-left text-white/30 border-b border-white/5">
                      <th className="py-2 pr-3">cycle</th>
                      <th className="py-2 pr-3">when</th>
                      <th className="py-2 pr-3">verdict</th>
                      {KNOWN_GATES.map((g) => (
                        <th key={g} className="py-2 pr-3">
                          {GATE_LABEL[g]}
                        </th>
                      ))}
                      <th className="py-2 pr-3">block reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((e, i) => {
                      const checkByName = Object.fromEntries(
                        e.checks.map((c) => [c.name, c])
                      );
                      const isOpen = expanded.has(i);
                      return (
                        <>
                          <tr
                            key={`row-${i}`}
                            onClick={() => toggle(i)}
                            className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                          >
                            <td className="py-2 pr-3 text-white/60">
                              {e.decisionId ?? "?"}
                            </td>
                            <td className="py-2 pr-3 text-white/40">
                              {relativeTime(e.at)}
                            </td>
                            <td
                              className={`py-2 pr-3 ${
                                e.verdict === "ACCEPTED"
                                  ? "text-emerald-400/80"
                                  : e.verdict === "BLOCKED"
                                  ? "text-red-400/80"
                                  : e.verdict === "ERROR"
                                  ? "text-yellow-400/80"
                                  : "text-white/40"
                              }`}
                            >
                              {e.verdict}
                            </td>
                            {KNOWN_GATES.map((g) => {
                              const c = checkByName[g];
                              return (
                                <td
                                  key={g}
                                  className={`py-2 pr-3 ${statusColor(
                                    c?.status
                                  )}`}
                                >
                                  {statusSymbol(c?.status)}
                                </td>
                              );
                            })}
                            <td className="py-2 pr-3 text-white/40 truncate max-w-[200px]">
                              {e.blockReason ?? e.error ?? ""}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`drill-${i}`} className="bg-white/[0.01]">
                              <td
                                colSpan={3 + KNOWN_GATES.length + 1}
                                className="py-3 px-3"
                              >
                                <pre className="text-[10px] text-white/50 whitespace-pre-wrap leading-relaxed">
                                  {JSON.stringify(e, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {data.summary.firstCycleAt && (
              <div className="text-center mt-6 text-[10px] text-white/20 font-mono">
                first cycle ran {relativeTime(data.summary.firstCycleAt)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Tile label="Cycles tracked" value={String(summary.totalEntries)} />
      <Tile
        label="Accepted"
        value={String(summary.acceptedCount)}
        tone="emerald"
      />
      <Tile label="Blocked" value={String(summary.blockedCount)} tone="red" />
      <Tile label="Skipped" value={String(summary.skippedCount)} tone="muted" />

      {KNOWN_GATES.map((g) => (
        <Tile
          key={g}
          label={`${GATE_LABEL[g]} pass rate`}
          value={
            summary.gatePassRates[g] != null
              ? `${summary.gatePassRates[g]}%`
              : "—"
          }
          tone={
            summary.gatePassRates[g] != null && summary.gatePassRates[g]! >= 90
              ? "emerald"
              : "amber"
          }
        />
      ))}
      {summary.errorCount > 0 && (
        <Tile label="Errors" value={String(summary.errorCount)} tone="amber" />
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "red" | "amber" | "muted";
}) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.03]",
    red: "text-red-400 border-red-500/20 bg-red-500/[0.03]",
    amber: "text-yellow-400 border-yellow-500/20 bg-yellow-500/[0.03]",
    muted: "text-white/40 border-white/[0.06] bg-white/[0.02]",
  }[tone ?? "muted"];
  return (
    <div className={`p-4 rounded-lg border ${colors}`}>
      <div className="text-[9px] text-white/30 uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="text-lg font-mono">{value}</div>
    </div>
  );
}
