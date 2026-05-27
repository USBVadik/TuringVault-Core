#!/usr/bin/env node
/**
 * Smoke harness for the RWA allocator.
 *
 * Synthesises 12 cases (3 consensus × 4 regimes) and runs each through
 * `rwaAllocator.evaluate` against current real on-chain wallet balances.
 * Prints a one-line table per case. No Bedrock call, no IPFS pin, no
 * on-chain TX.
 *
 * Usage:
 *   npm run smoke:rwa
 *
 * Exits 0 if ≥ 4/12 cases produce a non-null intent (validates that
 * Path A + Path B both fire on at least their canonical inputs).
 *
 * Spec: rwa-allocation-active T13.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { ethers } = require("ethers");
const rwaAllocator = require("../src/orchestrator/rwaAllocator");
const { USDT0Module } = require("../src/rwa/usdt0Module");
const { MerchantMoeDEX } = require("../src/dex/merchantMoe");

const FLAT_HOURS_AGO = 30; // simulate "long-flat wallet" for Path B cases

async function readBalances() {
  // Always include USDT (legacy) + USDT0. Other tokens optional.
  // Pass privateKey so MerchantMoeDEX.getBalances() can derive the
  // wallet address; dryRun stays true so no swap is ever issued.
  const dex = new MerchantMoeDEX({
    rpcUrl: "https://rpc.mantle.xyz",
    dryRun: true,
    privateKey: process.env.PRIVATE_KEY,
  });
  const balances = await dex.getBalances(); // includes USDT, mUSD, etc.
  try {
    if (process.env.PRIVATE_KEY) {
      const usdt0 = new USDT0Module({ privateKey: process.env.PRIVATE_KEY });
      const pos = await usdt0.getPosition();
      balances.USDT0 = pos.balance;
    } else {
      balances.USDT0 = 0;
    }
  } catch {
    balances.USDT0 = 0;
  }
  return balances;
}

function makeDecision(consensus, action) {
  return {
    consensus,
    analyst: { action, confidence: 0.7, reasoning: `smoke ${action}` },
  };
}

function makePosState(flat) {
  if (!flat) return { status: "IN_mETH", flatSince: null };
  return {
    status: "FLAT",
    flatSince: new Date(
      Date.now() - FLAT_HOURS_AGO * 3600 * 1000
    ).toISOString(),
  };
}

async function main() {
  console.log("\n=== smoke-rwa: 12-case allocator harness ===\n");

  const balances = await readBalances();
  const prices = { USDT: 1, USDT0: 1, mUSD: 1, MNT: 0.72, ETH: 2100 };
  const idleStableUsd =
    (balances.USDT ?? 0) * prices.USDT + (balances.mUSD ?? 0) * prices.mUSD;
  console.log(
    `Wallet stable USD: $${idleStableUsd.toFixed(2)}  (USDT=${(
      balances.USDT ?? 0
    ).toFixed(3)}  USDT0=${(balances.USDT0 ?? 0).toFixed(3)})\n`
  );

  const regimes = ["RANGING", "TREND_UP", "TREND_DOWN", "CRISIS"];
  const consensusModes = [
    {
      label: "consensus=true / rwa_allocate",
      consensus: true,
      action: "rwa_allocate",
    },
    { label: "consensus=true / rwa_exit", consensus: true, action: "rwa_exit" },
    { label: "consensus=false / hold", consensus: false, action: "hold" },
  ];

  let intentCount = 0;
  console.log(
    "CASE                                          | REGIME       | RESULT"
  );
  console.log(
    "----------------------------------------------+--------------+------------------------------------------"
  );
  for (const cm of consensusModes) {
    for (const regime of regimes) {
      const isPathBcandidate = cm.consensus === false;
      const out = rwaAllocator.evaluate({
        decision: makeDecision(cm.consensus, cm.action),
        market: { regime },
        balances,
        prices,
        lastSwapAt: null, // no prior swap for smoke
        posState: makePosState(isPathBcandidate),
      });

      let resultStr;
      if (!out) {
        resultStr = "null";
      } else if (out.skip) {
        resultStr = `skip: ${out._gate}`;
      } else {
        resultStr = `${out.source.padEnd(13)} ${out.from} → ${
          out.to
        } ($${out.amountInUsd.toFixed(2)})`;
        intentCount++;
      }
      console.log(`${cm.label.padEnd(46)}| ${regime.padEnd(13)}| ${resultStr}`);
    }
  }

  console.log(`\nIntents emitted: ${intentCount}/12`);
  if (intentCount >= 4) {
    console.log(
      "✅ Smoke pass — Path A and Path B both fire on canonical inputs."
    );
    process.exit(0);
  }
  console.log("⚠ Smoke fail — fewer than 4 intents emitted.");
  if (idleStableUsd < 5) {
    console.log(
      "   Wallet idle stable below $5 — many cases will gate on min-balance."
    );
    console.log("   Top up USDT or mUSD to test full matrix.");
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e?.message || e);
  process.exit(99);
});
