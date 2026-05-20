/**
 * TuringVault Background Orchestrator
 * Runs multi-agent cycle every 15 minutes
 * Conservative interval to preserve Nansen API credits (1000 total)
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const cron = require("node-cron");
const { runMultiAgentCycle } = require("./multiAgentLoop");
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/orchestrator.log" })
  ]
});

let cycleCount = 0;

async function runCycle() {
  cycleCount++;
  logger.info(`=== Starting cycle #${cycleCount} ===`);
  try {
    const result = await runMultiAgentCycle();
    logger.info(`Cycle #${cycleCount} complete. Consensus: ${result.consensus ? "REACHED" : "BLOCKED"}. Action: ${result.action}`);
  } catch (err) {
    logger.error(`Cycle #${cycleCount} failed: ${err.message}`);
  }
}

// Run immediately on start
runCycle();

// Then every 15 minutes
cron.schedule("*/15 * * * *", () => {
  runCycle();
});

logger.info("TuringVault Orchestrator started — running every 15 minutes");
logger.info("Nansen API: 1000 credits, each call = 10 credits, ~100 API calls available");
logger.info("At 15min intervals: ~96 cycles/day = ~96 Nansen calls/day");
