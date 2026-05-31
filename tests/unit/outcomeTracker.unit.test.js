/**
 * Unit tests for asset-aware outcome settlement helpers.
 */

const {
  inferSettlementAsset,
  isRiskOnTarget,
  computePriceMoveOutcome,
  deriveExecutionProofStatus,
  refreshExecutionProof,
} = require("../../src/orchestrator/outcomeTracker");

describe("outcomeTracker settlement asset helpers", () => {
  test("maps Mantle ETH exposure to a WETH/ETH benchmark, never naked ETH", () => {
    expect(inferSettlementAsset("mETH")).toBe("WETH");
    expect(inferSettlementAsset("WETH")).toBe("WETH");
    expect(inferSettlementAsset("ETH")).toBe("WETH");
  });

  test("maps MNT and WMNT to the MNT benchmark", () => {
    expect(inferSettlementAsset("MNT")).toBe("MNT");
    expect(inferSettlementAsset("WMNT")).toBe("MNT");
  });

  test("settles stable risk-off against the source risk asset", () => {
    expect(inferSettlementAsset("mUSD", "mETH", "WMNT")).toBe("MNT");
    expect(inferSettlementAsset("mUSD", "mETH", "mETH")).toBe("WETH");
  });

  test("treats mETH/WETH and MNT/WMNT as risk-on targets", () => {
    expect(isRiskOnTarget("mETH")).toBe(true);
    expect(isRiskOnTarget("WETH")).toBe(true);
    expect(isRiskOnTarget("MNT")).toBe(true);
    expect(isRiskOnTarget("WMNT")).toBe(true);
    expect(isRiskOnTarget("mUSD")).toBe(false);
  });
});

describe("computePriceMoveOutcome", () => {
  test("scores MNT upside as GOOD_CALL for an approved risk-on swap", () => {
    const result = computePriceMoveOutcome({
      consensus: true,
      targetAsset: "MNT",
      confidence: 0.6,
      priceAtDecision: 0.65,
      currentPrice: 0.70,
    });

    expect(result.outcome).toBe("GOOD_CALL");
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.pnlBps).toBeGreaterThan(0);
  });

  test("scores stable target correctly as risk-off when benchmark falls", () => {
    const result = computePriceMoveOutcome({
      consensus: true,
      targetAsset: "mUSD",
      confidence: 0.6,
      priceAtDecision: 2200,
      currentPrice: 2100,
    });

    expect(result.outcome).toBe("GOOD_CALL");
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.pnlBps).toBeGreaterThan(0);
  });

  test("does not reward blocking a risk-off proposal before a selloff", () => {
    const result = computePriceMoveOutcome({
      consensus: false,
      targetAsset: "mUSD",
      confidence: 0.6,
      priceAtDecision: 0.7,
      currentPrice: 0.65,
    });

    expect(result.outcome).toBe("MISSED_ALPHA");
    expect(result.scoreDelta).toBeLessThan(0);
    expect(result.pnlBps).toBeLessThan(0);
  });

  test("rewards blocking a risk-off proposal before upside", () => {
    const result = computePriceMoveOutcome({
      consensus: false,
      targetAsset: "mUSD",
      confidence: 0.6,
      priceAtDecision: 0.7,
      currentPrice: 0.75,
    });

    expect(result.outcome).toBe("CORRECT_BLOCK");
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.pnlBps).toBeGreaterThan(0);
  });
});

describe("deriveExecutionProofStatus", () => {
  test("returns ERROR when tx proof failed or timed out", () => {
    expect(
      deriveExecutionProofStatus({
        checks: [{ name: "tx_proof", status: "ERROR" }],
      })
    ).toBe("ERROR");
  });

  test("returns WARN for unfinalized proof", () => {
    expect(
      deriveExecutionProofStatus({
        checks: [
          { name: "tx_exists", status: "PASS" },
          { name: "tx_confirmed", status: "WARN" },
        ],
      })
    ).toBe("WARN");
  });

  test("returns ACCEPTED for passing tx proof", () => {
    expect(
      deriveExecutionProofStatus({
        checks: [
          { name: "tx_exists", status: "PASS" },
          { name: "tx_sender", status: "PASS" },
          { name: "tx_confirmed", status: "PASS" },
          { name: "tx_success", status: "PASS" },
          { name: "tx_proof", status: "PASS" },
        ],
      })
    ).toBe("ACCEPTED");
  });

  test("returns UNKNOWN for partial or mixed tx proof", () => {
    expect(
      deriveExecutionProofStatus({
        checks: [
          { name: "tx_exists", status: "PASS" },
          { name: "tx_sender", status: "PASS" },
          { name: "tx_success", status: "PASS" },
          { name: "tx_proof", status: "PASS" },
        ],
      })
    ).toBe("UNKNOWN");

    expect(
      deriveExecutionProofStatus({
        checks: [
          { name: "tx_exists", status: "PASS" },
          { name: "tx_sender", status: "PASS" },
          { name: "tx_confirmed", status: "PASS" },
          { name: "tx_success", status: "SKIP" },
          { name: "tx_proof", status: "PASS" },
        ],
      })
    ).toBe("UNKNOWN");
  });
});

describe("refreshExecutionProof", () => {
  test("re-proofs transient confirmation warnings before settlement", async () => {
    const entry = {
      decisionTier: "EXECUTED_SWAP",
      _displayTier: "EXECUTION_PROOF_PENDING",
      executedOnChain: true,
      executionProofStatus: "WARN",
      directionalSwap: {
        txHash:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
      },
      disciplineDetail: {
        checks: [
          { name: "price_freshness", status: "PASS" },
          { name: "tx_exists", status: "PASS" },
          { name: "tx_sender", status: "PASS" },
          { name: "tx_confirmed", status: "WARN" },
          { name: "tx_success", status: "PASS" },
          { name: "tx_proof", status: "WARN" },
        ],
      },
    };
    const provider = {
      getTransaction: jest.fn().mockResolvedValue({
        blockNumber: 100,
        from: "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a",
      }),
      getTransactionReceipt: jest.fn().mockResolvedValue({
        blockNumber: 100,
        status: 1,
      }),
      getBlockNumber: jest.fn().mockResolvedValue(105),
    };

    const refreshed = await refreshExecutionProof(entry, { provider });

    expect(refreshed.executionProofStatus).toBe("ACCEPTED");
    expect(refreshed._displayTier).toBe("EXECUTED_SWAP");
    expect(refreshed.disciplineDetail.checks).toEqual(
      expect.arrayContaining([
        { name: "price_freshness", status: "PASS" },
        expect.objectContaining({ name: "tx_confirmed", status: "PASS" }),
        expect.objectContaining({ name: "tx_proof", status: "PASS" }),
      ])
    );
  });

  test("re-proofs executed RWA swaps from rwaIntent txHash", async () => {
    const entry = {
      decisionTier: "EXECUTED_SWAP",
      _displayTier: "EXECUTION_PROOF_PENDING",
      executedOnChain: true,
      executionProofStatus: "UNKNOWN",
      rwaIntent: {
        executed: true,
        txHash:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
      },
      disciplineDetail: { checks: [] },
    };
    const provider = {
      getTransaction: jest.fn().mockResolvedValue({
        blockNumber: 100,
        from: "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a",
      }),
      getTransactionReceipt: jest.fn().mockResolvedValue({
        blockNumber: 100,
        status: 1,
      }),
      getBlockNumber: jest.fn().mockResolvedValue(105),
    };

    const refreshed = await refreshExecutionProof(entry, { provider });

    expect(provider.getTransaction).toHaveBeenCalledWith(
      "0x2222222222222222222222222222222222222222222222222222222222222222"
    );
    expect(refreshed.executionProofStatus).toBe("ACCEPTED");
    expect(refreshed._displayTier).toBe("EXECUTED_SWAP");
  });
});
