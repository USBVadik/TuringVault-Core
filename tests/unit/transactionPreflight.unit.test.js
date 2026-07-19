const {
  describeTransactionError,
  preflightTransaction,
} = require("../../src/dex/transactionPreflight");

const REQUEST = {
  to: "0x1111111111111111111111111111111111111111",
  data: "0xdeadbeef",
  value: "0",
};
const WALLET = "0x2222222222222222222222222222222222222222";

describe("transaction preflight", () => {
  test("accepts a transaction only after the node can estimate it", async () => {
    const provider = {
      estimateGas: jest.fn().mockResolvedValue(123456n),
      call: jest.fn(),
    };

    await expect(
      preflightTransaction({ provider, walletAddress: WALLET, transaction: REQUEST })
    ).resolves.toEqual({ ok: true, estimatedGas: 123456n });
    expect(provider.estimateGas).toHaveBeenCalledWith({
      from: WALLET,
      ...REQUEST,
      value: 0n,
    });
    expect(provider.call).not.toHaveBeenCalled();
  });

  test("returns the readable chain revert and never throws", async () => {
    const estimateError = new Error("opaque estimate error");
    const callError = new Error("Return amount is not enough");
    callError.reason = "Return amount is not enough";
    const provider = {
      estimateGas: jest.fn().mockRejectedValue(estimateError),
      call: jest.fn().mockRejectedValue(callError),
    };

    await expect(
      preflightTransaction({ provider, walletAddress: WALLET, transaction: REQUEST })
    ).resolves.toEqual({
      ok: false,
      reason: "Return amount is not enough",
    });
  });

  test("normalizes RPC error text without exposing a full request", () => {
    expect(
      describeTransactionError({
        shortMessage: "execution reverted: bad route\nwith extra whitespace",
      })
    ).toBe("execution reverted: bad route with extra whitespace");
  });
});
