import { NextResponse } from "next/server";

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

// Real performance data from on-chain settled outcomes
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

  // Build real equity curve from settled PnL
  const initialNav = 100; // $100 normalized starting capital
  const equityCurve: {
    idx: number;
    nav: number;
    bps: number;
    action?: string;
    date?: string;
  }[] = [];

  let cumulativeBps = 0;
  equityCurve.push({ idx: 0, nav: initialNav, bps: 0 });

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    cumulativeBps += s.pnlBps || 0;
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

  // Categorize trades
  const positive = settled.filter((s: any) => (s.pnlBps || 0) > 0).length;
  const negative = settled.filter((s: any) => (s.pnlBps || 0) < 0).length;
  const neutral = settled.filter((s: any) => (s.pnlBps || 0) === 0).length;

  // Count pending
  const pendingCount = (outcomes.pending || []).filter((e: any) => !e.settled).length;

  // Trade details for table
  const trades = settled.map((s: any, i: number) => ({
    idx: i + 1,
    action: s.action,
    asset: s.targetAsset || "mUSD",
    pnlBps: s.pnlBps || 0,
    date: s.recordedAt?.split("T")[0],
    price: s.priceAtDecision,
  }));

  return NextResponse.json({
    summary: {
      totalReturn: Math.round(totalReturn * 100) / 100,
      cumulativeBps,
      maxDrawdownBps: maxDDBps,
      maxDrawdownPct: Math.round((maxDDBps / 100) * 100) / 100,
      totalTrades: settled.length,
      positiveTrades: positive,
      negativeTrades: negative,
      neutralTrades: neutral,
      avgTradeBps:
        settled.length > 0 ? Math.round(cumulativeBps / settled.length) : 0,
      period: `${settled.length} settled decisions`,
      pendingCount,
      dataSource: "on-chain (ValidationRegistry + IPFS outcomes)",
      note: "Real execution results, not backtested simulation",
    },
    equityCurve,
    trades: trades.slice(-20), // most recent 20
  });
}
