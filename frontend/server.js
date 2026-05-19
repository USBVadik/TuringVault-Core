/**
 * TuringVault Dashboard API Server
 * Serves on-chain data + market data for the frontend
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const { ethers } = require("ethers");
const { getMarketData } = require("../src/orchestrator/marketData");
const config = require("../src/orchestrator/config");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

const DECISION_LOG_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash))",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 timestamp, string action, string targetAsset, uint256 amountIn, uint256 amountOut, uint256 confidence, string reasoningHash, bytes32 txHash)[])",
  "function successfulSwaps() view returns (uint256)",
  "function totalPnLBasisPoints() view returns (uint256)"
];

const IDENTITY_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);
const decisionLog = new ethers.Contract(config.CONTRACTS.DECISION_LOG, DECISION_LOG_ABI, provider);
const identity = new ethers.Contract(config.CONTRACTS.IDENTITY, IDENTITY_ABI, provider);

async function getAgentStatus() {
  const [total, successfulSwaps, totalPnL, agentURI] = await Promise.all([
    decisionLog.totalDecisions(),
    decisionLog.successfulSwaps(),
    decisionLog.totalPnLBasisPoints(),
    identity.tokenURI(0).catch(() => "{}")
  ]);

  let decisions = [];
  const count = Number(total);
  if (count > 0) {
    const recent = await decisionLog.getRecentDecisions(Math.min(count, 20));
    decisions = recent.map((d, i) => ({
      id: count - recent.length + i,
      timestamp: Number(d.timestamp) * 1000,
      action: d.action,
      targetAsset: d.targetAsset,
      confidence: Number(d.confidence),
      reasoning: d.reasoningHash
    }));
  }

  return {
    agent: {
      name: "TuringVault AI Agent",
      tokenId: 0,
      model: "Claude Sonnet 4.6",
      network: "Mantle Sepolia",
      contract: config.CONTRACTS.IDENTITY
    },
    stats: {
      totalDecisions: count,
      successfulSwaps: Number(successfulSwaps),
      totalPnLBps: Number(totalPnL),
      uptime: process.uptime()
    },
    decisions,
    contracts: config.CONTRACTS
  };
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.url === "/" || req.url === "/index.html") {
    res.setHeader("Content-Type", "text/html");
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.url === "/api/status") {
    try {
      const status = await getAgentStatus();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(status));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (req.url === "/api/market") {
    try {
      const market = await getMarketData();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(market));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.statusCode = 404;
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`TuringVault Dashboard: http://localhost:${PORT}`);
});
