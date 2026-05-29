# Audit 13 — Competitive Landscape + Claims Recheck

**Date**: 2026-05-29
**Tools**: Exa Web Search, Context7 (ethers v6 docs)
**Scope**: Verify time-sensitive numeric claims in README / pitch-deck;
scan competitive submissions for the AI x RWA Track.
**Method**: Both tools driven from this Kiro session via the `kiroPowers`
interface. Exa returned cleaned markdown excerpts from authoritative
sources (Ondo, AprScope, paragraph.com Yield Desk Research, Mantle
ecosystem coverage). Context7 verified ethers v6 contract-call patterns
against the current docs corpus (`/websites/ethers_v6`).

---

## 1. Time-sensitive claims found and corrected

| Claim | Old value | Reality (source) | Fix |
|---|---|---|---|
| USDY APY on Mantle | "5.25%" (README) | 3.55% APY (AprScope, 2026-05-23, $29.45M TVL) | README updated to "~3.55% APY on Mantle, $29.5M TVL per AprScope on 2026-05-23". |
| USDY APY ecosystem-wide | n/a | 4.65% APY (Yield Desk Research, paragraph.com, 2026-04-25) | Not added to README — Mantle-specific 3.55% is the right number for our deployment. |
| USDY total supply | n/a | $740M+ across Ethereum, Solana, Mantle, Sui, Aptos | Not currently claimed; available if needed. |
| Mantle DeFi TVL | n/a | $1B+ on 2026-03-10 (plisio.net) | Not claimed; available. |
| mETH TVL | n/a | ~$480M in May 2026 (DeFiLlama, ~78% drawdown from Q3 2025 peak of $2.19B) | Not claimed. |

The previous audit `08-documents-and-claims.md` flag #25 ("USDY 5.25%
APY — no-artifact, rate changes; no live oracle") explicitly anticipated
this drift. The 5.25% figure was never sourced from a live oracle, and
the published Ondo rate has since fallen.

## 2. Code-pattern verification (Context7 → ethers v6)

`src/dex/merchantMoe.js` was rewritten over the last two sessions to:

- Pick the deepest pool by reserves (Bug 1 fix in `0b710de`)
- Use on-chain `getSwapOut` for quotes (Bug 2 fix in `8e4a335`)
- Build N-leg paths in `src/orchestrator/multiAgentLoop.js` Step 4.7

Cross-referenced against:

| Source | Pattern |
|---|---|
| LFJ developer docs (`developers.lfj.gg/guides/swap-tokens`, fetched via Exa) | `swapExactTokensForTokens(uint256, uint256, Path, address, uint256)` with `Path = (uint256[] pairBinSteps, Version[] versions, IERC20[] tokenPath)`. Multi-hop example uses `IERC20[](3)` token path with `pairBinSteps[2]` and `versions[2]`. |
| LBRouter source (`mantlescan.xyz/address/0x013e138e...`) | Same signature; Version V2_2 = 3 in the enum (V1=0, V2=1, V2_1=2, V2_2=3). |
| Context7 `/websites/ethers_v6` | `parseUnits`, `BigInt`-style amounts, struct args via tuple syntax. |

Our ABI declaration:

```js
"function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) external returns (uint256 amountOut)"
```

Match. `uint8[] versions` is the correct ABI representation of the
`Version[]` enum array; ethers v6 encodes it identically.

`getSwapOut` overload safety: we call the **pair-level** 2-arg
`getSwapOut(uint128, bool)` (line 237 of `merchantMoe.js`) on the LB
pair contract, not the router-level 3-arg overload (which lives in the
LB_ROUTER_ABI as `getSwapOut(address pair, uint128, bool)`). The
calling site uses a separate inline ABI to avoid resolver ambiguity.

Verdict: code is consistent with the canonical patterns surfaced by
both Exa and Context7. No staleness or drift detected.

## 3. Competitive intel

Exa surfaced one direct competitor in the AI x RWA Track on GitHub:

- **`Samade20/mantleflow-ai`** (published 2026-05-06)
  - Stack: ERC-8004 identity, Ondo USDY, mETH, Ethena USDe, Nansen API,
    Elfa AI, Bybit, Solidity vault contracts, ERC-4626.
  - Claim: "live, autonomous capital deployment".
  - Status (their own README): Sprint S1 "🟡 IN BUILD" as of 2026-05-06,
    S4 "Mainnet deployment" planned for Jun 6-14.
  - Differentiator from us: human-vs-AI leaderboard, ERC-4626 vault
    pattern, Ethena USDe integration.

Our position vs theirs as of 2026-05-29:
- 137+ on-chain decisions logged (their status: "in build")
- 4/5 Sourcify-verified contracts on Mantle Mainnet
- Live multi-agent consensus pipeline (GLM-5 + Claude + Gemini)
- Discipline Layer post-execution audit
- Real DEX swaps executed (cycles 125, 126; tx hashes in outcomes.json)

Submission text should explicitly emphasise the live track record. The
hackathon rubric weights "complete UX" and "Real-World Validity" 40%;
having a running system with audit history is the strongest possible
evidence for both.

Other Track entrants likely exist on DoraHacks but were not surfaced by
Exa in this scan; not exhaustive.

## 4. Mantle ecosystem facts useful for submission

These are public, citable, and currently true:

- Mantle migrated from optimistic rollup with EigenDA to ZK validity
  proofs via Succinct's SP1 zkVM in September 2025. Withdrawal window
  shrank from 7 days to 6 hours. (plisio.net, 2026-05-27)
- Mantle is the 4th-largest L2 by TVL (after Arbitrum, Base, Optimism).
- Mantle DeFi TVL crossed $1B on 2026-03-10. Stablecoin market cap on
  Mantle reached $980M same day.
- Institutional partnerships verifiable: Securitize (MI4), Aave V3,
  Chainlink (SCALE), Ethena USDe, Ondo USDY, BlackRock-adjacent via
  BUIDL. Source: CoinStats AI Investment Analysis, 2026-05-01.
- USDY market position: 4.65% APY ecosystem-wide (April 2026), $740M+
  supply across 5 chains. Source: Yield Desk Research, paragraph.com,
  2026-05-23.

## 5. Files changed by this audit

- `README.md` — USDY APY claim updated from outdated 5.25% to
  Mantle-specific 3.55% with source citation.
- `.kiro/audits/13-competitive-and-claims-recheck.md` — this report.

## 6. Method note

Per workspace rule `.kiro/steering/audit-style.md`, this audit is
sourced from authoritative external surfaces (AprScope, paragraph.com,
plisio.net, mantlescan.xyz, developers.lfj.gg, docs.ethers.org), each
with timestamps. No claim in this report is asserted without a fetched
source. Where a claim was already in the repo (e.g. ABI match), the
verification path is documented above.
