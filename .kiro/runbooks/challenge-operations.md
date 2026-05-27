# Challenge Operations Runbook

**Page:** `/challenge` (live: <https://frontend-seven-beta-46.vercel.app/challenge>)
**API:** `/api/challenge?type=<flash_crash|pump_signal|oracle_conflict|sybil_consensus>`
**Spec:** `.kiro/specs/human-vs-ai-challenge-v2`
**Backend:** `src/orchestrator/runChallenge.js`, `src/orchestrator/attackVectors.js`, `src/orchestrator/challengeBudget.js`

The challenge page has two modes:

- **PREVIEW** (default) — deterministic-rules response with yellow PREVIEW badge.
- **LIVE** — real GLM-5 → Claude 4.6 → Gemini 3.5 pipeline, optional Mantle anchor.

PREVIEW mode is safe to leave on permanently. LIVE mode burns ~$0.15
per invocation in Bedrock + Vertex calls; daily cap caps total spend.

---

## 1. Enable LIVE mode

Live mode flag lives in **Vercel env vars**, not GitHub Actions
secrets — the route runs on Vercel functions.

1. Open <https://vercel.com/usbvadik/frontend-seven-beta-46/settings/environment-variables>
2. **Add new** environment variable:
   - **Key:** `CHALLENGE_LIVE_ENABLED`
   - **Value:** `true`
   - **Environments:** check Production
3. Save.
4. Redeploy from Vercel dashboard, or push any tiny commit to trigger
   a deploy. Vercel needs the new env var compiled into the function.

To verify: hit `/api/challenge?type=flash_crash`. Response should have
`mode: "LIVE_MULTI_AGENT"` and 8–12s latency. If you see
`mode: "DETERMINISTIC_RULES"`, the env var isn't loaded — re-deploy.

While LIVE is on, the function ALSO needs the same secrets the cron
uses for AWS Bedrock and Google Vertex AI. Ensure these are set in
Vercel env (not just GitHub):

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (paste the full JSON content
  as the value), `GEMINI_PROJECT_ID`
- `PINATA_JWT` for IPFS pinning

These can be the same values as the GitHub Actions secrets.

---

## 2. Enable on-chain anchor

This is **optional and orthogonal** to LIVE mode. When set, each live
challenge submits one `ValidationRegistry.submitProposal` TX to Mantle
with action prefix `[CHALLENGE-{type}]`, so judges can verify on
Mantlescan.

1. Vercel env vars → **Add**:
   - **Key:** `CHALLENGE_ANCHOR_ENABLED`
   - **Value:** `true`
2. Also need `PRIVATE_KEY` and `MANTLE_RPC_URL` env vars (same as cron).
3. Redeploy.

**Cost:** ~0.005 MNT per anchored challenge (~$0.004 at MNT $0.72).
At cap of 100/day: ~$0.40/day.

To pause anchor without disabling LIVE: flip
`CHALLENGE_ANCHOR_ENABLED=false`. Live reasoning still works, no TX.

---

## 3. Spend monitoring

| Cost source            | Where to check                                                                                | Alert at             |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| Bedrock (Claude + GLM) | <https://console.aws.amazon.com/cloudwatch/home#metricsV2:graph=~();query=~()> filter Bedrock | $5/day               |
| Vertex AI (Gemini)     | <https://console.cloud.google.com/billing/> filter Generative AI                              | $2/day               |
| Pinata (IPFS)          | <https://app.pinata.cloud/billing>                                                            | 80% of monthly quota |
| Vercel functions       | <https://vercel.com/usbvadik/frontend-seven-beta-46/usage>                                    | 80% of free tier     |

Daily cap (`CHALLENGE_DAILY_CAP`, default 100) is the backstop. At
100/day worst case: ~$15/day total spend. AWS Activate $10k credits
cover comfortably.

---

## 4. Pause LIVE mode mid-event

Two ways:

1. **Soft pause (preserves preview behaviour):** flip
   `CHALLENGE_LIVE_ENABLED=false` in Vercel env. Redeploy. Page
   returns to deterministic preview. Takes ~30 s end-to-end.
2. **Hard pause:** delete the `CHALLENGE_LIVE_ENABLED` env var
   entirely. Same effect, slightly cleaner.

If a Bedrock or Vertex outage happens during LIVE mode, individual
calls will return HTTP 503; the frontend shows a clear error. No
fake-live fallback. The page degrades to "service temporarily
unavailable" rather than producing fabricated reasoning.

---

## 5. Reset daily budget

The budget file is `data/challenge-budget.json`, committed by the
cron's commit-back step every hour like any other state file.

To reset early (e.g., before a demo):

```bash
echo '{"date":"'$(date -u +%F)'","used":0,"history":[]}' > data/challenge-budget.json
git add data/challenge-budget.json
git commit -m "chore: reset challenge budget for demo"
git push
```

Vercel re-deploys from main, the route reads the fresh file.

To raise the cap temporarily (e.g., during judging window):

1. Vercel env → set `CHALLENGE_DAILY_CAP=200`
2. Redeploy
3. After demo, set back to `100` (or delete the env var)

---

## 6. Common failures

### Vercel function timeout (60s)

Symptom: frontend shows "live pipeline failed". CloudWatch shows
Bedrock call still in progress.

Cause: model latency exceeded `maxDuration = 60` (set on the route).

Recovery: usually transient. Bedrock TPM throttling can stretch
analyst+validator+arbiter to >60s. Retry once.

If chronic, consider:

- Lowering arbiter usage by tightening agreement thresholds in
  `multiAgent.js` (more decisions resolve at validator stage)
- Bumping `maxDuration` (Vercel Pro allows up to 300s; check plan)

### Bedrock rate-limit (HTTP 429 from AWS)

Symptom: response 503 with message containing "429" or "ThrottlingException".

Recovery: per-IP rate limit (5/hour) + daily cap should prevent. If
hit anyway, request a TPM increase in AWS console. Or use a fallback
region.

### Vertex AI down

Symptom: arbiter step times out, response missing `agents.arbiter`.

Recovery: pipeline degrades gracefully — when arbiter fails, the
result reflects analyst+validator only, with `pipelinePath:
'analyst-validator'`. Not a fatal failure; frontend renders 2 cards
instead of 3.

### Bundle size warning on Vercel

Symptom: deploy log shows "function size near limit (50MB)".

Recovery: backend orchestrator bundles AWS SDK + Vertex SDK + ethers.
If size grows past limit, lazy-load the heaviest deps inside
`runChallenge` rather than at module top level. Currently fits
comfortably.

### Stuck nonce on anchor TX

Same recovery as `cron-operations.md` section 6 — manual self-transfer
with the stuck nonce.

---

## 7. After hackathon: cleanup

Once judging closes:

1. Delete `CHALLENGE_LIVE_ENABLED` env var (page reverts to PREVIEW)
2. Optionally delete `CHALLENGE_ANCHOR_ENABLED`
3. Spend monitoring continues until both flags are off

The budget file stays in repo; deletion not required.

---

## Quick reference

```
CHALLENGE_LIVE_ENABLED=true    → real multi-agent reasoning
CHALLENGE_LIVE_ENABLED=false   → preview / deterministic (default)

CHALLENGE_ANCHOR_ENABLED=true  → also submit on-chain TX
CHALLENGE_ANCHOR_ENABLED=false → IPFS pin only, no TX (default)

CHALLENGE_DAILY_CAP=100        → max LIVE invocations per UTC day
RATE_LIMIT_PER_IP_PER_HOUR=5   → in-memory soft per-IP limit (hardcoded)
```
