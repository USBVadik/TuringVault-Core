# Final Recording Brief - 2026-06-04

Use this for the DoraHacks video recording. It is intentionally short enough to keep open beside the browser.

Observed production snapshot: 2026-06-04 17:56 UTC.

```text
Latest cycle                 #290
Latest cycle ended            2026-06-04T17:53:10Z
Latest tier                   BLOCKED_BY_REGIME
Cron health, 24h              31 ran / 0 failed
Parse success, 24h            100%
Gas runway                    ok, about 15.4 days
DecisionLog rows              290
ValidationRegistry proposals  291
Approved / rejected           215 / 76
Settled outcomes              196
Win rate                      58.2%
Decision-Quality Score        +4342 bps
realizedTradingPnlBps         null
NAV                           $150.69 operator-funded demo capital
```

## Browser Tabs

1. Live dashboard: https://frontend-seven-beta-46.vercel.app
2. Health JSON: https://frontend-seven-beta-46.vercel.app/api/health
3. Executed cycle: https://frontend-seven-beta-46.vercel.app/replay/265
4. Protected-capital block: https://frontend-seven-beta-46.vercel.app/replay/266
5. Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
6. Discipline Layer: https://frontend-seven-beta-46.vercel.app/discipline
7. Performance API: https://frontend-seven-beta-46.vercel.app/api/performance
8. Agent Cycle run: https://github.com/USBVadik/TuringVault-Core/actions/runs/26969531335

## Two-Minute Script

Start on the homepage:

"TuringVault is an accountable AI RWA portfolio agent on Mantle. The important part is not that an AI can suggest trades. The important part is that every proposal is challenged, logged, replayable, and checked after execution."

Move to `/api/health`:

"This is a best-effort public GitHub Actions cron, not a hidden daemon. I do not claim perpetual liveness. `lastCycleAge` is the truth source. In this snapshot the latest cycle is #290, the 24-hour cron window is 31 successful runs and zero failed runs, and gas runway is healthy."

Move to `/replay/265`:

"Here is a pinned executed swap cycle. The analyst proposed a grid entry, the validator approved it, the decision was anchored on Mantle, and the Discipline Layer later verified transaction proof, price freshness, and regime alignment."

Move to `/replay/266`:

"Here is the opposite case. The agent proposed a swap, but the validator blocked it. Settlement later marked the refusal as a correct block. This is refusal-with-proof, not blind execution."

Move to Proof Explorer:

"The current proof snapshot shows 290 DecisionLog rows and 291 ValidationRegistry proposals. Those counters are intentionally labelled separately because they are different contract surfaces."

Move to performance:

"Across 196 settled outcomes, the system has a +4342 bps Decision-Quality Score and a 58.2% settled win rate. That is not wallet PnL. The API intentionally exposes `realizedTradingPnlBps: null`."

Close:

"The live capital is operator-funded demo capital. USDY support is implemented but gated until Mantle liquidity is usable. The current orchestrator is centralized, but the post-anchor evidence is public and tamper-evident. The product is the audit trail around AI capital allocation."

## Do Not Say

- Do not say realized wallet PnL.
- Do not say public deposits.
- Do not say every cycle is a trade.
- Do not say always-on or guaranteed cron.
- Do not say live USDY execution.
- Do not say complete trustlessness.
- Do not say full reasoning text is stored on-chain.

## Upload Checklist

- Upload as an unlisted YouTube or Loom link.
- Put the live demo URL first in the video description.
- Put GitHub second.
- Put Proof Explorer and Replay links third.
- After upload, replace the demo-video `TBD` in the DoraHacks form.
