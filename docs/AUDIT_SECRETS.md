# TuringVault Secrets Scan Report

**Date:** 2026-05-23  
**Scope:** Full repository (all files, git history)  
**Auditor:** Hermes Agent (automated)  
**Overall Risk:** LOW

---

## Summary

No hardcoded secrets, API keys, or private keys found in source code or git history.
The project follows proper secret hygiene.

---

## Findings

### PASS — .env Not Committed

- `.gitignore` correctly excludes `.env`
- Git history shows only `.env.example` was ever committed (commit f2e6390)
- `.env.example` contains placeholder values only ("your_xxx_here")

### PASS — No Hardcoded API Keys

Scanned for patterns:

- AWS Access Key IDs (AKIA...) — NOT FOUND
- Nansen keys (nsn\_...) — NOT FOUND
- OpenAI keys (sk-...) — NOT FOUND
- JWT tokens (eyJ...) — NOT FOUND
- Pinata tokens — NOT FOUND

### PASS — No Private Keys in Source

- All `PRIVATE_KEY` references use `process.env.PRIVATE_KEY`
- The 64-char hex string in `tencentKMS.js` is the secp256k1 curve order constant (public math value, not a key)
- Transaction hashes in `outcomes.json` are public on-chain data (not secrets)

### PASS — Frontend Has No Exposed Secrets

- No `NEXT_PUBLIC_` env vars with sensitive data
- Frontend reads on-chain data via public RPC only
- API routes in `/app/api/` do server-side calls only (not exposed to client)

### PASS — Hardhat Config Safe

- Uses `process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []` — safe empty default
- Etherscan API key also from env vars

---

## Observations (Non-Critical)

### [INFO-1] Data Files Contain On-Chain Transaction Hashes

**File:** `src/data/outcomes.json`  
These are public blockchain transactions, not secrets. However, they reveal wallet activity patterns if the repo becomes public. Acceptable for hackathon submission.

### [INFO-2] Contract Addresses Are Public

Multiple contract addresses hardcoded in source. These are intentionally public (deployed on-chain, verified on Sourcify). Not a secret exposure.

### [INFO-3] .gitignore Covers Internal Docs

Good practice — `docs/internal/`, `CLAUDE.md`, deep research briefs are excluded from git. Reduces information leakage about strategy/approach.

---

## Recommendations

1. **Before making repo public:** Run `git log --all -p | grep -i "private\|secret\|key\|password"` one final time to catch any accidental commits in branches.
2. **Consider:** Adding a pre-commit hook (e.g., `detect-secrets` or `gitleaks`) to prevent future accidental secret commits.
3. **Production:** Rotate all keys that were ever used on this development machine after hackathon submission.

---

## Conclusion

**CLEAN** — No secrets exposed. Repository is safe for public submission.
