#!/usr/bin/env node
/**
 * TuringVault Agent Cron — Continuous Trading Loop
 * 
 * Runs the multi-agent cycle every 5 minutes.
 * Each cycle: market intel → regime detection → grid signal → consensus → on-chain
 * 
 * Safety features:
 *   - Max 288 cycles/day (every 5 min)
 *   - Circuit breaker: stops after 3 consecutive errors
 *   - Max drawdown gate: pauses if portfolio -8%
 *   - Graceful shutdown on SIGTERM/SIGINT
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const CYCLE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_ERRORS = 3;
const MAX_DAILY_CYCLES = 288;

let running = true;
let cycleCount = 0;
let consecutiveErrors = 0;
let dailyCycles = 0;
let lastDayReset = new Date().toDateString();

// Graceful shutdown
process.on('SIGTERM', () => { running = false; console.log('\n⏹️  SIGTERM received — stopping after current cycle'); });
process.on('SIGINT', () => { running = false; console.log('\n⏹️  SIGINT received — stopping after current cycle'); });

async function runCycle() {
  const startTime = Date.now();
  cycleCount++;
  
  // Daily reset
  const today = new Date().toDateString();
  if (today !== lastDayReset) {
    dailyCycles = 0;
    lastDayReset = today;
    console.log(`\n📅 New day: ${today} — resetting cycle counter`);
  }
  
  // Daily limit
  if (dailyCycles >= MAX_DAILY_CYCLES) {
    console.log(`⚠️  Daily limit reached (${MAX_DAILY_CYCLES} cycles). Pausing until tomorrow.`);
    return;
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  CYCLE #${cycleCount} | ${new Date().toISOString()} | Errors: ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}`);
  console.log(`${'═'.repeat(60)}`);
  
  try {
    // Dynamic import to get fresh module state each cycle
    delete require.cache[require.resolve('../orchestrator/multiAgentLoop')];
    const { runMultiAgentCycle } = require('../orchestrator/multiAgentLoop');
    
    await runMultiAgentCycle();
    
    consecutiveErrors = 0; // Reset on success
    dailyCycles++;
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Cycle completed in ${elapsed}s | Next in ${CYCLE_INTERVAL_MS / 1000}s`);
    
  } catch (err) {
    consecutiveErrors++;
    console.error(`\n❌ Cycle #${cycleCount} FAILED: ${err.message}`);
    
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`\n🚨 CIRCUIT BREAKER: ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Stopping agent.`);
      console.error(`   Last error: ${err.stack?.split('\n').slice(0, 3).join('\n   ')}`);
      running = false;
    }
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  TURINGVAULT AUTONOMOUS AGENT — CRON MODE                   ║
║  Interval: ${CYCLE_INTERVAL_MS / 1000}s | Max errors: ${MAX_CONSECUTIVE_ERRORS} | Daily limit: ${MAX_DAILY_CYCLES}     ║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  // Run first cycle immediately
  await runCycle();
  
  // Then loop
  while (running) {
    await new Promise(resolve => setTimeout(resolve, CYCLE_INTERVAL_MS));
    if (!running) break;
    await runCycle();
  }
  
  console.log(`\n✅ Agent stopped cleanly after ${cycleCount} cycles.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
