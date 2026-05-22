/**
 * TuringVault — Outcome Tracker
 *
 * The REAL learning loop. After each decision, we wait N hours,
 * fetch the actual price, compute whether the agent was right or wrong,
 * and record that on-chain as PnL. Only then does promptEvolution
 * have real data to reason about.
 *
 * Flow per decision:
 *   1. Decision recorded → save {decisionId, action, targetAsset,
 *      priceAtDecision, timestamp, consensus} to local DB (outcomes.json)
 *   2. [4 hours later] outcomeTracker.settle() is called
 *   3. Fetch current price
 *   4. Compute outcome:
 *      - HOLD + price dropped  → CORRECT BLOCK   → +score
 *      - HOLD + price rose     → MISSED ALPHA    → -score
 *      - SWAP approved + rose  → GOOD CALL       → +score
 *      - SWAP approved + fell  → BAD CALL        → -score (serious)
 *   5. Call ReputationRegistry.recordPnL() on-chain
 *   6. Mark settled in outcomes.json
 *
 * Used by promptEvolution.selfReflect() to get REAL history instead of [].
 */

const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

const OUTCOMES_PATH = path.resolve(__dirname, '../data/outcomes.json');
const SETTLE_DELAY_MS = 1 * 60 * 60 * 1000; // 1 hour (ranging markets need faster feedback)
const MIN_PRICE_MOVE_PCT = 0.1; // 0.1% threshold (was 0.3% — too strict for ranging/L2)

const REPUTATION_ABI = [
  'function recordPnL(uint256 agentId, int128 pnlBps, bytes32 reasoningHash) external',
  'function getAgentScore(uint256 agentId) view returns (int256)',
  'function getTotalFeedback(uint256 agentId) view returns (uint256)',
];

// Score deltas (basis points of reputation score)
const SCORE = {
  CORRECT_BLOCK:  +40,  // HOLD, price fell — firewall worked
  MISSED_ALPHA:   -20,  // HOLD, price rose — too conservative
  GOOD_CALL:      +60,  // SWAP approved, price moved in our favour
  BAD_CALL:       -80,  // SWAP approved, price moved against us — serious
  NEUTRAL:          0,  // <0.3% move — no signal
};

// ─── DB helpers ────────────────────────────────────────────────────

function loadDB() {
  if (!fs.existsSync(OUTCOMES_PATH)) return { pending: [], settled: [] };
  try { return JSON.parse(fs.readFileSync(OUTCOMES_PATH, 'utf8')); }
  catch { return { pending: [], settled: [] }; }
}

function saveDB(db) {
  fs.mkdirSync(path.dirname(OUTCOMES_PATH), { recursive: true });
  fs.writeFileSync(OUTCOMES_PATH, JSON.stringify(db, null, 2));
}

// ─── Price fetch ───────────────────────────────────────────────────

async function fetchEthPrice() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: controller.signal }
    );
    const data = await res.json();
    return data?.ethereum?.usd || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Record a new decision for future settlement.
 * Call this immediately after runMultiAgentCycle() records on-chain.
 *
 * @param {object} params
 *   decisionId     - on-chain proposal ID
 *   action         - "swap" | "hold"
 *   targetAsset    - "mETH" | "mUSD"
 *   consensus      - bool (was it approved?)
 *   confidence     - analyst confidence 0-1
 *   priceAtDecision - ETH price at time of decision
 *   ipfsCid        - reasoning proof CID
 */
function record(params) {
  const db = loadDB();
  const entry = {
    id: `${Date.now()}_${params.decisionId}`,
    decisionId: params.decisionId,
    action: params.action,
    targetAsset: params.targetAsset,
    consensus: params.consensus,
    confidence: params.confidence,
    priceAtDecision: params.priceAtDecision,
    ipfsCid: params.ipfsCid || null,
    recordedAt: new Date().toISOString(),
    settleAfter: new Date(Date.now() + SETTLE_DELAY_MS).toISOString(),
    settled: false,
  };
  db.pending.push(entry);
  saveDB(db);
  console.log(`  [OUTCOME] Recorded decision ${entry.id} for settlement at ${entry.settleAfter}`);
  return entry;
}

/**
 * Settle all pending decisions whose settleAfter time has passed.
 * Fetches current price, computes outcome, calls recordPnL() on-chain.
 *
 * @param {object} opts
 *   wallet   - ethers.Wallet with REPUTATION contract write access
 *   provider - ethers.JsonRpcProvider
 *   dryRun   - if true, compute outcome but don't write on-chain
 */
async function settle(opts = {}) {
  const db = loadDB();
  const now = Date.now();
  const due = db.pending.filter(e => !e.settled && new Date(e.settleAfter).getTime() <= now);

  if (due.length === 0) {
    console.log('  [OUTCOME] No pending decisions ready for settlement');
    return [];
  }

  console.log(`  [OUTCOME] Settling ${due.length} decision(s)...`);

  const currentPrice = await fetchEthPrice();
  if (!currentPrice) {
    console.log('  [OUTCOME] Could not fetch price — skipping settlement');
    return [];
  }

  const REPUTATION_ADDR = '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a';
  const reputation = opts.wallet
    ? new ethers.Contract(REPUTATION_ADDR, REPUTATION_ABI, opts.wallet)
    : null;

  const results = [];

  for (const entry of due) {
    const priceAtDecision = entry.priceAtDecision;
    if (!priceAtDecision) {
      console.log(`  [OUTCOME] Skipping ${entry.id} — no priceAtDecision`);
      continue;
    }

    const pricePct = ((currentPrice - priceAtDecision) / priceAtDecision) * 100;
    const absPct = Math.abs(pricePct);
    const priceRose = pricePct > MIN_PRICE_MOVE_PCT;
    const priceFell = pricePct < -MIN_PRICE_MOVE_PCT;

    let outcome, scoreDelta, pnlBps;

    if (absPct < MIN_PRICE_MOVE_PCT) {
      outcome = 'NEUTRAL';
      scoreDelta = SCORE.NEUTRAL;
      pnlBps = 0;
    } else if (!entry.consensus) {
      // Decision was BLOCKED
      if (priceFell) {
        outcome = 'CORRECT_BLOCK';
        scoreDelta = SCORE.CORRECT_BLOCK;
        // Saved capital: roughly |pricePct| * position (assume 30% of portfolio)
        pnlBps = Math.round(absPct * 100 * 0.3); // positive: avoided loss
      } else if (priceRose) {
        outcome = 'MISSED_ALPHA';
        scoreDelta = SCORE.MISSED_ALPHA;
        pnlBps = -Math.round(absPct * 100 * 0.3); // negative: opportunity cost
      } else {
        outcome = 'NEUTRAL';
        scoreDelta = SCORE.NEUTRAL;
        pnlBps = 0;
      }
    } else {
      // Decision was APPROVED (swap executed)
      // For mETH: we want price to rise (risk-on)
      // For mUSD: we want price to fall (risk-off, defensive)
      const targetedRise = entry.targetAsset === 'mETH';
      const calledRight = (targetedRise && priceRose) || (!targetedRise && priceFell);

      if (calledRight) {
        outcome = 'GOOD_CALL';
        scoreDelta = SCORE.GOOD_CALL;
        pnlBps = Math.round(absPct * 100 * (entry.confidence || 0.5));
      } else {
        outcome = 'BAD_CALL';
        scoreDelta = SCORE.BAD_CALL;
        pnlBps = -Math.round(absPct * 100 * (entry.confidence || 0.5));
      }
    }

    const settled = {
      ...entry,
      settled: true,
      settledAt: new Date().toISOString(),
      priceAtSettlement: currentPrice,
      pricePct: +pricePct.toFixed(3),
      outcome,
      scoreDelta,
      pnlBps,
    };

    console.log(
      `  [OUTCOME] ${entry.id.slice(-12)} | ${entry.action}→${entry.targetAsset}` +
      ` | consensus=${entry.consensus} | ETH ${pricePct >= 0 ? '+' : ''}${pricePct.toFixed(2)}%` +
      ` | ${outcome} | score${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`
    );

    // Write on-chain (skip if dryRun or no wallet)
    if (!opts.dryRun && reputation && scoreDelta !== 0) {
      try {
        const reasoningHash = ethers.keccak256(
          ethers.toUtf8Bytes(`${entry.id}_${outcome}_${pnlBps}`)
        );
        const tx = await reputation.recordPnL(
          0, // agentId (NFT #0)
          pnlBps,
          reasoningHash
        );
        await tx.wait();
        settled.onChainTx = tx.hash;
        console.log(`  [OUTCOME] ✅ PnL recorded on-chain: ${tx.hash.slice(0, 18)}...`);
      } catch (e) {
        console.log(`  [OUTCOME] ⚠️  On-chain PnL failed: ${e.message?.slice(0, 60)}`);
      }
    }

    // Update DB
    const idx = db.pending.findIndex(e => e.id === entry.id);
    if (idx !== -1) db.pending.splice(idx, 1);
    db.settled.push(settled);
    results.push(settled);
  }

  saveDB(db);
  console.log(`  [OUTCOME] Settled ${results.length} decision(s)`);
  return results;
}

/**
 * Get settled outcomes formatted for promptEvolution.selfReflect().
 * Returns last N settled decisions with meaningful outcome data.
 *
 * This is the function that REPLACES the empty history[] in selfReflect.
 */
function getOutcomeHistory(limit = 20) {
  const db = loadDB();
  const recent = db.settled
    .sort((a, b) => new Date(b.settledAt) - new Date(a.settledAt))
    .slice(0, limit);

  // Summary stats
  const total = recent.length;
  const correctBlocks = recent.filter(e => e.outcome === 'CORRECT_BLOCK').length;
  const missedAlpha = recent.filter(e => e.outcome === 'MISSED_ALPHA').length;
  const goodCalls = recent.filter(e => e.outcome === 'GOOD_CALL').length;
  const badCalls = recent.filter(e => e.outcome === 'BAD_CALL').length;
  const totalPnlBps = recent.reduce((s, e) => s + (e.pnlBps || 0), 0);

  return {
    total,
    summary: {
      correctBlocks,
      missedAlpha,
      goodCalls,
      badCalls,
      totalPnlBps,
      accuracy: total > 0
        ? (((correctBlocks + goodCalls) / total) * 100).toFixed(1) + '%'
        : 'n/a',
    },
    // Formatted for LLM prompt injection
    forPrompt: recent.map(e => ({
      when: e.settledAt?.slice(0, 16),
      action: `${e.action}→${e.targetAsset}`,
      consensus: e.consensus,
      pricePct: e.pricePct,
      outcome: e.outcome,
      score: e.scoreDelta,
    })),
    raw: recent,
  };
}

/**
 * Get pending (not yet settled) decisions count.
 */
function getPendingCount() {
  const db = loadDB();
  return db.pending.filter(e => !e.settled).length;
}

module.exports = { record, settle, getOutcomeHistory, getPendingCount };
