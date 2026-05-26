# Adversarial Challenge — Operator Runbook

**Spec:** `.kiro/specs/human-vs-ai-challenge-v2`
**Frontend:** `/challenge`
**API:** `/api/challenge?type={attack}`
**Backend:** `src/orchestrator/runChallenge.js`

The page has two modes:

- **PREVIEW** (default) — deterministic safety-gate preview, no model calls,
  zero cost. Frontend shows a yellow `PREVIEW · deterministic rules` banner.
- **LIVE** — real GLM-5 → Claude 4.6 → Gemini 3.5 pipeline. ~$0.15 per call.
  Frontend shows a green `LIVE · multi-agent pipeline` banner.

Mode is gated by Vercel env vars (NOT GitHub Actions secrets — the route
runs on Vercel, not in the cron).

---

## 1. Enable live mode

Vercel UI → **Project → Settings → Environment Variables → Production**:

| Variable | Value | Required for |
|---|---|---|
| `CHALLENGE_LIVE_ENABLED` | `true` | Live pipeline at all |
| `CHALLENGE_ANCHOR_ENABLED` | `true` | On-chain attestation TXs |
| `CHALLENGE_DAILY_CAP` | (number, default 100) | Override daily budget |

Live mode also reuses these existing Vercel env vars (already set for the
other API routes):

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `PINATA_JWT` (for IPFS reasoning pin)
- `PRIVATE_KEY` (only needed when `CHALLENGE_ANCHOR_ENABLED=true`)
- `MANTLE_RPC_URL`
- `GEMINI_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (or its JSON
  contents written to a Vercel filesystem path; same approach as cron)

Save and redeploy (Vercel auto-rebuilds on env change).

## 2. Pause live mode mid-event

Set `CHALLENGE_LIVE_ENABLED=false` (or delete the var) in Vercel. The
next request hitting `/api/challenge` returns the deterministic preview
without spending Bedrock credits. Frontend banner flips to PREVIEW
within seconds.

This is the lever for "viral spike, costs spiking, kill it". No code
push needed.

## 3. Spend monitoring

Check daily spend through:

- **AWS Bedrock console** → CloudWatch Metrics → `AWS/Bedrock` →
  `InvokeModel` (filter by region matching `AWS_REGION`)
- **AWS Cost Explorer** → filter Service = Bedrock, granularity Daily

Each live challenge invocation costs roughly:
- GLM-5 analyst: ~$0.05
- Claude Sonnet 4.6 validator: ~$0.07
- Gemini 3.5 Flash arbiter: ~$0.001 (and it only fires on disagreement)
- Total: **~$0.12–0.18 per challenge**

At the default daily cap of 100 invocations, worst case spend is ~$15/day.

## 4. Reset daily budget

The budget is persisted to `data/challenge-budget.json` and committed
back by the cron's commit-back step. The file auto-resets when UTC date
rolls over.

To force a reset before midnight UTC:

```bash
# locally, after pulling latest main:
echo '{"date":"'$(date -u +%F)'","used":0,"history":[]}' > data/challenge-budget.json
git add data/challenge-budget.json
git commit -m "chore(challenge): reset daily budget"
git push origin main
```

The next scheduled cron picks it up; live `/api/challenge` will see
`used:0` on the next call (Vercel function cold-start re-reads the file
from the bundled repo contents — note that this means the reset only
takes effect after the next Vercel redeploy triggered by the cron's
push).

## 5. Reading challenge history

The budget file's `history[]` array carries the last 100 invocations:

```bash
jq '.history[]' data/challenge-budget.json
```

Each entry has `at`, `type`, `mode`, `blocked`, `decisionTier`,
`ipfsCid`, `anchored`. Useful for verifying a judge's claimed challenge
actually ran during their session.

## 6. Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `mode: 'DETERMINISTIC_RULES'` despite flag set | Vercel didn't redeploy after env change | Vercel UI → Deployments → Redeploy latest |
| HTTP 503 "live pipeline failed" | Bedrock 429 / RPC blip / Vertex outage | Wait 60s, retry. If persistent, check AWS region status |
| HTTP 429 "daily challenge budget exhausted" | Hit `CHALLENGE_DAILY_CAP` for the UTC day | Either wait for `resetAt`, raise the cap via env, or reset budget (section 4) |
| Vercel function timeout (60s) | Bedrock / Vertex took too long | Frontend shows error; user retries. If persistent, downgrade arbiter or skip Vertex |
| `onChain.skipped: 'attestation tx failed'` | Wallet ran out of MNT, or nonce gap | Top up wallet (~0.01 MNT covers many anchors), or wait for stuck nonce to clear |
| Reasoning text identical across calls | Bedrock returned cached/templated output (unlikely) | Verify by running same attack twice — should differ in details |
| IPFS pin failures (`ipfsCid: null`) | Pinata rate-limit or JWT expired | Non-fatal; the on-chain attestation still anchors. Rotate Pinata JWT if persistent |

## 7. Disable Gemini arbiter temporarily

If Vertex AI is down, the arbiter fallback (in `geminiArbiter.js`) returns
a conservative-block, so challenges still run analyst+validator only.
`pipelinePath` becomes `analyst-validator` instead of `analyst-validator-arbiter`.
This is a soft degradation, not a failure.

## 8. Bumping the daily cap

Edit Vercel env var `CHALLENGE_DAILY_CAP=500` (or whatever). Takes effect
on next request. No redeploy needed (route reads env on each invocation).

---

## Quick reference

```
PREVIEW mode          : CHALLENGE_LIVE_ENABLED unset/false
LIVE mode             : CHALLENGE_LIVE_ENABLED=true
LIVE + anchor         : both flags true
Per-IP rate limit     : 5 / hour (in-memory, soft)
Daily cap (global)    : CHALLENGE_DAILY_CAP, default 100
Cost per call         : ~$0.15
Round-trip latency    : 8–12s typical
Vercel function limit : 60s (set via maxDuration)
```
