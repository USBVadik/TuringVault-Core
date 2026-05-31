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

describe("record execution honesty", () => {
  const originalOutcomesPath = process.env.OUTCOMES_PATH;
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turing-record-"));
    process.env.OUTCOMES_PATH = path.join(tmpDir, "outcomes.json");
  });

  afterEach(() => {
    const fs = require("fs");
    if (originalOutcomesPath === undefined) {
      delete process.env.OUTCOMES_PATH;
    } else {
      process.env.OUTCOMES_PATH = originalOutcomesPath;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
  });

  test("partial directional legs do not mark the intended swap executed", () => {
    const { record } = require("../../src/orchestrator/outcomeTracker");
    const entry = record({
      decisionId: 9999,
      action: "swap",
      targetAsset: "mETH",
      consensus: true,
      confidence: 0.64,
      priceAtDecision: 2007,
      decisionTier: "EXECUTED_SWAP",
      directionalSwap: {
        executed: false,
        direction: "risk-on",
        from: "USDT0",
        to: "mETH",
        reason: "leg3-failed: not-viable",
        legs: [
          {
            leg: 1,
            from: "USDT0",
            to: "USDT",
            txHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
          },
          {
            leg: 2,
            from: "USDT",
            to: "WMNT",
            txHash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
          },
          { leg: 3, from: "WMNT", to: "mETH", reason: "not-viable" },
        ],
      },
    });

    expect(entry.executedOnChain).toBe(false);
    expect(entry._displayTier).toBe("INTENT_SWAP_NO_EXEC");
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
