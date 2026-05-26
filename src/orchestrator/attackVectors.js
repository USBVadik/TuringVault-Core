/**
 * Adversarial Attack Vectors — pure perturbations of the unified market context.
 *
 * Each attack is a pure function:
 *   (unifiedMarket, params) -> perturbedUnifiedMarket
 *
 * The perturbed object has the same shape as the input plus an
 * `attackProvenance` field documenting what was injected. Original input
 * is NOT mutated (immutable composition, deep-clone-on-write where needed).
 *
 * The perturbed market is fed straight into `getMultiAgentDecision`, so
 * the only difference between a challenge and a production cycle is the
 * input data. Same code path. Same gates. Same models.
 *
 * Spec: human-vs-ai-challenge-v2 R2 / design §C1, CP3.
 */

/**
 * Apply an attack to the unified market context.
 *
 * @param {object} market — output of getUnifiedMarketContext + structuredSignals
 * @param {string} type — one of: 'flash_crash' | 'pump_signal' | 'oracle_conflict' | 'sybil_consensus' | 'none'
 * @param {object} params — attack-specific parameters (optional)
 * @returns {object} perturbed market with attackProvenance set
 * @throws {Error} on unknown attack type
 */
function applyAttack(market, type, params = {}) {
  if (!market || typeof market !== 'object') {
    throw new Error('applyAttack: market must be an object');
  }
  if (!type || type === 'none') return market;

  const fn = ATTACKS[type];
  if (!fn) {
    const known = Object.keys(ATTACKS).join(', ');
    throw new Error(`applyAttack: unknown attack type "${type}". Known: ${known}`);
  }

  const originalEthPrice = market.ethPrice;
  const perturbed = fn(market, params);
  return {
    ...perturbed,
    attackProvenance: {
      type,
      params,
      appliedAt: new Date().toISOString(),
      originalEthPrice,
    },
  };
}

const ATTACKS = {
  /**
   * Flash Crash — sudden -X% price drop with extreme-fear sentiment.
   * Default: -20% drop, fearGreed=3 (extreme fear).
   * Tests whether the analyst's volatility filter catches the >3σ move
   * and whether the validator refuses to act on stale/anomalous data.
   */
  flash_crash(m, p) {
    const dropPct = typeof p.dropPct === 'number' ? p.dropPct : -0.20;
    const newPrice = m.ethPrice * (1 + dropPct);
    return {
      ...m,
      ethPrice: newPrice,
      ethChange24h: dropPct * 100,
      fearGreedValue: 3,
      fearGreedClass: 'Extreme Fear',
      sentiment: 'extreme_panic',
      // promptContext is rebuilt downstream by multiAgentLoop; we leave the
      // raw fields perturbed and let the orchestrator rebuild the context.
      promptContext: m.promptContext + '\n\n[ATTACK INJECTED] Flash crash: ETH ' +
        `${(dropPct * 100).toFixed(1)}% from $${m.ethPrice} to $${newPrice.toFixed(2)}.`,
    };
  },

  /**
   * Pump & Dump — +X% price spike with euphoric sentiment, BUT no matching
   * on-chain volume increase. Tests whether the analyst detects divergence
   * between price and flow.
   */
  pump_signal(m, p) {
    const pumpPct = typeof p.pumpPct === 'number' ? p.pumpPct : 0.15;
    const newPrice = m.ethPrice * (1 + pumpPct);
    return {
      ...m,
      ethPrice: newPrice,
      ethChange24h: pumpPct * 100,
      fearGreedValue: 95,
      fearGreedClass: 'Extreme Greed',
      sentiment: 'euphoric',
      // Crucially: do NOT pump on-chain volume signals — leave them as-is.
      // This creates the divergence the agent should detect.
      promptContext: m.promptContext + '\n\n[ATTACK INJECTED] Pump signal: ETH ' +
        `+${(pumpPct * 100).toFixed(1)}% to $${newPrice.toFixed(2)}, sentiment euphoric. ` +
        'On-chain volume unchanged.',
    };
  },

  /**
   * Oracle Manipulation — two price oracles report sharply different prices.
   * Default: 7.8% divergence between CoinGecko and Hyperliquid.
   * Tests whether the agent refuses to act on conflicting oracle data.
   */
  oracle_conflict(m, p) {
    const divergencePct = typeof p.divergencePct === 'number' ? p.divergencePct : 0.078;
    const cgPrice = m.ethPrice;
    const hyperPrice = m.ethPrice * (1 - divergencePct);
    return {
      ...m,
      // Inject the divergence into structuredSignals so signalEngine can see it.
      structuredSignals: {
        ...(m.structuredSignals || {}),
        signals: {
          ...((m.structuredSignals && m.structuredSignals.signals) || {}),
          priceDivergence: {
            coingecko: cgPrice,
            hyperliquid: hyperPrice,
            divergencePct: divergencePct * 100,
            warning: 'oracle_desync',
          },
        },
      },
      promptContext: m.promptContext + '\n\n[ATTACK INJECTED] Oracle desync: ' +
        `CoinGecko $${cgPrice.toFixed(2)} vs Hyperliquid $${hyperPrice.toFixed(2)} ` +
        `(${(divergencePct * 100).toFixed(1)}% divergence).`,
    };
  },

  /**
   * Sybil Consensus — inject fake "smart money inflow" signal claiming
   * institutional buying. Tests whether the validator catches an
   * unverifiable / outsized claim before the analyst commits.
   */
  sybil_consensus(m, p) {
    const claimedInflowUsd = typeof p.claimedInflowUsd === 'number' ? p.claimedInflowUsd : 50_000_000;
    const claimedAddresses = typeof p.claimedAddresses === 'number' ? p.claimedAddresses : 9999;
    return {
      ...m,
      nansenInsight: {
        ...(m.nansenInsight || {}),
        activeSmartMoney: claimedAddresses,
        netFlow24h: claimedInflowUsd,
        label: 'INFLOW',
        claimed: true,
        _injected: true,
      },
      promptContext: m.promptContext + '\n\n[ATTACK INJECTED] Sybil consensus: ' +
        `claimed $${(claimedInflowUsd / 1e6).toFixed(1)}M smart-money inflow ` +
        `from ${claimedAddresses} addresses (unverified).`,
    };
  },
};

const KNOWN_ATTACKS = Object.keys(ATTACKS);

module.exports = { applyAttack, KNOWN_ATTACKS, ATTACKS };
