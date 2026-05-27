# TuringVault Backend/Orchestrator Security Audit

**Date:** 2026-05-23  
**Scope:** `/src/orchestrator/`, `/src/execution/`, `/src/kms/`, `/src/ipfs/`, `/src/mcp/`  
**Auditor:** Hermes Agent (automated)  
**Overall Risk:** LOW-MEDIUM

---

## Executive Summary

The backend orchestrator is well-structured with multiple layers of defense:

- Zod schema validation on all AI outputs
- Multi-agent consensus (2/3 voting) prevents single-point hallucination
- Dynamic confidence thresholds that self-adjust after losses
- Dry-run default on execution engine
- EIP-2 signature canonicalization in KMS module

No critical vulnerabilities found. Several medium/low findings below.

---

## Findings

### [M-1] Private Key in Environment — No KMS in Production Path

**File:** `src/orchestrator/multiAgentLoop.js:16-17`  
**Severity:** MEDIUM  
**Description:** The force-override pattern reads `.env` raw and sets `process.env.PRIVATE_KEY`. In production, the hot wallet key sits in plaintext in `.env`. The `TencentKMSCrypto` module exists but is NOT integrated into the `multiAgentLoop.js` execution flow — it's only used as a standalone demo.

**Impact:** If the server is compromised, private key is immediately extractable.  
**Recommendation:** Wire `TencentKMSCrypto.signTransaction()` into the actual orchestrator transaction-signing path (replace `new ethers.Wallet(process.env.PRIVATE_KEY, provider)` with KMS-backed signer).

---

### [M-2] AWS Credentials Force-Override from .env

**File:** `src/orchestrator/multiAgentLoop.js:14-17`  
**Severity:** MEDIUM  
**Description:**

```js
const _env = require("dotenv").parse(require("fs").readFileSync(...));
process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
```

This force-overrides system env vars. If running on EC2 with IAM role, this breaks role-based auth and pins to static credentials. Also, reading the .env via `fs.readFileSync` is synchronous and could expose credentials in stack traces on error.

**Recommendation:** Use AWS SDK's default credential chain. Remove force-override for production. Keep only for local dev with an explicit `if (process.env.NODE_ENV !== 'production')` guard.

---

### [M-3] execSync in Execution Engine — Command Injection Surface

**File:** `src/execution/executionEngine.js:204`  
**Severity:** MEDIUM (mitigated by dryRun default)  
**Description:**

```js
const output = execSync(`byreal-perps-cli ${command} -o json`, {...});
```

The `command` variable is constructed from AI-derived values (`decision.analyst.targetAsset`, size, leverage). While the `_resolveAsset()` method maps to a fixed set, the `size` comes from `_calculateSize()` and the `leverage` from the decision object. If a malformed model response bypasses Zod validation (e.g. through the YAML fallback parser), arbitrary values could reach the shell.

**Mitigation present:** `dryRun: true` by default.  
**Recommendation:** Use `execFile` with an argument array instead of template-string `execSync`. Or spawn with `['byreal-perps-cli', command, '-o', 'json']`.

---

### [M-4] Nonce Management Race Condition

**File:** `src/orchestrator/multiAgentLoop.js:155-194`  
**Severity:** MEDIUM  
**Description:** The orchestrator fetches `currentNonce` once, then submits 4 sequential transactions with `nonce: currentNonce + 0/1/2/3`. If any external transaction from the same wallet lands between the nonce fetch and tx4, all subsequent txs will fail with "nonce too low". There's no retry logic.

**Recommendation:** Either:

- Use ethers.js managed nonces (remove explicit `{ nonce }`)
- Add retry with nonce refresh on "nonce too low" errors
- Use a NonceManager wrapper

---

### [L-1] YAML Fallback Parser in callAgent() — Overly Permissive

**File:** `src/orchestrator/multiAgent.js:351-376`  
**Severity:** LOW  
**Description:** When JSON parsing fails, the fallback tries to parse YAML-like `key: value` lines. This is very permissive and could parse garbage text as valid-looking objects. Combined with `normalizeAnalystResponse()`, even poorly-structured output gets coerced into valid-looking decisions.

**Mitigation present:** Zod `AnalystSchema.safeParse()` runs after normalization, catching most garbage.  
**Recommendation:** Log a WARNING when YAML fallback activates. Consider counting fallback frequency — if a model regularly fails JSON, it may be producing unreliable decisions too.

---

### [L-2] Hardcoded Contract Addresses Across Files

**File:** Multiple files  
**Severity:** LOW  
**Description:** Contract addresses appear in:

- `config.js` (partial set)
- `multiAgentLoop.js` (REGISTRY, DECISION_LOG, REPUTATION, VALIDATION, IDENTITY)
- `outcomeTracker.js` (REPUTATION hardcoded)

Some are duplicated and could drift. `config.js` has different IDENTITY address than `multiAgentLoop.js`:

- config.js: `0x582E6a649B99784829193E14bB7Af8c4A482E165`
- multiAgentLoop.js: `0x6f862802e0d5463DF18d267e422347BeCacc28bD`

**Recommendation:** Single source of truth for all contract addresses in `config.js`. Import everywhere.

---

### [L-3] Tencent KMS Algorithm Mismatch

**File:** `src/kms/tencentKMS.js:172`  
**Severity:** LOW  
**Description:** The `_callKMS` method uses `Algorithm: "SM2DSA"` in the payload, but the comment says "or ECC_SECP256K1 depending on key type". SM2DSA is a Chinese national standard — if the KMS key is actually secp256k1 (as required by Ethereum), this will fail. The code works in simulation mode only.

**Recommendation:** Explicitly verify key type matches. For Ethereum, must be `ECC_SECP256K1_SIGN`. Add a validation step that checks key metadata before signing.

---

### [L-4] No Rate Limiting on AI Calls

**File:** `src/orchestrator/multiAgent.js`  
**Severity:** LOW  
**Description:** If the cron fires faster than expected (or is called manually), there's no debounce/rate-limit on Bedrock API calls. Each cycle makes 2-3 model calls (analyst + validator + optional arbiter). AWS Bedrock has per-model TPM limits.

**Mitigation present:** The `isRunning` flag in `main.js` prevents concurrent cycles.  
**Recommendation:** Add exponential backoff on Bedrock throttling errors. Consider a semaphore or token bucket for model calls.

---

### [L-5] outcomeTracker.js Uses agentId=1, main.js Uses agentId=0

**File:** `src/orchestrator/outcomeTracker.js:228` vs `multiAgentLoop.js:208`  
**Severity:** LOW  
**Description:** `outcomeTracker.settle()` calls `reputation.recordPnL(1, ...)` but `multiAgentLoop.js` calls `reputation.submitFeedback(0, ...)`. Inconsistent agent IDs mean reputation scores go to different on-chain entities.

**Recommendation:** Use a single `AGENT_ID` constant from config.

---

### [L-6] Pinata JWT in Fallback Generates Fake CIDs

**File:** `src/ipfs/storage.js:24-28`  
**Severity:** LOW (acceptable for demo)  
**Description:** Without PINATA_JWT, the module generates deterministic `bafkrei...` CIDs from SHA-256. These look real but aren't on IPFS. On-chain references to these CIDs cannot be verified by third parties.

**Impact:** For hackathon demo this is fine. For production, any "Proof-of-Reasoning" stored this way is non-verifiable.

---

### [I-1] Signal Engine ethSignal Variable Out of Scope

**File:** `src/orchestrator/signalEngine.js:129`  
**Severity:** INFO (likely runtime error silently caught)  
**Description:**

```js
rsi: parseFloat(ethSignal.rsi || 50),
```

The variable `ethSignal` is only defined inside the `try` block at line 88-94, but `return` at line 124 references it outside that scope. If Byreal fails and Hyperliquid succeeds, `ethSignal` will be `undefined`.

**Recommendation:** Initialize `let ethSignal = null;` at function scope and reference it safely.

---

### [I-2] multiAgentLoop.js Line 262 — Undefined `signals` Variable

**File:** `src/orchestrator/multiAgentLoop.js:262`  
**Severity:** INFO  
**Description:**

```js
const parkSignal = getIdleParkingSignal(signals?.regime?.regime || "HOLD");
```

The variable `signals` is never defined in this scope. Should be `market.structuredSignals?.regime?.regime`. Currently caught by try/catch but produces incorrect idle parking behavior.

---

## Architecture Assessment

### Strengths

1. **Multi-agent consensus** — GLM-5 Analyst + Claude Validator + Gemini Arbiter. Three different providers, three different biases. Excellent hallucination defense.
2. **Zod validation** — All AI outputs are schema-validated before acting on them.
3. **Dynamic confidence threshold** — Self-adjusts after consecutive losses. Real risk management.
4. **Outcome tracking** — The settle-after-4h loop provides genuine P&L feedback, not just vibes.
5. **Position awareness** — Grid strategy knows if already in a position, prevents double-entry.
6. **Prompt evolution via IPFS** — Can upgrade analyst prompt without code deployment.
7. **Field normalizers** — Gracefully handles GLM-5's inconsistent output format.

### Weaknesses

1. **No circuit breaker** — If all 3 agents hallucinate the same direction (e.g., during flash crash), there's no hard stop besides confidence threshold.
2. **Single wallet** — One hot wallet for all operations. No multi-sig or time-lock.
3. **No monitoring/alerting** — Console.log only. No metrics export, no PagerDuty, no Telegram alerts on errors.
4. **File-based DB** (outcomes.json) — Race conditions possible if multiple instances run. Not atomic.

---

## Conclusion

The backend is well-architected for a hackathon project with real production-quality patterns (multi-agent consensus, Zod validation, outcome tracking). The main risks are operational (key management, nonce races) rather than algorithmic. No critical vulnerabilities that would allow fund theft or unauthorized execution — the dry-run default on ExecutionEngine is a strong safety net.

**Risk Rating: LOW-MEDIUM** — Suitable for testnet/demo. For mainnet with real funds, address M-1 (KMS integration), M-4 (nonce management), and add a circuit breaker.
