/**
 * TuringVault — Grid Strategy Backtester
 * 
 * Simulates the ranging grid strategy over historical price data.
 * Validates R:R, win rate, and net profit after slippage.
 */

const { detectChannel, computeGridLevels } = require('./rangingGrid');

const SLIPPAGE_PCT = 0.15; // 0.15% per trade (MerchantMoe v2.2)
const GAS_USD = 0.02;      // Mantle gas per swap

/**
 * Generate synthetic ranging price data for testing.
 * Simulates ETH oscillating in a channel with noise.
 */
function generateRangingPrices(support, resistance, hours = 200, noise = 0.3) {
  const prices = [];
  const mid = (support + resistance) / 2;
  const amplitude = (resistance - support) / 2;
  
  // Sine-based oscillation + random noise (realistic channel oscillation)
  let phase = Math.random() * Math.PI * 2;
  const period = 20 + Math.random() * 30; // 20-50 hour oscillation period
  
  for (let i = 0; i < hours; i++) {
    // Base oscillation: sine wave between support and resistance
    const sineComponent = Math.sin(phase + i * (2 * Math.PI / period));
    // Random walk component (bounded)
    const randomComponent = (Math.random() - 0.5) * noise;
    
    // Combine: 70% sine + 30% noise
    const normalized = sineComponent * 0.7 + randomComponent * 0.3;
    const price = mid + normalized * amplitude;
    
    // Clamp to slightly beyond channel (allow rare breakouts)
    prices.push(Math.max(support * 0.985, Math.min(resistance * 1.015, price)));
  }
  return prices;
}

/**
 * Run backtest simulation
 */
function runBacktest(prices, config = {}) {
  const {
    buyZone = 0.30,
    sellZone = 0.70,
    tpChannelPct = 0.75,   // TP at 75% of channel
    slRewardFraction = 0.4, // SL = 40% of reward (adaptive)
    minSlPct = 0.003,       // min 0.3% SL
    trailingActivation = 0.6, // trail after +0.6%
    trailingKeep = 0.6,     // keep 60% of gains
    lookback = 48,
  } = config;

  const trades = [];
  let position = null; // { type: 'long'|'short', entry, tp, sl, hwm }
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  for (let i = lookback; i < prices.length; i++) {
    const price = prices[i];
    const window = prices.slice(i - lookback, i);
    
    // Compute channel from lookback window
    const sorted = [...window].sort((a, b) => a - b);
    const support = sorted[Math.floor(sorted.length * 0.10)];
    const resistance = sorted[Math.floor(sorted.length * 0.90)];
    const channelWidth = resistance - support;
    
    if (channelWidth <= 0) continue;
    
    const pos = Math.max(0, Math.min(1, (price - support) / channelWidth));

    // ── IN POSITION: check exits ──
    if (position) {
      // Update HWM
      if (position.type === 'long') {
        position.hwm = Math.max(position.hwm, price);
      } else {
        position.hwm = Math.min(position.hwm, price);
      }

      let exitReason = null;
      let exitPrice = price;

      if (position.type === 'long') {
        // SL
        if (price <= position.sl) {
          exitReason = 'STOP_LOSS';
        }
        // TP
        else if (price >= position.tp) {
          exitReason = 'TAKE_PROFIT';
        }
        // Trailing stop
        else {
          const profitPct = (price / position.entry - 1) * 100;
          if (profitPct >= trailingActivation && position.hwm > position.entry) {
            const trailLevel = position.hwm - (position.hwm - position.entry) * (1 - trailingKeep);
            if (price <= trailLevel) {
              exitReason = 'TRAILING_STOP';
            }
          }
        }
      } else { // short
        if (price >= position.sl) {
          exitReason = 'STOP_LOSS';
        } else if (price <= position.tp) {
          exitReason = 'TAKE_PROFIT';
        } else {
          const profitPct = (position.entry / price - 1) * 100;
          if (profitPct >= trailingActivation && position.hwm < position.entry) {
            const trailLevel = position.hwm + (position.entry - position.hwm) * (1 - trailingKeep);
            if (price >= trailLevel) {
              exitReason = 'TRAILING_STOP';
            }
          }
        }
      }

      if (exitReason) {
        let pnlPct;
        if (position.type === 'long') {
          pnlPct = (exitPrice / position.entry - 1) * 100 - SLIPPAGE_PCT;
        } else {
          pnlPct = (position.entry / exitPrice - 1) * 100 - SLIPPAGE_PCT;
        }
        // Subtract entry slippage too
        pnlPct -= SLIPPAGE_PCT;
        
        totalPnl += pnlPct;
        if (pnlPct > 0) wins++;
        else losses++;
        
        trades.push({
          type: position.type,
          entry: position.entry,
          exit: exitPrice,
          pnlPct: +pnlPct.toFixed(4),
          reason: exitReason,
          bars: i - position.startBar,
        });
        position = null;
      }
      continue; // don't open new position while in one
    }

    // ── NO POSITION: check entries ──
    if (pos <= buyZone) {
      const targetExit = support + channelWidth * tpChannelPct;
      const expectedReward = targetExit - price;
      const slDistance = Math.max(price * minSlPct, expectedReward * slRewardFraction);
      const stopLoss = price - slDistance;

      position = {
        type: 'long',
        entry: price,
        tp: targetExit,
        sl: stopLoss,
        hwm: price,
        startBar: i,
      };
    } else if (pos >= sellZone) {
      const targetExit = support + channelWidth * (1 - tpChannelPct);
      const expectedReward = price - targetExit;
      const slDistance = Math.max(price * minSlPct, expectedReward * slRewardFraction);
      const stopLoss = price + slDistance;

      position = {
        type: 'short',
        entry: price,
        tp: targetExit,
        sl: stopLoss,
        hwm: price,
        startBar: i,
      };
    }
  }

  // Close any open position at end
  if (position) {
    const exitPrice = prices[prices.length - 1];
    let pnlPct;
    if (position.type === 'long') {
      pnlPct = (exitPrice / position.entry - 1) * 100 - SLIPPAGE_PCT * 2;
    } else {
      pnlPct = (position.entry / exitPrice - 1) * 100 - SLIPPAGE_PCT * 2;
    }
    totalPnl += pnlPct;
    if (pnlPct > 0) wins++;
    else losses++;
    trades.push({ type: position.type, entry: position.entry, exit: exitPrice, pnlPct: +pnlPct.toFixed(4), reason: 'END', bars: prices.length - position.startBar });
  }

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;
  const gasTotal = totalTrades * GAS_USD * 2; // entry + exit

  return {
    totalTrades,
    wins,
    losses,
    winRate: +winRate.toFixed(1),
    totalPnlPct: +totalPnl.toFixed(4),
    avgPnlPct: +avgPnl.toFixed(4),
    maxDrawdown: computeMaxDrawdown(trades),
    gasTotal: +gasTotal.toFixed(2),
    trades,
  };
}

function computeMaxDrawdown(trades) {
  let peak = 0;
  let cumPnl = 0;
  let maxDD = 0;
  for (const t of trades) {
    cumPnl += t.pnlPct;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  }
  return +maxDD.toFixed(4);
}

// ─── Run ───────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TURINGVAULT GRID STRATEGY BACKTEST');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Tight channel (like current market ~1%)
  console.log('── Test 1: Tight channel ($2100-$2140, width ~1.9%) ──');
  const prices1 = generateRangingPrices(2100, 2140, 500);
  const result1 = runBacktest(prices1);
  printResult(result1);

  // Test 2: Medium channel (3%)
  console.log('\n── Test 2: Medium channel ($2050-$2115, width ~3%) ──');
  const prices2 = generateRangingPrices(2050, 2115, 500);
  const result2 = runBacktest(prices2);
  printResult(result2);

  // Test 3: Wide channel (5%)
  console.log('\n── Test 3: Wide channel ($2000-$2100, width ~5%) ──');
  const prices3 = generateRangingPrices(2000, 2100, 500);
  const result3 = runBacktest(prices3);
  printResult(result3);

  // Test 4: Adverse — trending market (poor for grid)
  console.log('\n── Test 4: ADVERSE — uptrend with noise ──');
  const trendPrices = [];
  let p = 2100;
  for (let i = 0; i < 500; i++) {
    p += 0.5 + (Math.random() - 0.4) * 3; // slight upward bias
    trendPrices.push(p);
  }
  const result4 = runBacktest(trendPrices);
  printResult(result4);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  VERDICT');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Ranging (tight):  ${result1.totalPnlPct > 0 ? '✅' : '❌'} ${result1.totalPnlPct.toFixed(2)}% over ${result1.totalTrades} trades`);
  console.log(`  Ranging (medium): ${result2.totalPnlPct > 0 ? '✅' : '❌'} ${result2.totalPnlPct.toFixed(2)}% over ${result2.totalTrades} trades`);
  console.log(`  Ranging (wide):   ${result3.totalPnlPct > 0 ? '✅' : '❌'} ${result3.totalPnlPct.toFixed(2)}% over ${result3.totalTrades} trades`);
  console.log(`  Trending (bad):   ${result4.totalPnlPct > 0 ? '✅' : '❌'} ${result4.totalPnlPct.toFixed(2)}% over ${result4.totalTrades} trades`);
  console.log(`\n  Strategy is profitable in ranging = ${result1.totalPnlPct > 0 && result2.totalPnlPct > 0 && result3.totalPnlPct > 0 ? '✅ YES' : '❌ NEEDS WORK'}`);
  console.log(`  Strategy loses in trending = ${result4.totalPnlPct < 0 ? '✅ EXPECTED (regime filter protects)' : '⚠️  Also profitable (unexpected)'}`);
}

function printResult(r) {
  console.log(`  Trades: ${r.totalTrades} | Wins: ${r.wins} | Losses: ${r.losses}`);
  console.log(`  Win rate: ${r.winRate}% | Avg PnL/trade: ${r.avgPnlPct.toFixed(4)}%`);
  console.log(`  Total PnL: ${r.totalPnlPct.toFixed(4)}% | Max drawdown: ${r.maxDrawdown}%`);
  console.log(`  Gas cost: $${r.gasTotal} (${r.totalTrades} trades × $0.04)`);
}

module.exports = { runBacktest, generateRangingPrices };
