#!/usr/bin/env node
/**
 * Snapshot real on-chain gas cost for one representative cycle.
 *
 * Reads each TX of cycle 123 from the agent EOA, fetches its receipt
 * and gas price, sums total cost in MNT, writes a JSON artefact at
 * artifacts/gas-cost-<sample>.json.
 *
 * The README and pitch deck claim "~\$0.006 per attestation tx,
 * ~0.077 MNT per cycle" — this artefact is the verifiable backing.
 *
 * Usage:
 *   node scripts/audit/gas-cost-sample.js
 *
 * Output: artifacts/gas-cost-cycle-123.json
 *
 * Re-runnable: deterministic against a fixed cycle (block list is
 * hardcoded for cycle 123). To capture another cycle, edit the
 * `BLOCKS` table.
 */
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const RPC = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";
const EOA = "0xdc783cdbfa993f3fc299460627b204e83bf4fb5a";
const MNT_USD_ASSUMED = 0.62; // pinned for reproducibility

// Cycle 123 (post-trading-unblock fix), captured 2026-05-28T15:36-37Z.
// Source: .kiro/audits/04-on-chain.md "Most recent 8 DEX swaps" + cycle
// commit f2cc66c.
const BLOCKS = [
  [95926118, "submitProposal", "attestation", "ValidationRegistry"],
  [95926122, "validateProposal", "attestation", "ValidationRegistry"],
  [95926125, "logDecision", "attestation", "DecisionLog"],
  [95926128, "submitFeedback", "attestation", "ReputationRegistry"],
  [
    95926135,
    "swapExactTokensForTokens",
    "dex-swap",
    "MoeLBRouter (RWA: USDT->USDT0)",
  ],
  [
    95926142,
    "swapExactTokensForTokens",
    "dex-swap",
    "MoeLBRouter (directional leg 1: WMNT->USDT)",
  ],
  [
    95926148,
    "swapExactTokensForTokens",
    "dex-swap",
    "MoeLBRouter (directional leg 2: USDT->USDT0)",
  ],
  [95926153, "setAgentURI", "attestation", "TuringVaultIdentity"],
];

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  let totalGasUsed = 0n;
  let totalGasCost = 0n;
  const txs = [];
  for (const [bn, expectedMethod, kind, label] of BLOCKS) {
    const block = await provider.getBlock(bn, true);
    const tx = block.prefetchedTransactions.find(
      (t) => (t.from || "").toLowerCase() === EOA
    );
    if (!tx) continue;
    const r = await provider.getTransactionReceipt(tx.hash);
    const cost = r.gasUsed * (r.gasPrice || tx.gasPrice || 0n);
    totalGasUsed += r.gasUsed;
    totalGasCost += cost;
    txs.push({
      block: bn,
      txHash: tx.hash,
      method: expectedMethod,
      kind,
      target: label,
      gasUsed: r.gasUsed.toString(),
      gasPriceWei: (r.gasPrice || tx.gasPrice || 0n).toString(),
      costWei: cost.toString(),
      costMnt: parseFloat(ethers.formatEther(cost)),
    });
  }
  const out = {
    schemaVersion: 1,
    sample: "cycle-123",
    capturedAt: new Date().toISOString(),
    cycleStartedAt: "2026-05-28T15:35:24.328Z",
    cycleEndedAt: "2026-05-28T15:37:02.156Z",
    chain: { name: "Mantle Mainnet", chainId: 5000 },
    eoa: "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a",
    mntPriceUsdAssumed: MNT_USD_ASSUMED,
    txs,
    summary: {
      txCount: txs.length,
      attestationTxCount: txs.filter((t) => t.kind === "attestation").length,
      dexSwapCount: txs.filter((t) => t.kind === "dex-swap").length,
      totalGasUsed: totalGasUsed.toString(),
      totalGasCostWei: totalGasCost.toString(),
      totalGasCostMnt: parseFloat(ethers.formatEther(totalGasCost)),
      totalGasCostUsd:
        parseFloat(ethers.formatEther(totalGasCost)) * MNT_USD_ASSUMED,
      avgPerTxMnt: parseFloat(
        ethers.formatEther(totalGasCost / BigInt(txs.length || 1))
      ),
      avgPerTxUsd:
        parseFloat(
          ethers.formatEther(totalGasCost / BigInt(txs.length || 1))
        ) * MNT_USD_ASSUMED,
    },
    note:
      "Single representative cycle. Per-cycle cost varies with tx count: " +
      "HOLD cycles produce 5 attestations only; SWAP cycles produce 5 " +
      "attestations + 1-3 DEX swaps. mntPriceUsdAssumed locked here for " +
      "reproducibility; live MNT price drifts.",
    sourceCommit: "f2cc66c",
  };
  const outPath = path.resolve(
    __dirname,
    "..",
    "..",
    ".kiro",
    "audits",
    "raw",
    "gas-samples",
    "cycle-123.json"
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`✅ wrote ${outPath}`);
  console.log(
    `   ${out.summary.txCount} tx, ${out.summary.totalGasCostMnt.toFixed(
      4
    )} MNT total, ~$${out.summary.totalGasCostUsd.toFixed(
      4
    )} (avg $${out.summary.avgPerTxUsd.toFixed(4)} per tx)`
  );
})();
