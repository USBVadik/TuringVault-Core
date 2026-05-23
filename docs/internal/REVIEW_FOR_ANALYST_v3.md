# TuringVault — Full Project Review Brief v3.0
## For External Expert Analysis & Hackathon Winning Strategy

---

## 0. HACKATHON CONTEXT

### Event: Mantle Turing Test Hackathon
- **Platform:** https://dorahacks.io/hackathon/mantle-turing
- **Chain:** Mantle (L2 on Ethereum, chain ID 5000)
- **Theme:** "Can AI pass the Turing Test on-chain?" — autonomous AI agents managing capital with verifiable reasoning
- **Prize Pool:** $100,000+ in MNT/USDC
- **Submission Deadline:** Late May 2026

### Tracks We Are Targeting:
1. **🏆 AI Trading & Strategy** (Primary) — AI agents that trade, manage risk, execute DeFi strategies
2. **🤖 Agentic Wallets & Economy** (Secondary) — agent identity, wallets, on-chain reputation

### Judging Criteria (inferred from DoraHacks standard + Mantle-specific priorities):
| Criterion | Weight (est.) | What Judges Look For |
|-----------|---------------|---------------------|
| **Innovation / Originality** | ~25% | Novel approach, not a clone of existing projects |
| **Technical Execution** | ~25% | Working code, real deployment, test coverage |
| **Use of Mantle Ecosystem** | ~20% | Integration with Mantle-native tools & partners |
| **Design / UX / Demo Quality** | ~15% | Professional frontend, clear video demo |
| **Business Potential / Impact** | ~15% | Real-world applicability, scalability |

### Partner Tools (Mantle Ecosystem) — USING THESE = BONUS POINTS:
| Partner | Our Integration | Proof Artifact |
|---------|----------------|----------------|
| **Nansen** | MCP Protocol — 36 analytics tools for smart money detection | `src/mcp/nansenMCP.js` |
| **Merchant Moe** | Liquidity Book Router v2.1 — DEX execution | `src/execution/executionEngine.js` |
| **Byreal** | Perpetuals funding rate + OI as risk signal | `src/orchestrator/unifiedMarketData.js` |
| **Bybit** | Web3 wallet connector (RainbowKit) | `frontend/app/providers.tsx` |
| **Z.ai** | GLM-5 model as primary analyst | `src/orchestrator/multiAgentLoop.js` |
| **Tencent Cloud** | KMS HSM for hardware key signing | `src/execution/executionEngine.js` |
| **Ondo Finance** | USDY (RWA) tokenized T-Bills allocation | `src/orchestrator/integratedOrchestrator.js` |
| **Mantle** | Chain itself — 5 deployed contracts, 4 Sourcify-verified | Mantlescan links |
| **Pinata** | IPFS storage for reasoning proofs & Agent Cards | `src/ipfs/storage.js` |
| **Anthropic** | Claude 4.6 as adversarial validator | `src/orchestrator/multiAgentLoop.js` |

---

## 1. PROJECT IDENTITY

### Name: TuringVault
### One-Liner:
**Proof-of-Reasoning Trust Firewall for autonomous AI agents on Mantle — every AI decision is validated, attested on-chain, and linked to an evolving ERC-8004 reputation identity.**

### What We Are NOT:
- NOT a trading bot (we don't generate alpha)
- NOT a portfolio tracker
- NOT a simple multisig

### What We ARE:
- Infrastructure layer that sits BETWEEN an AI agent's decision and its execution
- Safety firewall that blocks dangerous trades BEFORE they happen
- On-chain proof system that records WHY the AI made each decision
- Evolving identity (ERC-8004) that builds reputation over time

### The Narrative (for judges):
> "AI tried to panic-sell ETH during a market dip. TuringVault's dual-model consensus blocked it. ETH recovered +1.2% within hours. The blocked trade, the reasoning, and the market outcome are all verifiable on-chain. This is what responsible AI autonomy looks like."

---

## 2. ARCHITECTURE — THE 7-STEP PROOF-OF-REASONING PIPELINE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROOF-OF-REASONING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] DATA         [2] ANALYSIS      [3] VALIDATION    [4] RISK GATE        │
│  AGGREGATION  →   (GLM-5)       →   (Claude 4.6)  →   (VaR Check)         │
│                                                                             │
│  [5] KMS SIGN     [6] EXECUTION     [7] ON-CHAIN ATTESTATION               │
│  (Tencent HSM) →  (Merchant Moe) →  (4 TXs + IPFS Proof)                  │
│                                                                             │
│  ┌────────────────────────────────┐                                         │
│  │      SELF-EVOLUTION LOOP       │                                         │
│  │  Read perf → Reflect → Validate│                                         │
│  │  → IPFS → setAgentURI() TX    │                                         │
│  └────────────────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step-by-step:

1. **Market Data Aggregation** (7 sources in parallel):
   - CoinGecko (ETH/MNT price, 24h change, volume)
   - DeFiLlama (Mantle TVL, protocol flows)
   - Fear & Greed Index (market sentiment 0-100)
   - Merchant Moe LB v2.1 (active bins, real on-chain DEX quotes)
   - Ondo USDY yield rate (5.25% APY, RWA benchmark)
   - Nansen MCP (smart money flows, token scoring — 36 tools)
   - Byreal (perps funding rate, open interest)

2. **GLM-5 Analyst** (Z.ai via AWS Bedrock):
   - Receives unified market context
   - Outputs: `{action, targetAsset, confidence, reasoning}`
   - Role: aggressive alpha identification

3. **Claude 4.6 Validator** (Anthropic via AWS Bedrock):
   - Reviews Analyst's proposal + same market data
   - Outputs: `{approved, riskScore 0-100, validatorConfidence, reasoning}`
   - Role: conservative risk manager, adversarial challenge
   - Rejects if: risk > 65 OR confidence < 0.6

4. **VaR Risk Gate** (on-chain Pre-Action Check):
   ```
   VaR < 50 bps  → AUTONOMOUS: AI executes without human intervention
   VaR 50-150    → SUPERVISED: AI proposes, human approves via intent queue
   VaR > 150     → BLOCKED: Too risky, action cancelled, capital saved
   ```

5. **KMS Signing** (Tencent Cloud HSM):
   - AI generates INTENTS, never touches private keys
   - HSM signs only after Pre-Action Check passes
   - Pipeline: DER parse → secp256k1 recovery → EIP-2 (low-S) → EIP-155 (chain-id)

6. **DEX Execution** (if approved):
   - Merchant Moe Liquidity Book Router v2.1 (bin-step pricing)
   - OR Ondo USDY allocation (RWA safe haven at high VaR)

7. **On-Chain Attestation** (4 transactions per cycle):
   - `DecisionLog.logDecision()` — decision + reasoning hash
   - `ValidationRegistry.submitValidation()` — validation result
   - `ReputationRegistry.updateReputation()` — performance tracking
   - `Identity.setAgentURI()` — updated Agent Card on IPFS (on evolution)

---

## 3. SMART CONTRACTS — DEPLOYED ON MANTLE MAINNET

| Contract | Address | Verified | Purpose |
|----------|---------|----------|---------|
| **TuringVaultIdentity** | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | ✅ Sourcify | ERC-8004 agent identity as NFT with evolving IPFS metadata |
| **TuringVaultDecisionLog** | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Sourcify | Immutable decision history with reasoning hashes |
| **TuringVaultValidation** | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | ✅ Sourcify | Pre-action validation, approve/reject with risk scores |
| **TuringVaultReputationRegistry** | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | ✅ Sourcify | Performance tracking: score, success rate, total decisions |
| **TuringVaultRouter** | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ⏳ Pending | DEX routing through Merchant Moe LB v2.1 |

**Solidity 0.8.28 / OpenZeppelin v5 / Hardhat / 91 contract tests passing**

---

## 4. ON-CHAIN PROOF OF SAFETY (LIVE DATA)

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Total Proposals | 20 | Analyst proposed 20 market actions |
| Blocked by Validator | 19 | Risk firewall rejected 19 unsafe proposals |
| Approved Executions | 1 | Only 1 action passed all safety thresholds |
| Consensus Rate | 100% | Every decision went through full dual-model pipeline |
| Avg VaR | ~160 bps | Market was volatile → most → BLOCKED/SUPERVISED |
| Gas Efficiency | ~0.005 MNT/TX | Each record costs ~$0.01 |

> **19/20 blocked — this is not failure, this is PROOF OF A WORKING SAFETY SYSTEM.**
> A risk firewall that blocks nothing = security theater.

### Featured Incident (for demo):
- **Proposal #12:** GLM-5 wanted to panic-sell ETH (Fear&Greed at 27/100)
- **Validator:** Claude assigned riskScore 73, VaR 228 bps → BLOCKED
- **Market After:** ETH recovered +1.2% within 4 hours
- **On-chain TX:** `0xd216d56512c6c9c8dd885ed0e7b9f707cee8ad49ef65202b879abf105219e5ff`
- **Proof:** Reasoning hash links to IPFS document showing full analyst/validator reasoning

---

## 5. SELF-EVOLUTION SYSTEM

The agent reads its own on-chain performance and evolves its prompts/parameters:

| # | Timestamp | Evolution Reason | Validator Approval |
|---|-----------|-----------------|-------------------|
| 1 | 2026-05-20 20:19 | "Increased confidence thresholds — operating in vacuum with no signal" | ✅ APPROVED |
| 2 | 2026-05-20 21:38 | "Adding explicit output structure and conservative risk parameters" | ✅ APPROVED |
| 3 | 2026-05-20 21:39 | "Establishing explicit decision thresholds and signal weights" | ✅ APPROVED |
| 4 | 2026-05-20 21:41 | "Establishing baseline parameters for meaningful feedback collection" | ✅ APPROVED |

**Each evolution:** self-reflection → validator approval → IPFS upload → on-chain `setAgentURI()` TX → next cycle loads from IPFS

---

## 6. TECHNOLOGY STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| AI Models | Z.ai GLM-5 + Claude 4.6 (AWS Bedrock) | Dual-model adversarial consensus |
| Smart Contracts | Solidity 0.8.28, OZ v5, Hardhat | 5 contracts, 4 Sourcify-verified |
| Testing | Hardhat (91) + Jest (19) = 110 tests | Full coverage |
| DEX | Merchant Moe LB Router v2.1 | Real swap quotes, bin-step liquidity |
| RWA | Ondo USDY | 5.25% APY, adaptive allocation 10-50% |
| Key Security | Tencent KMS HSM | Hardware signing, air-gapped from AI |
| Smart Money | Nansen MCP (36 tools) | Institutional flow detection |
| Perps Data | Byreal | Funding rate, OI, RSI signals |
| Storage | IPFS (Pinata) | Immutable reasoning proofs |
| Frontend | Next.js 16 + Tailwind + RainbowKit + wagmi | Proof Explorer dashboard |
| Chain | Mantle Mainnet (ID: 5000) | Low gas, EVM, ERC-8004 support |
| Wallet | Bybit Web3 Wallet (via RainbowKit) | End-user access |

---

## 7. FRONTEND — PROOF EXPLORER

**Live URL:** https://frontend-seven-beta-46.vercel.app/proof-explorer

### What It Shows:
1. **Incident Replay** — "AI tried to panic-sell → TuringVault blocked → ETH recovered"
2. **Live Stats** — 20 Decisions / 19 Blocked / 1 Approved (real on-chain data)
3. **Decision Timeline** — expandable cards for all 20 decisions with TX links
4. **Decision Pipeline** — visual 7-step flow showing each partner's role
5. **Protected Capital** — 3 blocked cases showing "trades that would have lost"
6. **Ecosystem Stack** — 10 partner cards with clickable proof links (→ GitHub, Mantlescan, IPFS)
7. **Agent Identity** — ERC-8004 data from IPFS, evolution history
8. **Contract Links** — direct Mantlescan links for verification
9. **SDK Section** — code examples for ecosystem builders

### Current Design:
- Dark theme (purple/green accents)
- Glass-card aesthetic
- Mobile responsive (2-col timeline, wrapped pipeline, stacked header)
- Space Grotesk + JetBrains Mono fonts

---

## 8. SDK — FOR ECOSYSTEM

```javascript
const { TuringVaultSDK } = require('@turingvault/sdk');

const sdk = new TuringVaultSDK({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://rpc.mantle.xyz',
  pinataJwt: process.env.PINATA_JWT,
});

// Record verifiable AI decision on-chain
const proof = await sdk.createPoRDecision({
  analyst: { model: 'any-model', action: 'swap', confidence: 0.85 },
  validator: { model: 'any-validator', riskScore: 35, approved: true },
  targetAsset: 'WETH',
});
// → decisionId, txHash, ipfsCid, approved, gasUsed

// Read-only (no key needed)
const decisions = await sdk.getRecentDecisions(10);
const stats = await sdk.getConsensusStats();
```

---

## 9. COMPETITIVE POSITIONING

| | Other AI Agents | TuringVault |
|---|---|---|
| **Reasoning** | Hidden / prompt-injected | On-chain, IPFS-pinned, auditable |
| **Consensus** | Single model | Dual-model adversarial (propose + challenge) |
| **Key Security** | Plaintext in .env | KMS HSM pipeline (DER + EIP-2 + EIP-155) |
| **Self-Improvement** | Manual prompt tuning | Autonomous evolution with safety validator |
| **Trust** | "Trust me bro" | Verifiable decision provenance (ERC-8004) |
| **Autonomy** | Binary (on/off) | Continuous VaR-based sliding scale |
| **Safety Proof** | Hope it works | 19/20 blocked — on-chain proof |
| **SDK/Ecosystem** | Closed black box | Open SDK — any agent can become PoR-enabled |

### Potential Competitors:
- **Ritual** — zkML inference verification (different approach — they verify model execution, we verify reasoning quality)
- **Giza** — ML model deployment on-chain (compute focus, not decision auditing)
- **Modulus** — ZK proofs for ML (too theoretical, no shipping)
- **Autonolas** — agent services (no reasoning attestation)
- **None of them** have: dual-model consensus + VaR autonomy scale + self-evolution + ERC-8004 identity

---

## 10. VERIFIABLE CLAIMS (for judges who want to check)

| Claim | How To Verify |
|-------|--------------|
| 20 AI decisions on-chain | `DecisionLog.totalDecisions()` → [Mantlescan](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5#readContract) |
| 19/20 blocked | ValidationRegistry events → [Mantlescan](https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6) |
| ERC-8004 Agent Identity | `Identity.tokenURI(0)` → [IPFS Agent Card](https://gateway.pinata.cloud/ipfs/QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw) |
| 4 evolution iterations | tokenURI change history on explorer |
| 110 tests passing | `cd turingvault && npm test` |
| Live frontend | https://frontend-seven-beta-46.vercel.app/proof-explorer |
| Source code | https://github.com/USBVadik/TuringVault-Core (will be public for submission) |

---

## 11. WHAT HAS BEEN DONE (IMPLEMENTATION PHASES)

### Phase 1: Smart Contract Infrastructure ✅
- 5 Solidity contracts (Identity, DecisionLog, Validation, Reputation, Router)
- 91 Hardhat tests
- Deployed to Mantle Mainnet
- 4/5 verified on Sourcify

### Phase 2: Multi-Agent Orchestrator ✅
- Unified Market Data (7 sources)
- GLM-5 Analyst integration (Z.ai via Bedrock)
- Claude 4.6 Validator integration (Anthropic via Bedrock)
- Consensus logic + VaR calculation
- 19 Jest tests

### Phase 3: Security & Signing ✅
- Tencent KMS HSM integration
- DER → EIP-2 → EIP-155 pipeline
- Pre-Action Check enforcement
- Intent-based architecture (AI never touches keys)

### Phase 4: Self-Evolution ✅
- Performance read from ReputationRegistry
- GLM-5 self-reflection module
- Claude validator for evolution proposals
- IPFS upload → setAgentURI() → prompt loading from IPFS
- 4 successful evolution cycles completed

### Phase 5: Frontend & SDK ✅
- Proof Explorer (Next.js 16)
- Mobile responsive
- RainbowKit + wagmi
- Agent Trust SDK
- Vercel deployment
- Partner proof links

### Phase 6: Remaining 🔲
- [ ] Video demo (2-3 min)
- [ ] DoraHacks submission form
- [ ] (Optional) Landing page improvements

---

## 12. CURRENT FRONTEND STATE — SCREENSHOTS/DESCRIPTION

**URL:** https://frontend-seven-beta-46.vercel.app/proof-explorer

### Sections (top to bottom):
1. **Header** — "TuringVault Proof Explorer" + stats bar (20/19/1)
2. **Incident Replay** — dark card with the "AI tried to sell → blocked → recovered" story
3. **Protected Capital** — 3 blocked trades with "$X saved" amounts
4. **Decision Timeline** — 5 most recent decisions, expandable, 2-col on mobile
5. **Decision Pipeline** — 7 visual steps with partner names
6. **Ecosystem Stack** — 10 clickable partner cards with proof links
7. **Audit Log** — full 20-decision table with TX hashes
8. **Contracts** — addresses with Mantlescan links
9. **Agent Card** — IPFS viewer
10. **SDK** — code example

---

## 13. QUESTIONS FOR THE ANALYST

### Category A: Winning Strategy

1. **What is the single most impactful thing we can add/change in the next 6-8 hours to maximize our chances?** Consider that we have working code, 5 deployed contracts, live frontend, and need to record a video.

2. **How should we structure the 2-3 minute demo video?** What story beats, pacing, and visual emphasis will make judges remember us?

3. **Is the "19/20 blocked = safety proof" narrative compelling?** Or do judges see "19/20 blocked" as "this thing doesn't work" / "just a block-everything bot"? How to frame it better?

4. **Should we run the orchestrator live during demo** to show real-time decision making? Or is pre-recorded + well-edited better?

5. **What "wow factor" or interactive element would make a judge spend 30 extra seconds on our page?** (We considered an animated mascot that reacts to market conditions — is that worth building?)

### Category B: Design / UI / UX

6. **What's wrong with our current frontend design?** Specific criticism of the proof-explorer page layout, information hierarchy, visual impact.

7. **What design patterns from winning hackathon projects should we adopt?** (Reference: Uniswap v3 launch, Aave Governance, Chainlink oracle dashboards)

8. **How should the "hero section" look?** Currently we jump into stats immediately. Should there be a dramatic intro? Animation? Live data feed?

9. **Is the dark purple/green glass-card aesthetic appropriate?** Or should we go for a different vibe for this kind of project?

10. **Mobile experience — what's the minimum bar for judges checking on phone?**

### Category C: Technical Depth vs. Simplicity

11. **Are we over-engineering the presentation?** 10 partners, 7-step pipeline, 5 contracts, 4 evolutions — is this too much for a hackathon? Should we simplify the story?

12. **Which technical feature should we highlight most?** (Dual-model consensus? VaR gates? Self-evolution? ERC-8004 identity? SDK?)

13. **The "Trust Firewall" positioning vs. "Proof-of-Reasoning Layer" — which resonates more with crypto-native judges?**

14. **Should we demonstrate the SDK more prominently?** (Showing "any AI agent can integrate in 3 lines of code" — is that compelling for hackathon judges or is it premature?)

### Category D: Red Flags / Weaknesses

15. **What will a skeptical judge attack?** (Oracle problem? Centralized dependencies? No real money? Validator-of-validator problem?) How do we preemptively address it?

16. **The repo was private until submission — does this hurt credibility?** How to frame it?

17. **We have 0 real trades executed** (only 1 approved, most blocked). Is this a weakness we need to address? Should we run some "successful" cycles before submission?

18. **Single deployer address = centralization.** Do we need to address governance/decentralization roadmap?

### Category E: Partner Integration Depth

19. **Are our partner integrations deep enough?** Or do judges see through "logo soup"? What would make the Nansen/Merchant Moe/Byreal integrations feel more genuine?

20. **Should we show live Nansen data in the demo?** (We have a working MCP client with 36 tools, but limited API credits)

21. **Merchant Moe integration — should we show an actual swap on-chain?** (Currently the router contract is deployed but we haven't executed a real swap. Would a $1 demo swap be worth it?)

22. **Z.ai (GLM-5) — how prominently should we feature this vs. just saying "we use multiple models"?**

### Category F: Video Demo

23. **What's the ideal video format?** Screen recording with voiceover? Animated explainer? Live walkthrough?

24. **Should the video start with the PROBLEM or the DEMO?** (Hook: "This AI agent just saved $2,400 by NOT trading" → show proof)

25. **Music/no music? Facecam/no facecam? Text overlays?**

26. **Should we show code at all in the video, or purely the frontend + on-chain proofs?**

---

## 14. RAW DATA FOR VERIFICATION

### IPFS Agent Card CID:
`QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw`

### Evolution TX Hashes:
1. `0xa5715caa7e073720da53833e81eb5eaeb88c56b01424c367021dafb210875a0d`
2. `0x7c8f0028719f4b32caaf5f0141861e32215af7a5c5154626f8a68cc3d50f77c0`
3. `0xc9d15a029147586fec78bc2f5f34453d3a902c1269a337abc8f7e2da28c1b1f8`
4. `0xbe178c26d1d333f0ce5eeb89b680227bc92aac3b4c8b027a08c95e00537fde64`

### Sample Decision TXs:
- `0xd216d56512c6c9c8dd885ed0e7b9f707cee8ad49ef65202b879abf105219e5ff` (BLOCKED, VaR:176)
- `0x37d83f87929ecbdcd3afb3944144b68b0c71efdd15e7031375d64713173dd67b` (APPROVED, risk=28)

### GitHub:
- https://github.com/USBVadik/TuringVault-Core (private → public before submission)

### Frontend:
- https://frontend-seven-beta-46.vercel.app/proof-explorer

### Test Command:
```bash
cd turingvault && npm test  # 110 tests (91 Hardhat + 19 Jest)
```

---

## 15. SPECIFIC DELIVERABLES WE WANT FROM THIS REVIEW

1. **Prioritized action list** — what to do in the next 6-8 hours, ordered by impact
2. **Video script outline** — beat-by-beat structure for 2-3 min demo
3. **Design critique** — specific UI/UX changes to make the page look "winning"
4. **Narrative refinement** — how to frame the project for maximum judge impact
5. **Red flag mitigation** — pre-emptive answers to skeptical questions
6. **Partner integration advice** — which integrations to deepen vs. which are fine as-is
7. **"Wow factor" suggestions** — 1-2 additions that would make us memorable

---

*Document prepared: May 22, 2026 | TuringVault v3.0 | Mantle Turing Test Hackathon*
*Author: TuringVault team | For external analyst review only*
