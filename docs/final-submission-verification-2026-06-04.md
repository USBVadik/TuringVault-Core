# Final Submission Verification - 2026-06-04

Branch: `codex/submission-hardening`

Purpose: verify the submission-hardening package before DoraHacks copy/video work.

---

## Live Snapshot Used

Observed from production APIs around 2026-06-04 15:33 UTC:

```text
/api/health
cyclesSucceeded24h   31
cyclesFailed24h       0
parseSuccessRate24h   100%
gasRunway.status      ok

/api/performance
NAV                   $151.55
settled outcomes      196
win rate              58.2%
outcomeScoreBps       +4342
realizedTradingPnlBps null

/api/proof-explorer
DecisionLog rows              288
ValidationRegistry proposals  289
approved                      213
rejected                       76
```

---

## Verification Commands

### Submission honesty audit

Command:

```bash
npm run audit:submission
```

Result:

```text
PASS - Submission honesty audit passed (5 files, 10 rules).
```

### Unit tests

Command:

```bash
npm run test:unit
```

Result:

```text
PASS - 40 test suites, 416 tests.
```

### Root lint

Command:

```bash
npm run lint
```

Result:

```text
PASS - 0 errors, 48 warnings.
```

Residual warnings are pre-existing lint warnings in `src/` for unused variables / prefer-const / one precision warning. They were not introduced by the submission-hardening package.

### Frontend lint

Command:

```bash
cd frontend && npm run lint
```

Result:

```text
PASS - 0 errors, 14 warnings.
```

Residual warnings are pre-existing unused-variable warnings in frontend routes/components.

### Frontend build

Command:

```bash
cd frontend && npm run build
```

Result:

```text
PASS - compiled successfully, TypeScript passed, static pages generated.
```

Residual warning:

```text
Turbopack warning: next.config.ts appears in the NFT trace for app/api/yield-meth/route.ts.
```

This warning existed before the submission-hardening changes and does not block the production build.

---

## Pinned Demo Cycles

Executed cycle:

- Cycle `265`
- URL: https://frontend-seven-beta-46.vercel.app/replay/265
- `decisionTier`: `EXECUTED_SWAP`
- Discipline Layer: `tx_proof PASS`

Protected-capital block:

- Cycle `266`
- URL: https://frontend-seven-beta-46.vercel.app/replay/266
- `decisionTier`: `BLOCKED_BY_VALIDATOR`
- settled outcome: `CORRECT_BLOCK`
- outcome score: `+86 bps`
- no executed transaction is claimed

---

## Remaining Manual Step

Before pasting to DoraHacks or recording the final video, refresh:

- `/api/health`
- `/api/performance`
- `/api/proof-explorer`

Then update the dated snapshot in:

- `docs/submission-final-copy.md`
- `docs/judge-verification-path.md`
- `docs/demo-script.md` if metrics materially changed

