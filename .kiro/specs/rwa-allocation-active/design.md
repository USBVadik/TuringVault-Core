# RWA Allocation Active — Design

## Overview

This design wires real on-chain RWA execution into the existing
multi-agent cycle. It preserves the entire current
proposal/validation/decision-log/reputation chain and adds, after
those four attestation TXs, a single optional swap step to the
USDT0/USDT pool on Merchant Moe.

The cycle picks at most one RWA action per run, sourced from one of:

- **Path A — LLM-driven** (`source: 'llm'`)
  The Analyst's vocabulary gains two actions: `rwa_allocate` and
  `rwa_exit`. When consensus reaches with one of these, the
  orchestrator builds an intent for the swap.

- **Path B — deterministic idle-parking** (`source: 'idle-parking'`)
  When the LLM consensus is HOLD and the wallet has been FLAT for
  ≥ 24 h (and regime ≠ TREND_UP), a deterministic rule triggers a
  small allocation to USDT0.

Both paths flow through one allocator (`rwaAllocator.evaluate`),
emit one shape (`RWAIntent`), and execute via one gateway
(`MerchantMoeDEX.executeSwap` with new safety limits).

## Decisions taken (closes Open Questions from requirements.md)

| Q | Decision | Rationale |
|---|---|---|
| Q1 — when in cycle | **After 4 attestations, before agent-card refresh.** | Mirrors how settled outcomes work today; the swap settles its own attestation chain on the next cycle. |
| Q2 — Path A delivery | **Extend Analyst vocabulary** (A1). | Single-prompt, single Zod schema bump. Adding a 3rd agent is cost+latency without narrative win. |
| Q3 — Path B cooldown | **6 h between successful idle-parking swaps.** | Hourly cron noise won't churn; 4 idle parks/day max is plenty. |
| Q4 — reverse direction | **Yes, `rwa_exit` is a Path A action.** | Symmetry with allocate; lets the agent rotate back to mETH on TREND_UP. Path B never exits. |
| Q5 — idle-parking source | **USDT (legacy) primary, mUSD when present.** | Wallet has 6.763 USDT idle today; mUSD = 0. USDT is the obvious dust-magnet. |
| Q6 — USDT0 yield claim | **Zero. Never claim APY on USDT0.** | USDT0 is bridge-wrapped Tether, not a rebasing yield token. Narrative is "Treasury-backed transparent allocation", not "earn yield". |

## Architecture

```
runMultiAgentCycle()
  │
  ├─ Step 1-3: market data → consensus → IPFS pin           (unchanged)
  │
  ├─ Step 4: 4 attestation TXs                              (unchanged)
  │     • registry.submitProposal       (tx1)
  │     • registry.validateProposal     (tx2)
  │     • decisionLog.logDecision       (tx3)
  │     • reputation.submitFeedback     (tx4)
  │
  ├─ Step 4.5 (NEW): RWA allocator
  │     ├─ rwaAllocator.evaluate({decision, market, balances,
  │     │                         lastSwapAt, posState})
  │     ├─ → null  : log gate reason, skip
  │     └─ → RWAIntent : continue
  │
  ├─ Step 4.6 (NEW): RWA execute (gated by RWA_EXECUTE_ENABLED)
  │     ├─ MerchantMoeDEX.executeSwap(intent, {limits})
  │     ├─ on success → write txHash into outcomes.json
  │     │              and last-cycle-summary.json.txHashes
  │     └─ on revert  → push to cycle-failures.json, exit 0
  │
  ├─ Step 5-6: outcome tracker + position state             (unchanged)
  ├─ Step 7: trajectory log                                 (unchanged)
  ├─ Step 8: agent-card refresh                             (unchanged)
  └─ return { decision, decisionTier, ..., rwaIntent }      (extended)
```

## Components and Interfaces

### C1 — `src/rwa/usdt0Module.js` (new)

```javascript
const USDT0_ADDRESS = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736';

class USDT0Module {
  constructor(opts = {}) {
    this.provider = new ethers.JsonRpcProvider(opts.rpcUrl || 'https://rpc.mantle.xyz');
    this.wallet = opts.privateKey ? new ethers.Wallet(opts.privateKey, this.provider) : null;
    this.token = new ethers.Contract(USDT0_ADDRESS, ERC20_ABI, this.provider);
    this.assetClass = 'rwa-treasury';
    this.issuer = 'Tether (via LayerZero)';
    this.underlying = 'US Treasury Bills + cash equivalents';
    this.currentAPY = 0;          // USDT0 is NOT yield-bearing on its own
    this.liquidityRoute = 'USDT/USDT0 binStep=1';
  }

  async getPosition(addr) { /* balance, decimals, supply, poolShare */ }

  async getContextForAI(addr) {
    return {
      asset: 'USDT0',
      address: USDT0_ADDRESS,
      assetClass: this.assetClass,
      issuer: this.issuer,
      underlying: this.underlying,
      yield: 'none (1:1 USD peg, transparent Treasury collateral)',
      liquidity: this.liquidityRoute,
    };
  }
}

module.exports = { USDT0Module, USDT0_ADDRESS };
```

Pure mirror of `usdyModule.js` but:
- `currentAPY: 0` (honest)
- `assetClass: 'rwa-treasury'` (taggable for `/api/decisions`)
- No `calculateAllocation`. The allocator is `rwaAllocator.js`.

### C2 — `src/config/rwaLimits.js` (new)

```javascript
module.exports = {
  // Per-cycle ceiling — single swap can't move more than this in USD.
  MAX_PER_CYCLE_USD: Number(process.env.RWA_MAX_PER_CYCLE_USD ?? 5),

  // Per-day rolling 24h ceiling across all RWA swaps.
  MAX_PER_DAY_USD: Number(process.env.RWA_MAX_PER_DAY_USD ?? 25),

  // Min wallet stable-USD balance to even attempt (anti-dust).
  MIN_BALANCE_USD: 2,

  // Max price impact accepted by executeSwap (basis points).
  MAX_PRICE_IMPACT_BPS: 100,            // 1%

  // Slippage applied when computing minAmountOut.
  DEFAULT_SLIPPAGE_BPS: 50,             // 0.5%

  // Path B cooldown after a successful idle-parking swap.
  IDLE_PARKING_COOLDOWN_MS: 6 * 60 * 60 * 1000,

  // Path B trigger: min FLAT duration before parking fires.
  IDLE_PARKING_MIN_FLAT_MS: 24 * 60 * 60 * 1000,

  // Fraction of stable-USD balance to park per Path B trigger.
  IDLE_PARKING_FRACTION: 0.20,          // 20% of idle USDT each parking
};
```

Operator can override any limit by setting an env var without
redeploy. GitHub Actions secret entry is documented in the runbook.

### C3 — `src/orchestrator/rwaAllocator.js` (new)

```javascript
/**
 * Single decision point for "should we touch RWA this cycle?"
 *
 * Inputs:
 *   - decision    : multi-agent decision object (already produced)
 *   - market      : market context with regime + structuredSignals
 *   - balances    : { USDT, USDT0, mUSD, MNT, mETH, ... } floats
 *   - prices      : { USDT: 1, USDT0: 1, MNT: 0.72, ETH: 2100, ... }
 *   - lastSwapAt  : ISO of most recent successful RWA swap or null
 *   - posState    : positionState.getState() result
 *
 * Output: RWAIntent | null
 */

const { USDT0_ADDRESS } = require('../rwa/usdt0Module');
const limits = require('../config/rwaLimits');

const USDT_ADDRESS = '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE';

function readDailySpend() {
  // sum of `amountInUsd` from outcomes.json[].rwaIntent within last 24h
  // (helper — not pasted)
}

function evaluate({ decision, market, balances, prices, lastSwapAt, posState }) {
  const nowMs = Date.now();
  const idleStableUsd =
    (balances.USDT ?? 0) * (prices.USDT ?? 1) +
    (balances.mUSD ?? 0) * (prices.mUSD ?? 1);

  // Hard floor: dust wallet → never touch RWA.
  if (idleStableUsd < limits.MIN_BALANCE_USD) {
    return { _gate: 'min-balance', skip: true };
  }

  // Daily ceiling
  if (readDailySpend() >= limits.MAX_PER_DAY_USD) {
    return { _gate: 'daily-cap', skip: true };
  }

  const action = decision?.analyst?.action;
  const consensus = decision?.consensus === true;

  // ── Path A: LLM-driven ───────────────────────────────────────
  if (consensus && action === 'rwa_allocate') {
    return buildIntent({
      source: 'llm',
      from: 'USDT', to: 'USDT0',
      amountInUsd: clampToCycle(idleStableUsd, decision),
      reason: `LLM allocate: ${decision.analyst.reasoning?.slice(0, 140)}`,
    });
  }

  if (consensus && action === 'rwa_exit') {
    const usdt0Usd = (balances.USDT0 ?? 0) * (prices.USDT0 ?? 1);
    if (usdt0Usd < limits.MIN_BALANCE_USD) {
      return { _gate: 'no-rwa-position-to-exit', skip: true };
    }
    return buildIntent({
      source: 'llm',
      from: 'USDT0', to: 'USDT',
      amountInUsd: Math.min(usdt0Usd, limits.MAX_PER_CYCLE_USD),
      reason: `LLM exit: ${decision.analyst.reasoning?.slice(0, 140)}`,
    });
  }

  // ── Path B: deterministic idle-parking ───────────────────────
  if (!consensus &&
      posState?.status === 'FLAT' &&
      market?.regime !== 'TREND_UP' &&
      flatLongEnough(posState, nowMs) &&
      cooldownElapsed(lastSwapAt, nowMs)) {
    const parkUsd = Math.min(
      idleStableUsd * limits.IDLE_PARKING_FRACTION,
      limits.MAX_PER_CYCLE_USD,
    );
    if (parkUsd < limits.MIN_BALANCE_USD) {
      return { _gate: 'park-too-small', skip: true };
    }
    return buildIntent({
      source: 'idle-parking',
      from: 'USDT', to: 'USDT0',
      amountInUsd: parkUsd,
      reason: `Idle ${flatHours(posState)}h FLAT, regime=${market?.regime}, parking 20% of idle stables`,
    });
  }

  return null;
}
```

Implementation notes:
- `buildIntent` converts USD → wei using prices passed in.
- `clampToCycle` enforces `MAX_PER_CYCLE_USD`.
- `flatLongEnough` checks `posState.flatSince` (added in C5 below).
- All gate-skip returns include `_gate` for the caller to log without
  deciding to swap.

### C4 — `MerchantMoeDEX.executeSwap` upgrades

Replace the existing single-shot `executeSwap` with a guarded version
in `src/dex/merchantMoe.js`:

```javascript
async executeSwap(tokenIn, tokenOut, amountInWei, options = {}) {
  if (this.dryRun) {
    return { ...await this.getQuote(tokenIn, tokenOut, amountInWei),
             executed: false, reason: 'DRY_RUN' };
  }
  const maxImpact = options.maxPriceImpactBps ?? 100;
  const slipBps   = options.slippageBps      ?? 50;

  const quote = await this.getQuote(tokenIn, tokenOut, amountInWei);
  if (!quote.viable) return { ...quote, executed: false, reason: 'not-viable' };
  if (quote.priceImpact * 100 > maxImpact) {
    return { ...quote, executed: false,
             reason: `impact ${quote.priceImpact.toFixed(3)}% > ${(maxImpact/100).toFixed(3)}%` };
  }

  // Pending nonce so we coexist with the 4 attestation TXs of the cycle.
  const nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');

  // Allowance (once-per-token)
  await this._ensureAllowance(tokenIn, amountInWei);

  // minOut with slippage
  const minOut = BigInt(Math.floor(quote.estimatedOut * (1 - slipBps / 10000) *
                                   10 ** quote._decimalsOut));
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const tx = await this.router.swapExactTokensForTokens(
    amountInWei, minOut, quote.path, this.wallet.address, deadline, { nonce }
  );
  const receipt = await tx.wait();
  return { ...quote, executed: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
}
```

Three behavioural changes:
1. `maxPriceImpactBps` param + revert before TX if violated.
2. `nonce: 'pending'` (was 'latest') so the swap doesn't collide with
   the 4 already-broadcast attestation TXs.
3. `_ensureAllowance` does `approve(MaxUint256)` once and returns
   immediately on subsequent calls (cached by `tokenIn`).

### C5 — `positionState.getState` extension

Add a single field:

```javascript
// in src/strategies/positionState.js
function exitPosition(reason) {
  state.status = 'FLAT';
  state.flatSince = new Date().toISOString();   // NEW
  // ... rest unchanged
}
```

`flatSince` is null for non-FLAT states. Used by `rwaAllocator` to
compute `flatHours`. No breaking change to readers — field is optional.

### C6 — `runMultiAgentCycle` integration (new Steps 4.5 + 4.6)

```javascript
// After Step 4 (reputation feedback) in src/orchestrator/multiAgentLoop.js:

// Step 4.5: RWA allocator
const rwaAllocator = require('./rwaAllocator');
const { MerchantMoeDEX } = require('../dex/merchantMoe');

const balances = await dex.getBalances(wallet.address);
const prices   = { USDT: 1, USDT0: 1, mUSD: 1, MNT: unified.mntPrice, ETH: market.ethPrice };
const lastRwaSwapAt = readLastRwaSwapAt();              // from outcomes.json

const intent = rwaAllocator.evaluate({
  decision, market, balances, prices,
  lastSwapAt: lastRwaSwapAt,
  posState: positionState.getState(),
});

let rwaResult = null;

if (intent && !intent.skip) {
  console.log(`💼 [STEP 4.5] RWA allocator: ${intent.source} ${intent.from} → ${intent.to} ` +
              `($${intent.amountInUsd.toFixed(2)}) — ${intent.reason}`);

  if (process.env.RWA_EXECUTE_ENABLED === 'true') {
    const dex = new MerchantMoeDEX({ privateKey: process.env.PRIVATE_KEY, dryRun: false });
    rwaResult = await dex.executeSwap(intent.from, intent.to, intent.amountInWei,
                                      { maxPriceImpactBps: 100, slippageBps: 50 });
    if (rwaResult.executed) {
      console.log(`   ✅ RWA swap: ${rwaResult.txHash.slice(0,18)}...`);
    } else {
      console.log(`   ⚠️  RWA swap blocked: ${rwaResult.reason}`);
    }
  } else {
    console.log(`   [DRY] RWA_EXECUTE_ENABLED!=true — intent logged, no TX`);
  }
} else if (intent?.skip) {
  console.log(`💼 [STEP 4.5] RWA gate hit: ${intent._gate}`);
} else {
  console.log(`💼 [STEP 4.5] No RWA intent this cycle`);
}

// Step 6 outcomeTracker.record() now also receives rwaIntent metadata:
outcomeTracker.record({
  // ...existing fields...
  rwaIntent: intent && !intent.skip ? {
    source: intent.source,
    from: intent.from, to: intent.to,
    amountInUsd: intent.amountInUsd,
    txHash: rwaResult?.txHash ?? null,
    executed: rwaResult?.executed ?? false,
    reason: intent.reason,
  } : null,
});

// Return shape extended for run-cycle.js:
return {
  decision, decisionTier, disagreementSignal,
  consensus: decision.consensus,
  proposalId: typeof proposalId === 'bigint' ? Number(proposalId) : proposalId,
  rwaIntent: intent && !intent.skip ? intent : null,
  rwaResult,
};
```

`scripts/run-cycle.js` then includes `txHash` in `last-cycle-summary
.json.txHashes` if `rwaResult?.executed`.

### C7 — Analyst prompt extension (Path A delivery)

Two diffs in `src/orchestrator/multiAgent.js`:

1. **Zod schema** — extend action enum:
   ```javascript
   const AnalystSchema = z.object({
     action: z.enum(['swap', 'hold', 'rwa_allocate', 'rwa_exit']),
     // ...rest unchanged
   });
   ```
2. **Prompt addendum** — append to `ANALYST_SYSTEM_PROMPT`:
   ```
   RWA ALLOCATION (Path A — when applicable):
   - Use action="rwa_allocate" when:
     * regime is HOLD/CRISIS/TREND_DOWN
     * AND wallet has idle stablecoin (USDT or mUSD)
     * AND you want explicit Treasury-backed exposure
     Set targetAsset="USDT0", direction="risk_off".
   - Use action="rwa_exit" when:
     * regime flips to TREND_UP
     * AND wallet holds USDT0 > 30% of NAV
     * Set targetAsset="USDT" (return to spendable stable), direction="risk_on".
   - USDT0 is LayerZero-bridged Tether — Treasury-collateralised, NOT
     yield-bearing on its own. Don't claim an APY in reasoning.
   ```

3. **Validator prompt** — gain one line of awareness:
   ```
   RWA ACTIONS:
   - rwa_allocate / rwa_exit follow the same R:R + regime gates as swap.
     If R:R unclear or regime mismatch → REJECT.
   ```

### C8 — `/api/decisions` extension

In `frontend/app/api/decisions/route.ts`, add `assetClass` derivation:

```typescript
function classifyAsset(targetAsset: string | null, rwaIntent: any): string {
  if (rwaIntent?.source) return 'rwa-treasury';
  if (targetAsset === 'mETH') return 'eth-staking';
  if (targetAsset === 'mUSD' || targetAsset === 'USDT') return 'stable';
  if (targetAsset === 'MNT' || targetAsset === 'WMNT') return 'native';
  return 'unknown';
}
```

Apply to each row when building the response. Type addition only.

### C9 — `/api/strategy` extension

In `frontend/app/api/strategy/route.ts`, add `rwaAllocation` block:

```typescript
const rwaAllocation = {
  currentPctNav: rwaUsd / navUsd * 100,
  target: { min: 10, max: 50 },
  lastRebalanceAt: lastRwaTxIso,             // from outcomes.json
  daysSinceLastFlatStart: posState?.flatSince
    ? Math.floor((Date.now() - Date.parse(posState.flatSince)) / 86400000)
    : null,
  executeEnabled: process.env.RWA_EXECUTE_ENABLED === 'true',
  source: lastRwaIntentSource,               // 'llm' | 'idle-parking' | 'none'
};
```

### C10 — Frontend honesty strip

In `frontend/app/page.tsx` strategy section:

```tsx
<div className="rwa-strip">
  <span className="label">RWA targets:</span>
  <Badge tone="green">USDT0 ({executeEnabled ? 'live' : 'simulated'})</Badge>
  <Badge tone="muted">USDY (paper-ready · pool dry)</Badge>
  {!executeEnabled && <span className="hint">RWA · simulation mode</span>}
  {executeEnabled && lastRebalanceAt &&
    <span className="hint">last allocation {fmtTime(lastRebalanceAt)}</span>}
</div>
```

### C11 — `scripts/smoke-rwa.js` (new)

Synthesises 12 cases (3 consensus × 4 regimes), calls
`rwaAllocator.evaluate` against current real on-chain balances, prints
table of `case → null | intent`. No TX submission, no Bedrock call,
no IPFS pin. Pure unit-style harness.

### C12 — `.kiro/runbooks/rwa-operations.md` (new)

Sections per R8:
1. Pause RWA execution (`RWA_EXECUTE_ENABLED=false`)
2. Tune limits (`RWA_MAX_PER_CYCLE_USD`, `RWA_MAX_PER_DAY_USD`)
3. Read RWA TX log (Mantlescan filter URL)
4. Recover from failed swap (allowance, slippage, nonce)
5. Reactivate USDY (preconditions checklist)

## Data Models

### RWAIntent

```typescript
type RWAIntent = {
  source: 'llm' | 'idle-parking';
  from: 'USDT' | 'USDT0' | 'mUSD';     // input symbol
  to:   'USDT' | 'USDT0' | 'mUSD';     // output symbol
  amountInWei: bigint;                  // exact input amount
  amountInUsd: number;                  // for logging + daily-cap math
  amountOutMinWei: bigint;              // post-slippage floor
  reason: string;                       // ≤ 200 chars
};

// Skip-marker (allocator returns this when a gate fired):
type RWASkip = { skip: true; _gate: string };
```

### outcomes.json — additive `rwaIntent` field

```json
{
  "decisionId": 101,
  "decisionTier": "BLOCKED_BY_LOW_CONFIDENCE",
  "consensus": false,
  ...
  "rwaIntent": {
    "source": "idle-parking",
    "from": "USDT", "to": "USDT0",
    "amountInUsd": 1.35,
    "txHash": "0xabc...123",
    "executed": true,
    "reason": "Idle 26h FLAT, regime=RANGING, parking 20% of idle stables"
  }
}
```

When no RWA intent for a cycle, `rwaIntent: null`. Schema is purely
additive — readers that don't know about `rwaIntent` ignore it.

### last-cycle-summary.json — additive `rwaTxHash`

```json
{
  ...existing fields...,
  "txHashes": ["0xabc...123"],     // populated when RWA swap succeeds
  "rwa": {
    "source": "idle-parking",
    "executed": true,
    "amountInUsd": 1.35,
    "from": "USDT", "to": "USDT0"
  }
}
```

## Correctness Properties

These are the invariants we'll test against in the smoke harness +
unit tests:

- **CP1 — Single-intent-per-cycle.** `rwaAllocator.evaluate` returns
  at most one non-null intent. Path A and Path B never both fire.
- **CP2 — Cap respected.** `intent.amountInUsd ≤
  limits.MAX_PER_CYCLE_USD` for every emitted intent.
- **CP3 — Daily cap respected.** Sum of `outcomes.json[].rwaIntent
  .amountInUsd` (executed, last 24 h) + new intent ≤
  `limits.MAX_PER_DAY_USD`.
- **CP4 — Path B determinism.** Given identical
  `(balances, posState, lastSwapAt, market.regime, MAX_PER_CYCLE_USD)`,
  two `evaluate` calls return identical Path B intents.
- **CP5 — No double-execution.** A revert / soft failure does not
  cause the same cycle to retry the swap. The next hour's cycle gets
  a fresh evaluation.
- **CP6 — USDY gated off.** Any path that constructs an intent with
  `from === 'USDY' || to === 'USDY'` is rejected by `executeSwap`
  with `RWA_POOL_INACTIVE`. Active by default until pool depth
  > $5 000 in active bin (manual flip).
- **CP7 — Allowance is set-once.** First swap of a token does
  `approve(MaxUint256)` once; subsequent swaps skip the approve TX.
- **CP8 — Nonce coexistence.** RWA swap TX uses
  `getTransactionCount(addr, 'pending')`, never collides with the 4
  attestation TXs of the same cycle.
- **CP9 — Honesty.** When `RWA_EXECUTE_ENABLED!=='true'`,
  `/api/strategy.rwaAllocation.executeEnabled === false` AND no
  `outcomes.json` row gains an `rwaIntent.executed:true` field.

## Error Handling

| Failure mode | Behaviour |
|---|---|
| Allocator throws | Caught at the cycle level, logged, cycle continues with `rwaIntent=null`. |
| `getQuote` returns `viable=false` | `executeSwap` returns `executed:false, reason:'not-viable'`; cycle logs and moves on. |
| Price-impact gate triggered | Same as above with reason `impact X% > Y%`. |
| Approve TX reverts | `_ensureAllowance` propagates; cycle catches at the `executeSwap` boundary, logs to `cycle-failures.json`, exit 0. |
| Swap TX reverts | `tx.wait()` throws; same pattern as above. |
| RPC timeout | `executeSwap` times out via `Promise.race` after 60 s; treated as soft failure. |
| Wallet under min balance | Allocator returns `{skip:true, _gate:'min-balance'}` early — no error path needed. |
| `RWA_EXECUTE_ENABLED!=='true'` | Allocator runs, intent logged, no TX. Not an error. |

## Testing Strategy

Three layers, in increasing cost:

### Layer 1 — Pure unit (no network, no Bedrock)
- `tests/unit/rwaAllocator.unit.test.js` — 24 cases:
  - 3 consensus states × 4 regimes × 2 wallet states (FLAT > 24 h vs not)
  - Each asserts the expected `intent.source` (or `null`).
  - Validates CP1, CP2, CP3, CP4.
- `tests/unit/rwaLimits.unit.test.js` — env override, default values.
- `tests/unit/usdt0Module.unit.test.js` — happy-path `getPosition` with
  mocked provider.

### Layer 2 — Integration smoke (`smoke:rwa`)
- Real on-chain balance read for the agent wallet.
- Synthesised decisions per case (no Bedrock spend).
- 12 case → 12-line table printed.
- Asserts at least 4 cases produce an intent.

### Layer 3 — End-to-end (one manual run)
- `RWA_EXECUTE_ENABLED=true` + `workflow_dispatch` once.
- Expected outcome:
  - 1 USDT0 swap TX appears on Mantlescan against our EOA.
  - `outcomes.json` last entry has `rwaIntent.executed:true`.
  - `/api/strategy.rwaAllocation.lastRebalanceAt` becomes non-null.
  - Frontend RWA strip flips to `live`.

## Files touched

```
NEW:
  src/rwa/usdt0Module.js
  src/orchestrator/rwaAllocator.js
  src/config/rwaLimits.js
  scripts/smoke-rwa.js
  .kiro/runbooks/rwa-operations.md
  tests/unit/rwaAllocator.unit.test.js
  tests/unit/rwaLimits.unit.test.js
  tests/unit/usdt0Module.unit.test.js

MODIFIED:
  src/dex/merchantMoe.js               (executeSwap upgrades, _ensureAllowance)
  src/orchestrator/multiAgent.js       (Analyst Zod + prompt + Validator awareness)
  src/orchestrator/multiAgentLoop.js   (Steps 4.5 + 4.6, return shape extension)
  src/orchestrator/outcomeTracker.js   (accept rwaIntent in record())
  src/strategies/positionState.js      (flatSince timestamp)
  scripts/run-cycle.js                 (write rwa.txHash to summary)
  frontend/app/api/decisions/route.ts  (assetClass classification)
  frontend/app/api/strategy/route.ts   (rwaAllocation block)
  frontend/app/page.tsx                (RWA strip)
  package.json                         (smoke:rwa script)
  README.md                            ("RWA execution" subsection)

UNCHANGED:
  All smart contracts.
  RWAModule (USDY) — paper-ready, executeSwap throws RWA_POOL_INACTIVE.
  IPFS storage path, agent-card refresh path, all 4 attestation TXs.
```

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pool re-prices during swap | 1% impact gate + 0.5% slippage = 1.5% worst-case loss. Per-swap < $5, max $0.075 loss per swap. Acceptable. |
| Idle-parking churns hourly | 6h cooldown (Q3) + 24h FLAT prereq. Max 4 parks/day. |
| Wallet runs out of USDT | `MIN_BALANCE_USD: 2` floor + Path A `rwa_exit` brings it back. |
| LLM hallucinates `rwa_allocate` when there's no balance | Allocator's min-balance gate catches it before TX. |
| Operator forgets to flip `RWA_EXECUTE_ENABLED` | First cycle silently logs intents to dev runbook. README + runbook checklist. |
| Allowance approval is itself rejected | Wallet either has gas or doesn't; same as today's 4-TX problem, surfaces clearly in cycle-failures.json. |
| LLM action enum drift back to old values | Zod schema rejects → cycle returns `consensus:false, reason:'Analyst output invalid'` (existing behaviour). No regression risk. |
| Vercel build fails on new fields | Additive only; type union widened, never narrowed. |
| Repo size from RWA per-cycle entries | `rwaIntent` is 6 fields ≈ 200 B per outcome row. Same magnitude as existing per-cycle commit. |

## Out of scope

- USDY swap path (pool dead).
- Multi-chain bridging (USDT0 native to LayerZero, this spec stays
  on Mantle).
- Vault contract pattern (separate spec).
- Reverse Path B (auto-exit USDT0 on TREND_UP) — only Path A
  `rwa_exit` does that, by design.
- Yield claim on USDT0 (it doesn't yield).
- New on-chain contracts — we use existing Merchant Moe Router.
