# Audit R14 — Verification Delta

Captured: 2026-05-28T13:00:19.746Z
Base: http://localhost:3210

## Container width consistency (largest card per page) @ 1440

| Page | Before | After | Δ |
|---|---|---|---|
| home | 1152 | 1152 | 0px |
| backtest | 1200 | 1200 | 0px |
| challenge | 1200 | 1200 | 0px |
| discipline | 1200 | 1200 | 0px |
| proof-explorer | 1232 | 1152 | -80px |
| social | 568 | 373 | -195px |

## H2 axis (proof-explorer @ 1440)

After: H2 X positions = [144] · spread = 0px
Audit reported: positions [104, 129, 136, 144] · spread = 40px before fix

## Gap scale on `/` @ 1440

After: 8 distinct gap values: 4px, 6px, 8px, 8px 32px, 12px, 16px, 24px, 40px
Audit reported: 9 distinct gap values before fix

## Card-padding signatures @ 1440

| Page | Before count | After count | After signatures |
|---|---|---|---|
| home | 10 | 4 | `40/40/40/40 | 32/32/32/32 | 20/20/20/20 | 24/24/24/24` |
| proof-explorer | 7 | 2 | `24/24/24/24 | 20/20/20/20` |
| backtest | 5 | 0 | `` |

## Emoji glyph count

| Page | Before | After | After list |
|---|---|---|---|
| home | 12 | 11 | `⚠ Replay: last cycle | → Channel: $0.631 – $0.654 | Width: 3.6% | ⚡ Decision: SWAP USDT→WMNT — confidence  | ✓ Entry $0.636 | TP $0.649 (75% ch) | SL | ✓ verified | ✓ verified | ✓ verified | ✓ verified | ✓ verified | ✓ verified | 🔴` |
| backtest | 0 | 0 | `` |
| challenge | 0 | 0 | `` |
| discipline | 36 | 0 | `` |
| proof-explorer | 2 | 0 | `` |
| social | 0 | 0 | `` |

## z-index inventory

After (homepage): [-10, -2, -1, 50]