const fs = require("fs");
const os = require("os");
const path = require("path");

describe("outcomeTracker settle integration", () => {
  const originalFetch = global.fetch;
  const originalOutcomesPath = process.env.OUTCOMES_PATH;
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turing-outcomes-"));
    process.env.OUTCOMES_PATH = path.join(tmpDir, "outcomes.json");
    global.fetch = jest.fn(async () => ({
      json: async () => ({
        ethereum: { usd: 2200 },
        mantle: { usd: 0.62 },
        "mantle-staked-ether": { usd: 2210 },
      }),
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalOutcomesPath === undefined) {
      delete process.env.OUTCOMES_PATH;
    } else {
      process.env.OUTCOMES_PATH = originalOutcomesPath;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    jest.resetModules();
  });

  test("re-proofs, settles, and persists an MNT-source risk-off entry", async () => {
    const txHash =
      "0x3333333333333333333333333333333333333333333333333333333333333333";
    const db = {
      schemaVersion: 2,
      pending: [
        {
          id: "settle_mnt_source",
          decisionId: 9001,
          action: "swap",
          targetAsset: "mUSD",
          consensus: true,
          confidence: 0.8,
          priceAtDecision: 0.7,
          settlementAsset: "MNT",
          priceAssetAtDecision: "MNT",
          settlementSourceAsset: "WMNT",
          recordedAt: "2026-05-31T00:00:00.000Z",
          settleAfter: "2026-05-31T00:00:00.000Z",
          settled: false,
          decisionTier: "EXECUTED_SWAP",
          _displayTier: "EXECUTION_PROOF_PENDING",
          executedOnChain: true,
          executionProofStatus: "WARN",
          directionalSwap: {
            executed: true,
            from: "WMNT",
            to: "USDT0",
            txHash,
          },
          disciplineDetail: {
            checks: [
              { name: "tx_exists", status: "PASS" },
              { name: "tx_sender", status: "PASS" },
              { name: "tx_confirmed", status: "WARN" },
              { name: "tx_success", status: "PASS" },
              { name: "tx_proof", status: "WARN" },
            ],
          },
        },
      ],
      settled: [],
    };
    fs.writeFileSync(process.env.OUTCOMES_PATH, JSON.stringify(db, null, 2));

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
    const { settle } = require("../../src/orchestrator/outcomeTracker");

    const results = await settle({ dryRun: true, provider });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      settlementAsset: "MNT",
      priceAtSettlement: 0.62,
      executionProofStatus: "ACCEPTED",
      _displayTier: "EXECUTED_SWAP",
      settled: true,
    });
    expect(results[0].pricePct).toBeCloseTo(-11.429, 3);
    expect(results[0].outcome).toBe("GOOD_CALL");
    expect(provider.getTransaction).toHaveBeenCalledWith(txHash);

    const persisted = JSON.parse(fs.readFileSync(process.env.OUTCOMES_PATH, "utf8"));
    expect(persisted.pending).toHaveLength(0);
    expect(persisted.settled).toHaveLength(1);
    expect(persisted.settled[0]).toMatchObject({
      settlementAsset: "MNT",
      executionProofStatus: "ACCEPTED",
      _displayTier: "EXECUTED_SWAP",
      priceAtSettlement: 0.62,
    });
  });

  test("keeps executed swaps pending when re-proof is not accepted", async () => {
    const txHash =
      "0x4444444444444444444444444444444444444444444444444444444444444444";
    const db = {
      schemaVersion: 2,
      pending: [
        {
          id: "settle_bad_proof",
          decisionId: 9002,
          action: "swap",
          targetAsset: "mUSD",
          consensus: true,
          confidence: 0.8,
          priceAtDecision: 0.7,
          settlementAsset: "MNT",
          priceAssetAtDecision: "MNT",
          settlementSourceAsset: "WMNT",
          recordedAt: "2026-05-31T00:00:00.000Z",
          settleAfter: "2026-05-31T00:00:00.000Z",
          settled: false,
          decisionTier: "EXECUTED_SWAP",
          _displayTier: "EXECUTION_PROOF_PENDING",
          executedOnChain: true,
          executionProofStatus: "WARN",
          directionalSwap: {
            executed: true,
            from: "WMNT",
            to: "USDT0",
            txHash,
          },
          disciplineDetail: { checks: [] },
        },
      ],
      settled: [],
    };
    fs.writeFileSync(process.env.OUTCOMES_PATH, JSON.stringify(db, null, 2));

    const provider = {
      getTransaction: jest.fn().mockResolvedValue(null),
    };
    const { settle } = require("../../src/orchestrator/outcomeTracker");

    const results = await settle({ dryRun: true, provider });

    expect(results).toEqual([]);
    const persisted = JSON.parse(fs.readFileSync(process.env.OUTCOMES_PATH, "utf8"));
    expect(persisted.pending).toHaveLength(1);
    expect(persisted.settled).toHaveLength(0);
    expect(persisted.pending[0]).toMatchObject({
      id: "settle_bad_proof",
      executionProofStatus: "ERROR",
      _displayTier: "EXECUTION_PROOF_PENDING",
      proofBlockReason: "execution proof ERROR",
    });
  });
});
