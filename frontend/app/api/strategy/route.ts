import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
