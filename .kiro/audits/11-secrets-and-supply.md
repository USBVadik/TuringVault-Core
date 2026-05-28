# 11 — Secrets + Supply-Chain Audit

| Meta | Value |
|------|-------|
| Auditor | Kiro (operator-supervised) |
| Date | 2026-05-28 |
| Scope | Repo-wide secret-leak scan; .gitignore coverage; npm audit (root + frontend); env-var read trace; Pinata JWT expiry; cross-ref with R10 env drift |
| Re-audit context | T13 in `.kiro/specs/system-audit-pre-submission/tasks.md` was marked SHIPPED but `11-secrets-and-supply.md` was absent. See M-1 in `04-on-chain.md`. |

---

## Git History Secret Scan

Method: `git log --all -p` filtered for AWS access keys, EVM private keys (0x + 64 hex), and JWT prefixes.

| Pattern | Pattern regex | Hits in history |
|---------|---------------|----------------:|
| AWS access key | `AKIA[0-9A-Z]{16}` | 0 |
| 64-hex token after `=` | `^.*=0x[0-9a-fA-F]{64}$` | 0 |
| JWT-shaped string in source | `eyJhbGciOi[A-Za-z0-9._-]+\.eyJ[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+` (excluding `.env`) | 0 |
| `.env`, `.env-turingvault` ever committed | path filter | 0 |

Manual cross-check: `git log --all --pretty=format:%H -- .env .env-turingvault gemini-service-account.json` returns 0 commits. Files have always been in `.gitignore` and have never been added.

The `git log -p -G '(VERCEL_TOKEN|PRIVATE_KEY|AWS_SECRET_ACCESS_KEY|PINATA_JWT)'` scan returns only references like `process.env.PRIVATE_KEY` — i.e. variable name lookups, never values.

**Verdict:** clean. No active credential has been committed in the public history.

---

## .gitignore Coverage

Required entries (from R12 spec):

| Entry | Present | Notes |
|-------|---------|-------|
| `.env` | ✅ |  |
| `.env*` (wildcard) | ✅ |  |
| `.env-turingvault` (explicit) | ✅ | Belt-and-braces with `.env*` glob |
| `gemini-service-account.json` | ✅ | Cron writes this at workflow runtime |
| `src/data/raw_model_outputs/*` | ✅ | with `!.gitkeep` |
| `cache/`, `artifacts/`, `coverage/`, `.next/` | ✅ |  |

Implicit risks I checked:
- `.kiro/audits/raw/` — **not in .gitignore**. Today this only contains a few HTML snapshots from the original audit; no secrets in them. Recommendation: leave as-is but periodically grep for token patterns before committing audit artifacts (audit-style steering already enforces this culturally).

---

## NPM Audit

```bash
$ npm audit --omit=dev          # repo root
2 moderate severity vulnerabilities

$ npm audit --omit=dev          # frontend/
4 moderate severity vulnerabilities
```

Both sets boil down to a single transitive issue:

| Package | Path | Severity | Advisory |
|---------|------|----------|----------|
| `ws` | `ethers > ws` | moderate | GHSA-58qx-3vcg-4xpx (uninitialized memory disclosure) |

The fix path is `npm audit fix --force` which would downgrade `ethers` to `5.8.0`. We use `ethers` v6 in non-trivial ways (`parseUnits`, `JsonRpcProvider`, `Wallet`, `formatUnits`, `Contract` calls, `MaxUint256`, `keccak256`, `toUtf8Bytes` etc.). A v5 downgrade is a **breaking** change across `src/dex/merchantMoe.js`, `src/orchestrator/multiAgentLoop.js`, `src/orchestrator/disciplineLayer.js`, `scripts/probe-*.js`, `frontend/app/api/decisions/route.ts`, and ~10 other call sites.

The `ws` advisory itself describes a server-side memory leak in WebSocket message processing. Our `ethers` usage is JSON-RPC over HTTP, not WebSocket; we never pass user-controlled buffers into a `ws` server. Practical attack surface from this repo's code: zero.

**Decision:** accept-and-document. Track upstream `ethers` for v6.x patch that bumps `ws`. Re-audit at submission close.

---

## Secret-Flow Trace

For each `process.env.<KEY>` read, can the value reach an HTTP response or log line?

| Env name | Read site(s) | Used for | Reaches HTTP response? | Reaches log? |
|----------|-------------|----------|:---:|:---:|
| `PRIVATE_KEY` | `multiAgentLoop.js`, `disciplineLayer.js`, `merchantMoe.js`, `liveGridBot.js`, `usdt0Module.js`, `scripts/probe-*` | Wallet signer instantiation only | No | No (we log `wallet.address` only) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Bedrock client init in `analystGLM.js`, `claudeValidator.js`, etc. | AWS SDK auth | No | No |
| `PINATA_JWT` | `src/ipfs/storage.js` | Pinata HTTP Authorization header | No | No |
| `NANSEN_API_KEY` | `src/data/nansenMCP.js` | Nansen header | No | No |
| `ELFA_API_KEY` | `src/data/elfa.js` | Elfa header | No | No |
| `GEMINI_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | `src/orchestrator/geminiArbiter.js` | GCP auth | No | No |
| `MANTLE_RPC_URL` | every Mantle-touching file | RPC URL | No (URL itself is a public Mantle endpoint) | URL is logged occasionally — not sensitive |
| `VERCEL_TOKEN` | local `.env` only, **not read** in `src/` | Used only by `curl` from the operator's terminal | No | No |
| `RWA_EXECUTE_ENABLED`, `AGENT_RUN_MODE` | feature flag reads | gating logic | Yes (flags are **booleans**, not secrets) | Yes, by design |

`/api/health` route was specifically inspected: it reads `process.env.AGENT_RUN_MODE` (boolean-ish, intentionally exposed), and otherwise reads files. It does not echo any secret env into the response.

`run-cycle.js` has an explicit comment: "env values are NEVER printed. Do not add console.log of process.env.* here." Verified — no `console.log(process.env.*)` exists anywhere in `scripts/run-cycle.js` or downstream.

Workflow `agent-cycle.yml` writes `gemini-service-account.json` from `GOOGLE_APPLICATION_CREDENTIALS_JSON` secret and **deletes the file before any `git add`** (line 91 in workflow). Defense-in-depth.

---

## Pinata JWT Status

Decoded via `node scripts/audit/decode-jwt.js PINATA_JWT` (script never echoes the token).

| Field | Value |
|-------|-------|
| `iat` | 2026-05-20 (issued ~8 days ago) |
| `exp` | 2027-05-20T20:12:54Z |
| `expires in` | 357.2 days |

No imminent expiry; we'd see plenty of warning if it rotated.

---

## Cross-ref with R10 Env Drift

`.kiro/audits/09-cron-vercel-bridge.md` table claims Vercel only carries 2 envs (`NEXT_PUBLIC_BASE_URL`, `ELFA_API_KEY`) while GH Actions carries 13. We re-listed Vercel envs via the Vercel projects API at `2026-05-28T15:32Z` and observed the same: 2 sensitive entries on Vercel (NEXT_PUBLIC_BASE_URL is a sensitive marker but the value is empty per project response — likely a placeholder).

This is **not** a security risk. The frontend reads state files from disk (which on Vercel doesn't exist → falls back to GitHub raw). It does not need most of the cron secrets. P2-7 in the consolidated report ("Only 2 env vars on Vercel vs 13 on GH Actions") was correctly classified as **acceptable**.

---

## Findings

### P0 — none
No active credential is committed; every secret read can be traced to a non-leaking sink.

### P1 — `ws` transitive vulnerability (moderate, accepted)
- **Surface:** `npm audit` root + frontend
- **Practical risk:** none for our usage pattern (JSON-RPC over HTTP only)
- **Action:** track upstream `ethers` v6 patch. Re-audit at submission close.
- **Status:** accepted-and-documented.

### P1 — `.kiro/audits/raw/` not in `.gitignore`
- **Surface:** repo policy
- **Risk:** if a future audit pass captures an API response containing a token in a header, it could land in a commit.
- **Mitigation already in place:** check-secrets.sh exists; audit-style steering instructs scanning every captured response.
- **Status:** open, P2 actually — escalate only if a future audit captures a real secret.

### Meta-finding M-1 (cont.)
- T13 file existed in plan, never on disk, was claimed SHIPPED.
- Closed by this report.

---

## Not Checked

| Item | Reason |
|------|--------|
| Vercel project env values themselves | Out of scope; we never fetch env values via the Vercel API. We probe names only. |
| Bedrock/Gemini IAM permission boundary | Beyond hackathon scope. Both keys are scoped (per ops-brief) to model invocations; no S3/STS access. |
| GitHub Actions OIDC vs static secrets | Static secrets are used. OIDC migration is a post-submission improvement (P3). |
| Active scan for token-shaped strings inside `node_modules/` | Too noisy; not part of the spec. |
