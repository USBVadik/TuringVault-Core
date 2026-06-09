/**
 * /api/yield-meth — Native passive yield surface for the agent's
 * mETH balance.
 *
 * Honesty contract (workspace steering rule §1, §3):
 *   - Every response carries `source` provenance and `degraded`
 *     boolean. `cached:*` indicates the live sources failed and we
 *     served the disk snapshot.
 *   - Reference rate is captured exactly once at the first
 *     successful read (cron path). If reference is not yet set,
 *     `referenceRateAtomic` is null and the UI shows
 *     "Initialising · waiting for first capture".
 *   - Yield is `balance × (rateNow − rateRef) × ethPriceUsd`.
 *   - If rateNow < rateRef we surface assetHealth: "drift" and
 *     return 0 yield (never a negative number).
 *   - This is NOT agent-generated alpha — it is the protocol-
 *     native return on the asset the agent chose to hold.
 *
 * Spec: .kiro/specs/meth-yield-surface
 * Backend module: src/onchain/methRate.js
 */

import { NextResponse } from "next/server";

// SWR caching — match the pattern from /api/decisions et al.
export const revalidate = 60;

type LiveRate = {
  apyPct: number | null;
  tvlUsd: number | null;
  currentRateAtomic: string | null;
  source: string;
  fetchedAt: string;
  degraded: boolean;
  snapshotAgeSec?: number;
};

type Reference = {
  referenceRateAtomic: string | null;
  referenceTs: string | null;
  referenceCapturedFromSource: string | null;
};

type Snapshot = {
  referenceRateAtomic?: string;
  referenceTs?: string;
  referenceCapturedFromSource?: string;
  captures?: Array<{
    ts: string;
    currentRateAtomic: string | null;
    apyPct: number | null;
    source: string;
  }>;
};

const FRESH_CAPTURE_MAX_AGE_SEC = 90 * 60;

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

function readReferenceFromSnapshot(s: Snapshot | null): Reference {
  if (!s) {
    return {
      referenceRateAtomic: null,
      referenceTs: null,
      referenceCapturedFromSource: null,
    };
  }
  return {
    referenceRateAtomic: s.referenceRateAtomic || null,
    referenceTs: s.referenceTs || null,
    referenceCapturedFromSource: s.referenceCapturedFromSource || null,
  };
}

function readLatestCaptureFromSnapshot(s: Snapshot | null): LiveRate | null {
  if (!s || !Array.isArray(s.captures) || s.captures.length === 0) return null;
  const last = s.captures[s.captures.length - 1];
  const fetchedAt = last.ts;
  const ageSec =
    Date.now() - Date.parse(fetchedAt);
  const snapshotAgeSec =
    Number.isFinite(ageSec) ? Math.max(0, Math.round(ageSec / 1000)) : 0;
  return {
    apyPct: last.apyPct ?? null,
    tvlUsd: null,
    currentRateAtomic: last.currentRateAtomic ?? null,
    source: `cached:${last.source || "unknown"}`,
    fetchedAt,
    degraded: snapshotAgeSec > FRESH_CAPTURE_MAX_AGE_SEC,
    snapshotAgeSec,
  };
}

// Yield computation — honest about drift + missing data.
function calcPassiveYield(args: {
  balanceFloat: number;
  rateNowAtomic: string | null;
  rateRefAtomic: string | null;
  ethPriceUsd: number | null;
}): {
  passiveYieldEthAtomic: string;
  passiveYieldUsd: number;
  assetHealth: "ok" | "drift" | "no-data";
  rateDeltaBps: number;
} {
  const { balanceFloat, rateNowAtomic, rateRefAtomic, ethPriceUsd } = args;
  const have = rateNowAtomic && rateRefAtomic && balanceFloat > 0;
  if (!have) {
    return {
      passiveYieldEthAtomic: "0",
      passiveYieldUsd: 0,
      assetHealth: "no-data",
      rateDeltaBps: 0,
    };
  }
  const rNow = BigInt(rateNowAtomic as string);
  const rRef = BigInt(rateRefAtomic as string);
  if (rNow < rRef) {
    const TEN_K = BigInt(10000);
    const driftBps = Number(((rRef - rNow) * TEN_K) / rRef) * -1;
    return {
      passiveYieldEthAtomic: "0",
      passiveYieldUsd: 0,
      assetHealth: "drift",
      rateDeltaBps: driftBps,
    };
  }
  const TEN_E18 = BigInt("1000000000000000000");
  const balAtomic = BigInt(Math.round(balanceFloat * Number(TEN_E18)));
  const yieldAtomic = (balAtomic * (rNow - rRef)) / TEN_E18;
  const yieldEthFloat = Number(yieldAtomic) / Number(TEN_E18);
  const yieldUsd = ethPriceUsd ? yieldEthFloat * Number(ethPriceUsd) : 0;
  const TEN_K2 = BigInt(10000);
  const deltaBps = Number(((rNow - rRef) * TEN_K2) / rRef);
  return {
    passiveYieldEthAtomic: yieldAtomic.toString(),
    passiveYieldUsd: yieldUsd,
    assetHealth: "ok",
    rateDeltaBps: deltaBps,
  };
}

// Lazy-load the perf endpoint internally to share its NAV math
// instead of duplicating contract reads.
async function fetchPerfBalanceAndEthPrice(): Promise<{
  balance: number;
  ethPriceUsd: number | null;
}> {
  // Try direct call to the same project's /api/performance
  // through the Vercel internal URL or relative fetch.
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://frontend-seven-beta-46.vercel.app";
    const r = await fetch(`${baseUrl}/api/performance`, {
      next: { revalidate: 60 },
    });
    if (r.ok) {
      const data = await r.json();
      const balance = Number(data?.holdings?.mETH ?? 0);
      const ethPriceUsd = Number(data?.prices?.mETH ?? data?.ethPrice ?? null);
      return {
        balance: Number.isFinite(balance) ? balance : 0,
        ethPriceUsd: Number.isFinite(ethPriceUsd) ? ethPriceUsd : null,
      };
    }
  } catch {
    /* fall through */
  }
  return { balance: 0, ethPriceUsd: null };
}

export async function GET() {
  const snapshot = await fetchFromGitHub<Snapshot>(
    "src/data/meth_rate_history.json"
  );

  // Live read attempt: we re-use the captures-on-disk path because
  // the cron is the canonical writer and we don't want every page
  // load to call DefiLlama. If the latest capture is fresh (< 90 min)
  // we serve it; otherwise we render `degraded:true`.
  const latest = readLatestCaptureFromSnapshot(snapshot);
  const reference = readReferenceFromSnapshot(snapshot);

  const { balance, ethPriceUsd } = await fetchPerfBalanceAndEthPrice();

  if (!latest) {
    return NextResponse.json(
      {
        currentRateAtomic: null,
        referenceRateAtomic: null,
        referenceTs: null,
        methBalance: balance,
        ethPriceUsd,
        passiveYieldEthAtomic: "0",
        passiveYieldUsd: 0,
        apyPct: null,
        source: null,
        lastSync: null,
        degraded: true,
        assetHealth: "no-data" as const,
        note:
          "No mETH rate captured yet. The first cron cycle after deploy will set the reference rate.",
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=300",
          "X-Cache-Mode": "swr-stale-snapshot",
        },
      }
    );
  }

  const yieldCalc = calcPassiveYield({
    balanceFloat: balance,
    rateNowAtomic: latest.currentRateAtomic,
    rateRefAtomic: reference.referenceRateAtomic,
    ethPriceUsd,
  });

  // APY-projected daily yield for UI surface when redemption-rate
  // path is unavailable (DefiLlama-only). This is a *projection* —
  // labelled explicitly per honesty rule §1; it's NOT realised
  // accrual. Realised accrual lights up once we have rateRef +
  // rateNow from L1 RPC or Mantle stats endpoint.
  const apyProjectedDailyUsd =
    latest.apyPct != null && balance > 0 && ethPriceUsd != null
      ? (balance * Number(ethPriceUsd) * (latest.apyPct / 100)) / 365
      : null;

  // Treat snapshot age >24h as stale at the API layer (steering §1).
  const ageMin =
    typeof latest.snapshotAgeSec === "number"
      ? Math.round(latest.snapshotAgeSec / 60)
      : null;
  const isStale =
    typeof latest.snapshotAgeSec === "number" &&
    latest.snapshotAgeSec > 24 * 60 * 60;

  return NextResponse.json(
    {
      currentRateAtomic: latest.currentRateAtomic,
      referenceRateAtomic: reference.referenceRateAtomic,
      referenceTs: reference.referenceTs,
      referenceCapturedFromSource: reference.referenceCapturedFromSource,
      methBalance: balance,
      ethPriceUsd,
      passiveYieldEthAtomic: yieldCalc.passiveYieldEthAtomic,
      passiveYieldUsd: yieldCalc.passiveYieldUsd,
      apyProjectedDailyUsd,
      rateDeltaBps: yieldCalc.rateDeltaBps,
      apyPct: latest.apyPct,
      source: latest.source,
      lastSync: latest.fetchedAt,
      lastSyncAgeMin: ageMin,
      degraded: latest.degraded || isStale,
      assetHealth: yieldCalc.assetHealth,
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
        "X-Cache-Mode":
          latest.degraded || isStale ? "swr-stale-snapshot" : "swr",
      },
    }
  );
}
