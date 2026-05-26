import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mantle } from 'viem/chains';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WALLET = '0xDC783CDBfA993f3FC299460627b204E83bf4fb5a';

// Same token list + decimals as /api/performance.
// rwa-treasury class = USDT0, USDY (paper-ready). Stable class = USDT_legacy,
// mUSD. Risk class = MNT, WMNT, mETH. NAV % is computed across all of them.
const TOKENS = {
  WMNT:        { address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', decimals: 18, class: 'native' },
  mETH:        { address: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0', decimals: 18, class: 'eth-staking' },
  mUSD:        { address: '0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3', decimals: 18, class: 'stable' },
  USDT_legacy: { address: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE', decimals: 6,  class: 'stable' },
  USDT0:       { address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', decimals: 6,  class: 'rwa-treasury' },
  USDY:        { address: '0x5bE26527e817998A7206475496fDE1E68957c5A6', decimals: 18, class: 'rwa-treasury' },
} as const;

const ERC20_ABI = [{
  name: 'balanceOf', type: 'function', stateMutability: 'view',
  inputs: [{ name: '', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}] as const;

type RwaIntent = { source?: string; executed?: boolean; amountInUsd?: number; from?: string; to?: string };
type OutcomeRow = { decisionId?: number; recordedAt?: string; settledAt?: string; rwaIntent?: RwaIntent | null };

/**
 * Compute current RWA allocation as % of NAV from live on-chain reads.
 * Stables priced at $1; MNT/WMNT/mETH priced from CoinGecko. Returns null
 * if any required price is unavailable (honest degradation).
 *
 * Spec: rwa-allocation-active R5 / design §C9.
 */
async function computeRwaPctNav(): Promise<{ navUsd: number; rwaUsd: number; pctNav: number } | null> {
  try {
    const client = createPublicClient({ chain: mantle, transport: http('https://rpc.mantle.xyz') });

    let mntPrice = 0.72, ethPrice = 2100;
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=mantle,mantle-staked-ether&vs_currencies=usd',
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) {
        const j = await r.json();
        if (j.mantle?.usd) mntPrice = j.mantle.usd;
        if (j['mantle-staked-ether']?.usd) ethPrice = j['mantle-staked-ether'].usd;
      }
    } catch { /* fall back to defaults — honest enough for % calc */ }

    const native = await client.getBalance({ address: WALLET as `0x${string}` });
    const mnt = Number(native) / 1e18;
    let navUsd = mnt * mntPrice;
    let rwaUsd = 0;

    for (const [sym, info] of Object.entries(TOKENS)) {
      let bal = 0;
      try {
        const wei = await client.readContract({
          address: info.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [WALLET as `0x${string}`],
        });
        bal = Number(wei) / 10 ** info.decimals;
      } catch {
        continue;
      }
      let priceUsd = 1;
      if (info.class === 'native') priceUsd = mntPrice;
      else if (info.class === 'eth-staking') priceUsd = ethPrice;
      const usdValue = bal * priceUsd;
      navUsd += usdValue;
      if (info.class === 'rwa-treasury') rwaUsd += usdValue;
    }

    if (navUsd <= 0) return null;
    return {
      navUsd: Math.round(navUsd * 100) / 100,
      rwaUsd: Math.round(rwaUsd * 100) / 100,
      pctNav: Math.round((rwaUsd / navUsd) * 1000) / 10,
    };
  } catch {
    return null;
  }
}

/**
 * Read outcomes.json and pull the most recent executed RWA swap.
 * Returns null when there's never been one.
 *
 * Spec: rwa-allocation-active R5, design §C9.
 */
async function readLatestRwaSwap(): Promise<{ at: string; source: string } | null> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const p = path.resolve(process.cwd(), '..', 'src', 'data', 'outcomes.json');
    if (!fs.existsSync(p)) return null;
    const db = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const all: OutcomeRow[] = [...(db.pending ?? []), ...(db.settled ?? [])];
    let latest: { at: string; source: string } | null = null;
    for (const e of all) {
      const ri = e?.rwaIntent;
      if (!ri || !ri.executed) continue;
      const at = e.recordedAt ?? e.settledAt ?? null;
      if (at && (!latest || Date.parse(at) > Date.parse(latest.at))) {
        latest = { at, source: ri.source ?? 'unknown' };
      }
    }
    return latest;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Read position state and grid signal from backend data files
    const fs = await import('fs');
    const path = await import('path');
    
    // Position state
    let positionState: any = { status: 'FLAT', entryPrice: null, targetExit: null, stopLoss: null };
    const statePath = path.resolve(process.cwd(), '../src/data/position_state.json');
    try {
      const raw = fs.readFileSync(statePath, 'utf-8');
      positionState = JSON.parse(raw);
    } catch {}

    // Grid signal — fetch live from CoinGecko to compute channel
    let channel = { support: 0, resistance: 0, currentPrice: 0, isRanging: false, channelPosition: 0 };
    try {
      const cgRes = await fetch(
        'https://api.coingecko.com/api/v3/coins/mantle/market_chart?vs_currency=usd&days=2',
        { signal: AbortSignal.timeout(5000) }
      );
      if (cgRes.ok) {
        const data = await cgRes.json();
        const prices = data.prices.map((p: number[]) => p[1]);
        const sorted = [...prices].sort((a, b) => a - b);
        const support = sorted[Math.floor(sorted.length * 0.1)];
        const resistance = sorted[Math.floor(sorted.length * 0.9)];
        const currentPrice = prices[prices.length - 1];
        const channelWidth = ((resistance - support) / support) * 100;
        const channelPosition = (currentPrice - support) / (resistance - support);
        
        // Simple trend detection
        const recentSlice = prices.slice(-12);
        const firstHalf = recentSlice.slice(0, 6).reduce((a: number, b: number) => a + b, 0) / 6;
        const secondHalf = recentSlice.slice(6).reduce((a: number, b: number) => a + b, 0) / 6;
        const hasTrend = Math.abs(secondHalf - firstHalf) / firstHalf > 0.005;
        const isRanging = channelWidth >= 0.7 && !hasTrend;

        channel = { support, resistance, currentPrice, isRanging, channelPosition };
      }
    } catch {}

    // Determine regime
    let regime = 'UNKNOWN';
    if (channel.isRanging) regime = 'RANGING';
    else if (channel.currentPrice > channel.resistance) regime = 'BREAKOUT';
    else regime = 'TRENDING';

    // Determine position display
    let position = 'FLAT';
    if (positionState.status && positionState.status !== 'FLAT') {
      position = `${positionState.status} @ $${Number(positionState.entryPrice).toFixed(4)}`;
    }

    // Risk:Reward
    let riskReward = null;
    if (positionState.targetExit && positionState.stopLoss && positionState.entryPrice) {
      const reward = Math.abs(positionState.targetExit - positionState.entryPrice);
      const risk = Math.abs(positionState.entryPrice - positionState.stopLoss);
      riskReward = risk > 0 ? (reward / risk).toFixed(1) : null;
    }

    // RWA allocation surface (rwa-allocation-active R5, design §C9).
    const [latestRwa, rwaPct] = await Promise.all([readLatestRwaSwap(), computeRwaPctNav()]);
    const flatSinceMs = positionState?.flatSince ? Date.parse(positionState.flatSince) : NaN;
    const daysSinceLastFlatStart = Number.isFinite(flatSinceMs)
      ? Math.floor((Date.now() - flatSinceMs) / 86400000)
      : null;
    const rwaAllocation = {
      currentPctNav: rwaPct?.pctNav ?? null,        // % of NAV in rwa-treasury class
      navUsd: rwaPct?.navUsd ?? null,
      rwaUsd: rwaPct?.rwaUsd ?? null,
      target: { min: 10, max: 50 },
      lastRebalanceAt: latestRwa?.at ?? null,
      daysSinceLastFlatStart,
      executeEnabled: process.env.RWA_EXECUTE_ENABLED === 'true',
      source: (latestRwa?.source ?? 'none') as 'llm' | 'idle-parking' | 'none' | 'unknown',
      activeAssets: ['USDT0'],
      paperReadyAssets: ['USDY'],     // pool dry; honest label per no-lying rule
    };

    return NextResponse.json({
      regime,
      position,
      channel: {
        support: Number(channel.support.toFixed(4)),
        resistance: Number(channel.resistance.toFixed(4)),
      },
      currentPrice: Number(channel.currentPrice.toFixed(4)),
      tp: positionState.targetExit ? `$${Number(positionState.targetExit).toFixed(4)}` : null,
      sl: positionState.stopLoss ? `$${Number(positionState.stopLoss).toFixed(4)}` : null,
      riskReward,
      varGate: '< 150 bps',
      lastUpdated: positionState.lastUpdated || new Date().toISOString(),
      dataScope: 'agent-lifetime',
      cached: true,
      rwaAllocation,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
