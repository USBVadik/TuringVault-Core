# Demo Runbook Final

Use this before recording the final DoraHacks video.

---

## Preflight

1. Open the live dashboard:
   https://frontend-seven-beta-46.vercel.app

2. Open the health JSON:
   https://frontend-seven-beta-46.vercel.app/api/health

3. Open the performance JSON:
   https://frontend-seven-beta-46.vercel.app/api/performance

4. Open the pinned replay pages:
   - https://frontend-seven-beta-46.vercel.app/replay/265
   - https://frontend-seven-beta-46.vercel.app/replay/266

5. Open the contracts:
   - DecisionLog: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
   - ValidationRegistry: https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
   - ReputationRegistry: https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a
   - Identity: https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD

---

## Recording Order

1. Homepage: proof-locked agent and liveness badge.
2. `/api/health`: public cron, last-cycle freshness, gas runway.
3. `/replay/265`: executed swap and verified Discipline Layer.
4. `/replay/266`: protected-capital block and no false execution claim.
5. `/proof-explorer`: registry counters and denominator note.
6. `/discipline`: post-execution checks.
7. `/backtest` or `/api/performance`: Decision-Quality Score, not wallet PnL.
8. GitHub Actions: public cron log.
9. Judge Q&A: keep `docs/judge-q-and-a-final.md` open for trust, custody, cron, and PnL questions.

---

## Lines To Say

- "Best-effort public cron, not a hidden daemon."
- "Cycles are not trades. Swaps are a subset of cycles."
- "Decision-Quality Score, not realized wallet PnL."
- "Operator-funded demo capital."
- "Full reasoning pinned off-chain, cryptographic anchor on Mantle."
- "USDY is paper-ready and gated, not live execution."
- "The current orchestrator is centralized, but the post-anchor evidence is public and tamper-evident."

---

## Lines To Avoid

- Any positive wallet-PnL claim.
- Any perpetual-liveness claim.
- Any absolute "trustless" or no-assumption claim.
- Any claim that full reasoning text is on-chain.
- Any claim that USDY is active execution.
