## Architecture Overview

TuringVault is a multi-agent AI system for verifiable DeFi decisions on Mantle.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  CoinGecko · DeFiLlama · Fear&Greed · Nansen Smart Money            │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Market context every 5 min
┌────────────────────────────▼────────────────────────────────────────┐
│                    ANALYST AGENT (Claude Sonnet 4.6)                 │
│  Role: Find best risk-adjusted opportunity in mETH/mUSD             │
│  Output: action + targetAsset + confidence + full reasoning          │
│  Validated: AnalystSchema (Zod)                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Proposal (action + reasoning)
┌────────────────────────────▼────────────────────────────────────────┐
│                   VALIDATOR AGENT (Claude Sonnet 4.6)                │
│  Role: Independently verify Analyst's logic and flag risks           │
│  Output: approved + riskScore + flaggedIssues + confidence           │
│  Validated: ValidatorSchema (Zod)                                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ Consensus check
┌────────────────────────────▼────────────────────────────────────────┐
│                      CONSENSUS ENGINE                                │
│  analyst.confidence ≥ 0.75 && validator.approved                    │
│  && validator.confidence ≥ 0.70 && riskScore ≤ 65                   │
└──────────┬──────────────────────────────────────────────────────────┘
           │ On-chain recording (Mantle Mainnet)
┌──────────▼──────────────────────────────────────────────────────────┐
│   ValidationRegistry.submitProposal()   [tx 1]                       │
│   ValidationRegistry.validateProposal() [tx 2]                       │
│   DecisionLog.logDecision()             [tx 3]                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key invariant:** If either agent's output fails Zod validation, the system falls back to "hold". Never execute on corrupted reasoning.
