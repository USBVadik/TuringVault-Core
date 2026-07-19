const { ethers } = require("ethers");
const { MerchantMoeDEX } = require("../../src/dex/merchantMoe");

describe("MerchantMoeDEX exact transaction preflight", () => {
  test("reports a failed token approval as an execution block without building a swap", async () => {
    const dex = Object.create(MerchantMoeDEX.prototype);
    dex.dryRun = false;
    dex.provider = {};
    dex.wallet = {
      address: "0x2222222222222222222222222222222222222222",
    };
    dex.maxSlippageBps = 100;
    dex._ensureAllowance = jest
      .fn()
      .mockRejectedValue(new Error("approval reverted"));
    dex.getQuote = jest.fn().mockResolvedValue({
      viable: true,
      priceImpact: 0,
      estimatedOut: 12,
    });

    const result = await dex.executeSwap(
      "mETH",
      "USDT",
      ethers.parseEther("0.005")
    );

    expect(result).toMatchObject({
      executed: false,
      executionBlocked: true,
      reason: expect.stringMatching(/approval failed/i),
    });
    expect(dex.getQuote).toHaveBeenCalledTimes(1);
  });

  test("never broadcasts a direct router swap whose calldata reverts in simulation", async () => {
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(12),
      estimateGas: jest.fn().mockRejectedValue(
        Object.assign(new Error("revert"), {
          reason: "LB: insufficient output amount",
        })
      ),
      call: jest.fn().mockRejectedValue(
        Object.assign(new Error("revert"), {
          reason: "LB: insufficient output amount",
        })
      ),
    };
    const sendTransaction = jest.fn();
    const dex = Object.create(MerchantMoeDEX.prototype);
    dex.dryRun = false;
    dex.provider = provider;
    dex.wallet = {
      address: "0x2222222222222222222222222222222222222222",
      provider,
      sendTransaction,
    };
    dex.maxSlippageBps = 100;
    dex._ensureAllowance = jest.fn().mockResolvedValue();
    dex.getQuote = jest.fn().mockResolvedValue({
      viable: true,
      priceImpact: 0,
      estimatedOut: 12,
      _decimalsOut: 6,
      path: {
        pairBinSteps: [25],
        versions: [2],
        tokenPath: [
          "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
          "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE",
        ],
      },
    });
    dex.router = {
      swapExactTokensForTokens: {
        populateTransaction: jest.fn().mockResolvedValue({
          to: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
          data: "0xdeadbeef",
          value: 0n,
        }),
      },
    };

    const result = await dex.executeSwap(
      "mETH",
      "USDT",
      ethers.parseEther("0.005")
    );

    expect(result).toMatchObject({
      executed: false,
      executionBlocked: true,
      reason: expect.stringMatching(/insufficient output amount/i),
    });
    expect(sendTransaction).not.toHaveBeenCalled();
  });
});
