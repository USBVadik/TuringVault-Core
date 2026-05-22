/**
 * TuringVault — Adaptive Grid Parameter Controller
 * 
 * AI manages PARAMETERS of the grid bot, not swaps directly.
 * This eliminates latency/MEV issues: the bot executes deterministically,
 * AI only adjusts macro strategy (bounds, step size, allocation).
 * 
 * Architecture:
 *   AI Agent → adjustGridParams() → grid_config.json
 *   Grid Bot → reads config → executes at exact price levels
 */
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.resolve(__dirname, "../data/grid_config.json");
const HISTORY_PATH = path.resolve(__dirname, "../data/grid_param_history.json");

const DEFAULT_CONFIG = {
  // Grid boundaries
  upperBound: 0.72,       // MNT price ceiling
  lowerBound: 0.63,       // MNT price floor
  gridSteps: 5,           // number of grid levels
  
  // Capital allocation
  maxPositionPct: 80,     // max % of portfolio in WMNT
  minReservePct: 20,      // min USDT reserve
  
  // Execution thresholds
  minTradeUsd: 0.10,      // minimum trade size
  slippagePct: 1.5,       // max slippage tolerance
  
  // Risk controls (AI cannot exceed these hard limits)
  hardStopLossPct: 8,     // absolute max drawdown before emergency exit
  maxDailySwaps: 10,      // prevent overtrading
  
  // Regime
  regime: "RANGING",      // RANGING | TRENDING_UP | TRENDING_DOWN | CRISIS
  lastUpdated: null,
  updatedBy: "default",
};

class GridParamController {
  constructor() {
    this.config = this._loadConfig();
    this.history = this._loadHistory();
  }

  _loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
    catch { return { ...DEFAULT_CONFIG }; }
  }

  _saveConfig() {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  _loadHistory() {
    try { return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")); }
    catch { return []; }
  }

  _saveHistory() {
    fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.history.slice(-100), null, 2));
  }

  /**
   * AI calls this to adjust grid parameters (not to execute trades)
   * @param {object} adjustment - new params from AI analysis
   * @param {string} reason - AI's reasoning for the change
   */
  adjustParams(adjustment, reason) {
    const prev = { ...this.config };
    
    // Validate hard limits (AI cannot bypass these)
    if (adjustment.maxPositionPct && adjustment.maxPositionPct > 90) {
      adjustment.maxPositionPct = 90; // hard cap
    }
    if (adjustment.hardStopLossPct && adjustment.hardStopLossPct > 15) {
      adjustment.hardStopLossPct = 15; // never risk more than 15%
    }
    if (adjustment.maxDailySwaps && adjustment.maxDailySwaps > 20) {
      adjustment.maxDailySwaps = 20;
    }
    
    // Apply validated changes
    Object.assign(this.config, adjustment, {
      lastUpdated: new Date().toISOString(),
      updatedBy: "ai_agent",
    });
    
    // Log the change
    this.history.push({
      timestamp: new Date().toISOString(),
      previous: prev,
      updated: this.config,
      reason,
      delta: Object.keys(adjustment).reduce((acc, k) => {
        if (prev[k] !== this.config[k]) acc[k] = { from: prev[k], to: this.config[k] };
        return acc;
      }, {}),
    });
    
    this._saveConfig();
    this._saveHistory();
    
    return {
      applied: true,
      config: this.config,
      changesApplied: Object.keys(adjustment).length,
    };
  }

  /**
   * Get current config for the grid bot to read
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get parameter change history for audit
   */
  getHistory(count = 20) {
    return this.history.slice(-count);
  }

  /**
   * Emergency: reset to defaults (called by risk control)
   */
  emergencyReset(reason) {
    this.history.push({
      timestamp: new Date().toISOString(),
      previous: { ...this.config },
      updated: DEFAULT_CONFIG,
      reason: `EMERGENCY RESET: ${reason}`,
      delta: { ALL: "reset to defaults" },
    });
    this.config = { ...DEFAULT_CONFIG, lastUpdated: new Date().toISOString(), updatedBy: "emergency" };
    this._saveConfig();
    this._saveHistory();
  }
}

module.exports = new GridParamController();
