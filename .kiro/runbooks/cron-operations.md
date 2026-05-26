# Cron Operations Runbook

**Workflow:** `.github/workflows/agent-cycle.yml`
**Spec:** `.kiro/specs/continuous-cron-and-health`
**Cadence:** every hour at `:00` UTC, plus manual `workflow_dispatch`.

---

## 1. First-time setup — GitHub Actions secrets

Open `Settings → Secrets and variables → Actions → New repository secret`
and create each of the following. The workflow will fail with a clear
"missing $SECRET_NAME" message if any are absent.

| Secret name | Source | Format / notes |
|---|---|---|
| `PRIVATE_KEY` | `.env` line `PRIVATE_KEY=` | 0x-prefixed 64-hex string. Agent EOA `0xDC78…fb5a`. |
| `AWS_ACCESS_KEY_ID` | AWS IAM user with Bedrock Invoke perms | Plain string (`AKIA…`). |
| `AWS_SECRET_ACCESS_KEY` | Same IAM user | Plain string. Treat as password. |
| `AWS_REGION` | Bedrock model region | e.g. `us-east-1`. Must match where Claude/GLM are enabled. |
| `NANSEN_API_KEY` | Nansen MCP dashboard | Plain string. |
| `PINATA_JWT` | Pinata account → API Keys | JWT, no `Bearer ` prefix. |
| `PINATA_API_KEY` | Pinata account → API Keys | Short alphanumeric. |
| `PINATA_SECRET` | Pinata account → API Keys | Long alphanumeric. |
| `MANTLE_RPC_URL` | Operator's Mantle RPC | Default `https://rpc.mantle.xyz`. |
| `GEMINI_PROJECT_ID` | GCP project hosting Vertex AI | e.g. `lina-494709`. |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Vertex service-account key file | **Paste the entire JSON file contents as the secret value**, including the literal newline characters in `private_key`. The workflow writes it to disk at `./gemini-service-account.json` for `geminiArbiter.js`. |

After saving:

1. Sanity-check: every name in the table appears in
   `.github/workflows/agent-cycle.yml` under the `env:` block.
2. Trigger a manual run (section 3) to verify the secrets are wired.

---

## 2. Pause the agent

Disabling stops both the schedule and `workflow_dispatch`. Takes ~30 s.

1. Open the repo's **Actions** tab.
2. Left sidebar → click **Agent Cycle**.
3. Top-right `⋯` menu → **Disable workflow**.

The mascot on the dashboard will remain 🟢 until `lastCycleAge > 1 h`,
then turn 🟡 IDLE, then 🔴 OFFLINE after enough time. Honest behaviour.

To resume: same menu → **Enable workflow**, then optionally trigger a
manual cycle (section 3) to refresh state immediately.

---

## 3. Manual cycle (workflow_dispatch)

1. Actions → **Agent Cycle** → top-right **Run workflow** dropdown.
2. Branch: `main`. Click **Run workflow**.
3. Refresh after ~10 s; the new run appears at the top of the list.
4. Click into the run to follow logs in real time.

A successful manual run pushes a `chore(cron): cycle ...` commit to
`main`, which Vercel rebuilds within ~60–90 s.

---

## 4. Reading logs

URL pattern: `https://github.com/USBVadik/TuringVault-Core/actions/runs/<run_id>`.

Common signatures to grep for:

| Symptom in logs | Likely cause | Action |
|---|---|---|
| `missing $PRIVATE_KEY` | Secret not set | Section 1. |
| `Bedrock` + `429` or `ThrottlingException` | Bedrock rate-limit | Soft failure; next cron retries. |
| `replacement transaction underpriced` | Stuck nonce on Mantle | Section 6. |
| `ECONNRESET` against `rpc.mantle.xyz` | RPC blip | Soft failure; investigate only if persistent. |
| `state-validate: <file>: ...` | Cycle wrote corrupt JSON | Hard failure; pull main and inspect manually. |

---

## 5. Soft vs hard failure

**Soft failure** — `runMultiAgentCycle()` threw, but the workflow exit
code is `0`:
- `scripts/run-cycle.js` writes a summary JSON with `errors: [...]`
  populated and `decisionId: null`.
- One entry appended to `data/cycle-failures.json`.
- The workflow still commits and pushes — front-end shows the failure
  via `/api/health.cyclesFailed24h`.
- **No human action required** unless failures are clustered.

**Hard failure** — workflow exit code ≠ `0`:
- Exit `2` from `run-cycle.js` ⇒ a state file failed JSON parse.
- Exit `99` from `run-cycle.js` ⇒ an uncaught throw inside the runner
  itself (rare — usually a regression in a JS dep).
- Job-level timeout (8 min) ⇒ a hung Bedrock or RPC call.
- These leave the previous state files unchanged.

Drop into the **Actions tab** → run logs → top of the failed step.

---

## 6. Recover from a stuck nonce

Symptom: `tx.wait()` hangs or the runner times out, and Mantlescan
shows a pending TX from `0xDC78…fb5a` that never confirms.

Two ways to clear:

### Option A — overwrite with a self-transfer

```bash
# Locally, with .env sourced:
node -e '
const { ethers } = require("ethers");
require("dotenv").config({ path: "./.env" });
(async () => {
  const p = new ethers.JsonRpcProvider("https://rpc.mantle.xyz");
  const w = new ethers.Wallet(process.env.PRIVATE_KEY, p);
  const stuck = <NONCE_TO_REPLACE>;
  const fee = await p.getFeeData();
  const tx = await w.sendTransaction({
    to: w.address,
    value: 0n,
    nonce: stuck,
    maxFeePerGas: fee.maxFeePerGas * 2n,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas * 2n,
  });
  console.log(await tx.wait());
})();'
```

### Option B — wait

If the stuck TX has very low gas, it usually drops from the mempool
within a few hours. Pause the workflow (section 2), wait, and re-enable.

---

## 7. Cost monitoring

| Surface | URL | Threshold |
|---|---|---|
| GitHub Actions minutes | `Settings → Billing → Usage this month` | < 1500 / 2000 free |
| AWS Bedrock invocations | CloudWatch Metrics → `AWS/Bedrock` → `InvokeModel` | 60–80 / day expected |
| AWS Bedrock spend | Cost Explorer → filter Bedrock | ≤ $5 / day |
| Mantle gas spent | Mantlescan → agent EOA | ~0.005 MNT / cycle |

Alarm if Bedrock cost > $5/day or GH Actions minutes burn rate
projects > 2000/mo. Investigate via the Actions log of the costliest
recent run.

---

## 8. Disable Gemini arbiter temporarily

If the arbiter is misbehaving (e.g., Vertex outage, schema drift),
empty the secret to fall back to conservative-block:

1. Settings → Secrets → `GOOGLE_APPLICATION_CREDENTIALS_JSON` → Update.
2. Replace the value with a single space (or any non-JSON content).
3. Save.

`geminiArbiter.js` will detect the missing/invalid key and skip its
arbitration step. The cycle continues with analyst+validator only;
edge cases default to BLOCKED. Restore by re-pasting the original key.

---

## Observed costs

(Filled in after first 24 h of live cron — see spec task T12.)

| Date | Cycles | GH Actions min | Bedrock $ | Notes |
|---|---|---|---|---|
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |
