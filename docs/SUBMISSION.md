# TuringVault — Hackathon Submission Guide

> Step-by-step checklist for the Mantle Turing Test 2026 (Phase 2 "AI Awakening") DoraHacks submission.

---

## Track positioning (claim explicitly on DoraHacks)

| Track / Award | Claim | Path / Rationale |
|---|---|---|
| **AI x RWA Track — Path A (Infrastructure)** | **PRIMARY** | TuringVault is an *RWA-portfolio-manager infrastructure layer* — agent identity (ERC-8004), proof-of-reasoning, post-execution discipline gate, reputation accumulation. Innovation in technical approach + completeness of asset tokenization flow. |
| **20 Project Deployment Award** | Eligible | Live demo, 5 verified Mantle Mainnet contracts, hourly cron, complete UX. |
| **Best UI/UX Award** | Opt-in | Honesty-first dashboard with live data freshness, Discipline Layer drill-down, Challenge arena, Risk Mascot reflecting real cycle state — every numeric stat traceable to on-chain or settled-outcome source. |
| **Grand Champion** | Long shot, do not over-pitch | Mention as bonus on submission, but optimization is for AI x RWA Path A first. |

### Why Path A (Infrastructure) over Path B (Application)

The brief lists **three defining features**: (1) on-chain benchmarking of AI, (2) ERC-8004 agent identity standard, (3) radical transparency. TuringVault was architected around all three from day one. Path B (consumer-facing RWA app) would force us to under-emphasize the verification machinery that is our actual innovation.

---

## Three Defining Features — what we ship for each

| Feature | Concrete artefact | Where to verify |
|---|---|---|
| **On-chain benchmarking of AI** | 4 attestation TXs per cycle (proposal, validation, decisionLog, reputation) — 104+ decisions, 40 approved, 64 blocked, full reasoning hash anchored on every one | Mantlescan + GitHub Actions hourly cron log |
| **ERC-8004 agent identity standard** | Reference implementation deployed on Mantle Mainnet — non-transferable Identity NFT with auto-updating tokenURI, ValidationRegistry, ReputationRegistry, DecisionLog. Drop-in compatible with the upcoming Mantle-issued Agent Identity issuer. | Sourcify-verified contracts (table below) |
| **Radical transparency** | Public hourly cron · IPFS-pinned reasoning blobs · live mascot reflecting real cycle freshness · `/challenge` arena · `/discipline` post-execution proof page · honesty rule documented in `.kiro/steering/no-lying-about-state.md` and enforced | Live demo, GitHub workflow log |

---

## Submission Checklist

### Required for ALL tracks
- [x] Project name: **TuringVault**
- [x] Team: USBVadik (vadik@nexus-shell.ai)
- [x] GitHub: https://github.com/USBVadik/TuringVault-Core
- [x] Demo URL: https://frontend-seven-beta-46.vercel.app
- [ ] Video Demo: re-recording with Screen Studio at high quality (deferred until source is readable)
- [x] Short description (≤256 chars): *Accountable AI RWA portfolio manager on Mantle. 3-model adversarial consensus + ERC-8004 reference identity + Discipline Layer post-execution proof. Every allocation survives challenge before execution; every decision anchored on-chain.*

### AI & RWA Track — Path A (Infrastructure) · PRIMARY
- [x] AI component: three-model adversarial consensus (GLM-5 Analyst → Claude 4.6 Validator → Gemini 3.5 Arbiter) with default-REJECT validator and 2-of-3 consensus rule
- [x] RWA component: mETH (native ETH staking yield) + USDT0 (LayerZero Treasury-collateralised) + USDY metadata (Ondo Finance)
- [x] Asset tokenization flow completeness: live first RWA swap on Merchant Moe LB v2.2 — TX `0x0af23364c7651b053d33b0f7ed3eb8b30107b5dc489e96a7ad8ac90cad3e09de`; ~55-74% NAV currently in tokenized Treasuries
- [x] Innovation: ERC-8004 reference implementation + Synrail-inspired Discipline Layer (3-gate post-execution proof) + dual-path RWA Allocator (LLM-driven Path A + deterministic idle-parking Path B)

### Best UI/UX Award · OPT-IN
- [x] Card-source badge on landing hero (live tokenURI vs repo snapshot, IPFS CID linked)
- [x] DisciplineStripRow on home — latest cycle proof at a glance with click-through to `/discipline`
- [x] LiveTerminal labeled as "Example reasoning · static" (no fake liveness)
- [x] Risk Mascot pulled from agent-card.json (no hardcoded copy)
- [x] Decisions API reads on-chain DecisionLog timestamps directly (no cached freshness)
- [x] Honest empty/stale states throughout (e.g., "Stale · last update <ts>") per `.kiro/steering/no-lying-about-state.md`
- [x] `/challenge` page lets visitors probe the agent's gates with adversarial perturbations

### 20 Project Deployment Award · ELIGIBILITY CHECKLIST
- [x] Live frontend deployed (Vercel)
- [x] Live backend (GitHub Actions hourly cron, public workflow log)
- [x] Smart contracts on Mantle Mainnet, Sourcify-verified
- [x] Real ERC-20 holdings on the operator EOA (mETH + USDT0 + USDT + WMNT + MNT)
- [x] Functional end-to-end UX (browse decisions, challenge agent, see discipline proofs)

---

## Deployed Contract Addresses

### Mantle MAINNET (chain 5000) ← PRIMARY

| Contract | Address | Role | Sourcify |
|----------|---------|---|---------|
| TuringVaultIdentity (production, ERC-8004) | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | Non-transferable identity NFT, auto-updating tokenURI per cycle | ✅ Full match |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | Reasoning-hash anchor for every cycle | ✅ Full match |
| TuringVaultValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | Pre-execution attestation registry | ✅ Full match |
| ReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | Settled-outcome reputation accumulator | ✅ Full match |
| TuringVaultValidation (ERC-8004 trustless agents) | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | Standalone validation reference | ✅ Full match |
| TuringVaultIdentity (legacy, kept on-chain) | `0x582E6a649B99784829193E14bB7Af8c4A482E165` | Earlier identity contract, retained for history | ✅ Full match |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | Vault router pattern, **not in current execution path** | ⚠ not verified — bytecode no longer matches in-repo source; vault contract pattern in active development |

Explorer: https://explorer.mantle.xyz · Sourcify status auto-checked via `npm run check:sourcify`.

### Mantle SEPOLIA (chain 5003) ← TESTNET

| Contract | Address |
|----------|---------|
| TuringVaultIdentity | `0x582E6a649B99784829193E14bB7Af8c4A482E165` |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` |
| TuringVaultValidationRegistry | `0x4Ed86C2221ecaF03018eb438e5b28201893dde3A` |

---

## Key Talking Points for Judges (Path A · Infrastructure)

1. **Three Defining Features end-to-end** — most submissions claim one or two. We ship all three (on-chain benchmarking + ERC-8004 + radical transparency) and link each to a verifiable artefact.
2. **ERC-8004 reference implementation, not theatre** — Identity NFT with auto-updating tokenURI per cycle, Validation/Reputation registries deployed and Sourcify-verified, ready to interop with Mantle's official issuer once it ships.
3. **Refusal-with-proof beats unverifiable execution** — 64/104 unsafe proposals blocked; every block has reasoning hash on Mantle. For DAO treasuries / compliance-conscious operators, this is the entire reason to use an AI agent at all.
4. **Mantle-native asset stack** — mETH (Mantle's own LST) for risk-on real yield, USDT0 (LayerZero Treasury-collateralised) on Merchant Moe LB v2.2 for the only liquid RWA target on Mantle, USDY metadata for the wider tokenized-Treasury narrative.
5. **Radical transparency enforced as workspace rule** — `.kiro/steering/no-lying-about-state.md` is loaded on every developer turn; misrepresentation is the project's only way to lose.
6. **Synrail-inspired Discipline Layer** — 3-gate post-execution verification (TX proof, price freshness, drift detection) on every swap, history surfaced on `/discipline` page.
7. **Live-stream ready** — hourly GitHub Actions cron is the natural fit for the hackathon's live-stream component; judges can drop into any past run or watch a fresh one.

---

## Demo flow for the video / live walkthrough (≤2 min)

1. Landing page — point at the card-source badge (live tokenURI from on-chain), Risk Mascot (fed from agent-card), and DisciplineStripRow (latest post-execution proof).
2. `/decisions` — show recent on-chain DecisionLog rows with reasoning IPFS hashes, click through to Mantlescan.
3. `/discipline` — open one cycle, show the 3 gates fired (tx_proof, price_freshness, drift_detection) and the resulting health.
4. `/challenge` — run one adversarial perturbation (e.g., flash_crash) and show the agent reasoning through it; highlight the budget meter.
5. GitHub Actions tab — open the most recent "Agent Cycle" workflow run, show the live cron log as proof of "running on its own".

---

## Links

- GitHub: https://github.com/USBVadik/TuringVault-Core
- Frontend: https://frontend-seven-beta-46.vercel.app
- Mainnet Explorer: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
- Sourcify (Identity): https://repo.sourcify.dev/contracts/full_match/5000/0x6f862802e0d5463DF18d267e422347BeCacc28bD/
- Sourcify (DecisionLog): https://repo.sourcify.dev/contracts/full_match/5000/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5/
- Pitch deck PDF: `docs/pitch-deck/turingvault-pitch.pdf` (regenerate via `npm run deck:pdf`)
- Honesty rule: `.kiro/steering/no-lying-about-state.md`
- Hackathon context rule: `.kiro/steering/hackathon-context.md`
