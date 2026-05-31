# Post-Fix Adversarial Big Audit

**Scope:** commit `e6bc1b4` plus live production probes after push. Reviewed cron bridge, proof/Sourcify honesty, secret scanner, execution guardrails, risk-asset routing, and public audit status.
**CodeRabbit:** `coderabbit review --agent --base-commit 9dc2418` completed with `findings:0`.
**Verdict:** CONCERNS

## Critical Findings

None in the committed code diff. The tests, lint, build, and CodeRabbit review did not surface a merge-blocking code defect.

## Warnings

1. Live Vercel cron bridge is not operational yet.
   `/api/cron/trigger-cycle` returned HTTP 500 at `2026-05-31T20:31:57Z` with `CRON_SECRET not configured`. The repo now has the bridge and stale-cycle policy, but production will not use it until Vercel env vars `CRON_SECRET` and `GH_DISPATCH_TOKEN` are set and the endpoint is re-probed with Authorization.

2. Live Proof Explorer still serves stale Sourcify copy.
   The repo derives `6 contracts · 5/6 Sourcify-verified`, and Sourcify live confirms 5 perfect plus Router false. The public page still rendered old `5 contracts · 4 Sourcify-verified` copy from Vercel cache/build at the post-push probe. This is an honesty-surface risk until deployment/cache is verified.

3. Secret scanner fix is safer for TX hashes but weaker for unlabeled raw keys.
   `check-secrets.sh` no longer fails on generic `0x[a-fA-F0-9]{64}` values. That removes false positives on transaction hashes, but an unlabeled private-key-shaped value can now exit 0 unless it appears in a named assignment such as `PRIVATE_KEY=...`. Add contextual allowlists or entropy/path rules so high-confidence secrets still fail.

4. Audit status is now less accurate than the code.
   Several `99-consolidated.md`/Audit25 rows still read `open` even after later fixes (`threat-1`, `threat-3`, `P1-1`, `P1-2`, `api-10`). This will confuse an external reviewer because grep evidence and live probes contradict the status table.

5. Risk-on routing is capable but still signal-gated, not forced.
   The execution path can buy `WMNT` and can route `USDT0 -> USDT -> WMNT -> mETH` for mETH targets. It also normalizes legacy `ETH` to `mETH`. But the bot will only buy when the multi-agent consensus emits `swap` with a risk-on target and portfolio/risk gates allow it. Latest live cycle was `BLOCKED_BY_PORTFOLIO`, so there is no guarantee the next cycle buys risk assets.

## Notes

- The user's Mantle clarification is reflected by current code behavior: there is no native ETH execution path; `ETH` is a legacy alias normalized to `mETH`, while executable risk assets are `WMNT`, `MNT` via wrapping where appropriate, `mETH`, and `WETH` as an analyst/source alias.
- `walletRouter.js` comments mention a risk-on native-MNT wrapping fallback, but the current `risk-on` implementation only uses `USDT0` or `USDT` as funding sources. That is fine for the current stable-heavy wallet, but the comment should be corrected or implemented later.
- Vercel cron dispatches on health-unavailable by design. This is useful as a rescue path, but if `/api/health` has transient failures near a GitHub schedule slot, the GitHub workflow concurrency group is the main duplicate-run mitigation.

## Summary

The important trading blocker is no longer "the code cannot buy risk." The code can execute risk-on paths against Mantle's real liquid assets (`WMNT`/`mETH`, not native ETH), and the portfolio guard prevents repeated stable exits when already stable-heavy. The remaining risks are mostly operational honesty: production Vercel envs/deploy cache, stale audit rows, and making the secret scanner strict without reviving TX-hash false positives.

