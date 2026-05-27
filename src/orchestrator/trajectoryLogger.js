/**
 * TuringVault — Process-Level Trajectory Logger
 *
 * Logs full decision trajectories (not just outcomes) for audit:
 * - Tool calls made by each agent
 * - Intermediate reasoning steps
 * - Time-to-decision metrics
 * - Consistency scores across identical inputs
 */
const fs = require("fs");
const path = require("path");

const TRAJECTORY_PATH = path.resolve(__dirname, "../data/trajectories.json");

class TrajectoryLogger {
  constructor() {
    this.trajectories = this._load();
  }

  _load() {
    try {
      return JSON.parse(fs.readFileSync(TRAJECTORY_PATH, "utf8"));
    } catch {
      return [];
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(TRAJECTORY_PATH), { recursive: true });
    fs.writeFileSync(
      TRAJECTORY_PATH,
      JSON.stringify(this.trajectories.slice(-200), null, 2)
    );
  }

  /**
   * Log a full cycle trajectory
   */
  logCycle(trajectory) {
    const entry = {
      id: `traj_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...trajectory,
      // Process metrics
      metrics: {
        timeToAnalysis_ms: trajectory.analystDuration || 0,
        timeToValidation_ms: trajectory.validatorDuration || 0,
        timeToOnchain_ms: trajectory.onchainDuration || 0,
        totalCycle_ms:
          (trajectory.analystDuration || 0) +
          (trajectory.validatorDuration || 0) +
          (trajectory.onchainDuration || 0),
        // Consistency check
        actionReasoningConsistent: this._checkConsistency(trajectory.analyst),
        // Tool usage
        toolCallsAnalyst: trajectory.toolCalls?.analyst || 0,
        toolCallsValidator: trajectory.toolCalls?.validator || 0,
        // Information diversity (unique data points referenced)
        dataPointsUsed: this._countDataPoints(
          trajectory.analyst?.reasoning || ""
        ),
      },
    };
    this.trajectories.push(entry);
    this._save();
    return entry;
  }

  /**
   * Check if action is consistent with reasoning direction
   * Returns: "consistent" | "contradictory" | "ambiguous"
   */
  _checkConsistency(analyst) {
    if (!analyst) return "unknown";
    const { action, direction, targetAsset, reasoning } = analyst;
    if (!reasoning) return "unknown";

    const r = reasoning.toLowerCase();
    const bullishSignals = [
      "buy",
      "accumulate",
      "breakout",
      "bullish",
      "risk-on",
      "long",
      "upside",
    ];
    const bearishSignals = [
      "sell",
      "de-risk",
      "bearish",
      "correction",
      "defensive",
      "risk-off",
      "downside",
    ];

    const bullCount = bullishSignals.filter((s) => r.includes(s)).length;
    const bearCount = bearishSignals.filter((s) => r.includes(s)).length;

    if (
      bullCount > bearCount &&
      targetAsset === "mETH" &&
      direction === "risk_on"
    )
      return "consistent";
    if (
      bearCount > bullCount &&
      targetAsset === "mUSD" &&
      direction === "risk_off"
    )
      return "consistent";
    if (bullCount > bearCount && targetAsset === "mUSD") return "contradictory";
    if (bearCount > bullCount && targetAsset === "mETH") return "contradictory";
    if (action === "hold") return "consistent";
    return "ambiguous";
  }

  /**
   * Count unique data points referenced in reasoning
   */
  _countDataPoints(reasoning) {
    const patterns = [
      /\d+\.?\d*%/g, // percentages
      /\$[\d,]+\.?\d*/g, // dollar amounts
      /RSI|MACD|EMA|SMA/gi, // indicators
      /funding|Fear|Greed/gi, // sentiment
      /support|resistance/gi, // levels
    ];
    let count = 0;
    for (const p of patterns) {
      const matches = reasoning.match(p);
      if (matches) count += matches.length;
    }
    return count;
  }

  /**
   * Get aggregate process metrics for audit
   */
  getProcessMetrics() {
    if (this.trajectories.length === 0) return null;

    const recent = this.trajectories.slice(-50);
    const consistencies = recent
      .map((t) => t.metrics?.actionReasoningConsistent)
      .filter(Boolean);
    const cycleTimes = recent
      .map((t) => t.metrics?.totalCycle_ms)
      .filter((t) => t > 0);
    const dataPoints = recent
      .map((t) => t.metrics?.dataPointsUsed)
      .filter((d) => d > 0);

    return {
      totalTrajectories: this.trajectories.length,
      recentWindow: recent.length,
      consistency: {
        consistent: consistencies.filter((c) => c === "consistent").length,
        contradictory: consistencies.filter((c) => c === "contradictory")
          .length,
        ambiguous: consistencies.filter((c) => c === "ambiguous").length,
        consistencyRate:
          consistencies.length > 0
            ? (
                (consistencies.filter((c) => c === "consistent").length /
                  consistencies.length) *
                100
              ).toFixed(1) + "%"
            : "N/A",
      },
      timing: {
        avgCycle_ms:
          cycleTimes.length > 0
            ? Math.round(
                cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
              )
            : 0,
        minCycle_ms: cycleTimes.length > 0 ? Math.min(...cycleTimes) : 0,
        maxCycle_ms: cycleTimes.length > 0 ? Math.max(...cycleTimes) : 0,
      },
      informationDiversity: {
        avgDataPoints:
          dataPoints.length > 0
            ? (
                dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length
              ).toFixed(1)
            : 0,
      },
    };
  }
}

module.exports = new TrajectoryLogger();
