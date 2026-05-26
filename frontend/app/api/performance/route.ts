/**
 * GET /api/performance
 *
 * Lifetime aggregate performance for agentId=0.
 * Numbers are derived from:
 *   - Mantle on-chain reads (NAV from agent EOA balances)
 *   - src/data/outcomes.json (settled[]) — outcome buckets, win rate, cumPnL
 *
 * What this endpoint NEVER returns:
 *   - Hardcoded Sharpe, maxDrawdown, recoveryHours, hoursTracked. Those
 *     metrics need a real performance tracker driven by sufficient cycle
 *     history. The previous implementation faked them with a constant
 *     fallback; that is now removed.
 *   - totalReturn computed from a mocked `initialNav = 5 * mntPrice`. Until
 *     a real initial-NAV record exists on disk, we don't return totalReturn.
 *
 * Field semantics:
 *   - winRate         : (GOOD_CALL + CORRECT_BLOCK) / settledCount  in % (1 dp)
 *   - cumulativePnlBps: sum(pnlBps) across settled[]
 *   - dataScope       : 'agent-lifetime'  → aggregate across the entire
 *                       agent history; not per-user. Frontend MUST label
 *                       these as Lifetime (R4).
 *
 * Spec: .kiro/specs/ui-honesty-pass/{requirements,design,tasks}.md (T5, R3, R10)
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE: HeadersInit = { 'Cache-Control': 'no-store, max-age=0' };

const WALLET = '0xDC783CDBfA993f3FC299460627b204E83bf4fb5a';
const METH_TOKEN = '0xcDA86A272531e8640cD7F1a92c01839911B90bb0';

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

type PerformanceResponse = {
  // On-chain reads (live)
  nav: number | null;
  mnt: number | null;
  meth: string | null;
  mntPrice: number | null;
  ethPrice: number | null;

  // Derived from outcomes.json (lifetime aggregate)
  settledCount: number | null;
  winRate: number | null;            // % with 1 decimal, or null when no data
  goodCallCount: number;
  correctBlockCount: number;
  badCallCount: number;
  missedAlphaCount: number;
  cumulativePnlBps: number;
  lastSettlementAt: string | null;

  // Honesty labels
  dataScope: 'agent-lifetime';
  source: {
    onchain: 'mantle-mainnet';
    aggregates: 'src/data/outcomes.json';
  };
  error?: string;
};

function backendPath(...segments: string[]): string {
  return path.resolve(process.cwd(), '..', ...segments);
}

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
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

async function getPrices(): Promise<{ mntPrice: number | null; ethPrice: number | null }> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=mantle,mantle-staked-ether&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return { mntPrice: null, ethPrice: null };
    const json = (await res.json()) as Record<string, { usd?: number }>;
    return {
      mntPrice: json.mantle?.usd ?? null,
      ethPrice: json['mantle-staked-ether']?.usd ?? null,
    };
  } catch {
    return { mntPrice: null, ethPrice: null };
  }
}

async function getOnchainBalances(): Promise<{
  mnt: number | null;
  methWei: bigint | null;
}> {
  try {
    const client = createPublicClient({
      chain: mantle,
      transport: http('https://rpc.mantle.xyz'),
    });
    const [mntBal, methBal] = await Promise.all([
      client.getBalance({ address: WALLET as `0x${string}` }),
      client.readContract({
        address: METH_TOKEN as `0x${string}`,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: '', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ] as const,
        functionName: 'balanceOf',
        args: [WALLET as `0x${string}`],
      }),
    ]);
    return {
      mnt: Number(mntBal) / 1e18,
      methWei: methBal as bigint,
    };
  } catch {
    return { mnt: null, methWei: null };
  }
}

export async function GET(): Promise<NextResponse> {
  // ── On-chain (live) ─────────────────────────────────────────────
  const [{ mntPrice, ethPrice }, { mnt, methWei }] = await Promise.all([
    getPrices(),
    getOnchainBalances(),
  ]);

  const meth = methWei !== null ? (Number(methWei) / 1e18).toFixed(6) : null;
  const methFloat = methWei !== null ? Number(methWei) / 1e18 : null;
  const nav =
    mnt !== null && mntPrice !== null && methFloat !== null && ethPrice !== null
      ? Math.round((mnt * mntPrice + methFloat * ethPrice) * 100) / 100
      : null;

  // ── Outcomes aggregate (lifetime) ───────────────────────────────
  const outcomesPath = backendPath('src', 'data', 'outcomes.json');
  const outcomes = safeReadJson<Outcomes>(outcomesPath);
  const settled: SettledOutcome[] = outcomes?.settled ?? [];

  const settledCount = settled.length;
  let goodCallCount = 0;
  let correctBlockCount = 0;
  let badCallCount = 0;
  let missedAlphaCount = 0;
  let cumulativePnlBps = 0;

  for (const o of settled) {
    switch (o.outcome) {
      case 'GOOD_CALL':
        goodCallCount++;
        break;
      case 'CORRECT_BLOCK':
        correctBlockCount++;
        break;
      case 'BAD_CALL':
        badCallCount++;
        break;
      case 'MISSED_ALPHA':
        missedAlphaCount++;
        break;
      default:
        // NEUTRAL or unknown — counted in settledCount, not in any bucket
        break;
    }
    cumulativePnlBps += typeof o.pnlBps === 'number' ? o.pnlBps : 0;
  }

  const winRate =
    settledCount > 0
      ? Math.round(((goodCallCount + correctBlockCount) / settledCount) * 1000) / 10
      : null;

  const lastSettlementAt = newestSettlementIso(settled);

  const body: PerformanceResponse = {
    nav,
    mnt: mnt !== null ? Math.round(mnt * 1000) / 1000 : null,
    meth,
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
    dataScope: 'agent-lifetime',
    source: {
      onchain: 'mantle-mainnet',
      aggregates: 'src/data/outcomes.json',
    },
    ...(outcomes ? {} : { error: 'outcomes.json unreachable in this deployment' }),
  };

  return NextResponse.json(body, { headers: NO_STORE });
}
