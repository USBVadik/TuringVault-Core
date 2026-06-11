const {
  fulfilledValue,
} = require("../../frontend/app/lib/proof-data-resilience.shared.js");

describe("Proof Explorer data resilience", () => {
  test("uses the fallback when an optional on-chain read rejects", () => {
    const result = fulfilledValue(
      { status: "rejected", reason: new Error("rpc timeout") },
      []
    );

    expect(result).toEqual([]);
  });

  test("preserves fulfilled values without touching the payload", () => {
    const payload = [{ id: 454, displayTier: "EXECUTED_SWAP" }];

    const result = fulfilledValue({ status: "fulfilled", value: payload }, []);

    expect(result).toBe(payload);
  });
});
