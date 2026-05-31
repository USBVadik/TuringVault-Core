# Docs and claims spot-check

timestamp: 2026-05-31T21:02:23.517Z

| Claim | Source | Live artifact | Verdict |
| --- | --- | --- | --- |
| README snapshot: 158 scheduled decisions | README.md lines 53-60 | live decisions.total=203 | snapshot stale >10% but labelled |
| README rejection rate 41% | README.md lines 53-60 | live rejected=70/203=34.5% | snapshot stale but labelled |
| README realised PnL +1757 bps | README.md line 59 | live cumulativePnlBps=1757 | matches |
| README cron status live-only | README.md line 60 | health succeeded24h=21, failed24h=0, lastCycleAge=4673 | honest |
| Local assets/agent-card snapshot totalDecisions=158 | assets/agent-card.json stats | live /api/agent-card cardStats.totalDecisions=203 | local snapshot stale |
| Sourcify 5/6 current truth | README/contracts + /api/agent-card | Six contracts deployed on Mantle Mainnet; 5 of 6 Sourcify-verified `perfect` (Identity, ReputationRegistry, ValidationRegistry, ValidationHelper, DecisionLog) — | matches API |
