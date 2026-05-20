/**
 * TuringVault Continuous Decision Loop
 * 
 * Runs the integrated orchestrator every 5 minutes to accumulate
 * on-chain decisions for hackathon demo (target: 50+ decisions).
 * 
 * Usage: node scripts/continuousLoop.js [mode] [iterations]
 *   mode: autonomous (default) | supervised | paper
 *   iterations: number of cycles (default: 15 = 60 decisions)
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between cycles
const MAX_ITERATIONS = parseInt(process.argv[3]) || 15;
const MODE = process.argv[2] || "autonomous";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Dynamic import to avoid top-level env issues
  const { runIntegratedCycle } = require("../src/orchestrator/integratedOrchestrator");
  const { ethers } = require("ethers");
  
  const provider = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const startBalance = await provider.getBalance(wallet.address);
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TURINGVAULT CONTINUOUS LOOP");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Mode: ${MODE}`);
  console.log(`  Target iterations: ${MAX_ITERATIONS}`);
  console.log(`  Interval: ${INTERVAL_MS / 1000}s`);
  console.log(`  Wallet: ${wallet.address}`);
  console.log(`  Balance: ${ethers.formatEther(startBalance)} MNT`);
  console.log(`  Est. completion: ${new Date(Date.now() + MAX_ITERATIONS * INTERVAL_MS).toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  let successCount = 0;
  let failCount = 0;
  const results = [];

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const cycleStart = Date.now();
    console.log(`\n━━━ CYCLE ${i}/${MAX_ITERATIONS} [${new Date().toISOString()}] ━━━\n`);
    
    try {
      const result = await runIntegratedCycle({ mode: MODE });
      successCount++;
      results.push({
        cycle: i,
        time: new Date().toISOString(),
        proposalId: result.proposalId,
        action: result.decision?.analyst?.action,
        var_bps: result.var_bps,
        autonomy: result.autonomyLevel,
        success: true
      });
      console.log(`\n  ✅ Cycle ${i} complete — Proposal #${result.proposalId}`);
    } catch (error) {
      failCount++;
      results.push({ cycle: i, time: new Date().toISOString(), error: error.message?.slice(0, 100), success: false });
      console.log(`\n  ❌ Cycle ${i} failed: ${error.message?.slice(0, 100)}`);
    }

    // Stats
    const currentBalance = await provider.getBalance(wallet.address);
    const spent = startBalance - currentBalance;
    console.log(`  📊 Success: ${successCount}/${i} | Spent: ${ethers.formatEther(spent)} MNT | Remaining: ${ethers.formatEther(currentBalance)} MNT`);
    console.log(`  📊 Total on-chain TXs: ~${successCount * 4} (4 per cycle)`);

    // Save progress
    const fs = require("fs");
    fs.writeFileSync(
      require("path").resolve(__dirname, "../data/loop_progress.json"),
      JSON.stringify({ results, successCount, failCount, lastUpdate: new Date().toISOString() }, null, 2)
    );

    // Wait unless last iteration
    if (i < MAX_ITERATIONS) {
      const elapsed = Date.now() - cycleStart;
      const waitTime = Math.max(INTERVAL_MS - elapsed, 30000); // Min 30s between cycles
      console.log(`  ⏳ Next cycle in ${Math.round(waitTime / 1000)}s...\n`);
      await sleep(waitTime);
    }
  }

  // Final summary
  const finalBalance = await provider.getBalance(wallet.address);
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LOOP COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Cycles: ${successCount} success / ${failCount} failed`);
  console.log(`  On-chain decisions: ~${successCount * 4} TXs`);
  console.log(`  Gas spent: ${ethers.formatEther(startBalance - finalBalance)} MNT`);
  console.log(`  Balance: ${ethers.formatEther(finalBalance)} MNT`);
  console.log("═══════════════════════════════════════════════════════════════");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
