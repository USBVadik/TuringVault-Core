import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetch outcomes from GitHub raw (works on Vercel)
async function fetchOutcomes(): Promise<any> {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/src/data/outcomes.json",
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Outcome-score curve from settled outcomes. pnlBps is a reputation /
// decision-quality score written by outcomeTracker, not realized wallet PnL.
export async function GET() {
  const outcomes = await fetchOutcomes();
  
  if (!outcomes) {
    return NextResponse.json(
      { error: "Failed to fetch outcomes data" },
      { status: 500 }
    );
  }

  const settled = (outcomes.settled || []).sort((a: any, b: any) =>
    (a.recordedAt || "").localeCompare(b.recordedAt || "")
  );

  // Build normalized score curve from settled outcome scores.
  const initialNav = 100; // $100 normalized starting capital
  const equityCurve: {
    idx: number;
    nav: number;
    bps: number;
    action?: string;
    date?: string;
  }[] = [];

  // A consensus swap that never executed on-chain took no position, so its
  // GOOD_CALL/BAD_CALL pnlBps is phantom (the wallet never realized it).
  // Count only realized outcomes — executed swaps + genuine holds/blocks.
  // Mirrors outcomeTracker's INTENT_NOT_EXECUTED handling for new rows and
  // neutralizes historical rows that pre-date that fix (we do not rewrite
  // the committed ledger; we just score it honestly here).
  // Workspace rule: .kiro/steering/no-lying-about-state.md §3 (no phantom PnL).
  const isPhantomCall = (s: any) =>
    s.executedOnChain !== true &&
    (s.outcome === "GOOD_CALL" ||
      s.outcome === "BAD_CALL" ||
      s.outcome === "INTENT_NOT_EXECUTED");
  const effectiveBps = (s: any): number => (isPhantomCall(s) ? 0 : s.pnlBps || 0);
  const intentNotExecutedCount = settled.filter(isPhantomCall).length;

  let cumulativeBps = 0;
  equityCurve.push({ idx: 0, nav: initialNav, bps: 0 });

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    cumulativeBps += effectiveBps(s);
    const nav = initialNav * (1 + cumulativeBps / 10000);
    equityCurve.push({
      idx: i + 1,
      nav: Math.round(nav * 100) / 100,
      bps: cumulativeBps,
      action: s.action,
      date: s.recordedAt?.split("T")[0],
    });
  }

  const finalNav = equityCurve[equityCurve.length - 1].nav;
  const totalReturn = ((finalNav - initialNav) / initialNav) * 100;

  // Max drawdown in bps
  let peak = 0;
  let maxDDBps = 0;
  for (const pt of equityCurve) {
    if (pt.bps > peak) peak = pt.bps;
    const dd = peak - pt.bps;
    if (dd > maxDDBps) maxDDBps = dd;
  }

  // Realized swap drawdown — peak-to-trough over ONLY executed swaps that took
  // a position (executedOnChain && GOOD_CALL/BAD_CALL). This is the closest
  // honest proxy to a CAPITAL drawdown. maxDDBps above is the decision-SCORE
  // drawdown and is dominated by MISSED_ALPHA (holds where price rose =
  // opportunity cost, never a wallet loss), so it overstates capital risk.
  // Both are outcome-score bps, not literal $ NAV. Holds and non-executed
  // intents are excluded here. Rule: no-lying-about-state §3.
  const realizedSwaps = settled.filter(
    (s: any) =>
      s.executedOnChain === true &&
      (s.outcome === "GOOD_CALL" || s.outcome === "BAD_CALL")
  );
  let rsPeak = 0;
  let rsCum = 0;
  let realizedSwapDrawdownBps = 0;
  let worstExecutedSwapBps = 0;
  for (const s of realizedSwaps) {
    const b = typeof s.pnlBps === "number" ? s.pnlBps : 0;
    rsCum += b;
    if (rsCum > rsPeak) rsPeak = rsCum;
    const dd = rsPeak - rsCum;
    if (dd > realizedSwapDrawdownBps) realizedSwapDrawdownBps = dd;
    if (b < worstExecutedSwapBps) worstExecutedSwapBps = b;
  }

  // Categorize trades
  const positive = settled.filter((s: any) => effectiveBps(s) > 0).length;
  const negative = settled.filter((s: any) => effectiveBps(s) < 0).length;
  const neutral = settled.filter((s: any) => effectiveBps(s) === 0).length;

  // Count pending
  const pendingCount = (outcomes.pending || []).filter((e: any) => !e.settled).length;

  // Trade details for table
  const trades = settled.map((s: any, i: number) => ({
    idx: i + 1,
    action: s.action,
    asset: s.targetAsset || "mUSD",
    pnlBps: effectiveBps(s),
    executed: s.executedOnChain === true,
    intentOnly: isPhantomCall(s),
    date: s.recordedAt?.split("T")[0],
    price: s.priceAtDecision,
  }));

  return NextResponse.json({
    summary: {
      totalReturn: Math.round(totalReturn * 100) / 100,
      cumulativeBps,
      maxDrawdownBps: maxDDBps,
      maxDrawdownPct: Math.round((maxDDBps / 100) * 100) / 100,
      realizedSwapDrawdownBps,
      realizedSwapDrawdownPct:
        Math.round((realizedSwapDrawdownBps / 100) * 100) / 100,
      realizedSwapCount: realizedSwaps.length,
      worstExecutedSwapBps,
      totalTrades: settled.length,
      positiveTrades: positive,
      negativeTrades: negative,
      neutralTrades: neutral,
      avgTradeBps:
        settled.length > 0 ? Math.round(cumulativeBps / settled.length) : 0,
      period: `${settled.length} settled decisions`,
      pendingCount,
      intentNotExecutedExcluded: intentNotExecutedCount,
      dataSource: "src/data/outcomes.json settled outcome scores",
      note:
        "Decision outcome score, not realized wallet PnL or a backtested trading equity curve",
      scoreMethodology:
        "cumulativeBps = sum of pnlBps over REALIZED outcomes only (executed swaps + holds/blocks). Proposed swaps that never executed on-chain score 0 (intent-not-executed) and are excluded — they took no position.",
      drawdownMethodology:
        "maxDrawdownBps is the worst peak-to-trough of the decision-SCORE curve (executed swaps + holds); it is dominated by MISSED_ALPHA (holds where price rose = opportunity cost), not capital losses. realizedSwapDrawdownBps is the peak-to-trough over executed swaps only (the closest honest proxy to a capital drawdown). Both are outcome-score bps, not literal $ NAV. worstExecutedSwapBps is the most-negative single executed swap.",
    },
    equityCurve,
    trades: trades.slice(-20), // most recent 20
  }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}
