const { buildSummary } = require("../../frontend/app/lib/discipline-summary.shared.js");

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
});
