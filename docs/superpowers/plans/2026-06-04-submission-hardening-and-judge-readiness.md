# Submission Hardening And Judge Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the three independent research reports into a concrete execution plan that raises TuringVault's Mantle Turing Test win odds by removing stale or misleading claims, improving proof clarity, and preparing a judge-friendly demo.

**Architecture:** The work is split into independent modules. P0 modules harden truth surfaces and labels first; P1 modules improve proof discovery and first impression; P2 modules package the final DoraHacks/video/social story. All public metrics must read from live API or contract-derived sources and must not imply wallet PnL, public custody, 24/7 certainty, or live USDY execution unless those facts are verifiable.

**Tech Stack:** Next.js frontend in `frontend/app`, Node/TypeScript API routes, Jest unit tests, markdown docs, public Vercel deployment, GitHub Actions cron, Mantle Mainnet contracts.

## Implementation Status

- [x] Module A - Metric Truth Contract.
  - Committed as `019af6c docs: label performance as outcome score`.
- [x] Module B - Cycles Vs Trades And Discipline Semantics.
  - Committed as `b262f87 fix(discipline): separate holds from verified swaps`.
  - Reviewer follow-up committed as `ce5d8bf fix(discipline): count tx proof errors as unverified`.
- [x] Module C - Proof Explorer Consistency And Golden Cycles.
  - Committed as `523c0f6 fix(proof): clarify proposal counters`.
  - Added `docs/judge-verification-path.md` with pinned executed/protected cycles.
- [x] Module D - DoraHacks And README Copy Rewrite.
  - Added `docs/submission-final-copy.md`.
  - Added `npm run audit:submission`.
- [ ] Module E - Liveness, Cron, And Gas Readiness.
- [ ] Module F - RWA Claim Matrix And Asset Copy.
- [ ] Module G - Demo Script And Social Proof Pack.
- [ ] Module H - Final Verification And Submission Freeze.

---

## Research Digest

### Inputs Reviewed

- `/Users/usbdick/Downloads/TuringVault-Research-Report.md`
- `/Users/usbdick/Downloads/deep-research-report (7).md`
- `/Users/usbdick/Downloads/Аудит заявки TuringVault DoraHacks.md`

### Useful Consensus From All Reports

1. TuringVault is technically strong enough for finalist contention. The strongest moat is not "AI trading returns"; it is verifiable AI decision infrastructure: multi-model challenge, ERC-8004-style identity/reputation/validation, on-chain decision logs, replay manifests, Discipline Layer, and Challenge Arena.
2. The largest current win-probability leak is packaging honesty. Several surfaces can make a careful judge think the project is inflating performance or conflating cycles, decisions, swaps, accepted holds, and realized profit.
3. The words `realised PnL`, `realized PnL`, `successful cycles`, `ACCEPTED`, `TX proof 100%`, and `No trust assumptions` are high-risk unless tightly scoped.
4. DoraHacks and README numbers are stale compared with live API. Updating them helps only if the metric is renamed from PnL to outcome/decision-quality score.
5. The demo should never depend on the latest market cycle. It should pin one recent executed cycle and one recent correct block/protected-capital cycle.
6. The RWA story should be framed as Path A infrastructure for RWA allocation. Active now: mETH yield surface, USDT0/stable allocation, Mantle execution/proof rails. Paper-ready: USDY route, shipped but gated until Mantle liquidity returns.
7. Judges need a three-click verification path above the fold: live health, latest executed proof, replay verifier/contracts.

### Findings To Discard Or Downgrade

- One report claimed GitHub/Vercel were unavailable. Current checks show the project and demo are accessible. Treat this as a first-impression resilience warning, not as a proven outage.
- One report suggests stronger live USDY framing. Do not claim live USDY execution unless liquidity and execution are actually active.
- One report says "zero trust assumptions" in sample copy. Do not use this phrase. The honest phrasing is "reduced trust through public evidence, replay, and on-chain attestation."

### Current Live Snapshot To Re-Verify Before Shipping

The values below were observed on 2026-06-04 and must be refreshed before final DoraHacks paste:

- `/api/health`: around 29 successful cycles / 0 failed in 24h, parse success 100%, gas runway around 15.5 days.
- `/api/performance`: NAV around $150.96, settled outcomes 196, win rate 58.2%, outcome score +4342 bps, `realizedTradingPnlBps: null`, `pnlMethodology: "outcome-score-not-realized-wallet-pnl"`.
- Recent replay/discipline: real swaps are rare relative to all cycles; most cycles resolve to HOLD or blocked-with-proof.

---

## Module Map

### Module A - Metric Truth Contract (P0)

**Purpose:** Make all public metric language match `/api/performance` methodology.

**Files:**
- Modify: `README.md`
- Modify: `docs/dorahacks-submission-v2.md`
- Modify: `docs/DORAHACKS_SUBMISSION.md`
- Modify: `docs/SUBMISSION.md`
- Modify: `frontend/app/backtest/page.tsx`
- Modify: `frontend/app/page.tsx`
- Create: `tests/unit/publicMetricCopy.unit.test.js`

**Acceptance Criteria:**
- Public copy does not call `outcomeScoreBps` or `cumulativePnlBps` "realised/realized wallet PnL".
- `realizedTradingPnlBps: null` remains explicit in `/api/performance`.
- UI labels use "Outcome Score", "Decision-Quality Score", or "Lifetime Decision Score".
- Any legacy `cumulativePnlBps` display includes methodology text: "outcome score, not wallet PnL".
- NAV labels say "operator-funded demo capital" where shown near performance.

### Module B - Cycles Vs Trades And Discipline Semantics (P0)

**Purpose:** Stop the UI/API from implying that cron cycles or HOLD decisions are executed swaps.

**Files:**
- Modify: `frontend/app/api/discipline/route.ts`
- Modify: `frontend/app/discipline/page.tsx`
- Modify: `frontend/app/api/health/route.ts`
- Modify: `frontend/app/page.tsx`
- Create: `tests/unit/disciplineSummary.unit.test.js`
- Create: `tests/unit/healthExecutionSummary.unit.test.js`

**Acceptance Criteria:**
- `/api/discipline.summary` separates:
  - `cyclesWithTx`
  - `cyclesWithoutTx`
  - `txProofPassCount`
  - `txProofFailCount`
  - `txProofSkipCount`
  - `txProofPassRateExecutedOnly`
- Discipline UI does not show "TX Proof 100%" without the denominator of cycles with actual tx.
- HOLD cycles render as `HOLD (no tx)` or `ACCEPTED (no execution)`, visually distinct from `SWAP VERIFIED`.
- `/api/health` and homepage copy distinguish "cycles ran" from "swaps executed".

### Module C - Proof Explorer Consistency And Golden Cycles (P0)

**Purpose:** Make the proof surface impossible to misread during the first judging minute.

**Files:**
- Modify: `frontend/app/proof-explorer/page.tsx`
- Modify: `frontend/app/proof-explorer/client.tsx`
- Modify: `frontend/app/api/proof-explorer/route.ts`
- Modify: `frontend/app/replay/page.tsx`
- Modify: `frontend/app/replay/[id]/page.tsx`
- Create: `docs/judge-verification-path.md`
- Create: `tests/unit/proofExplorerConsistency.unit.test.js`

**Acceptance Criteria:**
- Decision totals reconcile on the page: approved + blocked + neutral/hold/no-op equals total, or the denominators are explicitly different.
- Latest blocked cycle cannot be visually presented as executed.
- A "Latest executed cycle" card and a "Latest protected-capital block" card are available above or near first fold.
- `docs/judge-verification-path.md` includes exact links for:
  - live health
  - latest or pinned executed cycle
  - pinned replay cycle
  - DecisionLog contract
  - ValidationRegistry contract
  - public GitHub Actions workflow

### Module D - DoraHacks And README Copy Rewrite (P0)

**Purpose:** Replace stale submission copy with judge-optimized, source-of-truth-based copy.

**Files:**
- Modify: `docs/dorahacks-submission-v2.md`
- Modify: `docs/DORAHACKS_SUBMISSION.md`
- Modify: `docs/SUBMISSION.md`
- Modify: `README.md`
- Create: `docs/submission-final-copy.md`
- Create: `scripts/audit/check-submission-honesty.js`

**Acceptance Criteria:**
- `docs/submission-final-copy.md` contains the final paste-ready DoraHacks description.
- It includes a dated "Live Snapshot" block with source-of-truth links.
- It uses:
  - "Decision-Quality Score" instead of "realised PnL"
  - "best-effort public cron" instead of "always-on"
  - "full reasoning pinned off-chain and cryptographically anchored on Mantle" instead of "complete reasoning stored on-chain"
  - "operator-funded demo capital" instead of implying NAV is trading profit
  - "USDY paper-ready/gated" instead of live USDY execution
- `node scripts/audit/check-submission-honesty.js` fails on forbidden stale phrases.

### Module E - First Impression Liveness And Fallback States (P1)

**Purpose:** Ensure first render never looks dead when the live system is healthy.

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/api/health/freshness.shared.js`
- Modify: `frontend/app/components/LiveStatusBadge.tsx` if present; otherwise the local component in `frontend/app/page.tsx`
- Create: `tests/unit/liveFreshnessCopy.unit.test.js`

**Acceptance Criteria:**
- LIVE/IDLE/STALE/OFFLINE thresholds are sourced from one shared module.
- The homepage SSR/fallback does not show `OFFLINE` unless the last known source actually says offline.
- Loading states read like "Loading live snapshot" with last verified timestamp if available, not broken terminal copy.
- Existing P0 honesty behavior is preserved: stale is shown when stale.

### Module F - RWA Framing And Asset Matrix (P1)

**Purpose:** Make the RWA story strong and precise without overclaiming.

**Files:**
- Modify: `README.md`
- Modify: `docs/submission-final-copy.md`
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/backtest/page.tsx` if it describes RWA assets
- Create: `docs/rwa-live-vs-paper-ready.md`

**Acceptance Criteria:**
- Active lane says:
  - mETH: Mantle native LST yield/risk-on leg, not a tokenized Treasury.
  - USDT0: Treasury-collateralised stable allocation rail, not yield source.
  - MNT/WMNT: Mantle-native risk asset/gas/liquidity context.
- Paper-ready lane says:
  - USDY module ships.
  - USDY route is gated off until Mantle liquidity returns.
  - No live USDY execution claim.
- Submission explains Path A infrastructure more strongly than "trading bot".

### Module G - Demo Video And X Thread Package (P1)

**Purpose:** Create a 90-120 second proof-first demo package.

**Files:**
- Modify: `docs/demo-script.md`
- Create: `docs/demo-runbook-final.md`
- Create: `docs/x-thread-final.md`

**Acceptance Criteria:**
- Demo script opens with proof, not marketing.
- Demo includes:
  - live health
  - three-model consensus
  - pinned executed cycle
  - pinned blocked/protected-capital cycle
  - replay verification
  - custody/demo-capital honesty note
- The final script avoids "realized PnL" and "zero trust".
- The X thread includes GitHub, live demo, Mantle contract, demo video, and one honesty note.

### Module H - Final Verification And Freeze (P0)

**Purpose:** Prove the final package is consistent before touching DoraHacks.

**Files:**
- Modify only if tests reveal drift.
- Create: `docs/final-submission-verification-2026-06-04.md`

**Acceptance Criteria:**
- `npm run test:unit` passes.
- `npm run lint` passes or pre-existing warnings are documented.
- `cd frontend && npm run lint` passes or pre-existing warnings are documented.
- `cd frontend && npm run build` passes.
- `node scripts/audit/probe-dorahacks-submission.js` passes after DoraHacks text is pasted.
- `node scripts/audit/check-submission-honesty.js` passes.
- Final verification doc contains live API snapshots, exact timestamp, and final URLs.

---

## Implementation Tasks

### Task 1: Create Public Metric Copy Guard

**Files:**
- Create: `tests/unit/publicMetricCopy.unit.test.js`
- Modify: `README.md`
- Modify: `docs/dorahacks-submission-v2.md`
- Modify: `docs/DORAHACKS_SUBMISSION.md`
- Modify: `docs/SUBMISSION.md`

- [ ] **Step 1: Write the failing copy test**

Create `tests/unit/publicMetricCopy.unit.test.js`:

```js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC_DOCS = [
  "README.md",
  "docs/dorahacks-submission-v2.md",
  "docs/DORAHACKS_SUBMISSION.md",
  "docs/SUBMISSION.md",
];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

describe("public metric copy honesty", () => {
  test.each(PUBLIC_DOCS)("%s does not label outcome score as realised wallet PnL", (file) => {
    const text = read(file);
    expect(text).not.toMatch(/live reali[sz]ed pnl/i);
    expect(text).not.toMatch(/reali[sz]ed pnl \+\d+/i);
    expect(text).not.toMatch(/equity curve built cycle-by-cycle from on-chain settled PnL/i);
  });

  test.each(PUBLIC_DOCS)("%s discloses outcome-score methodology when performance is mentioned", (file) => {
    const text = read(file);
    if (/outcome score|decision-quality|cumulativePnlBps|performance/i.test(text)) {
      expect(text).toMatch(/not wallet PnL|outcome score|decision-quality/i);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npx jest tests/unit/publicMetricCopy.unit.test.js --runInBand
```

Expected: FAIL because current docs contain `Live realised PnL` and/or stale PnL phrasing.

- [ ] **Step 3: Replace public metric language**

In all listed docs, replace:

```text
Live realised PnL +1757 bps (+17.57%) across 67 settled outcomes
```

with current-source wording:

```text
Lifetime Decision-Quality / Outcome Score: +4342 bps across 196 settled outcomes.
Methodology: this is an outcome score from settled decisions, not realized wallet PnL;
`/api/performance.realizedTradingPnlBps` is intentionally null.
```

Also replace "equity curve built cycle-by-cycle from on-chain settled PnL" with:

```text
outcome-score curve built from settled decision outcomes; not wallet PnL
```

- [ ] **Step 4: Run the copy test**

Run:

```bash
npx jest tests/unit/publicMetricCopy.unit.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/publicMetricCopy.unit.test.js README.md docs/dorahacks-submission-v2.md docs/DORAHACKS_SUBMISSION.md docs/SUBMISSION.md
git commit -m "docs: label performance as outcome score"
```

### Task 2: Add Discipline Execution-Aware Summary

**Files:**
- Modify: `frontend/app/api/discipline/route.ts`
- Create: `tests/unit/disciplineSummary.unit.test.js`

- [ ] **Step 1: Extract summary logic for testing**

In `frontend/app/api/discipline/route.ts`, export a pure helper:

```ts
export function summarizeDisciplineHistoryForTest(history: HistoryEntry[]): Summary {
  return buildSummary(history);
}
```

Extend `Summary` with:

```ts
cyclesWithTx: number;
cyclesWithoutTx: number;
txProofPassCount: number;
txProofFailCount: number;
txProofSkipCount: number;
txProofPassRateExecutedOnly: number | null;
```

Define execution by `tx_proof` status:

```ts
const txProof = e.checks.find((c) => c.name === "tx_proof");
const txStatus = String(txProof?.status ?? "").toLowerCase();
if (txStatus === "skip") cyclesWithoutTx++;
else if (txStatus === "pass" || txStatus === "fail" || txStatus === "warn") cyclesWithTx++;
```

- [ ] **Step 2: Write the failing unit test**

Create `tests/unit/disciplineSummary.unit.test.js`:

```js
describe("discipline execution-aware summary", () => {
  test("separates executed swaps from hold cycles", () => {
    const { summarizeDisciplineHistoryForTest } = require("../../frontend/app/api/discipline/route.ts");
    const summary = summarizeDisciplineHistoryForTest([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 1,
        verdict: "ACCEPTED",
        checks: [
          { name: "tx_proof", status: "SKIP", detail: "Hold action — no tx to verify" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 2,
        verdict: "ACCEPTED",
        checks: [
          { name: "tx_proof", status: "PASS", detail: "tx confirmed" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
    ]);

    expect(summary.cyclesWithTx).toBe(1);
    expect(summary.cyclesWithoutTx).toBe(1);
    expect(summary.txProofPassCount).toBe(1);
    expect(summary.txProofSkipCount).toBe(1);
    expect(summary.txProofPassRateExecutedOnly).toBe(100);
  });
});
```

If Jest cannot import `.ts` route files directly in this repo, move the pure logic to `frontend/app/lib/discipline-summary.shared.js` and import that from both the route and test.

- [ ] **Step 3: Run the test and confirm it fails**

Run:

```bash
npx jest tests/unit/disciplineSummary.unit.test.js --runInBand
```

Expected: FAIL until the new fields exist.

- [ ] **Step 4: Implement execution-aware summary**

Update `buildSummary()` so `tx_proof` skip is not included in executed-only pass rate. Preserve existing `gatePassRates` for backward compatibility, but add the new explicit fields.

- [ ] **Step 5: Run focused test**

Run:

```bash
npx jest tests/unit/disciplineSummary.unit.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/discipline/route.ts tests/unit/disciplineSummary.unit.test.js
git commit -m "fix(discipline): separate holds from verified swaps"
```

### Task 3: Update Discipline UI Labels

**Files:**
- Modify: `frontend/app/discipline/page.tsx`
- Modify: `frontend/app/discipline/discipline.module.css`

- [ ] **Step 1: Add display helpers**

In `frontend/app/discipline/page.tsx`, add:

```ts
function txProofStatus(entry: HistoryEntry | null | undefined): string {
  const tx = entry?.checks?.find((c) => c.name === "tx_proof");
  return String(tx?.status ?? "").toLowerCase();
}

function verdictLabel(entry: HistoryEntry | null | undefined): string {
  if (!entry) return "UNKNOWN";
  const tx = txProofStatus(entry);
  if (entry.verdict === "ACCEPTED" && tx === "skip") return "HOLD (no tx)";
  if (entry.verdict === "ACCEPTED" && tx === "pass") return "SWAP VERIFIED";
  return entry.verdict;
}
```

- [ ] **Step 2: Replace latest verdict rendering**

Change latest verdict display from:

```tsx
{data.latest?.status ?? "UNKNOWN"}
```

to:

```tsx
{verdictLabel(data.latestEntry)}
```

- [ ] **Step 3: Replace top summary copy**

Where the page shows TX Proof pass rate, render:

```tsx
<span>
  {data.summary.txProofPassCount}/{data.summary.cyclesWithTx} swaps verified
</span>
<span>
  {data.summary.cyclesWithoutTx} HOLD cycles had no tx to verify
</span>
```

If `cyclesWithTx` is `0`, show:

```text
No swap tx in this window; HOLD cycles were checked for freshness and drift.
```

- [ ] **Step 4: Build frontend**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/discipline/page.tsx frontend/app/discipline/discipline.module.css
git commit -m "fix(ui): clarify discipline hold verdicts"
```

### Task 4: Add Cycles Vs Trades Summary To Health/Home

**Files:**
- Modify: `frontend/app/api/health/route.ts`
- Modify: `frontend/app/page.tsx`
- Create: `tests/unit/healthExecutionSummary.unit.test.js`

- [ ] **Step 1: Add health response fields**

Add best-effort fields to `/api/health` by reading recent decisions/outcomes:

```ts
executionSummary24h: {
  cyclesRan: number;
  swapsExecuted: number;
  holdsOrBlocks: number;
  note: "cyclesRan counts cron cycles, not trades";
}
```

Use existing cycle history or outcome history files already loaded by the route. If exact 24h swap count is unavailable, expose:

```ts
executionSummary24h: {
  cyclesRan: cyclesSucceeded24h,
  swapsExecuted: null,
  holdsOrBlocks: null,
  note: "cyclesRan counts cron cycles, not trades; swap count unavailable in this snapshot";
}
```

Do not fabricate a number.

- [ ] **Step 2: Write test**

Create `tests/unit/healthExecutionSummary.unit.test.js` to assert the note exists and cycles are not labeled trades.

- [ ] **Step 3: Update homepage copy**

In `frontend/app/page.tsx`, replace any copy that can read as "29 trades" with:

```text
29 cycles ran / 0 failed in 24h. Cycles are agent decisions, not necessarily swaps.
```

If swap count exists:

```text
29 cycles ran / 2 swaps executed / rest HOLD or blocked-with-proof.
```

- [ ] **Step 4: Verify**

Run:

```bash
npx jest tests/unit/healthExecutionSummary.unit.test.js --runInBand
cd frontend && npm run build
```

Expected: tests and build pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/health/route.ts frontend/app/page.tsx tests/unit/healthExecutionSummary.unit.test.js
git commit -m "fix(health): distinguish cycles from swaps"
```

### Task 5: Fix Proof Explorer Totals And Golden Cycle Cards

**Files:**
- Modify: `frontend/app/api/proof-explorer/route.ts`
- Modify: `frontend/app/proof-explorer/page.tsx`
- Modify: `frontend/app/proof-explorer/client.tsx`
- Create: `tests/unit/proofExplorerConsistency.unit.test.js`

- [ ] **Step 1: Define proof summary taxonomy**

The API response should expose:

```ts
summary: {
  totalDecisions: number;
  approvedCount: number;
  blockedCount: number;
  holdOrNoopCount: number;
  executedSwapCount: number;
  denominatorNote: string;
}
```

The invariant is:

```text
approvedCount + blockedCount + holdOrNoopCount = totalDecisions
```

If the API uses different contract denominators, expose separate fields:

```ts
decisionLogCount
validationProposalCount
validationApprovedCount
validationRejectedCount
denominatorNote
```

- [ ] **Step 2: Write invariant test**

Create `tests/unit/proofExplorerConsistency.unit.test.js` that feeds sample rows and asserts totals reconcile or denominator note is present.

- [ ] **Step 3: Add golden cycle cards**

On the proof explorer, render:

```text
Latest executed cycle
Latest protected-capital block
```

Each card must include:

- cycle id
- decision tier
- target asset
- tx hash if present
- replay link if available
- timestamp

- [ ] **Step 4: Verify latest blocked cycle is not shown as executed**

Add a test or fixture for a `BLOCKED_BY_REGIME` row with `txHashes: []`; expected UI/API classification: blocked/protected, not executed.

- [ ] **Step 5: Build**

Run:

```bash
npx jest tests/unit/proofExplorerConsistency.unit.test.js --runInBand
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/api/proof-explorer/route.ts frontend/app/proof-explorer/page.tsx frontend/app/proof-explorer/client.tsx tests/unit/proofExplorerConsistency.unit.test.js
git commit -m "fix(proof): reconcile totals and pin judge cycles"
```

### Task 6: Write Final DoraHacks Copy

**Files:**
- Create: `docs/submission-final-copy.md`
- Create: `scripts/audit/check-submission-honesty.js`
- Modify: `docs/dorahacks-submission-v2.md`
- Modify: `docs/DORAHACKS_SUBMISSION.md`

- [ ] **Step 1: Create honesty audit script**

Create `scripts/audit/check-submission-honesty.js`:

```js
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const FILES = [
  "docs/submission-final-copy.md",
  "docs/dorahacks-submission-v2.md",
  "docs/DORAHACKS_SUBMISSION.md",
  "README.md",
];

const forbidden = [
  [/live reali[sz]ed pnl/i, "Use Outcome Score, not live realized PnL"],
  [/reali[sz]ed pnl \+\d+/i, "Do not attach realized PnL to outcome score"],
  [/zero trust assumptions/i, "Use reduced trust / verifiable evidence"],
  [/always[- ]on|24\/7 autonomous/i, "Use best-effort public cron"],
  [/complete reasoning chain.*on-chain/i, "Use off-chain pinned, on-chain anchored"],
  [/live USDY execution/i, "USDY is paper-ready/gated unless reactivated"],
];

let failed = false;
for (const file of FILES) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const [regex, reason] of forbidden) {
    if (regex.test(text)) {
      console.error(`${file}: forbidden phrase matched ${regex}: ${reason}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log("submission honesty check passed");
```

- [ ] **Step 2: Draft `docs/submission-final-copy.md`**

Use this structure:

```md
# TuringVault - Verifiable AI Infrastructure For RWA Portfolio Decisions On Mantle

## 60-Second Pitch

Most AI portfolio agents show the trade but not the reasoning. TuringVault adds the missing infrastructure: adversarial multi-model review, ERC-8004-style identity/reputation/validation registries, on-chain decision logs, IPFS-pinned reasoning, replay-verifiable manifests, a Discipline Layer, and a public challenge arena.

## What Is Live

- Mantle Mainnet decision logging and trust registries.
- Public best-effort GitHub Actions cron with live health endpoint.
- Replay verifier and daily replay validation workflow.
- Demo capital managed through an operator-funded custodial EOA; no public deposits.
- Active Mantle rails: mETH yield/risk leg, USDT0 stable allocation, MNT/WMNT liquidity/gas context.
- USDY module shipped but gated until Mantle liquidity returns.

## Live Snapshot

Snapshot timestamp: 2026-06-04T13:45Z observed during plan creation; refresh this block by running the commands below immediately before paste.
Source of truth: /api/health and /api/performance.

Observed snapshot:

- Cycles: 29 ran / 0 failed in 24h. These are agent cycles, not trades.
- Parse success: 100%.
- Gas runway: about 15.5 days.
- Settled outcomes: 196.
- Decision-Quality / Outcome Score: +4342 bps. This is not wallet PnL.
- Win rate: 58.2% using the documented outcome denominator.
- NAV: about $150.96, operator-funded demo capital; reflects top-ups and holdings, not agent profit.

Refresh command:

```bash
curl -fsS https://frontend-seven-beta-46.vercel.app/api/health | jq '{lastCycleTimestamp,cyclesSucceeded24h,cyclesFailed24h,parseSuccessRate24h,gasRunway}'
curl -fsS https://frontend-seven-beta-46.vercel.app/api/performance | jq '{nav,settledCount,winRate,outcomeScoreBps,realizedTradingPnlBps,pnlMethodology}'
```

## Judge Verification Path

1. Live health: https://frontend-seven-beta-46.vercel.app/api/health
2. Performance methodology: https://frontend-seven-beta-46.vercel.app/api/performance
3. Proof Explorer: https://frontend-seven-beta-46.vercel.app/proof-explorer
4. Replay Verifier: https://frontend-seven-beta-46.vercel.app/replay
5. Challenge Arena: https://frontend-seven-beta-46.vercel.app/challenge
6. Agent Cycle workflow: https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml

## Honesty Notes

- Outcome score is not realized wallet PnL.
- Most cycles resolve to HOLD or blocked-with-proof; real swaps are rare by design.
- Full reasoning is pinned off-chain and cryptographically anchored on Mantle.
- Current custody is demo EOA; public vault contract remains in development.
- USDY route is paper-ready/gated, not live execution.
```

If the refresh command returns different values, update the observed snapshot before pasting. Keep the methodology note unchanged unless `/api/performance.pnlMethodology` changes.

- [ ] **Step 3: Run honesty check**

Run:

```bash
node scripts/audit/check-submission-honesty.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/submission-final-copy.md scripts/audit/check-submission-honesty.js docs/dorahacks-submission-v2.md docs/DORAHACKS_SUBMISSION.md
git commit -m "docs: prepare final DoraHacks copy"
```

### Task 7: Add RWA Live Vs Paper-Ready Matrix

**Files:**
- Create: `docs/rwa-live-vs-paper-ready.md`
- Modify: `README.md`
- Modify: `docs/submission-final-copy.md`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create RWA matrix doc**

Create `docs/rwa-live-vs-paper-ready.md`:

```md
# TuringVault RWA Live Vs Paper-Ready Matrix

## Active Now

| Asset | Role | Honest Status |
| --- | --- | --- |
| mETH | Mantle native LST yield / risk-on leg | Active. Yield surface is tracked separately from trading outcome score. Not a tokenized Treasury. |
| USDT0 | Stable allocation rail, Treasury-collateralised Tether bridge | Active. Stable/capital-preservation rail; not claimed as yield source. |
| MNT / WMNT | Mantle-native risk and liquidity/gas context | Active. Used for Mantle-native exposure and execution routing. |

## Paper-Ready

| Asset | Role | Honest Status |
| --- | --- | --- |
| USDY | Ondo tokenized US Treasuries | Module ships, route is gated until Mantle pool liquidity returns. No live USDY execution claim. |

## Submission Language

TuringVault is Path A infrastructure for accountable RWA allocation. The live demo proves the trust layer, decision logging, replay, and Mantle execution rails with demo capital. It does not claim a production public vault or live USDY rebalancing today.
```

- [ ] **Step 2: Link it from README and submission copy**

Add a link near the RWA section:

```md
See [`docs/rwa-live-vs-paper-ready.md`](docs/rwa-live-vs-paper-ready.md) for the active vs paper-ready asset matrix.
```

- [ ] **Step 3: Update homepage asset wording**

Ensure homepage copy does not call mETH a tokenized Treasury or imply USDY live execution.

- [ ] **Step 4: Commit**

```bash
git add docs/rwa-live-vs-paper-ready.md README.md docs/submission-final-copy.md frontend/app/page.tsx
git commit -m "docs: clarify live and paper-ready RWA rails"
```

### Task 8: Prepare Demo And Social Runbook

**Files:**
- Modify: `docs/demo-script.md`
- Create: `docs/demo-runbook-final.md`
- Create: `docs/x-thread-final.md`

- [ ] **Step 1: Create final demo runbook**

Create `docs/demo-runbook-final.md`:

```md
# TuringVault Final Demo Runbook

## Preflight

1. Open `/api/health`; confirm status is ok or honestly explain stale state.
2. Open `/api/performance`; copy fresh settled count, outcome score, win rate, NAV, methodology.
3. Pick one latest executed cycle.
4. Pick one latest protected-capital block.
5. Verify replay page for the chosen cycle renders and anchor check is green.
6. Verify `/challenge` runs in live mode or label it demo/static if live mode is disabled.

## 90-120 Second Script

0:00-0:10 - Hook:
"Most AI agents show you the trade. TuringVault shows you the reasoning, the challenge, the proof, and the outcome on Mantle Mainnet."

0:10-0:25 - Live health:
"This is live demo capital on Mantle. The health endpoint shows recent cycles, parse success, and gas runway. Cycles are decisions, not necessarily trades."

0:25-0:40 - Architecture:
"GLM-5 proposes, Claude challenges, Gemini arbitrates. Execution needs independent gates before capital can move."

0:40-0:55 - Executed proof:
"Here is a recent executed cycle with the Mantle transaction and the recorded decision."

0:55-1:10 - Protected block:
"Here is a blocked cycle. Refusal-with-proof is the product: the system can prove why it did not trade."

1:10-1:30 - Replay:
"The prompts, model responses, manifest hash, and on-chain anchor are replay-verifiable. Full reasoning is pinned off-chain and anchored on Mantle."

1:30-1:45 - RWA/custody honesty:
"Active rails are mETH and USDT0; USDY is shipped but gated until liquidity returns. This is operator-funded demo capital, no public deposits."

1:45-2:00 - Close:
"TuringVault: verifiable AI infrastructure for RWA portfolio decisions on Mantle."
```

- [ ] **Step 2: Create X thread draft**

Create `docs/x-thread-final.md` with 7 posts:

1. Problem and project thesis.
2. Mantle-specific proof rails.
3. Three-model consensus.
4. Replay verifier.
5. Discipline and challenge arena.
6. Honest limitations: demo capital, no public vault, outcome score not PnL.
7. Links: DoraHacks, live demo, GitHub, contract, demo video.

- [ ] **Step 3: Commit**

```bash
git add docs/demo-script.md docs/demo-runbook-final.md docs/x-thread-final.md
git commit -m "docs: add final demo and social runbook"
```

### Task 9: Run Final Verification

**Files:**
- Create: `docs/final-submission-verification-2026-06-04.md`

- [ ] **Step 1: Capture live API values**

Run:

```bash
curl -fsS https://frontend-seven-beta-46.vercel.app/api/health | jq '{status,lastCycleAge,lastCycleTimestamp,cyclesSucceeded24h,cyclesFailed24h,parseSuccessRate24h,gasRunway,summary:.lastCycleSummary}'
curl -fsS https://frontend-seven-beta-46.vercel.app/api/performance | jq '{nav,settledCount,winRate,outcomeScoreBps,realizedTradingPnlBps,pnlMethodology,holdings,prices}'
curl -fsS https://frontend-seven-beta-46.vercel.app/api/discipline | jq '{summary, latestEntry}'
```

- [ ] **Step 2: Run local tests**

Run:

```bash
npm run test:unit
npm run lint
cd frontend && npm run lint && npm run build
```

Expected: all pass, or pre-existing warnings are documented without hiding them.

- [ ] **Step 3: Run copy audits**

Run:

```bash
node scripts/audit/check-submission-honesty.js
node scripts/audit/probe-dorahacks-submission.js
```

Expected:

- honesty check passes locally.
- DoraHacks probe passes after user pastes updated text.

- [ ] **Step 4: Create verification doc**

Create `docs/final-submission-verification-2026-06-04.md` with:

```md
# Final Submission Verification - 2026-06-04

## Live API Snapshot

Insert the exact summarized outputs from Step 1. The section must include `lastCycleTimestamp`, `cyclesSucceeded24h`, `cyclesFailed24h`, `parseSuccessRate24h`, `gasRunway.daysRemaining`, `nav`, `settledCount`, `winRate`, `outcomeScoreBps`, `realizedTradingPnlBps`, and `pnlMethodology`.

## Local Verification

- npm run test:unit: PASS
- npm run lint: PASS or documented warnings
- frontend npm run lint: PASS or documented warnings
- frontend npm run build: PASS
- check-submission-honesty: PASS
- probe-dorahacks-submission: PASS after DoraHacks update

## Final Links

- DoraHacks: https://dorahacks.io/buidl/43986
- Live demo: https://frontend-seven-beta-46.vercel.app
- GitHub: https://github.com/USBVadik/TuringVault-Core
- Demo video: add the final YouTube/Loom URL after upload; if no upload exists, keep `demo/demo-FINAL.mp4` out of the public proof path and do not claim an external video link.
- Latest executed cycle: use the card/link produced by Module C after verification.
- Latest protected block: use the card/link produced by Module C after verification.
- Replay verifier: https://frontend-seven-beta-46.vercel.app/replay
- DecisionLog: https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5
- ValidationRegistry: https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6
```

- [ ] **Step 5: Commit**

```bash
git add docs/final-submission-verification-2026-06-04.md
git commit -m "docs: record final submission verification"
```

---

## Execution Order

Run modules in this order:

1. Module A - Metric Truth Contract.
2. Module B - Cycles Vs Trades And Discipline Semantics.
3. Module C - Proof Explorer Consistency And Golden Cycles.
4. Module D - DoraHacks And README Copy Rewrite.
5. Module E - First Impression Liveness And Fallback States.
6. Module F - RWA Framing And Asset Matrix.
7. Module G - Demo Video And X Thread Package.
8. Module H - Final Verification And Freeze.

## Stop Conditions

Stop and ask before proceeding if:

- A live API value contradicts a claim we are about to paste to DoraHacks.
- A code change would affect live trading or execution logic.
- Fixing the UI requires schema changes that would break existing API consumers.
- Tests reveal a real production bug outside the scope of submission hardening.

## Final Freeze Rule

After Module H, do not add new features before submission. Only accept:

- honesty fixes,
- runtime/cron fixes,
- broken-link fixes,
- demo copy corrections based on live data.
