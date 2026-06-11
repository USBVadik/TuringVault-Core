# Final Recording Brief - 2026-06-04

Use this for the DoraHacks video recording. It is intentionally short enough to keep open beside the browser.

Original recording snapshot: 2026-06-04 17:56 UTC.
Refreshed judge-facing metric snapshot: 2026-06-11 17:03 UTC.

```text
Latest live cycle             refresh from /api/health before recording
Latest tier                   refresh from /api/decisions before recording
Cron health, 24h              23 ran / 0 failed in the 2026-06-11 17:03 UTC snapshot
Parse success, 24h            100%
Gas runway                    low, about 11.4 days
Decision/proposal rows        463 public API rows; Proof Explorer contract view may differ by one during fresh writes
Approved / rejected           337 / 126
Settled outcomes              358
Win rate                      53.1%
Decision-Quality Score        +5083 bps
realizedTradingPnlBps         null
NAV                           about $139.33 operator-funded demo capital
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

"This is a best-effort public GitHub Actions cron, not a hidden daemon. I do not claim perpetual liveness. `lastCycleAge` is the truth source. In this refreshed snapshot the 24-hour cron window is 23 successful runs and zero failed runs, with about 11.4 days of gas runway."

Move to `/replay/265`:

"Here is a pinned executed swap cycle. The analyst proposed a grid entry, the validator approved it, the decision was anchored on Mantle, and the Discipline Layer later verified transaction proof, price freshness, and regime alignment."

Move to `/replay/266`:

"Here is the opposite case. The agent proposed a swap, but the validator blocked it. Settlement later marked the refusal as a correct block. This is refusal-with-proof, not blind execution."

Move to Proof Explorer:

"The current proof snapshot shows 463 public decision/proposal rows. DecisionLog rows and ValidationRegistry proposals are intentionally labelled separately because they are different contract surfaces and can differ by one during a fresh cycle."

Move to performance:

"Across 358 settled outcomes, the system has a +5083 bps Decision-Quality Score and a 53.1% settled win rate. That is not wallet PnL. The API intentionally exposes `realizedTradingPnlBps: null`."

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
