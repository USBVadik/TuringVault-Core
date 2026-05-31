/**
 * Outcomes integrity invariants.
 *
 * Defends the project's defining narrative — adversarial validation
 * + cryptographically-proven on-chain attestation — against the
 * exact class of bug we caught manually in cycles 113-122
 * (.kiro/audits/2026-05-28-trading-unblock.md): the cron commit
 * said `EXECUTED_SWAP` while no DEX TX had been broadcast. UI then
 * advertised a fake green "swap executed" badge.
 *
 * The invariant: any row in `src/data/outcomes.json` pending or settled
 * displayed to the user as `EXECUTED_SWAP` MUST be backed by a
 * real on-chain TX (executedOnChain=true AND a 32-byte tx hash on
 * the first directional swap leg). A drift here is a P0 honesty-
 * rule violation per `.kiro/steering/no-lying-about-state.md`.
 *
 * Why we check `_displayTier` rather than `decisionTier`:
 *   - `decisionTier` is what the classifier stamped at decision
 *     time; for the historical pre-fix window (decisionIds 47-122)
 *     the classifier itself was the bug — it wrote `EXECUTED_SWAP`
 *     for cycles where no broadcast happened.
 *   - The repair commit (`145388a`) backfilled `_displayTier`
 *     across those rows so the dashboard renders them honestly as
 *     `INTENT_SWAP_NO_EXEC`. The frontend reads `_displayTier ||
 *     decisionTier` (see `frontend/app/api/decisions/route.ts`).
 *   - `_displayTier` is what a judge actually sees. It is the
 *     correct surface to invariant-check.
 *
 * What we tolerate:
 *   - Legacy rows from the pre-`decisionTier` schema that have
 *     neither `decisionTier` nor `_displayTier` are skipped (single
 *     decisionId=100 row at time of writing).
 *   - HEARTBEAT_SWAP rows are checked separately because they are
 *     allowed to bypass adversarial consensus (gated path; see
 *     `src/orchestrator/heartbeatMode.js`) but MUST still produce
 *     a real on-chain TX.
 */

const fs = require("fs");
const path = require("path");

const TX_HASH_RE = /^0x[a-f0-9]{64}$/i;

function loadOutcomes() {
  const p = path.resolve(__dirname, "../../src/data/outcomes.json");
  const raw = fs.readFileSync(p, "utf-8");
  const parsed = JSON.parse(raw);
  return [
    ...(Array.isArray(parsed.settled) ? parsed.settled : []),
    ...(Array.isArray(parsed.pending) ? parsed.pending : []),
  ];
}

function effectiveTier(row) {
  if (!row) return null;
  // Frontend honest-display priority: _displayTier overrides
  // decisionTier when the latter was set optimistically.
  if (row._displayTier === undefined || row._displayTier === null) {
    return row.decisionTier || null;
  }
  return row._displayTier;
}

function firstLegTxHash(row) {
  return row?.directionalSwap?.legs?.[0]?.txHash || null;
}

function hasFailedExecutionProof(row) {
  const checks = row?.disciplineDetail?.checks;
  if (!Array.isArray(checks)) return false;
  return checks.some(
    (c) =>
      ["tx_proof", "tx_exists", "tx_sender", "tx_confirmed", "tx_success"].includes(
        c?.name
      ) && ["FAIL", "ERROR"].includes(c?.status)
  );
}

describe("outcomes integrity invariants", () => {
  const settled = loadOutcomes();

  test("outcome rows are a non-empty array", () => {
    expect(Array.isArray(settled)).toBe(true);
    expect(settled.length).toBeGreaterThan(0);
  });

  test("every EXECUTED_SWAP-displayed row has executedOnChain=true", () => {
    const offenders = settled.filter(
      (r) => effectiveTier(r) === "EXECUTED_SWAP" && r.executedOnChain !== true
    );
    if (offenders.length > 0) {
      // Print a useful failure so the operator can backfill.
      console.error(
        `[outcomesIntegrity] EXECUTED_SWAP without executedOnChain — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          decisionTier: r.decisionTier,
          _displayTier: r._displayTier,
          executedOnChain: r.executedOnChain,
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("every EXECUTED_SWAP-displayed row has a 32-byte first-leg tx hash", () => {
    const offenders = settled.filter((r) => {
      if (effectiveTier(r) !== "EXECUTED_SWAP") return false;
      const tx = firstLegTxHash(r);
      return !tx || !TX_HASH_RE.test(tx);
    });
    if (offenders.length > 0) {
      console.error(
        `[outcomesIntegrity] EXECUTED_SWAP without 32-byte first-leg txHash — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          firstLegTx: firstLegTxHash(r),
          legCount: r?.directionalSwap?.legs?.length,
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("every EXECUTED_SWAP-displayed row has directionalSwap.executed=true", () => {
    const offenders = settled.filter((r) => {
      if (effectiveTier(r) !== "EXECUTED_SWAP") return false;
      return r?.directionalSwap?.executed !== true;
    });
    if (offenders.length > 0) {
      console.error(
        `[outcomesIntegrity] EXECUTED_SWAP with directionalSwap.executed!=true — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          directionalSwapExecuted: r?.directionalSwap?.executed,
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("every EXECUTED_SWAP-displayed row has no failed execution proof", () => {
    const offenders = settled.filter(
      (r) => effectiveTier(r) === "EXECUTED_SWAP" && hasFailedExecutionProof(r)
    );
    if (offenders.length > 0) {
      console.error(
        `[outcomesIntegrity] EXECUTED_SWAP with failed tx proof — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          disciplineStatus: r.disciplineStatus,
          proofChecks: (r?.disciplineDetail?.checks || [])
            .filter((c) => String(c?.name || "").startsWith("tx_"))
            .map((c) => `${c.name}:${c.status}`),
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("HEARTBEAT_SWAP rows are checked under the same on-chain rule", () => {
    // HEARTBEAT_SWAP bypasses consensus by design (heartbeatMode.js)
    // but it MUST still produce a real on-chain TX. A heartbeat row
    // with executedOnChain=false would be the same class of lie as
    // the cycle-113-122 bug.
    const offenders = settled.filter(
      (r) =>
        effectiveTier(r) === "HEARTBEAT_SWAP" &&
        (r.executedOnChain !== true ||
          !TX_HASH_RE.test(firstLegTxHash(r) || ""))
    );
    if (offenders.length > 0) {
      console.error(
        `[outcomesIntegrity] HEARTBEAT_SWAP without on-chain tx — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          executedOnChain: r.executedOnChain,
          firstLegTx: firstLegTxHash(r),
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("INTENT_SWAP_NO_EXEC rows correctly admit no broadcast", () => {
    // Mirror invariant: rows displayed as INTENT_SWAP_NO_EXEC MUST
    // NOT carry executedOnChain=true. This catches a row that was
    // backfilled in the wrong direction.
    const offenders = settled.filter(
      (r) =>
        effectiveTier(r) === "INTENT_SWAP_NO_EXEC" && r.executedOnChain === true
    );
    if (offenders.length > 0) {
      console.error(
        `[outcomesIntegrity] INTENT_SWAP_NO_EXEC marked executedOnChain=true — ${offenders.length} row(s):`,
        offenders.slice(0, 5).map((r) => ({
          decisionId: r.decisionId,
          executedOnChain: r.executedOnChain,
        }))
      );
    }
    expect(offenders).toEqual([]);
  });

  test("legacy schema rows without decisionTier are tolerated", () => {
    // These exist for the very first cycles before decisionTier
    // was introduced. They must NOT carry an EXECUTED_SWAP flag in
    // any other surface field. We accept them as opaque hold rows.
    const orphans = settled.filter(
      (r) => !r.decisionTier && !r._displayTier
    );
    // Sanity: no orphan with executedOnChain=true (would mean a
    // pre-tier swap that escaped classification).
    const naughtyOrphans = orphans.filter((r) => r.executedOnChain === true);
    expect(naughtyOrphans).toEqual([]);
  });
});
