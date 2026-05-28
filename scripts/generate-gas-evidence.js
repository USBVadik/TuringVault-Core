/**
 * Generate gas cost evidence artifact from actual TX receipts on Mantle Mainnet.
 *
 * Fetches receipt data for all on-chain TXs in outcomes.json,
 * computes per-TX and aggregate gas metrics, and writes the result
 * to artifacts/gas-cost-analysis.json.
 *
 * Usage: node scripts/generate-gas-evidence.js
 * Spec: post-submission-backlog OC-01.
 */

const fs = require("fs");
const path = require("path");

const RPC = "https://rpc.mantle.xyz";

async function getReceipt(txHash) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [txHash],
    }),
  });
  const json = await res.json();
  return json.result;
}

async function getTransaction(txHash) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [txHash],
    }),
  });
  const json = await res.json();
  return json.result;
}

async function main() {
  const outcomes = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../src/data/outcomes.json"),
      "utf-8"
    )
  );

  const allTxs = [
    ...(outcomes.pending || []),
    ...(outcomes.settled || []),
  ]
    .filter((e) => e.onChainTx)
    .map((e) => ({
      txHash: e.onChainTx,
      decisionId: e.decisionId,
      action: e.action,
      recordedAt: e.recordedAt,
    }));

  console.log(`Found ${allTxs.length} TXs to analyze...`);

  const results = [];
  const MNT_USD = 0.72; // approximate MNT price

  for (const entry of allTxs) {
    try {
      const [receipt, tx] = await Promise.all([
        getReceipt(entry.txHash),
        getTransaction(entry.txHash),
      ]);

      if (!receipt || !tx) {
        console.log(`  ⚠ ${entry.txHash.slice(0, 12)}… — receipt not found`);
        continue;
      }

      const gasUsed = parseInt(receipt.gasUsed, 16);
      const gasPrice = parseInt(tx.gasPrice || receipt.effectiveGasPrice, 16);
      const costWei = BigInt(gasUsed) * BigInt(gasPrice);
      const costMNT = Number(costWei) / 1e18;
      const costUSD = costMNT * MNT_USD;

      results.push({
        txHash: entry.txHash,
        decisionId: entry.decisionId,
        action: entry.action,
        recordedAt: entry.recordedAt,
        gasUsed,
        gasPriceGwei: gasPrice / 1e9,
        costMNT: Math.round(costMNT * 1e8) / 1e8,
        costUSD: Math.round(costUSD * 1e6) / 1e6,
      });

      console.log(
        `  ✓ ${entry.txHash.slice(0, 12)}… — ${gasUsed} gas, ${costMNT.toFixed(6)} MNT ($${costUSD.toFixed(5)})`
      );
    } catch (e) {
      console.log(`  ✗ ${entry.txHash.slice(0, 12)}… — ${e.message}`);
    }
  }

  // Aggregate stats
  const totalCostMNT = results.reduce((s, r) => s + r.costMNT, 0);
  const totalCostUSD = results.reduce((s, r) => s + r.costUSD, 0);
  const avgCostMNT = totalCostMNT / results.length;
  const avgCostUSD = totalCostUSD / results.length;
  const maxCostUSD = Math.max(...results.map((r) => r.costUSD));
  const minCostUSD = Math.min(...results.map((r) => r.costUSD));

  const artifact = {
    generatedAt: new Date().toISOString(),
    mntPriceAssumption: MNT_USD,
    sampleSize: results.length,
    aggregate: {
      totalCostMNT: Math.round(totalCostMNT * 1e6) / 1e6,
      totalCostUSD: Math.round(totalCostUSD * 1e4) / 1e4,
      avgCostPerTxMNT: Math.round(avgCostMNT * 1e8) / 1e8,
      avgCostPerTxUSD: Math.round(avgCostUSD * 1e6) / 1e6,
      maxCostUSD: Math.round(maxCostUSD * 1e6) / 1e6,
      minCostUSD: Math.round(minCostUSD * 1e6) / 1e6,
      claim: `~$${avgCostUSD.toFixed(4)} per TX (${results.length}-TX sample on Mantle Mainnet)`,
    },
    transactions: results,
  };

  const outPath = path.resolve(__dirname, "../artifacts/gas-cost-analysis.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\n✅ Artifact written: artifacts/gas-cost-analysis.json`);
  console.log(`   Sample: ${results.length} TXs`);
  console.log(`   Avg cost: ${avgCostMNT.toFixed(6)} MNT ($${avgCostUSD.toFixed(5)})`);
}

main().catch(console.error);
