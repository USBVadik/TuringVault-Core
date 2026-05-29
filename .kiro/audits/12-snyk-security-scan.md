# Audit 12 — Snyk Security Scan (pre-submission)

**Date**: 2026-05-29
**Tool**: Snyk MCP (via Kiro Powers — Secure-at-Inception)
**Scope**: Full repo SAST + SCA + IaC surface
**Method**: `snyk_code_scan` and `snyk_sca_scan` invoked from this Kiro
session against the workspace at `/Users/usbdick/Documents/TuringVault-Core`.

---

## 1. SAST (Static Application Security Testing)

`snyk_code_scan` runs Snyk's SAST engine against source code. Severity
threshold: `low` (the most permissive — surfaces everything).

| Path | Findings |
|---|---|
| `src/` (orchestrator, dex, ipfs, evolution, kms, contracts logic) | **0** |
| `frontend/` (Next.js app, components, API routes) | **0** |
| `contracts/` (Solidity) | n/a — Snyk Code does not parse Solidity. Contracts are Sourcify-verified separately; on-chain code review is the gate for that surface. |

**Verdict**: clean. No SAST findings on JavaScript / TypeScript surface.

## 2. SCA (Software Composition Analysis)

Initial scan returned 3 medium-severity findings, all transitive.

| ID | Package@version | CVE | Severity | Introduced through |
|---|---|---|---|---|
| SNYK-JS-WS-16722635 | `ws@8.17.1` | CVE-2026-45736 | medium | `ethers@6.16.0` → `ws` |
| SNYK-JS-POSTCSS-16189065 | `postcss@8.4.31` | CVE-2026-41305 | medium | `next@16.2.6` → `postcss` |
| SNYK-JS-WS-16722635 (frontend) | `ws@8.17.1` | CVE-2026-45736 | medium | `ethers@6.16.0` → `ws` |

### Remediation

Both fixable via npm `overrides`. No breaking changes; these are minor
patches to transitive deps.

**Root `package.json`**:

```json
"overrides": {
  "ws": "^8.20.1"
}
```

**`frontend/package.json`**:

```json
"overrides": {
  "ws": "^8.20.1",
  "postcss": "^8.5.10"
}
```

After `npm install --legacy-peer-deps`:
- `ws` resolved to `8.21.0` (>= 8.20.1 fix line) in both root and frontend
- `postcss` resolved to `8.5.15` (>= 8.5.10 fix line) in frontend

### Re-scan verification

```
snyk_sca_scan --all-projects --severity-threshold low
→ {"success":true,"issueCount":0}
```

**0 findings** after remediation.

## 3. Validation that fixes did not break the build

| Check | Result |
|---|---|
| `npx jest` | ✅ 196/196 tests passing |
| `npx eslint src/ --max-warnings 50` | ✅ 0 errors / 47 warnings (under cap) |
| `npm install --legacy-peer-deps` (root) | ✅ install completed, no resolution errors |
| `npm install --legacy-peer-deps` (frontend) | ✅ "found 0 vulnerabilities" |

## 4. Surfaces explicitly out of scope here

- **Solidity contracts** — not parsable by Snyk Code. Already Sourcify-verified
  for 4 of 5 deployed contracts; on-chain audit trail is the appropriate
  evidence surface. See `.kiro/audits/04-on-chain.md`.
- **Container images** — none in this stack (Vercel + GH Actions, no Docker).
- **IaC** — no Terraform / CloudFormation / K8s manifests in repo.
- **Secrets surface** — covered separately by `.kiro/audits/11-secrets-and-supply.md`.

## 5. Submission stance

This audit is part of the pre-submission security pass for the Mantle
Turing Test 2026 (AI x RWA Track). All known dependency vulnerabilities
have been remediated; SAST surface is clean. The repo carries no high or
critical severity findings on any scannable surface as of 2026-05-29.

---

## Files changed by this audit

- `package.json` — added `overrides.ws`
- `frontend/package.json` — added `overrides.ws` and `overrides.postcss`
- `package-lock.json` and `frontend/package-lock.json` — regenerated
- `.kiro/audits/12-snyk-security-scan.md` — this report
