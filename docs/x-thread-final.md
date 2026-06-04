# X Thread Final

Thread draft for launch / DoraHacks submission.

---

1/ TuringVault is my Mantle Turing Test build: an accountable AI RWA portfolio agent.

The point is not "AI trading bot makes chart go up."

The point is: every AI allocation proposal is challenged, logged, replayable, and checked after execution.

Live demo:
https://frontend-seven-beta-46.vercel.app

2/ The system ships the three things the Mantle brief cares about:

- on-chain benchmarking of AI decisions
- ERC-8004-style identity / validation / reputation
- radical transparency through replayable Proof-of-Reasoning

GitHub:
https://github.com/USBVadik/TuringVault-Core

3/ Current observed snapshot, 2026-06-04 16:15 UTC:

- 288 DecisionLog rows
- 289 ValidationRegistry proposals
- 213 approved
- 76 rejected before execution
- 196 settled outcomes
- +4342 bps Decision-Quality Score
- 58.2% settled win rate

Not wallet PnL. Outcome score.

4/ Why refusal matters:

An AI treasury agent should not be rewarded for clicking buttons.

It should be rewarded for surviving adversarial challenge, refusing weak ideas, and leaving evidence when it moves capital.

Cycle 266 is a good example: proposed swap, validator block, later settled as CORRECT_BLOCK.

5/ The live RWA lane:

- USDT0: Treasury-collateralised stable allocation rail
- mETH: Mantle-native LST risk-on/yield leg
- MNT/WMNT: Mantle-native risk/liquidity inventory

USDY support is implemented but gated until Mantle liquidity is usable. No fake live claim.

6/ The judge path:

Proof Explorer:
https://frontend-seven-beta-46.vercel.app/proof-explorer

Replay:
https://frontend-seven-beta-46.vercel.app/replay

Discipline Layer:
https://frontend-seven-beta-46.vercel.app/discipline

Challenge Arena:
https://frontend-seven-beta-46.vercel.app/challenge

7/ Contracts on Mantle:

DecisionLog:
https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5

ValidationRegistry:
https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6

ReputationRegistry:
https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a

8/ Honesty note:

The current NAV is operator-funded demo capital.

GitHub Actions cron is best-effort public automation, not a guaranteed daemon.

Full reasoning is pinned off-chain; Mantle stores the cryptographic anchor.

That is the whole thesis: AI capital allocation should be auditable by default.

9/ Commercial path:

This starts as a Mantle hackathon build, but the customer is clear: DAO treasuries and on-chain funds that want AI allocation with governance-grade evidence.

Hosted agent ops, on-chain attestation, replay dashboards, and audit exports.
