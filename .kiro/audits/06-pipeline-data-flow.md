# 06 — Pipeline Data-Flow Audit

| Meta | Value |
|------|-------|
| Auditor | Kiro (automated) |
| Date | 2026-05-28 |
| Scope | 2 decision cycles from `cycle-history.json` (May 26–28 window) |
| Method | Local state files → IPFS pin fetch → on-chain RPC query → code trace |

---

## Cycle Selection

| # | Cycle Type | Timestamp (started) | Decision ID | IPFS CID |
|---|-----------|-------------------|-------------|-----------|
| A | **EXECUTED_SWAP** | 2026-05-27T05:14:01Z | 107 | `QmQhCFyAJvdCzirofqfS5BVDzxky9zDRurBTa5EpjiSE2N` |
| B | **BLOCKED_BY_LOW_CONFIDENCE** | 2026-05-27T16:04:46Z | 110 | `QmWpnqtmWKqdaRMfaoowqPuduxkdCLKcTVZ6L3KuTvRU1G` |

Both cycles are within the last 7 days relative to the most recent cycle-history entry (2026-05-28T05:00).

---

## Data Card A — EXECUTED_SWAP (Decision #107)

| Layer | Source | Key Data |
|-------|--------|----------|
| **Analyst** | IPFS pin (`analyst` field) | Model: claude-sonnet-4.6. Action: `swap` → mUSD. Confidence: 0.68. Reasoning: "TREND_DOWN regime (60% confidence) with bearish signal consensus supports reducing risk exposure. Funding rate at 0.438% is neutral, but EMA bearish crossover and negative MACD histogram confirm downside pressure." Risk factors: RSI bounce, low volatility, neutral smart money flows. |
| **Validator** | IPFS pin (`validator` field) + outcomes.json | Model: claude-sonnet-4.6. Approved: true. Confidence: 0.72. Risk score: 28. Reasoning: "Defensive rotation to mUSD in TREND_DOWN regime is a risk-off action, not a directional speculative swap." Flagged issues: 60% regime confidence, RSI bounce risk, neutral smart money, improving MACD. |
| **Arbiter** | outcomes.json | Arbiter vote: `null` (arbiter did NOT fire — consensus was reached between analyst+validator without escalation). |
| **Discipline** | discipline-history.json + outcomes.json | Verdict: ACCEPTED. Checks: price_freshness PASS ("5s old"), drift_detection PASS ("Action aligns with RANGING regime"). `tx_proof` not present (swap occurred AFTER discipline gate). |
| **IPFS Link** | Pinata gateway | `https://gateway.pinata.cloud/ipfs/QmQhCFyAJvdCzirofqfS5BVDzxky9zDRurBTa5EpjiSE2N` — HTTP 200, content verified matches outcomes.json reasoning. |

### On-Chain Cross-Reference

| Field | On-Chain (proposal #107) | Local (outcomes.json) | Match? |
|-------|-------------------------|----------------------|--------|
| Timestamp | 2026-05-27T05:14:24Z | recordedAt: 2026-05-27T05:14:47Z | ✅ ~23s delta (submit→confirm) |
| Action | swap | swap | ✅ |
| Target | mUSD | mUSD | ✅ |
| Confidence | 6800 (basis points) | 0.68 | ✅ |
| Status | 1 (Approved) | consensus: true | ✅ |
| Reasoning | Matches IPFS pin | Matches IPFS pin | ✅ |

### Settlement

- Price at decision: $2069.41
- Price at settlement: $2059.72 (−0.47%)
- Outcome: **GOOD_CALL** (+60 score, +32 pnlBps)

---

## Data Card B — BLOCKED_BY_LOW_CONFIDENCE (Decision #110)

| Layer | Source | Key Data |
|-------|--------|----------|
| **Analyst** | IPFS pin (`analyst` field) | Model: claude-sonnet-4.6. Action: `hold` → mETH. Confidence: **0.35** (below 0.62 threshold). Reasoning: "Regime is unconfirmed (HOLD at 35% confidence) with mixed signals: technicals lean bearish but RSI rising." Risk factors: Extreme Fear (25), lower Bollinger band, low volatility breakout risk. |
| **Validator** | IPFS pin (`validator` field) + outcomes.json | Model: claude-sonnet-4.6. Approved: true. Confidence: 0.78. Risk score: 18. Reasoning: "HOLD proposal with 0% allocation change is low-risk by default. Analyst reasoning accurately reflects raw signals." Flagged issues: Social mindshare +43% bullish signal omitted by analyst, yield spread −1% not explicitly cited. |
| **Arbiter** | outcomes.json | Vote: `approve`. Reasoning: "The hold proposal is approved because the market signals are highly mixed and the lack of smart money direction warrants keeping the current allocation unchanged." |
| **Discipline** | discipline-history.json + outcomes.json | Verdict: ACCEPTED. Checks: tx_proof SKIP ("Hold action — no tx to verify"), price_freshness PASS ("5s old"), drift_detection PASS ("Action aligns with RANGING regime"). |
| **IPFS Link** | Pinata gateway | `https://gateway.pinata.cloud/ipfs/QmWpnqtmWKqdaRMfaoowqPuduxkdCLKcTVZ6L3KuTvRU1G` — HTTP 200, content verified matches outcomes.json reasoning. |

### On-Chain Cross-Reference

| Field | On-Chain (proposal #110) | Local (outcomes.json) | Match? |
|-------|-------------------------|----------------------|--------|
| Timestamp | 2026-05-27T16:05:24Z | recordedAt: 2026-05-27T16:05:47Z | ✅ ~23s delta |
| Action | hold | hold | ✅ |
| Target | mETH | mETH | ✅ |
| Confidence | 3500 (basis points) | 0.35 | ✅ |
| Status | 2 (Rejected/Blocked) | consensus: false | ✅ |
| Reasoning | Matches IPFS pin | Matches IPFS pin | ✅ |

### Settlement

- Price at decision: $2068.00
- Price at settlement: $2052.52 (−0.75%)
- Outcome: **CORRECT_BLOCK** (+40 score, +22 pnlBps)
- On-chain TX: `0xcc25c80332e1030ca34e92c70f7a045e89576d35187d55ca8e6c70cb8e48558c`

---

## Quality Checks

### Cycle A — EXECUTED_SWAP (#107)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Market data fresh at decision time? | **PASS** | Discipline gate: "Price data was 5s old". IPFS pin timestamp 05:14:19Z vs cycle start 05:14:01Z = 18s total pipeline latency. |
| 2 | Analyst reasoning unique vs last 5 cycles? | **PASS** | Decision #107 reasoning discusses "TREND_DOWN regime + defensive rotation to mUSD" — distinct from the HOLD-oriented reasoning in decisions #108–111. Swap-specific logic (R:R framework, 35% allocation) is unique. |
| 3 | Validator disagreed at least once in same window? | **FAIL** | `disagreementSignal` is `false` for decision #107 AND for all 20 most recent settled outcomes. Validator NEVER rejected a proposal in the observable window. See P1 finding below. |
| 4 | Arbiter fired when expected? | **PASS (N/A)** | Arbiter did NOT fire (vote=null). This is correct — consensus was reached between analyst (0.68) and validator (0.72) without needing escalation. The arbiter fires only when there is disagreement. |
| 5 | Claimed signals in prompt context? | **PARTIAL FAIL** | See signal verification table below. |

### Cycle B — BLOCKED_BY_LOW_CONFIDENCE (#110)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Market data fresh at decision time? | **PASS** | Discipline gate: "Price data was 5s old". IPFS pin timestamp 16:05:18Z vs cycle start 16:04:46Z = 32s pipeline latency. |
| 2 | Analyst reasoning unique vs last 5 cycles? | **FAIL** | Validator reasoning for #109, #110, #111 all begin with nearly identical text: "HOLD with 0% allocation change is a low-risk…" with only minor variations. Analyst reasoning for #110 is more unique (discusses 0.35 confidence threshold), but pattern repetition is concerning. |
| 3 | Validator disagreed at least once in same window? | **FAIL** | Same as above — `disagreementSignal=false` across all last 20 outcomes. |
| 4 | Arbiter fired when expected? | **PASS** | Arbiter DID fire (vote: "approve", reasoning present). This is correct — `consensus: false` means analyst confidence was too low, so arbiter was engaged as tiebreaker. Arbiter correctly approved the defensive hold. |
| 5 | Claimed signals in prompt context? | **PARTIAL FAIL** | See signal verification table below. |

---

## Signal Verification (Check #5 Detail)

README claims these signals feed the pipeline:

| Signal | README Claim | In `signalEngine.js` code? | In IPFS pin `dataSources`? | In actual reasoning text? | Verdict |
|--------|-------------|---------------------------|---------------------------|--------------------------|---------|
| CoinGecko (price/vol) | ✅ Live | ✅ `getEthPrice()` | ✅ Listed | ✅ Price referenced | **PASS** |
| Nansen MCP (smart money) | ✅ Live | ✅ `getOnChainFlowSignal()` | ✅ Listed | ✅ "Smart money flows neutral/flat" in reasoning | **PASS** |
| Elfa (social mindshare) | ✅ Live | ✅ `getElfaSignal()` in signalEngine | ❌ NOT in IPFS pin dataSources | ✅ Validator mentions "Social mindshare +43%" | **PARTIAL** |
| DeFiLlama (Mantle TVL) | ✅ Live | ✅ `getMantleTVL()` | ✅ Listed | Not explicitly in reasoning | **PASS** |
| Byreal Perps (funding/OI) | ✅ Live | ✅ `getByrealSignals()` | ✅ Listed as "Byreal Perps" | ✅ Funding rate referenced | **PASS** |
| Fear & Greed Index | ✅ Live | ✅ `getFearGreed()` | ✅ Listed | ✅ "Fear & Greed at 25" | **PASS** |
| Regime Detection | ✅ Architecture diagram | ✅ `detectRegime()` | Not a "data source" per se | ✅ Regime label in all reasoning | **PASS** |
| Hyperliquid | Listed in README architecture | ❌ Not in signalEngine.js | ❌ Not in IPFS pin | ❌ Not referenced | **FAIL** |

---

## Findings

### P1 — Validator Never Disagreed in Last 20 Cycles

- **Surface:** `outcomes.json` → `disagreementSignal` field
- **Expected:** Validator should reject at least some proposals to demonstrate adversarial behavior
- **Actual:** `disagreementSignal=false` for ALL 20 most recent settled outcomes (decisions #92–#111). The validator always approves.
- **Nuance:** `consensus=false` occurs 15/20 times, but this is driven by LOW ANALYST CONFIDENCE (below threshold), not by validator disagreement. The validator `approved: true` in every case.
- **Root cause:** The validator model (Claude Sonnet 4.6) appears to be structurally approving — it flags issues but never rejects. The system relies on confidence gating rather than adversarial rejection.
- **Impact:** The "adversarial multi-agent consensus" narrative is weakened. The validator is a reviewer, not an adversary. This is not a lie (it does flag issues), but it contradicts the "adversarial challenge" framing.
- **Suggested fix:** Either (a) lower the validator approval threshold so it actually rejects low-confidence proposals, or (b) reframe documentation to say "advisory validator" rather than "adversarial validator."

### P2 — Repetitive Validator Reasoning

- **Surface:** outcomes.json, decisions #108–111
- **Expected:** Each cycle produces unique reasoning demonstrating fresh analysis
- **Actual:** Validator reasoning for HOLD decisions is near-identical: "HOLD with 0% allocation change is a low-risk [capital-preserving/defensive] action. Analyst reasoning [accurately reflects/aligns with] raw signals…"
- **Root cause:** When the action is HOLD with identical market conditions, the Claude validator produces structurally similar text. This is expected LLM behavior, not a bug.
- **Impact:** Low — the reasoning IS correct each time. But it weakens the "unique reasoning per cycle" claim for judges doing spot-checks.

### P2 — Elfa Signal Missing from IPFS Pin dataSources

- **Surface:** `src/ipfs/storage.js` → `marketContext.dataSources` array
- **Expected:** All signals feeding the prompt should be listed in the IPFS proof artifact
- **Actual:** Elfa is wired into `signalEngine.js` and its data appears in validator reasoning ("Social mindshare +43%"), but the IPFS pin's `dataSources` hardcoded array omits it.
- **Root cause:** `dataSources` in `src/ipfs/storage.js` is a static list that wasn't updated when Elfa was added.
- **Suggested fix:** Add `"Elfa Social"` to the `dataSources` array in `src/ipfs/storage.js`.

### P2 — Hyperliquid Claimed in README Architecture but Not in Pipeline

- **Surface:** README.md architecture diagram lists "Hyperliquid" in DATA LAYER
- **Expected:** If listed in architecture, should feed the pipeline
- **Actual:** No Hyperliquid integration exists in `signalEngine.js` or `unifiedMarketData.js`. The "Byreal Perps" module provides funding/OI data (potentially from Hyperliquid as upstream), but there is no direct Hyperliquid API call.
- **Impact:** Low — this is a labeling issue in the ASCII architecture diagram. "Byreal Perps" may source from Hyperliquid, but it's not a direct integration.
- **Suggested fix:** Rename "Hyperliquid" to "Byreal Perps (funding/OI)" in the architecture diagram, or add a footnote that Byreal aggregates Hyperliquid data.

### P2 — Raw Model Outputs Not Stored for Recent Decisions

- **Surface:** `src/data/raw_model_outputs/`
- **Expected:** Per task description, raw model output files should exist per decision
- **Actual:** The directory only contains files from 2026-05-26T11:xx and 2026-05-26T12:xx (early testing). No files for decisions #107–111.
- **Root cause:** Raw output capture appears to have been active during initial testing but was either disabled or the GitHub Actions runner doesn't persist these files (they'd be ephemeral in CI).
- **Impact:** Low for judges (IPFS pins contain the full reasoning), but reduces local reproducibility.

### Observation — On-Chain Proposal Count vs Outcomes.json Length

- On-chain `totalProposals()`: **119**
- outcomes.json settled entries: **111** (IDs go up to 111, plus many early entries with IDs like "9999")
- Delta: +8 on-chain proposals not reflected in local outcomes.json
- This is expected — the most recent cycles (112–119) may still be in the pending state or were recorded on-chain but not yet settled locally.

---

## Not Checked

| Item | Reason |
|------|--------|
| Full IPFS content integrity (keccak hash vs on-chain `reasoningHash`) | Contract does not store `reasoningHash` field — only reasoning text directly. CID is content-addressed (IPFS guarantee). |
| Pinata pin persistence guarantee | Both CIDs returned HTTP 200 at audit time. Cannot predict future pin expiry without checking Pinata dashboard (requires auth). |
| Whether Elfa signal was actually fresh at decision time (vs cached) | signalEngine.js uses a cache wrapper; cannot verify cache hit/miss from artifacts alone. Code has no explicit TTL — uses default 5-min cache. |
| Raw model output completeness for all 119 proposals | Only 20 files exist in `raw_model_outputs/`, all from 2026-05-26 testing phase. |

---

## Summary

| Check | Cycle A (EXECUTED_SWAP) | Cycle B (BLOCKED_BY_LOW_CONFIDENCE) |
|-------|------------------------|--------------------------------------|
| Market data fresh | ✅ PASS | ✅ PASS |
| Reasoning unique | ✅ PASS | ❌ FAIL (repetitive) |
| Validator disagreed | ❌ FAIL (never in 20 cycles) | ❌ FAIL (never in 20 cycles) |
| Arbiter fired correctly | ✅ PASS | ✅ PASS |
| Claimed signals in context | ⚠️ PARTIAL (Elfa present but unlisted; Hyperliquid absent) | ⚠️ PARTIAL (same) |

**Highest severity:** P1 — Validator has never disagreed in the last 20 cycles.
