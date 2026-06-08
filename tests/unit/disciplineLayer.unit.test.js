const { resolveTxProofMode } = require("../../src/orchestrator/disciplineLayer.js");

describe("discipline tx proof mode", () => {
  test("verifies a transaction whenever a tx hash is present, even for hold-labelled heartbeat cycles", () => {
    expect(
      resolveTxProofMode({
        action: "hold",
        txHash: "0xabc",
        executionExpected: false,
        decisionTier: "HEARTBEAT_SWAP",
      })
    ).toBe("verify");
  });

  test("skips tx proof for blocked swap proposals when execution was not expected", () => {
    expect(
      resolveTxProofMode({
        action: "swap",
        txHash: null,
        executionExpected: false,
        decisionTier: "BLOCKED_BY_REGIME",
      })
    ).toBe("skip");
  });

  test("fails tx proof when execution was expected but no tx hash is available", () => {
    expect(
      resolveTxProofMode({
        action: "swap",
        txHash: null,
        executionExpected: true,
        decisionTier: "EXECUTED_SWAP",
      })
    ).toBe("fail-missing-tx");
  });
});
