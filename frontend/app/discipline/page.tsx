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

import { Fragment, useEffect, useState } from "react";
import { Shield, Check, X, AlertTriangle, Circle, MinusCircle, ChevronDown, ChevronUp, Receipt, Clock, Activity, ExternalLink } from "lucide-react";
import { Skeleton } from "../components/Skeleton";
import styles from "./discipline.module.css";

function DisciplineSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-[1200px] mx-auto">
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
  cyclesWithTx: number;
  cyclesWithoutTx: number;
  txProofPassCount: number;
  txProofFailCount: number;
  txProofWarnCount: number;
  txProofErrorCount: number;
  txProofSkipCount: number;
  txProofPassRateExecutedOnly: number | null;
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

function StatusIcon({ status, className = "w-3.5 h-3.5" }: { status: string | undefined; className?: string }) {
  const s = (status ?? "").toLowerCase();
  if (s === "pass") return <Check className={`${className} text-emerald-400`} aria-label="pass" />;
  if (s === "fail") return <X className={`${className} text-red-400`} aria-label="fail" />;
  if (s === "warn") return <AlertTriangle className={`${className} text-yellow-400`} aria-label="warn" />;
  if (s === "skip") return <Circle className={`${className} text-white/30`} aria-label="skip" />;
  if (s === "error") return <AlertTriangle className={`${className} text-red-300`} aria-label="error" />;
  return <MinusCircle className={`${className} text-white/20`} aria-label="unknown" />;
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

function txProofStatus(checks: Check[] | undefined): string {
  return String(checks?.find((c) => c.name === "tx_proof")?.status ?? "").toLowerCase();
}

function displayVerdict(status: string | undefined, checks: Check[] | undefined): string {
  const verdict = status ?? "UNKNOWN";
  const tx = txProofStatus(checks);
  if (verdict === "ACCEPTED" && tx === "skip") return "HOLD (no tx)";
  if (verdict === "ACCEPTED" && tx === "pass") return "SWAP VERIFIED";
  if (verdict === "ACCEPTED" && tx === "warn") return "TX WARNING";
  if (verdict === "ACCEPTED" && (tx === "fail" || tx === "error")) {
    return "TX PROOF FAILED";
  }
  if (verdict === "ACCEPTED" && !tx) return "TX UNVERIFIED";
  return verdict;
}

function verdictTextClass(status: string | undefined, checks: Check[] | undefined): string {
  const tx = txProofStatus(checks);
  if (status === "ACCEPTED" && tx === "skip") return styles.verdictMuted;
  if (status === "ACCEPTED" && tx === "pass") return styles.verdictAccepted;
  if (status === "ACCEPTED") return styles.verdictWarn;
  if (status === "BLOCKED") return styles.verdictBlocked;
  if (status === "ERROR") return styles.verdictWarn;
  return styles.verdictMuted;
}

function verdictPillClass(status: string | undefined, checks: Check[] | undefined): string {
  const tx = txProofStatus(checks);
  if (status === "ACCEPTED" && tx === "skip") return styles.statusMuted;
  if (status === "ACCEPTED" && tx === "pass") return styles.statusAccepted;
  if (status === "ACCEPTED") return styles.statusWarn;
  if (status === "BLOCKED") return styles.statusBlocked;
  if (status === "ERROR") return styles.statusWarn;
  return styles.statusMuted;
}

export default function DisciplinePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Collapsed by default so the technical summary stays the first
  // thing a judge sees. Open it for the human-readable explainer.
  const [explainerOpen, setExplainerOpen] = useState(false);

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
    <div className={styles.page}>
      <div className={`${styles.shell} anim-fade-up`}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span>Discipline Layer</span>
              <span>Post-execution gates</span>
            </div>
            <h1>Every AI trade has to prove itself after execution.</h1>
            <p>
              The agent can propose, validate, and execute. The Discipline
              Layer checks the aftermath: did the transaction land, was the
              market data fresh, and did the action match the declared regime?
            </p>
            <div className={styles.gateStrip}>
              <span>TX exists on chain</span>
              <span>price data &lt; 60s</span>
              <span>regime alignment</span>
            </div>
          </div>

          {data && (
            <div className={styles.verdictCard}>
              <div>
                <div className={styles.verdictLabel}>Latest verdict</div>
                <div
                  className={`${styles.verdictValue} ${
                    verdictTextClass(data.latest?.status, data.latest?.checks)
                  }`}
                >
                  {displayVerdict(data.latest?.status, data.latest?.checks)}
                </div>
              </div>
              <div className={styles.verdictMeta}>
                <span>
                  cycle #{data.latestEntry?.decisionId ?? "?"}
                </span>
                <span>
                  {data.latestEntry?.at ? relativeTime(data.latestEntry.at) : "—"}
                </span>
              </div>
              <div className={styles.miniGateList}>
                {KNOWN_GATES.map((g) => {
                  const c = data.latest?.checks.find((x) => x.name === g);
                  return (
                    <div key={g}>
                      <StatusIcon status={c?.status} />
                      <span>{GATE_LABEL[g]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Plain-language explainer. Collapsed by default so the
            data-first view doesn't change for power users; open by
            judges + first-time visitors who want the "why this
            exists". */}
        <div className={styles.explainer}>
          <button
            type="button"
            onClick={() => setExplainerOpen((v) => !v)}
            aria-expanded={explainerOpen}
            className={styles.explainerButton}
          >
            <div className="flex items-center gap-3">
              <span className={styles.explainerKicker}>
                What is this · plain English
              </span>
              <span className={styles.explainerTitle}>
                Why every AI trade goes through three independent checks
              </span>
            </div>
            {explainerOpen ? (
              <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
            )}
          </button>

          {explainerOpen && (
            <div className={styles.explainerBody}>
              <p>
                Think of the AI agent as a fast, never-sleeping junior trader.
                It can be smart, but it can also drift, hallucinate a trade
                that never landed on chain, or make decisions on stale data.
                The Discipline Layer is its compliance officer. After every
                cycle, three independent gates check the AI&apos;s work against
                blockchain reality. If any gate fails, the trade is not
                accepted into the public record — and the reason is published
                instead.
              </p>

              <div className={styles.explainerGrid}>
                <ExplainerGate
                  icon={Receipt}
                  title="TX Proof"
                  oneLiner="Show me the receipt"
                  body={
                    <>
                      The agent claims a swap landed. We don&apos;t take its
                      word for it — we read the transaction directly from
                      Mantle. Was the hash real? Did our wallet send it? Did
                      it confirm? Did it revert? If any of those is no, the
                      swap is officially{" "}
                      <span className="text-red-400/80">BLOCKED</span>, even
                      if the agent logged success.
                    </>
                  }
                  whyItMatters="Catches the &apos;agent advertised a swap that never happened&apos; failure mode that hit us on cycles 113–122."
                />
                <ExplainerGate
                  icon={Clock}
                  title="Price Freshness"
                  oneLiner="Was your data from 5 seconds ago, or 5 minutes?"
                  body={
                    <>
                      The agent decided based on a price snapshot. We check
                      how old that snapshot was. If older than{" "}
                      <span className="text-white/70">60 seconds</span>, the
                      decision used stale data — markets move enough in a
                      minute to change the right answer. Block.
                    </>
                  }
                  whyItMatters="Stops the agent from acting on a price feed that lagged behind reality."
                />
                <ExplainerGate
                  icon={Activity}
                  title="Drift Detection"
                  oneLiner="Are we still doing the right thing this regime?"
                  body={
                    <>
                      We watch how many times in a row the action mismatches
                      the declared market regime. After{" "}
                      <span className="text-white/70">3 consecutive</span>{" "}
                      mismatches, we force a stop and ask the operator to
                      re-confirm the regime before more capital moves.
                    </>
                  }
                  whyItMatters="Prevents the AI from digging itself into a hole when conditions change but the prompt hasn't caught up yet."
                />
              </div>

              <div className={styles.explainerNote}>
                <p>
                  Verdict on every cycle is one of two things:{" "}
                  <span className="text-emerald-400/80 font-mono">
                    ACCEPTED
                  </span>{" "}
                  or{" "}
                  <span className="text-red-400/80 font-mono">BLOCKED</span>.
                  Blocks come with a{" "}
                  <span className="text-white/70 font-mono">blockReason</span>{" "}
                  (what failed) and a{" "}
                  <span className="text-white/70 font-mono">repairStep</span>{" "}
                  (how to fix it). Both are stored alongside the decision so
                  judges and operators see the same truth.
                </p>
                <p>
                  This is the &quot;Proof of Reasoning&quot; backbone: an AI
                  agent that{" "}
                  <span className="text-white/70">
                    has to prove every action
                  </span>{" "}
                  — not just claim it.
                </p>
                <div className={styles.sourceLinks}>
                  <a
                    href="https://github.com/USBVadik/synrail"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-purple-400/80 hover:text-purple-300 transition-colors"
                  >
                    Inspired by Synrail
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://github.com/USBVadik/TuringVault-Core/blob/main/src/orchestrator/disciplineLayer.js"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/70 transition-colors"
                  >
                    Read the source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href="https://github.com/USBVadik/TuringVault-Core/blob/main/docs/discipline-layer.md"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/70 transition-colors"
                  >
                    Architecture doc
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {data && (
          <>
            {/* Summary */}
            <SummaryCard summary={data.summary} />

            {/* Latest with full detail */}
            {data.latest && (
              <div className={styles.latestPanel}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h3>Latest cycle</h3>
                    <p>Full post-execution gate detail</p>
                  </div>
                  <span
                    className={`${styles.statusPill} ${verdictPillClass(
                      data.latest.status,
                      data.latest.checks
                    )}`}
                  >
                    {displayVerdict(data.latest.status, data.latest.checks)}
                  </span>
                </div>
                <div className={styles.latestMeta}>
                  {data.latestEntry?.at && (
                    <span>
                      {relativeTime(data.latestEntry.at)} · cycle #
                      {data.latestEntry.decisionId ?? "?"}
                    </span>
                  )}
                </div>
                {data.latest.blockReason && (
                  <div className={styles.blockReason}>
                    blockReason: {data.latest.blockReason}
                  </div>
                )}
                {data.latest.repairStep && (
                  <div className={styles.repairStep}>
                    repairStep: {data.latest.repairStep}
                  </div>
                )}
                <div className={styles.latestChecks}>
                  {data.latest.checks.map((c, i) => (
                    <div
                      key={i}
                      className={styles.latestCheckRow}
                    >
                      <span>
                        <StatusIcon status={c.status} />
                      </span>
                      <strong>
                        {GATE_LABEL[c.name] ?? c.name}
                      </strong>
                      <em>
                        {c.detail ?? ""}
                      </em>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History table */}
            <div className={styles.historyPanel}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>History</h3>
                  <p>Last {data.history.length} cycles</p>
                </div>
              </div>
              {data.history.length === 0 ? (
                <p className="text-white/30 text-sm">
                  No cycles recorded yet. New cycles auto-populate.
                </p>
              ) : (
                <div className={styles.tableScroller}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>cycle</th>
                        <th>when</th>
                        <th>verdict</th>
                        {KNOWN_GATES.map((g) => (
                          <th key={g}>{GATE_LABEL[g]}</th>
                        ))}
                        <th>block reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((e, i) => {
                        const checkByName = Object.fromEntries(
                          e.checks.map((c) => [c.name, c])
                        );
                        const isOpen = expanded.has(i);
                        return (
                          <Fragment key={i}>
                            <tr
                              onClick={() => toggle(i)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggle(i);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-expanded={isOpen}
                            >
                              <td>{e.decisionId ?? "?"}</td>
                              <td>{relativeTime(e.at)}</td>
                              <td>
                                <span
                                  className={`${styles.statusPill} ${verdictPillClass(
                                    e.verdict,
                                    e.checks
                                  )}`}
                                >
                                  {displayVerdict(e.verdict, e.checks)}
                                </span>
                              </td>
                              {KNOWN_GATES.map((g) => {
                                const c = checkByName[g];
                                return (
                                  <td
                                    key={g}
                                    title={
                                      c?.status
                                        ? `${c.status}${c.detail ? ` — ${c.detail}` : ""}`
                                        : "no check recorded for this cycle"
                                    }
                                  >
                                    <span className={styles.gateIconCell}>
                                      <StatusIcon status={c?.status} />
                                    </span>
                                  </td>
                                );
                              })}
                              <td className={styles.reasonCell}>
                                {e.blockReason ?? e.error ?? ""}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className={styles.drillRow}>
                                <td colSpan={3 + KNOWN_GATES.length + 1}>
                                  <pre>{JSON.stringify(e, null, 2)}</pre>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {data.summary.firstCycleAt && (
              <div className={styles.footerNote}>
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
    <div className={styles.summaryGrid}>
      <Tile label="Cycles tracked" value={String(summary.totalEntries)} />
      <Tile
        label="Accepted"
        value={String(summary.acceptedCount)}
        tone="emerald"
      />
      <Tile label="Blocked" value={String(summary.blockedCount)} tone="red" />
      <Tile label="Skipped" value={String(summary.skippedCount)} tone="muted" />

      {KNOWN_GATES.map((g) => {
        if (g === "tx_proof") {
          const hasExecutedTx = summary.cyclesWithTx > 0;
          const rate = summary.txProofPassRateExecutedOnly;
          const nonPassing =
            summary.txProofFailCount + summary.txProofWarnCount;
          return (
            <Tile
              key={g}
              label="TX Proof"
              value={
                hasExecutedTx
                  ? `${summary.txProofPassCount}/${summary.cyclesWithTx} tx cycles`
                  : "No swaps"
              }
              tooltip={
                hasExecutedTx
                  ? `${rate ?? "—"}% verified across cycles with a transaction; ${nonPassing} failed/warned (${summary.txProofErrorCount} RPC errors); ${summary.cyclesWithoutTx} HOLD cycles had no tx to verify`
                  : `${summary.cyclesWithoutTx} HOLD cycles had no tx to verify`
              }
              tone={
                !hasExecutedTx
                  ? "muted"
                  : rate != null && rate >= 90
                  ? "emerald"
                  : "amber"
              }
            />
          );
        }

        const rate = summary.gatePassRates[g];
        const hasData = rate != null;
        return (
          <Tile
            key={g}
            label={`${GATE_LABEL[g]} pass rate`}
            value={
              hasData
                ? `${rate}%`
                : "—"
            }
            tone={
              hasData && rate! >= 90
                ? "emerald"
                : hasData
                ? "amber"
                : "amber"
            }
          />
        );
      })}
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
  tooltip,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "red" | "amber" | "muted";
  tooltip?: string;
}) {
  const colors = {
    emerald: styles.tileEmerald,
    red: styles.tileRed,
    amber: styles.tileAmber,
    muted: styles.tileMuted,
  }[tone ?? "muted"];
  return (
    <div className={`${styles.tile} ${colors}`} title={tooltip}>
      <div>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

function ExplainerGate({
  icon: Icon,
  title,
  oneLiner,
  body,
  whyItMatters,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  oneLiner: string;
  body: React.ReactNode;
  whyItMatters: string;
}) {
  return (
    <div className={styles.explainerGate}>
      <div>
        <Icon className="w-4 h-4 text-purple-300/80 shrink-0" />
        <span>{title}</span>
      </div>
      <p>&ldquo;{oneLiner}&rdquo;</p>
      <section>{body}</section>
      <footer>
        <span>
          Why it matters ·
        </span>{" "}
        {whyItMatters}
      </footer>
    </div>
  );
}
