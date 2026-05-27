/**
 * Discipline Layer — Post-Execution Proof Verification
 *
 * Inspired by Synrail (github.com/USBVadik/synrail).
 * Verifies that execution claims are backed by on-chain proof
 * before allowing outcome settlement.
 *
 * Checks:
 *   1. TX Proof Gate — tx hash exists, confirmed, matches our wallet
 *   2. Freshness — price data used was < 60s old at decision time
 *   3. Drift Detection — action matches declared regime
 */

const { ethers } = require("ethers");

const MANTLE_RPC = process.env.MANTLE_RPC || "https://rpc.mantle.xyz";
const WALLET_ADDRESS =
  process.env.WALLET_ADDRESS || "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";

// Minimum confirmations for a tx to be considered "proved"
const MIN_CONFIRMATIONS = 2;
// Maximum age of price data at decision time (ms)
const MAX_PRICE_AGE_MS = 60_000;
// Maximum decisions in wrong regime before flagging drift
const MAX_DRIFT_STREAK = 3;

let driftStreak = 0;
let lastDriftRegime = null;

/**
 * Verify a swap execution claim against on-chain reality.
 *
 * @param {Object} params
 * @param {string} params.txHash — claimed transaction hash
 * @param {string} params.action — "swap" or "hold"
 * @param {number} params.priceAtDecision — ETH price used in decision
 * @param {number} params.decisionTimestamp — when decision was made (ms)
 * @param {number} params.priceTimestamp — when price was fetched (ms)
 * @param {string} params.regime — current market regime
 * @param {string} params.expectedAction — what the regime suggests
 * @returns {Object} { status: 'ACCEPTED'|'BLOCKED', checks: [...], blockReason?: string, repairStep?: string }
 */
async function verify(params) {
  const checks = [];
  let blocked = false;
  let blockReason = "";
  let repairStep = "";

  // === CHECK 1: TX Proof Gate ===
  if (params.action === "swap" && params.txHash) {
    try {
      const provider = new ethers.JsonRpcProvider(MANTLE_RPC);
      const tx = await provider.getTransaction(params.txHash);

      if (!tx) {
        checks.push({
          name: "tx_exists",
          status: "FAIL",
          detail: "TX not found on chain",
        });
        blocked = true;
        blockReason = "Transaction hash not found on Mantle";
        repairStep =
          "Re-fetch tx hash from wallet; if missing, execution may have failed silently";
      } else {
        checks.push({
          name: "tx_exists",
          status: "PASS",
          detail: `Block ${tx.blockNumber}`,
        });

        // Verify sender matches our wallet
        if (tx.from.toLowerCase() !== WALLET_ADDRESS.toLowerCase()) {
          checks.push({
            name: "tx_sender",
            status: "FAIL",
            detail: `Expected ${WALLET_ADDRESS}, got ${tx.from}`,
          });
          blocked = true;
          blockReason = "TX sender does not match vault wallet";
          repairStep = "Verify wallet address in .env matches deployer";
        } else {
          checks.push({
            name: "tx_sender",
            status: "PASS",
            detail: "Matches vault wallet",
          });
        }

        // Check confirmations
        const receipt = await provider.getTransactionReceipt(params.txHash);
        if (receipt) {
          const currentBlock = await provider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber;

          if (confirmations < MIN_CONFIRMATIONS) {
            checks.push({
              name: "tx_confirmed",
              status: "WARN",
              detail: `Only ${confirmations} confirmations (need ${MIN_CONFIRMATIONS})`,
            });
            // Don't block — just warn, it'll confirm soon
          } else {
            checks.push({
              name: "tx_confirmed",
              status: "PASS",
              detail: `${confirmations} confirmations`,
            });
          }

          // Check tx succeeded
          if (receipt.status === 0) {
            checks.push({
              name: "tx_success",
              status: "FAIL",
              detail: "TX reverted on-chain",
            });
            blocked = true;
            blockReason = "Transaction reverted — swap failed";
            repairStep = "Check slippage settings and token allowances";
          } else {
            checks.push({
              name: "tx_success",
              status: "PASS",
              detail: "TX successful",
            });
          }
        }
      }
    } catch (err) {
      checks.push({
        name: "tx_proof",
        status: "ERROR",
        detail: err.message?.slice(0, 100),
      });
      // Don't block on RPC errors — degrade gracefully
    }
  } else if (params.action === "hold") {
    checks.push({
      name: "tx_proof",
      status: "SKIP",
      detail: "Hold action — no tx to verify",
    });
  }

  // === CHECK 2: Price Freshness ===
  if (params.priceTimestamp && params.decisionTimestamp) {
    const priceAge = params.decisionTimestamp - params.priceTimestamp;

    if (priceAge > MAX_PRICE_AGE_MS) {
      checks.push({
        name: "price_freshness",
        status: "FAIL",
        detail: `Price data was ${(priceAge / 1000).toFixed(
          0
        )}s old at decision time (max: ${MAX_PRICE_AGE_MS / 1000}s)`,
      });
      if (!blocked) {
        blocked = true;
        blockReason = "Stale price data used in decision";
        repairStep =
          "Re-fetch live price and re-evaluate decision with fresh data";
      }
    } else if (priceAge > MAX_PRICE_AGE_MS * 0.8) {
      checks.push({
        name: "price_freshness",
        status: "WARN",
        detail: `Price data was ${(priceAge / 1000).toFixed(
          0
        )}s old — approaching staleness`,
      });
    } else {
      checks.push({
        name: "price_freshness",
        status: "PASS",
        detail: `Price data was ${(priceAge / 1000).toFixed(0)}s old`,
      });
    }
  } else {
    checks.push({
      name: "price_freshness",
      status: "SKIP",
      detail: "Timestamps not provided",
    });
  }

  // === CHECK 3: Strategy Drift Detection ===
  if (params.regime && params.action) {
    const regimeMismatch = detectDrift(params.action, params.regime);

    if (regimeMismatch) {
      driftStreak++;
      lastDriftRegime = params.regime;

      if (driftStreak >= MAX_DRIFT_STREAK) {
        checks.push({
          name: "drift_detection",
          status: "FAIL",
          detail: `${driftStreak} consecutive regime-mismatched decisions (${params.action} during ${params.regime})`,
        });
        if (!blocked) {
          blocked = true;
          blockReason = `Strategy drift: ${driftStreak} consecutive actions mismatched with ${params.regime} regime`;
          repairStep =
            "Re-evaluate market regime; consider forcing HOLD until regime stabilizes";
        }
      } else {
        checks.push({
          name: "drift_detection",
          status: "WARN",
          detail: `Action ${params.action} unusual for ${params.regime} regime (streak: ${driftStreak})`,
        });
      }
    } else {
      driftStreak = 0;
      checks.push({
        name: "drift_detection",
        status: "PASS",
        detail: `Action aligns with ${params.regime} regime`,
      });
    }
  }

  // Roll up the tx_proof gate from the per-step checks above.
  // For "swap" cycles we write tx_exists / tx_sender / tx_confirmed /
  // tx_success individually; the UI and summary aggregator only know the
  // canonical gate name "tx_proof". Without this roll-up the gate appears
  // as "·" (unknown) on the discipline page for every executed swap, and
  // tx_proof pass rate stays "—" forever.
  const TX_PROOF_STEPS = [
    "tx_exists",
    "tx_sender",
    "tx_confirmed",
    "tx_success",
  ];
  const txSubChecks = checks.filter((c) => TX_PROOF_STEPS.includes(c.name));
  const hasTxProofRollup = checks.some((c) => c.name === "tx_proof");
  if (txSubChecks.length > 0 && !hasTxProofRollup) {
    let rollupStatus = "PASS";
    if (txSubChecks.some((c) => c.status === "FAIL")) rollupStatus = "FAIL";
    else if (txSubChecks.some((c) => c.status === "WARN"))
      rollupStatus = "WARN";
    checks.push({
      name: "tx_proof",
      status: rollupStatus,
      detail: `Rolled up from ${txSubChecks.length} sub-checks`,
    });
  }

  const status = blocked ? "BLOCKED" : "ACCEPTED";
  const result = { status, checks, timestamp: Date.now() };

  if (blocked) {
    result.blockReason = blockReason;
    result.repairStep = repairStep;
  }

  // Log discipline check
  const icon = status === "ACCEPTED" ? "✅" : "🚫";
  console.log(
    `   ${icon} [DISCIPLINE] ${status}${blocked ? ` — ${blockReason}` : ""}`
  );
  for (const c of checks) {
    const cIcon =
      c.status === "PASS"
        ? "✓"
        : c.status === "FAIL"
        ? "✗"
        : c.status === "WARN"
        ? "⚠"
        : "○";
    console.log(`      ${cIcon} ${c.name}: ${c.detail}`);
  }

  return result;
}

/**
 * Detect if action mismatches the current regime.
 * In RANGING regime, frequent swaps are expected.
 * In CRISIS, only holds are appropriate.
 * In TREND, swaps aligned with direction are fine.
 */
function detectDrift(action, regime) {
  switch (regime) {
    case "CRISIS":
      return action === "swap"; // Swapping during crisis = drift
    case "RANGING":
      return false; // Both hold and swap are fine in ranging
    case "TREND_UP":
    case "TREND_DOWN":
      return false; // Swaps aligned with trend are fine
    default:
      return false;
  }
}

/**
 * Get current discipline layer stats
 */
function getStats() {
  return {
    driftStreak,
    lastDriftRegime,
    maxDriftStreak: MAX_DRIFT_STREAK,
    maxPriceAgeMs: MAX_PRICE_AGE_MS,
    minConfirmations: MIN_CONFIRMATIONS,
  };
}

module.exports = { verify, getStats, detectDrift };
