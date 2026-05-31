/**
 * TuringVault — Outcome Tracker
 *
 * The REAL learning loop. After each decision, we wait N hours,
 * fetch the actual benchmark price, compute whether the agent was right or wrong,
 * and record that on-chain as PnL. Only then does promptEvolution
 * have real data to reason about.
 *
 * Flow per decision:
 *   1. Decision recorded → save {decisionId, action, targetAsset,
 *      priceAtDecision, timestamp, consensus} to local DB (outcomes.json)
 *   2. [4 hours later] outcomeTracker.settle() is called
 *   3. Fetch current WETH/ETH or MNT benchmark price
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

const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const {
  deriveDisplayTier,
  deriveExecutionProofStatus,
} = require("./executionProofStatus");

const OUTCOMES_PATH = process.env.OUTCOMES_PATH
  ? path.resolve(process.env.OUTCOMES_PATH)
  : path.resolve(__dirname, "../data/outcomes.json");
const SETTLE_DELAY_MS = 1 * 60 * 60 * 1000; // 1 hour (ranging markets need faster feedback)
const MIN_PRICE_MOVE_PCT = 0.1; // 0.1% threshold (was 0.3% — too strict for ranging/L2)
const MANTLE_RPC = process.env.MANTLE_RPC || "https://rpc.mantle.xyz";
const WALLET_ADDRESS =
  process.env.WALLET_ADDRESS || "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";
const MIN_CONFIRMATIONS = 2;
const TX_PROOF_NAMES = new Set([
  "tx_exists",
  "tx_sender",
  "tx_confirmed",
  "tx_success",
  "tx_proof",
]);

const REPUTATION_ABI = [
  "function recordPnL(uint256 agentId, int128 pnlBps, bytes32 reasoningHash) external",
  "function getAgentScore(uint256 agentId) view returns (int256)",
  "function getTotalFeedback(uint256 agentId) view returns (uint256)",
];

// Score deltas (basis points of reputation score)
const SCORE = {
  CORRECT_BLOCK: +40, // HOLD, price fell — firewall worked
  MISSED_ALPHA: -20, // HOLD, price rose — too conservative
  GOOD_CALL: +60, // SWAP approved, price moved in our favour
  BAD_CALL: -80, // SWAP approved, price moved against us — serious
  NEUTRAL: 0, // sub-threshold move — no signal
};

// ─── DB helpers ────────────────────────────────────────────────────

const SCHEMA_VERSION = 2;

function loadDB() {
  if (!fs.existsSync(OUTCOMES_PATH)) {
    return { schemaVersion: SCHEMA_VERSION, pending: [], settled: [] };
  }
  try {
    const db = JSON.parse(fs.readFileSync(OUTCOMES_PATH, "utf8"));
    // Tag pre-existing v1 files; migration script upgrades to v2.
    db.schemaVersion = db.schemaVersion ?? 1;
    db.pending = db.pending ?? [];
    db.settled = db.settled ?? [];
    return db;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, pending: [], settled: [] };
  }
}

function saveDB(db) {
  fs.mkdirSync(path.dirname(OUTCOMES_PATH), { recursive: true });
  // Always write the current schema version on save so newly-recorded
  // entries (which carry v2 fields from multiAgentLoop) are tagged.
  db.schemaVersion = SCHEMA_VERSION;
  // SECURITY/M4: atomic write to avoid partial reads when a concurrent
  // reader (rwaAllocator.readDailySpendUsd) opens the file mid-write.
  // Write to temp and rename — rename is atomic on POSIX.
  const tmp = OUTCOMES_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, OUTCOMES_PATH);
}

// ─── Price fetch / settlement assets ───────────────────────────────

const RISK_ON_TARGETS = new Set(["mETH", "WETH", "MNT", "WMNT"]);
const ETH_BENCHMARK_TARGETS = new Set(["mETH", "WETH"]);
const MNT_BENCHMARK_TARGETS = new Set(["MNT", "WMNT"]);

function normalizeAssetSymbol(asset) {
  const raw = String(asset || "").trim();
  const upper = raw.toUpperCase();
  if (upper === "ETH" || upper === "METH") return "mETH";
  if (upper === "WETH") return "WETH";
  if (upper === "MNT" || upper === "WMNT") return upper;
  if (upper === "MUSD") return "mUSD";
  if (upper === "USDT" || upper === "USDT0") return upper;
  return raw || null;
}

function isRiskOnTarget(targetAsset) {
  return RISK_ON_TARGETS.has(normalizeAssetSymbol(targetAsset));
}

function inferSettlementAsset(targetAsset, fallback = "mETH", sourceAsset = null) {
  const symbol = normalizeAssetSymbol(targetAsset);
  if (ETH_BENCHMARK_TARGETS.has(symbol)) return "WETH";
  if (MNT_BENCHMARK_TARGETS.has(symbol)) return "MNT";
  const sourceSymbol = normalizeAssetSymbol(sourceAsset);
  if (ETH_BENCHMARK_TARGETS.has(sourceSymbol)) return "WETH";
  if (MNT_BENCHMARK_TARGETS.has(sourceSymbol)) return "MNT";
  const fallbackSymbol = normalizeAssetSymbol(fallback);
  if (ETH_BENCHMARK_TARGETS.has(fallbackSymbol)) return "WETH";
  if (MNT_BENCHMARK_TARGETS.has(fallbackSymbol)) return "MNT";
  return fallbackSymbol || "WETH";
}

function priceFromMap(priceMap = {}, settlementAsset = "mETH") {
  const asset = inferSettlementAsset(settlementAsset);
  if (asset === "MNT") return priceMap.MNT ?? priceMap.WMNT ?? null;
  return priceMap.WETH ?? priceMap.mETH ?? null;
}

async function fetchAssetPrices() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,mantle,mantle-staked-ether&vs_currencies=usd",
      { signal: controller.signal }
    );
    const data = await res.json();
    const ethUsd = data?.ethereum?.usd || null;
    const methUsd = data?.["mantle-staked-ether"]?.usd || ethUsd;
    const mntUsd = data?.mantle?.usd || null;
    return {
      mETH: methUsd,
      WETH: ethUsd,
      MNT: mntUsd,
      WMNT: mntUsd,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEthPrice() {
  const prices = await fetchAssetPrices();
  return prices?.WETH || prices?.mETH || null;
}

function computePriceMoveOutcome({
  consensus,
  targetAsset,
  confidence,
  priceAtDecision,
  currentPrice,
}) {
  const pricePct = ((currentPrice - priceAtDecision) / priceAtDecision) * 100;
  const absPct = Math.abs(pricePct);
  const priceRose = pricePct > MIN_PRICE_MOVE_PCT;
  const priceFell = pricePct < -MIN_PRICE_MOVE_PCT;

  if (absPct < MIN_PRICE_MOVE_PCT) {
    return {
      pricePct,
      outcome: "NEUTRAL",
      scoreDelta: SCORE.NEUTRAL,
      pnlBps: 0,
    };
  }

  if (!consensus) {
    const blockedRiskOn = isRiskOnTarget(targetAsset);
    const blockWasRight =
      (blockedRiskOn && priceFell) || (!blockedRiskOn && priceRose);
    const blockMissedMove =
      (blockedRiskOn && priceRose) || (!blockedRiskOn && priceFell);

    if (blockWasRight) {
      return {
        pricePct,
        outcome: "CORRECT_BLOCK",
        scoreDelta: SCORE.CORRECT_BLOCK,
        pnlBps: Math.round(absPct * 100 * 0.3),
      };
    }
    if (blockMissedMove) {
      return {
        pricePct,
        outcome: "MISSED_ALPHA",
        scoreDelta: SCORE.MISSED_ALPHA,
        pnlBps: -Math.round(absPct * 100 * 0.3),
      };
    }
    return {
      pricePct,
      outcome: "NEUTRAL",
      scoreDelta: SCORE.NEUTRAL,
      pnlBps: 0,
    };
  }

  const targetedRise = isRiskOnTarget(targetAsset);
  const calledRight =
    (targetedRise && priceRose) || (!targetedRise && priceFell);

  return {
    pricePct,
    outcome: calledRight ? "GOOD_CALL" : "BAD_CALL",
    scoreDelta: calledRight ? SCORE.GOOD_CALL : SCORE.BAD_CALL,
    pnlBps:
      Math.round(absPct * 100 * (confidence || 0.5)) *
      (calledRight ? 1 : -1),
  };
}

function firstExecutionTxHash(entry = {}) {
  if (entry.txHash) return entry.txHash;
  if (entry.directionalSwap?.txHash) return entry.directionalSwap.txHash;
  if (entry.rwaIntent?.txHash) return entry.rwaIntent.txHash;
  const legs = Array.isArray(entry.directionalSwap?.legs)
    ? entry.directionalSwap.legs
    : [];
  for (let i = legs.length - 1; i >= 0; i--) {
    if (legs[i]?.txHash) return legs[i].txHash;
  }
  return null;
}

function replaceTxProofChecks(existingChecks = [], txChecks = []) {
  const nonTxChecks = Array.isArray(existingChecks)
    ? existingChecks.filter((c) => !TX_PROOF_NAMES.has(c?.name))
    : [];
  return [...nonTxChecks, ...txChecks];
}

async function refreshExecutionProof(entry, opts = {}) {
  if (!entry || entry.executedOnChain !== true) return entry;
  if (deriveExecutionProofStatus(entry) === "ACCEPTED") return entry;

  const txHash = firstExecutionTxHash(entry);
  if (!txHash) return entry;

  try {
    const provider =
      opts.provider ||
      opts.wallet?.provider ||
      new ethers.JsonRpcProvider(MANTLE_RPC);
    const expectedSender = (
      opts.expectedSender ||
      opts.wallet?.address ||
      WALLET_ADDRESS
    ).toLowerCase();
    const tx = await provider.getTransaction(txHash);
    const txChecks = [];

    if (!tx) {
      txChecks.push({
        name: "tx_exists",
        status: "FAIL",
        detail: "TX not found on chain during settlement re-proof",
      });
    } else {
      txChecks.push({
        name: "tx_exists",
        status: "PASS",
        detail: `Re-proof: block ${tx.blockNumber ?? "pending"}`,
      });
      txChecks.push({
        name: "tx_sender",
        status:
          typeof tx.from === "string" &&
          tx.from.toLowerCase() === expectedSender
            ? "PASS"
            : "FAIL",
        detail: `Re-proof: sender ${tx.from || "unknown"}`,
      });

      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        txChecks.push({
          name: "tx_confirmed",
          status: "FAIL",
          detail: "Re-proof: receipt unavailable",
        });
        txChecks.push({
          name: "tx_success",
          status: "FAIL",
          detail: "Re-proof: cannot prove success without receipt",
        });
      } else {
        const currentBlock = await provider.getBlockNumber();
        const confirmations = currentBlock - receipt.blockNumber;
        txChecks.push({
          name: "tx_confirmed",
          status: confirmations >= MIN_CONFIRMATIONS ? "PASS" : "WARN",
          detail: `Re-proof: ${confirmations} confirmations`,
        });
        txChecks.push({
          name: "tx_success",
          status: receipt.status === 1 ? "PASS" : "FAIL",
          detail:
            receipt.status === 1
              ? "Re-proof: TX successful"
              : "Re-proof: TX reverted",
        });
      }
    }

    let rollupStatus = "PASS";
    if (txChecks.some((c) => ["FAIL", "ERROR"].includes(c.status))) {
      rollupStatus = "FAIL";
    } else if (txChecks.some((c) => c.status === "WARN")) {
      rollupStatus = "WARN";
    }
    txChecks.push({
      name: "tx_proof",
      status: rollupStatus,
      detail: "Re-proofed during outcome settlement",
    });

    entry.disciplineDetail = {
      ...(entry.disciplineDetail || {}),
      checks: replaceTxProofChecks(entry.disciplineDetail?.checks, txChecks),
      reproofedAt: new Date().toISOString(),
    };
    entry.executionProofStatus = deriveExecutionProofStatus(entry);
    entry._displayTier = deriveDisplayTier({
      decisionTier: entry.decisionTier ?? null,
      executedOnChain: entry.executedOnChain === true,
      executionProofStatus: entry.executionProofStatus,
    });
    return entry;
  } catch (e) {
    entry.executionProofRefreshError = e.message?.slice(0, 120) || "unknown";
    return entry;
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
 *   targetAsset    - "mETH" | "WETH" | "MNT" | "WMNT" | stable target
 *   consensus      - bool (was it approved?)
 *   confidence     - analyst confidence 0-1
 *   priceAtDecision - benchmark price at time of decision
 *   settlementAsset - "WETH" or "MNT" benchmark for later settlement
 *   ipfsCid        - reasoning proof CID
 */
function record(params) {
  const settlementAsset = inferSettlementAsset(
    params.settlementAsset || params.targetAsset,
    params.priceAssetAtDecision || "mETH",
    params.sourceAsset || params.directionalSwap?.from
  );
  const db = loadDB();
  const entry = {
    id: `${Date.now()}_${params.decisionId}`,
    decisionId: params.decisionId,
    action: params.action,
    targetAsset: params.targetAsset,
    consensus: params.consensus,
    confidence: params.confidence,
    priceAtDecision: params.priceAtDecision,
    settlementAsset,
    priceAssetAtDecision: params.priceAssetAtDecision || settlementAsset,
    settlementSourceAsset:
      params.settlementSourceAsset ||
      params.sourceAsset ||
      params.directionalSwap?.from ||
      null,
    ipfsCid: params.ipfsCid || null,
    recordedAt: new Date().toISOString(),
    settleAfter: new Date(Date.now() + SETTLE_DELAY_MS).toISOString(),
    settled: false,
    // RWA allocation result for this cycle, if any. Spec:
    // rwa-allocation-active R3.3 / design "Data Models". Null when no
    // RWA action taken; populated by rwaAllocator.evaluate + executeSwap.
    rwaIntent: params.rwaIntent || null,
  };

  // Capture optional T9 v2 / agent-reasoning-quality fields verbatim
  // so we don't lose tier provenance on entries that pass them in.
  for (const k of [
    "disciplineStatus",
    "disciplineDetail",
    "decisionTier",
    "tierSource",
    "confidencePath",
    "promptSource",
    "disagreementSignal",
    "validatorReasoning",
    "validatorFlaggedIssues",
    "arbiterVote",
    "arbiterReasoning",
    // Deterministic inventory/portfolio veto or allow decision from
    // multiAgentLoop Step 1.7/Step 2. Null when no swap reached it.
    "portfolioGuard",
    // Deterministic grid candidate considered before the LLM proposal.
    // Lets audits distinguish "no edge" from "edge promoted/rejected".
    "gridTradeCandidate",
    // directionalSwap is the {executed, txHash, from, to, amountIn,
    // amountOut, reason?} object emitted by multiAgentLoop Step 4.7.
    // Without this entry the field was silently dropped on persist
    // and the trade became invisible to outcome metrics, even when
    // it succeeded on-chain.
    "directionalSwap",
    // Reproducible AI on-chain anchor (audit 18). The DecisionLog
    // contract carries combinedAnchor in its bytes32 txHash slot;
    // we surface the underlying values here so the frontend can
    // recompute and verify keccak256(utf8(ipfsCid) ‖ manifestHash)
    // matches what's on-chain — no contract redeploy required.
    "manifestHash",
    "combinedAnchor",
    "decisionLogTxHash",
    // Data-source provenance (audit 19/20). Records which upstream
    // feed produced this cycle's prices and candles, plus whether
    // they came from a stale on-disk snapshot. Surfaced on
    // /api/decisions and the proof-explorer "data path" pill so
    // the multi-source resilience is visible to a judge.
    "priceSource",
    "priceFromSnapshot",
    "priceSnapshotAgeSec",
    "candleSource",
    "candleFromSnapshot",
    "candleSnapshotAgeSec",
  ]) {
    if (params[k] !== undefined) entry[k] = params[k];
  }

  // Inline honesty derivation. The backfill script
  // scripts/backfill-outcomes-honesty.js retroactively adds these
  // two fields to old rows. New rows must carry them too, so we
  // compute them here at write time. Frontend `/api/decisions` and
  // LiveTerminal both prefer these fields over a re-derivation, so
  // baking them in keeps the surface consistent.
  //
  // executedOnChain is the ground truth for "did a DEX TX actually
  // happen". _displayTier is what the UI should render: identical to
  // decisionTier in the happy path, but rewritten to
  // INTENT_SWAP_NO_EXEC when the classifier said EXECUTED_SWAP
  // without a tx hash to back it.
  //
  // Workspace rule: .kiro/steering/no-lying-about-state.md §4.
  const executedOnChain =
    Boolean(entry.txHash) ||
    (entry.rwaIntent && entry.rwaIntent.executed === true) ||
    (entry.directionalSwap && entry.directionalSwap.executed === true) ||
    (entry.directionalSwap &&
      Array.isArray(entry.directionalSwap.legs) &&
      entry.directionalSwap.legs.some((l) => l && l.txHash));
  entry.executedOnChain = executedOnChain;
  entry.executionProofStatus = deriveExecutionProofStatus(
    entry.disciplineDetail
  );
  entry._displayTier = deriveDisplayTier({
    decisionTier: entry.decisionTier ?? null,
    executedOnChain,
    executionProofStatus: entry.executionProofStatus,
  });

  db.pending.push(entry);
  saveDB(db);
  console.log(
    `  [OUTCOME] Recorded decision ${entry.id} for settlement at ${entry.settleAfter}`
  );
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
  const due = db.pending.filter(
    (e) => !e.settled && new Date(e.settleAfter).getTime() <= now
  );

  if (due.length === 0) {
    console.log("  [OUTCOME] No pending decisions ready for settlement");
    return [];
  }

  console.log(`  [OUTCOME] Settling ${due.length} decision(s)...`);

  const currentPrices = await fetchAssetPrices();
  if (!currentPrices) {
    console.log("  [OUTCOME] Could not fetch prices — skipping settlement");
    return [];
  }

  const REPUTATION_ADDR = "0xC78119F3274B05046Ac7c38a14298a6cbD946e1a";
  const reputation = opts.wallet
    ? new ethers.Contract(REPUTATION_ADDR, REPUTATION_ABI, opts.wallet)
    : null;

  const results = [];

  for (const rawEntry of due) {
    const entry = await refreshExecutionProof(rawEntry, opts);
    if (
      entry.executedOnChain === true &&
      deriveExecutionProofStatus(entry) !== "ACCEPTED"
    ) {
      entry.proofBlockedAt = new Date().toISOString();
      entry.proofBlockReason = `execution proof ${deriveExecutionProofStatus(entry)}`;
      const idx = db.pending.findIndex((e) => e.id === entry.id);
      if (idx !== -1) db.pending[idx] = entry;
      console.log(
        `  [OUTCOME] Skipping ${entry.id} — execution proof not accepted (${deriveExecutionProofStatus(entry)})`
      );
      continue;
    }

    const priceAtDecision = entry.priceAtDecision;
    if (!priceAtDecision) {
      console.log(`  [OUTCOME] Skipping ${entry.id} — no priceAtDecision`);
      continue;
    }

    const settlementAsset = inferSettlementAsset(
      entry.settlementAsset || entry.targetAsset,
      entry.priceAssetAtDecision || "mETH"
    );
    const currentPrice = priceFromMap(currentPrices, settlementAsset);
    if (!currentPrice) {
      console.log(
        `  [OUTCOME] Skipping ${entry.id} — no ${settlementAsset} price`
      );
      continue;
    }

    const { pricePct, outcome, scoreDelta, pnlBps } = computePriceMoveOutcome({
      consensus: entry.consensus,
      targetAsset: entry.targetAsset,
      confidence: entry.confidence,
      priceAtDecision,
      currentPrice,
    });

    const settled = {
      ...entry,
      settled: true,
      settledAt: new Date().toISOString(),
      priceAtSettlement: currentPrice,
      settlementAsset,
      pricePct: +pricePct.toFixed(3),
      outcome,
      scoreDelta,
      pnlBps,
    };

    console.log(
      `  [OUTCOME] ${entry.id.slice(-12)} | ${entry.action}→${
        entry.targetAsset
      }` +
        ` | consensus=${entry.consensus} | ${settlementAsset} ${
          pricePct >= 0 ? "+" : ""
        }${pricePct.toFixed(2)}%` +
        ` | ${outcome} | score${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`
    );

    // Write on-chain (skip if dryRun or no wallet)
    if (!opts.dryRun && reputation && scoreDelta !== 0) {
      try {
        const reasoningHash = ethers.keccak256(
          ethers.toUtf8Bytes(`${entry.id}_${outcome}_${pnlBps}`)
        );
        const tx = await reputation.recordPnL(
          1, // agentId (NFT #1)
          pnlBps,
          reasoningHash
        );
        await tx.wait();
        settled.onChainTx = tx.hash;
        console.log(
          `  [OUTCOME] ✅ PnL recorded on-chain: ${tx.hash.slice(0, 18)}...`
        );
      } catch (e) {
        console.log(
          `  [OUTCOME] ⚠️  On-chain PnL failed: ${e.message?.slice(0, 60)}`
        );
      }
    }

    // Update DB
    const idx = db.pending.findIndex((e) => e.id === entry.id);
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
  const correctBlocks = recent.filter(
    (e) => e.outcome === "CORRECT_BLOCK"
  ).length;
  const missedAlpha = recent.filter((e) => e.outcome === "MISSED_ALPHA").length;
  const goodCalls = recent.filter((e) => e.outcome === "GOOD_CALL").length;
  const badCalls = recent.filter((e) => e.outcome === "BAD_CALL").length;
  const totalPnlBps = recent.reduce((s, e) => s + (e.pnlBps || 0), 0);

  return {
    total,
    summary: {
      correctBlocks,
      missedAlpha,
      goodCalls,
      badCalls,
      totalPnlBps,
      accuracy:
        total > 0
          ? (((correctBlocks + goodCalls) / total) * 100).toFixed(1) + "%"
          : "n/a",
    },
    // Formatted for LLM prompt injection
    forPrompt: recent.map((e) => ({
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
  return db.pending.filter((e) => !e.settled).length;
}

/**
 * Get the ISO timestamp of the most recent successful RWA swap.
 * Used by the cycle to compute Path B cooldown. Returns null if
 * there has never been an executed RWA swap.
 *
 * Spec: rwa-allocation-active R3.3 / T9.
 */
function getLastRwaSwapAt() {
  const db = loadDB();
  let latest = null;
  for (const e of [...(db.pending ?? []), ...(db.settled ?? [])]) {
    const ri = e?.rwaIntent;
    if (!ri || !ri.executed) continue;
    const ts = e.recordedAt ?? e.settledAt ?? null;
    if (ts && (!latest || Date.parse(ts) > Date.parse(latest))) latest = ts;
  }
  return latest;
}

module.exports = {
  record,
  settle,
  getOutcomeHistory,
  getPendingCount,
  getLastRwaSwapAt,
  fetchAssetPrices,
  fetchEthPrice,
  normalizeAssetSymbol,
  isRiskOnTarget,
  inferSettlementAsset,
  computePriceMoveOutcome,
  deriveExecutionProofStatus,
  refreshExecutionProof,
};
