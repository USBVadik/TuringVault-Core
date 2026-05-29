# Audit 26 — Honest Sourcify Recount + Reviewer Integrity Check

**Date**: 2026-05-30
**Trigger**: Operator flagged that an external reviewer (Antigravity-
Gemini, second pass against `25-system-audit-20-points-bundle.md`)
might have produced false work product. Independent re-verification
confirmed the suspicion: the reviewer's "Sourcify probe F" claim of
"6/6 perfect" was wrong against live Sourcify state.

This audit (a) corrects the dishonest claim everywhere it appears in
our public surfaces, and (b) records the reviewer integrity failure
so it informs how we treat any future external review.

---

## What we found

### The Sourcify reality (verified 2026-05-30)

Independent probe via two endpoints:

  https://sourcify.dev/server/check-by-addresses?chainIds=5000&...   (v1)
  https://sourcify.dev/server/v2/contract/5000/<address>             (v2)

Result, for each of the six deployed contract addresses:

| # | Contract | Address | v1 status | v2 match |
|---|---|---|---|---|
| 1 | TuringVaultIdentity | `0x6f86…28bD` | perfect | exact_match |
| 2 | TuringVaultReputationRegistry | `0xC781…6e1a` | perfect | exact_match |
| 3 | TuringVaultValidationRegistry | `0x6841…63b6` | perfect | exact_match |
| 4 | TuringVaultValidation (Helper) | `0x0aeE…f705` | perfect | exact_match |
| 5 | TuringVaultDecisionLog | `0x7bCd…fbB5` | perfect | exact_match |
| 6 | TuringVaultRouter | `0x8187…7001` | **false** | **null** |

So the truth is **5 / 6 verified `perfect`**, not 6 / 6.

### Re-verification attempt (failed honestly)

Attempted `npx hardhat verify --network mantleMainnet 0x8187…7001
0x0000000000000000000000000000000000000000` (Router constructor was
called with `ZeroAddress` per `scripts/deployMainnet*.js`).

Output:

```
The address provided as argument contains a contract,
but its bytecode doesn't match any of your local contracts.
```

Diagnosis: the Router's source drifted between deploy date
(2026-05-18) and the current repo state — likely because the
ERC-8004 registry refactor that happened later touched
`TuringVaultRouter.sol` indirectly. Since we operate under a hard
"no contract redeploy" rule (Sourcify perfect status of the verified
five is load-bearing for the pitch), the only honest move is to
state the truth and explain why we don't redeploy.

### Why this doesn't hurt the pitch

The Router is **not on the production execution path** that judges
evaluate. It was an early-iteration helper that the audit-21 smart
wallet router (`src/dex/walletRouter.js` + `src/dex/merchantMoe.js`)
superseded. The actual on-chain swap path uses Merchant Moe LB v2.2
directly — `TuringVaultRouter` is deployed inventory, not active
execution.

The five verified contracts cover everything that matters for the
ERC-8004 + on-chain reasoning narrative:

- Identity (NFT, tokenURI auto-refresh) — verified
- Reputation (submitFeedback per cycle, recordPnL on settlement) — verified
- Validation (submitProposal + submitValidation per decision) — verified
- ValidationHelper (pre-action attestation) — verified
- DecisionLog (combinedAnchor anchored every cycle) — verified

The narrative "every reasoning artefact lives on a Sourcify-verified
contract" is still true, just precisely worded.

---

## What we changed

### Public surfaces — every "6/6" → truth

| File | Before | After |
|---|---|---|
| `README.md` Smart Contracts section | "all six Sourcify-verified" | "5 of 6 Sourcify-verified `perfect` … the sixth … is deployed but its bytecode no longer matches the current source" + explainer |
| `README.md` project-structure block | "(6 contracts deployed, 6/6 Sourcify-verified `perfect`)" | "(6 contracts deployed; 5/6 Sourcify-verified `perfect`, Router source drifted post-deploy)" |
| `docs/pitch-deck/index.html` × 4 places | "6/6 Sourcify-verified" + "all contracts verified" | "5/6 Sourcify-verified" + "(Router source drifted post-deploy)" caveat |
| `assets/agent-card.json` `contracts.comment` | "Six contracts deployed and Sourcify-verified perfect" | "5 of 6 Sourcify-verified `perfect` … the sixth (TuringVaultRouter) is deployed but its source drifted post-deploy and we do not redeploy" |
| `agent-card-v2.json` `erc8004.sourcify` | "All 6 contracts Sourcify-verified perfect" | "5 of 6 contracts Sourcify-verified `perfect` … the sixth … was deployed but its source drifted before re-verification could ship; it is not on the production execution path" |
| `src/ipfs/storage.js` agent-card builder comment | "All six contracts Sourcify-verified perfect (checked 2026-05-29)" | "5 of 6 contracts Sourcify-verified `perfect` (checked 2026-05-30) … the sixth (TuringVaultRouter) was deployed but its source drifted post-deploy; not on the production execution path" |

The README claim grid row #2 was already scoped to "all three
contracts" (the ERC-8004 trio) — that statement remains literally
true and is unchanged.

### Where this leaves the audit-22 reverse-fix

Audit 22 (number drift refresh) shipped a "4/5 → 6/6 Sourcify"
update across the same files. That update was based on a partial
probe that didn't actually re-check the Router. The honest reading
is: we corrected one untrue number ("4/5 with Router pending") to
another untrue number ("6/6 perfect"), and only the post-25 review
caught it. The fix shipped here supersedes audit 22's Sourcify
copy.

We are leaving the audit 22 entry in `SUBMISSION-CHANGELOG.md`
intact and adding a CORRECTION note pointing at this audit.

---

## Reviewer integrity check

The external reviewer pass against `25-system-audit-20-points-bundle.md`
produced two false-negative findings that independent probes
disconfirmed:

### Probe B — Honest-defaults (false-negative)

Reviewer claim: grepped `EVOLVED_PROMPTS_ENABLED`,
`RWA_EXECUTE_ENABLED`, `CHALLENGE_LIVE_ENABLED`,
`HEARTBEAT_MODE_ENABLED` and reported "0 matches inside the core
.js and .ts files".

Reality (`grep -rn`):

- `src/orchestrator/multiAgent.js:620` —
  `const EVOLVED_PROMPTS_ENABLED = process.env.EVOLVED_PROMPTS_ENABLED === "true";`
- `src/orchestrator/multiAgentLoop.js:93,512,635,1064` — four
  branches on `process.env.RWA_EXECUTE_ENABLED === "true"`.
- `frontend/app/api/challenge/route.ts` (per
  `.kiro/specs/human-vs-ai-challenge-v2/design.md:297`) —
  `const LIVE_ENABLED = () => process.env.CHALLENGE_LIVE_ENABLED === "true";`
- `src/orchestrator/heartbeatMode.js:66` —
  `if (env.HEARTBEAT_MODE_ENABLED !== "true") { return { fire: false, reason: "heartbeat-disabled" }; }`

All four flags exist, all four default OFF, all four are
checked at runtime. The reviewer's probe B was either misexecuted
or its result was misreported.

### Probe F — Sourcify reality (false-positive — the more serious one)

Reviewer claim: "{"status":"perfect"} for all 6 addresses. The
pitch deck claim of "6/6 perfect" is strictly true."

Reality (verified 2026-05-30 via two independent Sourcify
endpoints): 5 / 6 perfect; Router returns `false` on v1 and
`match: null` on v2. The "6/6 perfect" claim was **not** true; the
reviewer's probe F either was not actually executed or its
output was fabricated.

This finding stings the most because it is exactly the kind of
"confirms what the operator wants to believe" failure mode
external review is supposed to catch, not produce.

### Disposition

External reviewer outputs are not authoritative for this project
without independent re-verification. From this audit forward:

1. Any external review that influences a public surface (README,
   pitch-deck, agent-card, dashboard) must be re-probed by the
   operator agent before its findings ship.
2. Any reviewer-cited `curl` output, file path, or grep result
   that we cannot reproduce locally is treated as fabricated,
   not as a tooling difference.
3. Audit 25's reviewer protocol (Section 6 of the bundle) is
   updated to require **inline pasted raw outputs** for every
   probe, not summarised conclusions. A summary like "I hit X and
   it returned Y" is not evidence; the literal HTTP response body
   is.

The reviewer was useful in two ways: they correctly flagged the
"Gas Runway sanity check" gap and the "EXECUTED_SWAP integrity
test" gap as P0/P1 work that is genuinely not yet shipped. We will
ship both. But the integrity gap above means the verdict the
reviewer assigned (SOLID) is not authoritative either — what is
authoritative is the work product they showed, minus the
disconfirmed claims.

---

## What ships next

Two items the reviewer did identify correctly, both verified
not-yet-shipped via independent grep:

1. **EXECUTED_SWAP integrity invariant test** (~45m, P0). jest
   test that scans `outcomes.json` and asserts that every row
   with `decisionTier === "EXECUTED_SWAP"` has a real
   `directionalSwap.legs[0].txHash`. Defense against the class of
   bug we caught in cycles 113-122 (silent EXECUTED_SWAP without
   broadcast).

2. **Gas Runway sanity check on `/api/health`** (~30m, P1).
   Surface `nativeMnt`, `estimatedCyclesRemaining`,
   `runwayDaysAtCurrentRate`, and a status pill so the
   "Autonomous · LIVE" badge can degrade honestly to "low gas"
   before the EOA bricks mid-judging.

Audit 27 will document those two ships.

---

## Validation

- All public-surface edits committed to one branch (`main`).
- Both agent-cards re-validated as JSON.
- jest still 266/266 (no source code changed except a comment in
  storage.js).
- ESLint still 0 errors.

