# TuringVault Demo Script

Target length: 90-120 seconds.

Narrative rule: open with proof, not performance. Performance is framed as Decision-Quality / Outcome Score, not realized wallet PnL.

---

## 0:00-0:12 - Proof First

Screen: homepage hero.

Voiceover:

"TuringVault is an accountable AI RWA portfolio agent on Mantle. The important part is not that an AI can suggest trades. The important part is that every proposal is challenged, logged, replayable, and checked after execution."

Show:

- LiveStatusBadge.
- Agent wallet/operator capital label.
- Proof-locked visual.

---

## 0:12-0:28 - Live Health

Screen: `/api/health` or homepage Live Agent Pipeline.

Voiceover:

"The system runs on a best-effort public GitHub Actions cron. I do not claim perpetual liveness; this `lastCycleAge` field is the truth source. In the current snapshot, the agent has 31 successful cycles and zero failed cycles in 24 hours."

Show:

- `mode: cron-github-actions`
- `cyclesSucceeded24h`
- `cyclesFailed24h`
- `gasRunway.status`

---

## 0:28-0:48 - Executed Cycle

Screen: `/replay/265`.

Voiceover:

"Here is a pinned executed swap cycle. The analyst proposed a grid entry, the validator approved it, the decision was anchored on Mantle, and the Discipline Layer later verified the transaction proof, price freshness, and regime alignment."

Show:

- cycle `265`
- `decisionTier: EXECUTED_SWAP`
- `tx_proof PASS`
- DecisionLog tx link
- manifest hash / combined anchor

---

## 0:48-1:08 - Protected-Capital Block

Screen: `/replay/266`, then `/proof-explorer`.

Voiceover:

"Now the opposite case: cycle 266 proposed a swap, but the validator blocked it. Settlement later marked that refusal as a correct block. This is the product: refusal-with-proof, not blind execution."

Show:

- cycle `266`
- `BLOCKED_BY_VALIDATOR`
- `CORRECT_BLOCK`
- `+86 bps` avoided outcome score
- no executed transaction claimed

---

## 1:08-1:28 - Registry And Identity

Screen: Proof Explorer and Mantle contract tabs.

Voiceover:

"The agent is represented by an ERC-8004-style identity and active validation and reputation registries. The current snapshot shows 290 DecisionLog rows and 291 ValidationRegistry proposals. The counters are labelled separately because they are different contract surfaces."

Show:

- DecisionLog contract
- ValidationRegistry contract
- ReputationRegistry contract
- Identity NFT contract

---

## 1:28-1:46 - RWA Framing

Screen: homepage wallet/RWA block or `docs/rwa-live-vs-paper-ready.md`.

Voiceover:

"The live RWA lane is USDT0 as the Treasury-collateralised stable allocation rail, and mETH as Mantle's native LST risk-on yield leg. USDY support is implemented, but gated until Mantle liquidity returns. We label it paper-ready, not live execution."

Show:

- USDT0 active.
- mETH active.
- USDY paper-ready/gated.

---

## 1:46-2:00 - Outcome Score And Close

Screen: `/backtest` or `/api/performance`.

Voiceover:

"Across 196 settled outcomes, TuringVault has a +4342 bps Decision-Quality Score and a 58.2% settled win rate. That is not claimed as wallet PnL; it is an outcome score for whether the agent made or blocked the right decisions. The real win is the audit trail."

Show:

- `outcomeScoreBps: 4342`
- `realizedTradingPnlBps: null`
- settled outcomes: `196`
- GitHub repo + live demo URL

---

## Recording Notes

- Browser at 1440px or 1920px wide; zoom 100%.
- Use the pinned cycles from `docs/judge-verification-path.md`.
- Do not depend on the latest live cycle during recording.
- Keep Mantlescan tabs pre-opened.
- Avoid positive wallet-PnL wording, perpetual-liveness wording, hardware-free absolutism, and any claim that USDY is active execution.
