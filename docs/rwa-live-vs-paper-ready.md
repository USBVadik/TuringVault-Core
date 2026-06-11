# RWA Live Vs Paper-Ready Matrix

Observed snapshot: 2026-06-11 17:03 UTC.

This file exists to keep the RWA story strong without overclaiming. Use it for DoraHacks copy, demo narration, and judge Q&A.

---

## Active Lanes

| Asset | Role | Current status | Honest wording |
| --- | --- | --- | --- |
| mETH | Mantle-native ETH liquid staking token | Active | Risk-on yield leg. The dashboard surfaces mETH protocol yield separately from trading outcome score. |
| USDT0 | Treasury-collateralised omnichain Tether | Active | Stable RWA allocation rail and risk-off inventory. It is not described as yield-bearing. |
| USDT | Stable execution bridge | Active | Spendable stable route used by the wallet/router. |
| MNT / WMNT | Mantle-native risk asset and execution inventory | Active | Risk asset/liquidity context plus gas-adjacent native inventory. |

What we can say:

- "TuringVault actively manages Mantle-native mETH, USDT0, USDT, MNT, and WMNT inventory."
- "USDT0 is the active Treasury-collateralised stable allocation rail."
- "mETH is the live Mantle-native LST yield/risk-on leg."
- "The agent's RWA infrastructure is live: allocation intent, validation, on-chain proof, execution route, and post-execution discipline."

---

## Paper-Ready / Gated Lane

| Asset | Role | Current status | Honest wording |
| --- | --- | --- | --- |
| USDY | Ondo tokenized Treasury module | Paper-ready/gated | Module ships in the repo, but live execution is disabled until Mantle pool depth returns. |

What we can say:

- "USDY support is implemented as a gated module."
- "The route throws `RWA_POOL_INACTIVE` until Mantle liquidity is usable."
- "USDY is part of the expansion path, not the current live execution claim."

What we should not say:

- "The agent is currently earning USDY yield."
- "The current NAV is invested in USDY."
- "USDY execution is live."

---

## AI & RWA Path B Application Framing

The strongest RWA claim is an application with infrastructure-grade proof, not APY:

1. The agent receives market/yield/liquidity context.
2. The analyst proposes an allocation.
3. The validator challenges the proposal.
4. The decision is logged and hash-anchored on Mantle.
5. Execution happens only when the gates pass.
6. The Discipline Layer checks the result after execution.
7. The outcome feeds reputation.

That is the Path B story under the updated Mantle scorecard: a complete RWA application for treasury/fund operators, using existing Mantle-native assets and making every AI allocation step verifiable.
