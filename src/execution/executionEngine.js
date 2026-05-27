/**
 * TuringVault Execution Engine — Byreal Perps CLI Wrapper
 *
 * Converts multi-agent consensus decisions into deterministic on-chain execution
 * via Byreal Hyperliquid perpetual futures CLI.
 *
 * Architecture:
 *   MultiAgent Decision → ExecutionEngine → Byreal CLI → Hyperliquid
 *                                        → On-chain attestation (Mantle)
 */

const { execSync } = require("child_process");
const { ethers } = require("ethers");

class ExecutionEngine {
  constructor(options = {}) {
    this.maxLeverage = options.maxLeverage || 5;
    this.maxPositionSize = options.maxPositionSize || 0.1; // BTC equiv
    this.maxDrawdownPct = options.maxDrawdownPct || 10;
    this.dryRun = options.dryRun !== false; // default: dry-run for safety
    this.outputFormat = "json";
  }

  /**
   * Execute a trading decision from multi-agent consensus
   * @param {Object} decision — from multiAgent.js getMultiAgentDecision()
   * @returns {Object} execution result with txid or error
   */
  async execute(decision) {
    if (!decision || !decision.consensus) {
      return { executed: false, reason: "No consensus reached" };
    }

    const action = decision.action?.toLowerCase();
    const asset = this._resolveAsset(decision.analyst?.targetAsset);
    const confidence = decision.analyst?.confidence || 0;

    // Risk guardrails — cannot be overridden by LLM
    if (confidence < 0.8) {
      return {
        executed: false,
        reason: `Confidence ${confidence} below execution threshold 0.80`,
      };
    }

    try {
      switch (action) {
        case "swap":
        case "buy":
        case "long":
          return await this._openPosition(asset, "buy", decision);
        case "sell":
        case "short":
          return await this._openPosition(asset, "sell", decision);
        case "close":
          return await this._closePosition(asset);
        case "hold":
          return { executed: false, reason: "Hold signal — no trade" };
        default:
          return { executed: false, reason: `Unknown action: ${action}` };
      }
    } catch (err) {
      return { executed: false, error: err.message };
    }
  }

  /**
   * Get current market signals from Byreal
   */
  async getSignals() {
    const raw = this._cli("signal scan");
    return raw?.data?.signals || {};
  }

  /**
   * Get detailed technical analysis for a coin
   */
  async getSignalDetail(coin) {
    const raw = this._cli(`signal detail ${coin}`);
    return raw?.data || {};
  }

  /**
   * List open positions
   */
  async getPositions() {
    const raw = this._cli("position list");
    return raw?.data?.positions || [];
  }

  /**
   * Get account info & balance
   */
  async getAccountInfo() {
    const raw = this._cli("account info");
    return raw?.data || {};
  }

  // ─── Private Methods ───────────────────────────────────────────

  async _openPosition(coin, side, decision) {
    const size = this._calculateSize(decision);
    const leverage = Math.min(
      decision.analyst?.leverage || 3,
      this.maxLeverage
    );

    // Set leverage first
    this._cli(`position leverage ${coin} ${leverage}`);

    // Build order command
    let cmd = `order market ${side} ${size} ${coin}`;

    // Add TP/SL from validator risk assessment
    const riskScore = decision.validator?.riskScore || 50;
    const tpMultiplier = riskScore < 30 ? 0.05 : 0.03; // wider TP for low-risk
    const slMultiplier = riskScore < 30 ? 0.03 : 0.02;

    // Get current price for TP/SL calculation
    const signals = await this.getSignals();
    const coinSignal = this._findCoinInSignals(signals, coin);
    if (coinSignal) {
      const price = parseFloat(coinSignal.price);
      const tp =
        side === "buy"
          ? (price * (1 + tpMultiplier)).toFixed(2)
          : (price * (1 - tpMultiplier)).toFixed(2);
      const sl =
        side === "buy"
          ? (price * (1 - slMultiplier)).toFixed(2)
          : (price * (1 + slMultiplier)).toFixed(2);
      cmd += ` --tp ${tp} --sl ${sl}`;
    }

    if (this.dryRun) {
      return {
        executed: false,
        dryRun: true,
        command: `byreal-perps-cli ${cmd}`,
        coin,
        side,
        size,
        leverage,
        reason: "Dry-run mode — command prepared but not executed",
      };
    }

    // Execute with auto-confirm
    const result = this._cli(cmd + " -y");
    return {
      executed: true,
      coin,
      side,
      size,
      leverage,
      result,
      txid: result?.data?.txid || null,
    };
  }

  async _closePosition(coin) {
    if (this.dryRun) {
      return {
        executed: false,
        dryRun: true,
        command: `byreal-perps-cli position close-market ${coin}`,
      };
    }
    const result = this._cli(`position close-market ${coin} -y`);
    return { executed: true, coin, action: "close", result };
  }

  _calculateSize(decision) {
    // Conservative sizing based on confidence
    const confidence = decision.analyst?.confidence || 0.75;
    const riskScore = decision.validator?.riskScore || 50;

    // Base size 0.01 BTC, scale up with confidence, scale down with risk
    const baseSize = 0.01;
    const confidenceMultiplier = confidence; // 0.75-1.0
    const riskMultiplier = 1 - riskScore / 100; // lower risk = bigger position

    const size = Math.min(
      baseSize * confidenceMultiplier * riskMultiplier * 5,
      this.maxPositionSize
    );

    return size.toFixed(4);
  }

  _resolveAsset(targetAsset) {
    // Map our internal asset names to Byreal/Hyperliquid coins
    const mapping = {
      mETH: "ETH",
      ETH: "ETH",
      mUSD: "ETH", // mUSD strategies map to ETH shorts/longs
      BTC: "BTC",
      MNT: "MNT",
      USDY: "ETH", // RWA yield → hedge with ETH
    };
    return mapping[targetAsset] || "ETH";
  }

  _findCoinInSignals(signals, coin) {
    for (const category of Object.values(signals)) {
      if (Array.isArray(category)) {
        const found = category.find(
          (s) => s.coin === coin || s.coin?.includes(coin)
        );
        if (found) return found;
      }
    }
    return null;
  }

  _cli(command) {
    try {
      const output = execSync(`byreal-perps-cli ${command} -o json`, {
        timeout: 30000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return JSON.parse(output);
    } catch (err) {
      const stderr = err.stderr?.toString() || "";
      const stdout = err.stdout?.toString() || "";
      // Try to parse JSON from stdout even on error exit
      try {
        return JSON.parse(stdout);
      } catch {}
      throw new Error(`Byreal CLI error: ${stderr || stdout || err.message}`);
    }
  }
}

module.exports = { ExecutionEngine };
