# Pipeline data cards

timestamp: 2026-05-31T21:02:35.771Z

## Recent EXECUTED_SWAP row

decisionId: 189
recordedAt: 2026-05-31T08:23:59.760Z
action: swap
targetAsset: mUSD
tier: EXECUTED_SWAP
consensus: true
confidence: 0.66
validatorConfidence:
riskScore:
arbiterVote:
ipfsCid: QmTFteahKFiY954fPGDDYCkyGKnnao9WM9RjtRbifHKSRC
executedOnChain: true
directionalSwap.executed: true
directionalSwap.legs: 2
validatorReasoning: Analyst proposes defensive swap to mUSD (risk-off), not a directional speculative swap. Grid signal SELL_mETH at 82% channel position with 2.1:1 R:R clears the 1.5:1 threshold. RANGING regime supports mean-reversion sells near resistance $2031. Bearish signal consensus, negative yield spread (-1%), and F&G=28 fear cont

## Recent BLOCKED_BY_LOW_CONFIDENCE row

decisionId: 184
recordedAt: 2026-05-30T23:45:40.793Z
action: hold
targetAsset: mETH
tier: BLOCKED_BY_LOW_CONFIDENCE
consensus: false
confidence: 0.52
validatorConfidence:
riskScore:
arbiterVote: approve
ipfsCid: QmcHLs4MPxv3Qkrg4qnCg6Nsc9u6AXYj6ej2CuWZrtMjm8
executedOnChain: null
directionalSwap.executed:
directionalSwap.legs:
validatorReasoning: HOLD proposal is well-supported. ETH grid at 69% channel position (mid-range, $2002-$2028) correctly yields no actionable edge. RANGING regime (55% confidence) prohibits directional swaps absent grid confirmation — none present. F&G=23 extreme fear, MACD bearish, RSI neutral at 49.1, smart money flow $0.0M neutral. Ana
