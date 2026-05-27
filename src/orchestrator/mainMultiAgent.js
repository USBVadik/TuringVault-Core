/**
 * TuringVault Multi-Agent Orchestrator — Production Loop
 *
 * Runs every 5 minutes:
 *   1. Fetch real market data (CoinGecko, DeFiLlama, Fear&Greed, Nansen)
 *   2. Analyst Agent proposes decision
 *   3. Validator Agent independently verifies
 *   4. Consensus result recorded on-chain (Mantle Mainnet)
 *
 * Usage: node src/orchestrator/mainMultiAgent.js
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
});
const cron = require("node-cron");
const { runMultiAgentCycle } = require("./multiAgentLoop");

let cycleCount = 0;
let approvedCount = 0;
let rejectedCount = 0;

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  TURINGVAULT MULTI-AGENT ORCHESTRATOR — STARTING        ║");
console.log("║  Interval: every 5 minutes                              ║");
console.log("║  Network:  Mantle Mainnet                               ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`Started: ${new Date().toISOString()}\n`);

async function runCycle() {
  cycleCount++;
  console.log(`\n[Cycle #${cycleCount}] ${new Date().toISOString()}`);

  try {
    const result = await runMultiAgentCycle();
    if (result.consensus) {
      approvedCount++;
    } else {
      rejectedCount++;
    }
    console.log(
      `[Stats] Total: ${cycleCount} | Approved: ${approvedCount} | Rejected: ${rejectedCount} | Rate: ${(
        (approvedCount / cycleCount) *
        100
      ).toFixed(0)}%`
    );
  } catch (err) {
    console.error(`[Cycle #${cycleCount}] ERROR:`, err.message);
  }
}

// Run immediately on start
runCycle();

// Then every 5 minutes
cron.schedule("*/5 * * * *", runCycle);

console.log("Orchestrator running. Press Ctrl+C to stop.\n");
