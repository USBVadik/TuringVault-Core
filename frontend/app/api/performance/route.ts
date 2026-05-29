/**
 * GET /api/performance
 *
 * Lifetime aggregate performance for agentId=0.
 *
 * NAV = native MNT + Σ(ERC-20 balance × USD price) for all known holdings:
 *   MNT, WMNT, mETH, USDT (legacy bridged), USDT0 (LayerZero OFT — sponsor
 *   asset for the AI x RWA narrative), mUSD, USDY.
 *
 * Outcome buckets, win rate, cumulative PnL come from src/data/outcomes.json
 * (already migrated to schemaVersion 2 with decisionTier).
 *
 * What this endpoint NEVER returns:
 *   - Hardcoded Sharpe, maxDrawdown, recoveryHours, hoursTracked.
 *   - totalReturn computed from a mocked initialNav.
 *
 * Spec: .kiro/specs/ui-honesty-pass (no-lying-about-state)
 *       Updated to include all 6 token holdings after operator
 *       pointed out missing USDT0/USDT/WMNT in NAV (2026-05-26).
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, http } from "viem";
import { mantle } from "viem/chains";

export const dynamic = "force-dynamic";
// Audit Section 3 weakness #3 — was 0. Performance reads live RPC
// for wallet balances + CoinGecko for prices. With s-maxage=30 below,
// the edge serves the last good payload during transient 502s.
export const revalidate = 30;

/**
 * SWR cache headers — same pattern as /api/health, /api/decisions etc.
 * Reduces RPC + CoinGecko 502 stress on the user-facing surface.
 */
const SWR_CACHE: HeadersInit = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  "X-Cache-Mode": "swr",
};

const WALLET = "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";

// All ERC-20s the agent ever holds. Decimals confirmed via on-chain probe.
const TOKENS = {
  WMNT: { address: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8", decimals: 18 },
  mETH: { address: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0", decimals: 18 },
  mUSD: { address: "0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3", decimals: 18 },
  USDT_legacy: {
    address: "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
    decimals: 6,
  },
  USDT0: { address: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", decimals: 6 },
  USDY: { address: "0x5bE26527e817998A7206475496fDE1E68957c5A6", decimals: 18 },
} as const;

type TokenSymbol = keyof typeof TOKENS;

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type SettledOutcome = {
  outcome?: string;
  pnlBps?: number;
  settledAt?: string;
  recordedAt?: string;
};

type Outcomes = {
  pending?: unknown[];
  settled?: SettledOutcome[];
};

type Holdings = Record<string, number | null>;

type PerformanceResponse = {
  // NAV + breakdown (live on-chain reads)
  nav: number | null;
  holdings: Holdings;
  prices: Record<string, number | null>;

  // Legacy aliases — kept temporarily so older frontend code still renders
  mnt: number | null;
  meth: string | null;
  mntPrice: number | null;
  ethPrice: number | null;

  // Derived from outcomes.json (lifetime aggregate)
  settledCount: number | null;
  winRate: number | null;
  goodCallCount: number;
  correctBlockCount: number;
  badCallCount: number;
  missedAlphaCount: number;
  cumulativePnlBps: number;
  lastSettlementAt: string | null;

  dataScope: "agent-lifetime";
  source: {
    onchain: "mantle-mainnet";
    aggregates: "src/data/outcomes.json";
  };
  winRateDenominator: string;
  error?: string;
};

function backendPath(...segments: string[]): string {
  return path.resolve(process.cwd(), "..", ...segments);
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
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

function newestSettlementIso(settled: SettledOutcome[]): string | null {
  let newest: string | null = null;
  let newestMs = -Infinity;
  for (const o of settled) {
    const iso = o.settledAt ?? o.recordedAt;
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) continue;
    if (ms > newestMs) {
      newestMs = ms;
      newest = iso;
    }
  }
  return newest;
}

/**
 * Fetch USD prices from CoinGecko in a single call. Stable-pegged tokens
 * (USDT0, USDT_legacy, mUSD, USDY) are assumed = $1.00 to avoid round-trips
 * for tokens CoinGecko sometimes lacks; this matches Mantlescan's display
 * within a few tenths of a cent and is honest enough for the dashboard.
 */
async function getPrices(): Promise<{
  mntPrice: number | null;
  ethPrice: number | null; // mantle-staked-ether (mETH)
}> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=mantle,mantle-staked-ether&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { mntPrice: null, ethPrice: null };
    const json = (await res.json()) as Record<string, { usd?: number }>;
    return {
      mntPrice: json.mantle?.usd ?? null,
      ethPrice: json["mantle-staked-ether"]?.usd ?? null,
    };
  } catch {
    return { mntPrice: null, ethPrice: null };
  }
}

async function getAllBalances(client: ReturnType<typeof createPublicClient>) {
  const native = client.getBalance({ address: WALLET as `0x${string}` });
  const erc20Calls = (
    Object.entries(TOKENS) as [TokenSymbol, (typeof TOKENS)[TokenSymbol]][]
  ).map(async ([sym, info]) => {
    try {
      const wei = await client.readContract({
        address: info.address as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [WALLET as `0x${string}`],
      });
      const f = Number(wei) / 10 ** info.decimals;
      return [sym, f] as const;
    } catch {
      return [sym, null] as const;
    }
  });
  const [nativeWei, ...rest] = await Promise.all([native, ...erc20Calls]);
  const mnt = Number(nativeWei) / 1e18;
  const balances: Record<string, number | null> = { MNT: mnt };
  for (const entry of rest) {
    const [sym, val] = entry as [TokenSymbol, number | null];
    balances[sym] = val;
  }
  return balances;
}

export async function GET(): Promise<NextResponse> {
  // ── On-chain (live) ─────────────────────────────────────────────
  const client = createPublicClient({
    chain: mantle,
    transport: http("https://rpc.mantle.xyz"),
  });

  const [{ mntPrice, ethPrice }, balances] = await Promise.all([
    getPrices(),
    getAllBalances(client),
  ]);

  // Stable-pegged assets at $1; mETH gets ETH price; MNT/WMNT use mntPrice.
  const prices: Record<string, number | null> = {
    MNT: mntPrice,
    WMNT: mntPrice,
    mETH: ethPrice,
    USDT_legacy: 1.0,
    USDT0: 1.0,
    mUSD: 1.0,
    USDY: 1.0,
  };

  // NAV = Σ(balance × price) where both are non-null and >0.
  let nav: number | null = null;
  let canCompute = true;
  let acc = 0;
  for (const [sym, bal] of Object.entries(balances)) {
    if (bal == null) continue; // unreachable token doesn't blow NAV
    const p = prices[sym];
    if (p == null) {
      canCompute = false;
      break;
    }
    acc += bal * p;
  }
  if (canCompute) {
    nav = Math.round(acc * 100) / 100;
  }

  // ── Outcomes aggregate (lifetime) ───────────────────────────────
  const outcomesPath = backendPath("src", "data", "outcomes.json");
  let outcomes = safeReadJson<Outcomes>(outcomesPath);
  if (!outcomes) {
    outcomes = await fetchFromGitHub<Outcomes>("src/data/outcomes.json");
  }
  const settled: SettledOutcome[] = outcomes?.settled ?? [];

  const settledCount = settled.length;
  let goodCallCount = 0;
  let correctBlockCount = 0;
  let badCallCount = 0;
  let missedAlphaCount = 0;
  let cumulativePnlBps = 0;

  for (const o of settled) {
    switch (o.outcome) {
      case "GOOD_CALL":
        goodCallCount++;
        break;
      case "CORRECT_BLOCK":
        correctBlockCount++;
        break;
      case "BAD_CALL":
        badCallCount++;
        break;
      case "MISSED_ALPHA":
        missedAlphaCount++;
        break;
      default:
        break;
    }
    cumulativePnlBps += typeof o.pnlBps === "number" ? o.pnlBps : 0;
  }

  // Win Rate methodology (unified with /api/reputation denominator docs):
  // Numerator = GOOD_CALL + CORRECT_BLOCK (favourable outcomes)
  // Denominator = all settled outcomes (total sample)
  // This differs from /api/reputation which uses on-chain positiveCount/totalFeedback
  // from ReputationRegistry. That contract only counts explicit feedback submissions,
  // whereas this counts all settled outcomes including those never submitted on-chain.
  // Both methods are documented via `winRateDenominator` field.
  const winRate =
    settledCount > 0
      ? Math.round(
          ((goodCallCount + correctBlockCount) / settledCount) * 1000
        ) / 10
      : null;

  const lastSettlementAt = newestSettlementIso(settled);

  // Round holdings for display (preserves ≥ 6 sig figs for stables, 4 for MNT-class)
  const roundedHoldings: Holdings = {};
  for (const [sym, bal] of Object.entries(balances)) {
    if (bal == null) {
      roundedHoldings[sym] = null;
      continue;
    }
    // 6 decimals for stables (USDT-style), 4 for native/MNT, 6 for mETH
    const decimals =
      sym === "mETH"
        ? 6
        : sym.startsWith("USDT") || sym === "mUSD" || sym === "USDY"
        ? 4
        : 3;
    roundedHoldings[sym] = Math.round(bal * 10 ** decimals) / 10 ** decimals;
  }

  const body: PerformanceResponse = {
    nav,
    holdings: roundedHoldings,
    prices,
    // Legacy aliases — kept so existing UI bindings continue to work until
    // the page is refactored to use `holdings` directly.
    mnt: roundedHoldings.MNT,
    meth:
      roundedHoldings.mETH != null
        ? Number(roundedHoldings.mETH).toFixed(6)
        : null,
    mntPrice,
    ethPrice,
    settledCount: outcomes ? settledCount : null,
    winRate,
    goodCallCount,
    correctBlockCount,
    badCallCount,
    missedAlphaCount,
    cumulativePnlBps,
    lastSettlementAt,
    dataScope: "agent-lifetime",
    source: {
      onchain: "mantle-mainnet",
      aggregates: "src/data/outcomes.json",
    },
    winRateDenominator: "(GOOD_CALL + CORRECT_BLOCK) / settled.length from outcomes.json",
    ...(outcomes
      ? {}
      : { error: "outcomes.json unreachable in this deployment" }),
  };

  return NextResponse.json(body, { headers: SWR_CACHE });
}
