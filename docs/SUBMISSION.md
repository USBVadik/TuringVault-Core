# TuringVault — Hackathon Submission Guide

> Step-by-step checklist for the Mantle Turing Test 2026 DoraHacks submission.

---

## Submission Checklist

### Required for ALL tracks
- [ ] Project name: **TuringVault**
- [ ] Team: USBVadik (vadik@nexus-shell.ai)
- [ ] GitHub: https://github.com/USBVadik/TuringVault-Core
- [ ] Demo URL: https://frontend-seven-beta-46.vercel.app
- [ ] Video Demo: TBD (min 2 min, showing live cycle)
- [ ] Short description (140 chars): *Autonomous AI agents make verifiable on-chain DeFi decisions via Proof-of-Reasoning — dual-agent consensus, Mantle Mainnet, fully auditable*

### AI & RWA Track (Primary)
- [ ] AI component described: Claude Sonnet 4.6 dual-agent (Analyst + Validator)
- [ ] RWA component: mETH (real staking yield) vs mUSD (stable) rebalancing
- [ ] On-chain AI output: ValidationRegistry + DecisionLog (verified on Mantle Mainnet)

### Alpha & Data Track (Secondary)
- [ ] Data sources listed: CoinGecko, DeFiLlama, Fear&Greed, Nansen Smart Money
- [ ] Alpha generation mechanism: Nansen institutional flows + cross-signal sentiment

---

## Deployed Contract Addresses

### Mantle MAINNET (chain 5000) ← PRIMARY

| Contract | Address | Sourcify |
|----------|---------|---------|
| TuringVaultIdentity | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | ✅ Verified |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Verified |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ✅ Verified |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | ✅ Verified |

Explorer: https://explorer.mantle.xyz

### Mantle SEPOLIA (chain 5003) ← TESTNET

| Contract | Address |
|----------|---------|
| TuringVaultIdentity | `0x582E6a649B99784829193E14bB7Af8c4A482E165` |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` |
| TuringVaultValidationRegistry | `0x4Ed86C2221ecaF03018eb438e5b28201893dde3A` |

---

## Key Talking Points for Judges

1. **Proof-of-Reasoning is new** — no other DeFi project puts AI reasoning on-chain as a first-class primitive
2. **Anti-hallucination by design** — two independent LLMs must agree; either can veto
3. **Running live** — orchestrator has been logging decisions to Mantle Mainnet continuously
4. **Mantle-native** — mETH/mUSD, Merchant Moe routing, ERC-8004 identity
5. **All 4 partner touchpoints** — Mantle (infra), Bybit Wallet (UX), Nansen (data), Merchant Moe (DEX)

---

## Links

- GitHub: https://github.com/USBVadik/TuringVault-Core
- Frontend: https://frontend-seven-beta-46.vercel.app
- Mainnet Explorer: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
- Sourcify (Identity): https://repo.sourcify.dev/contracts/full_match/5000/0x582E6a649B99784829193E14bB7Af8c4A482E165/
