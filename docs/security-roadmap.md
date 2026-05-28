# Security Roadmap

## Contract Admin Key (OC-02)

**Current state:** Single EOA (`0xDC783CDBfA993f3FC299460627b204E83bf4fb5a`)
owns all 5 deployed contracts as the Ownable admin. Total value at risk: ~$30
in demo capital.

**Risk assessment:** Low immediate risk (demo-only capital, no public deposits).
Higher reputational risk if judges flag single-key governance.

**Migration plan (post-hackathon):**

1. Deploy a 2-of-3 Gnosis Safe on Mantle
2. Transfer ownership of all 5 contracts to the Safe
3. Add timelock (24h) for admin actions (parameter changes, upgrades)
4. Document key holders (minimum: project owner + trusted backup)

**Why not now:** Contract redeploy is prohibited (loses on-chain decision
history, breaks Sourcify links). Ownership transfer is a low-risk TX but
the Safe deployment + testing exceeds the time budget and is not a scoring
criterion for the hackathon.

---

## Price Oracle Strategy (OC-03)

**Current state:** Single CoinGecko source for ETH/MNT price feeds.

**Mitigations already in place:**

1. **Discipline Layer – Freshness Gate:** Rejects any decision where price
   data is > 60 seconds old at time of execution. This limits damage from
   stale/cached CoinGecko responses.

2. **Validator adversarial check:** If the Analyst proposes a trade based
   on a price that seems anomalous (large delta from recent), the Validator's
   risk scoring flags it.

3. **No leveraged positions:** Max loss is bounded by position size (capped
   at 50% NAV), not amplified by leverage.

**Known residual risk:** A single-source oracle can be:
- Temporarily unavailable (CoinGecko rate limits → cycle fails, auto-retries)
- Manipulated upstream (unlikely for CoinGecko aggregated prices, but not
  impossible)

**Planned improvements (post-submission):**

1. Add Chainlink price feed as secondary source (not available on Mantle
   for all pairs yet)
2. Cross-validate CoinGecko vs on-chain TWAP from Merchant Moe pool
3. Implement median-of-3 oracle pattern when sources are available
4. Add staleness circuit-breaker: if price hasn't changed in > 5 minutes,
   flag as potentially stale even within 60s window
