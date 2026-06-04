# Judge Verification Path

Observed snapshot: 2026-06-04 17:05 UTC. Refresh live counters before final video or DoraHacks paste.

This page is intentionally practical: a judge should be able to verify the core claims in about one minute without private access.

---

## 1. Live Health

Open:

https://frontend-seven-beta-46.vercel.app/api/health

What to check:

- `mode` is `cron-github-actions`
- `lastCycleAge` is recent, or the UI labels the feed IDLE / STALE / OFFLINE honestly
- `cyclesSucceeded24h` and `cyclesFailed24h` describe cron cycles, not trades
- `gasRunway.status` is `ok`

Observed 2026-06-04 17:05 UTC:

```text
cyclesSucceeded24h  32
cyclesFailed24h      0
parseSuccessRate24h  100%
gasRunway.status     ok
lastCycleAge          about 92 min
```

---

## 2. Latest Pinned Executed Cycle

Use cycle `265` for the current demo recording.

Open:

https://frontend-seven-beta-46.vercel.app/replay/265

Why this cycle:

- `decisionTier`: `EXECUTED_SWAP`
- `action`: `swap`
- `targetAsset`: `MNT`
- Discipline Layer: `tx_proof PASS`, `price_freshness PASS`, `drift_detection PASS`
- Replay manifest exists in the public repo:
  `.kiro/audits/raw/replay-manifests/cycle-0265.json`

On-chain anchor from the manifest:

```text
DecisionLog tx  0x1aeef292d1769fd232a1038b71fb846be98144fd568dea5c6afa40a288e4d55e
IPFS CID        Qmd9nmbipfpP2gmaYXw2BsKzqANdbNHd4457oVgKPmUcdZ
manifestHash    0x77791edab02aa341a3e8ab97bc6846ad3b14d707421b3f11bd8acebb6f58193c
combinedAnchor  0xdccb79defcae51644fa4741aa78f50b5019be1a2891a6e219a0c20a2e22ade95
```

Mantle transaction:

https://explorer.mantle.xyz/tx/0x1aeef292d1769fd232a1038b71fb846be98144fd568dea5c6afa40a288e4d55e

---

## 3. Latest Pinned Protected-Capital Block

Use cycle `266` for the current demo recording.

Open:

https://frontend-seven-beta-46.vercel.app/replay/266

Why this cycle:

- `decisionTier`: `BLOCKED_BY_VALIDATOR`
- `action`: proposed swap
- `targetAsset`: `MNT`
- settled outcome: `CORRECT_BLOCK`
- outcome score: `+86 bps`
- no executed transaction is claimed

This is the core story: the agent found a potential grid entry, the validator challenged it, the system refused execution, and the later settlement marked the refusal as correct.

Replay manifest:

`.kiro/audits/raw/replay-manifests/cycle-0266.json`

---

## 4. Proof Explorer

Open:

https://frontend-seven-beta-46.vercel.app/proof-explorer

What to check:

- DecisionLog row count is labelled separately from ValidationRegistry proposal counters.
- Historical showcase cards are labelled as historical, not live proof.
- Protected-capital examples do not claim execution.

Observed 2026-06-04 17:05 UTC:

```text
DecisionLog rows              288
ValidationRegistry proposals  289
Approved                      213
Rejected                       76
```

---

## 5. Core Contracts

DecisionLog:

https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5

ValidationRegistry:

https://explorer.mantle.xyz/address/0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6

ReputationRegistry:

https://explorer.mantle.xyz/address/0xC78119F3274B05046Ac7c38a14298a6cbD946e1a

Identity NFT:

https://explorer.mantle.xyz/address/0x6f862802e0d5463DF18d267e422347BeCacc28bD

---

## 6. Public Automation

Agent Cycle workflow:

https://github.com/USBVadik/TuringVault-Core/actions/workflows/agent-cycle.yml

Replay Validator workflow:

https://github.com/USBVadik/TuringVault-Core/actions/workflows/replay-validator.yml

Honest framing:

- GitHub Actions is a best-effort public cron, not a guaranteed daemon.
- `/api/health.lastCycleAge` is the source of truth for freshness.
- Cycles are not trades; swaps are a subset of cycles.
