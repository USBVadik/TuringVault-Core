# Discipline Layer — Post-Execution Verification

## Overview

The Discipline Layer extends TuringVault's adversarial validation with **post-execution proof verification** — catching cases where the agent claims success but evidence is weak, stale, or fabricated.

Inspired by [Synrail](https://github.com/USBVadik/synrail) (same author), adapted from coding-agent verification to trading-agent verification.

## Problem Statement

Current TuringVault validation flow:
```
Analyst proposes → Validator challenges → Consensus → Execute → Log outcome
```

Missing gap: **between execution and outcome logging**, there's no verification that:
1. The swap actually executed at the claimed price
2. The reported PnL matches on-chain reality
3. The agent isn't logging stale/cached results as fresh decisions
4. Strategy drift hasn't silently invalidated the agent's assumptions

This is the "false-green" in trading: the agent reports success, but the proof doesn't match reality.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISCIPLINE LAYER (proposed)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Proof Gate   │ →  │ Freshness Check  │ →  │ Drift Detect  │  │
│  │              │    │                  │    │               │  │
│  │ Did the tx   │    │ Is the price     │    │ Is the agent  │  │
│  │ actually     │    │ data < 60s old?  │    │ still within  │  │
│  │ execute?     │    │ Is the block     │    │ its declared  │  │
│  │              │    │ confirmed?       │    │ strategy?     │  │
│  └──────────────┘    └──────────────────┘    └───────────────┘  │
│         │                     │                      │           │
│         ▼                     ▼                      ▼           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              VERDICT: ACCEPTED / BLOCKED                 │    │
│  │                                                          │    │
│  │  If BLOCKED → bounded repair step (retry, re-fetch,     │    │
│  │               flag for human review)                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Verification Checks

### 1. Proof Gate (execution reality)
- Verify tx hash exists on Mantle explorer
- Confirm sender matches our wallet
- Confirm token amounts match claimed trade
- Check block confirmation (>= 2 blocks)

### 2. Freshness Check (temporal validity)
- Price data used in decision must be < 60s old at execution time
- Block timestamp vs decision timestamp delta < 120s
- Reject stale-cached market data being passed as "live"

### 3. Strategy Drift Detection
- Compare current decision pattern vs declared regime (RANGING/TREND/CRISIS)
- Flag if agent is executing TREND logic during RANGING regime
- Alert on consecutive regime-mismatched decisions (>= 3)

### 4. PnL Reality Check
- After settlement: compare claimed pnlBps vs actual on-chain balance delta
- Flag discrepancies > 5 bps
- Prevent "narrative PnL" (agent reports theoretical profit without execution)

## Integration Points

```javascript
// In orchestrator, after trade execution:
const proofResult = await disciplineLayer.verify({
  txHash: executionResult.hash,
  claimedAction: decision.action,
  claimedPrice: decision.priceAtDecision,
  priceTimestamp: decision.timestamp,
  regime: currentRegime,
  expectedPnl: estimatedPnl,
});

if (proofResult.status === 'BLOCKED') {
  // Log the block reason on-chain
  await validationRegistry.logBlock(proofResult.reason);
  // Execute bounded repair
  await proofResult.repairStep();
} else {
  // Proceed with outcome settlement
  await settleOutcome(executionResult);
}
```

## Synrail Concepts Mapped to Trading

| Synrail (Coding)           | TuringVault (Trading)                    |
|----------------------------|------------------------------------------|
| Agent claims "tests passed"| Agent claims "swap executed profitably"  |
| Proof: test output exists  | Proof: tx hash confirmed on-chain        |
| Freshness: output recent   | Freshness: price data < 60s old          |
| Drift: code doesn't match task | Drift: action doesn't match regime    |
| Bounded repair: fix one file| Bounded repair: retry with fresh data    |
| Acceptance gate            | Settlement gate                          |

## Generalization Path

The core Synrail pattern — `claim → proof → verify → accept/block → repair` — works for any domain where:

1. An autonomous agent claims task completion
2. The claim can be independently verified
3. False acceptance has meaningful cost
4. Repair steps can be bounded (not infinite loops)

Domains beyond coding and trading:
- **Research agents**: claim "paper summarized" → verify citations exist, quotes are real
- **Operations agents**: claim "deploy complete" → verify health check passes
- **Content agents**: claim "article written" → verify facts against sources
- **Compliance agents**: claim "audit passed" → verify checks were actually run

## Status

**Roadmap item** — not yet implemented. Current TuringVault relies on:
- Pre-execution validation (adversarial consensus) ✅
- On-chain logging (immutable audit trail) ✅
- PnL tracking (outcome measurement) ✅
- **Post-execution proof verification** ❌ ← This is what Discipline Layer adds

## Priority

Medium-high. Current system works but has the gap between "trade executed" and "outcome logged" where false claims could theoretically slip through. With 93 decisions and growing, automated proof verification becomes increasingly valuable.
