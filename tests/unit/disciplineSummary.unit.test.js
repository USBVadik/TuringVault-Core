const {
  buildSummary,
  enrichHistoryWithOutcomes,
} = require("../../frontend/app/lib/discipline-summary.shared.js");

describe("discipline summary", () => {
  test("separates executed swaps from hold cycles", () => {
    const summary = buildSummary([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 1,
        verdict: "ACCEPTED",
        checks: [
          { name: "tx_proof", status: "SKIP", detail: "Hold action — no tx to verify" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 2,
        verdict: "ACCEPTED",
        checks: [
          { name: "tx_proof", status: "PASS", detail: "tx confirmed" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
    ]);

    expect(summary.cyclesWithTx).toBe(1);
    expect(summary.cyclesWithoutTx).toBe(1);
    expect(summary.txProofPassCount).toBe(1);
    expect(summary.txProofSkipCount).toBe(1);
    expect(summary.txProofPassRateExecutedOnly).toBe(100);
    expect(summary.gatePassRates.tx_proof).toBe(100);
  });

  test("uses executed-only denominator for pass rate", () => {
    const summary = buildSummary([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 1,
        verdict: "ACCEPTED",
        checks: [{ name: "tx_proof", status: "PASS" }],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 2,
        verdict: "BLOCKED",
        checks: [{ name: "tx_proof", status: "FAIL" }],
      },
    ]);

    expect(summary.cyclesWithTx).toBe(2);
    expect(summary.cyclesWithoutTx).toBe(0);
    expect(summary.txProofPassCount).toBe(1);
    expect(summary.txProofFailCount).toBe(1);
    expect(summary.txProofPassRateExecutedOnly).toBe(50);
    expect(summary.gatePassRates.tx_proof).toBe(50);
  });

  test("counts tx proof ERROR as an executed proof failure", () => {
    const summary = buildSummary([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 1,
        verdict: "ACCEPTED",
        checks: [{ name: "tx_proof", status: "PASS" }],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 2,
        verdict: "ACCEPTED",
        checks: [{ name: "tx_proof", status: "ERROR" }],
      },
    ]);

    expect(summary.cyclesWithTx).toBe(2);
    expect(summary.cyclesWithoutTx).toBe(0);
    expect(summary.txProofPassCount).toBe(1);
    expect(summary.txProofFailCount).toBe(1);
    expect(summary.txProofErrorCount).toBe(1);
    expect(summary.txProofPassRateExecutedOnly).toBe(50);
    expect(summary.gatePassRates.tx_proof).toBe(50);
  });

  test("all skipped tx proofs produce null executed-only rate", () => {
    const summary = buildSummary([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 1,
        verdict: "ACCEPTED",
        checks: [{ name: "tx_proof", status: "SKIP" }],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 2,
        verdict: "ACCEPTED",
        checks: [{ name: "tx_proof", status: "SKIP" }],
      },
    ]);

    expect(summary.cyclesWithTx).toBe(0);
    expect(summary.cyclesWithoutTx).toBe(2);
    expect(summary.txProofSkipCount).toBe(2);
    expect(summary.txProofPassRateExecutedOnly).toBeNull();
    expect(summary.gatePassRates.tx_proof).toBeNull();
  });

  test("handles non-array history without fabricating timestamps", () => {
    const summary = buildSummary(null);

    expect(summary.totalEntries).toBe(0);
    expect(summary.firstCycleAt).toBeNull();
    expect(summary.latestCycleAt).toBeNull();
    expect(summary.txProofPassRateExecutedOnly).toBeNull();
  });

  test("counts blocked decision tiers separately from post-check pass verdicts", () => {
    const summary = buildSummary([
      {
        at: "2026-06-04T00:00:00Z",
        decisionId: 10,
        verdict: "ACCEPTED",
        decisionTier: "BLOCKED_BY_REGIME",
        displayTier: "BLOCKED_BY_REGIME",
        checks: [
          { name: "tx_proof", status: "SKIP", detail: "No execution expected" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
      {
        at: "2026-06-04T00:30:00Z",
        decisionId: 11,
        verdict: "ACCEPTED",
        decisionTier: "HEARTBEAT_SWAP",
        displayTier: "HEARTBEAT_SWAP",
        checks: [
          { name: "tx_proof", status: "PASS", detail: "tx confirmed" },
          { name: "price_freshness", status: "PASS" },
          { name: "drift_detection", status: "PASS" },
        ],
      },
    ]);

    expect(summary.acceptedCount).toBe(2);
    expect(summary.decisionBlockedCount).toBe(1);
    expect(summary.executedSwapCount).toBe(1);
    expect(summary.holdNoSwapCount).toBe(0);
  });

  test("enriches discipline history with decision tier and re-proofed tx checks from outcomes", () => {
    const [entry] = enrichHistoryWithOutcomes(
      [
        {
          at: "2026-06-04T00:00:00Z",
          decisionId: 42,
          verdict: "ACCEPTED",
          checks: [
            { name: "tx_proof", status: "SKIP", detail: "Hold action — no tx to verify" },
            { name: "price_freshness", status: "PASS" },
            { name: "drift_detection", status: "PASS" },
          ],
        },
      ],
      [
        {
          decisionId: 42,
          decisionTier: "HEARTBEAT_SWAP",
          _displayTier: "HEARTBEAT_SWAP",
          executedOnChain: true,
          disciplineDetail: {
            checks: [
              { name: "tx_exists", status: "PASS", detail: "Block 123" },
              { name: "tx_sender", status: "PASS", detail: "Matches vault wallet" },
              { name: "tx_confirmed", status: "PASS", detail: "2 confirmations" },
              { name: "tx_success", status: "PASS", detail: "TX successful" },
              { name: "tx_proof", status: "PASS", detail: "Re-proofed during outcome settlement" },
            ],
          },
        },
      ]
    );

    expect(entry.decisionTier).toBe("HEARTBEAT_SWAP");
    expect(entry.displayTier).toBe("HEARTBEAT_SWAP");
    expect(entry.executedOnChain).toBe(true);
    expect(entry.checks.find((check) => check.name === "tx_proof")?.status).toBe("PASS");
    expect(entry.checks.find((check) => check.name === "tx_exists")?.status).toBe("PASS");
  });

  test("adds an explicit skipped tx proof for blocked no-execution rows", () => {
    const [entry] = enrichHistoryWithOutcomes(
      [
        {
          at: "2026-06-04T00:00:00Z",
          decisionId: 43,
          verdict: "ACCEPTED",
          checks: [
            { name: "price_freshness", status: "PASS" },
            { name: "drift_detection", status: "PASS" },
          ],
        },
      ],
      [
        {
          decisionId: 43,
          decisionTier: "BLOCKED_BY_REGIME",
          _displayTier: "BLOCKED_BY_REGIME",
          executedOnChain: false,
        },
      ]
    );

    const txProof = entry.checks.find((check) => check.name === "tx_proof");
    expect(txProof?.status).toBe("SKIP");
    expect(txProof?.detail).toMatch(/BLOCKED_BY_REGIME/);
  });

  test("rewrites stale executed tx skip copy to intent-only display tier", () => {
    const [entry] = enrichHistoryWithOutcomes(
      [
        {
          at: "2026-06-09T14:07:03Z",
          decisionId: 413,
          verdict: "ACCEPTED",
          decisionTier: "EXECUTED_SWAP",
          displayTier: "EXECUTED_SWAP",
          executedOnChain: false,
          checks: [
            {
              name: "tx_proof",
              status: "SKIP",
              detail: "EXECUTED_SWAP — No execution transaction expected for this cycle",
            },
            { name: "price_freshness", status: "PASS" },
            { name: "drift_detection", status: "PASS" },
          ],
        },
      ],
      [
        {
          decisionId: 413,
          decisionTier: "EXECUTED_SWAP",
          _displayTier: "INTENT_SWAP_NO_EXEC",
          executedOnChain: false,
        },
      ]
    );

    expect(entry.displayTier).toBe("INTENT_SWAP_NO_EXEC");
    const txProof = entry.checks.find((check) => check.name === "tx_proof");
    expect(txProof?.status).toBe("SKIP");
    expect(txProof?.detail).toMatch(/INTENT_SWAP_NO_EXEC/);
    expect(txProof?.detail).not.toMatch(/EXECUTED_SWAP/);
  });

  test("falls back to cycle history tier when outcomes row is missing", () => {
    const [entry] = enrichHistoryWithOutcomes(
      [
        {
          at: "2026-06-04T00:00:10Z",
          decisionId: 44,
          verdict: "ACCEPTED",
          checks: [{ name: "tx_proof", status: "SKIP" }],
        },
      ],
      [],
      [
        {
          cycleEndedAt: "2026-06-04T00:00:12Z",
          decisionTier: "BLOCKED_BY_REGIME",
        },
      ]
    );

    expect(entry.displayTier).toBe("BLOCKED_BY_REGIME");
    expect(entry.decisionTier).toBe("BLOCKED_BY_REGIME");
    expect(entry.checks.find((check) => check.name === "tx_proof")?.detail).toMatch(
      /BLOCKED_BY_REGIME/
    );
  });
});
