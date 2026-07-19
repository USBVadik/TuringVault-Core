const { ethers } = require("ethers");
const { ADDRESSES } = require("../../src/dex/openOcean");
const { LifiDEX } = require("../../src/dex/lifi");

const WALLET = "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";
const ROUTER = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";

function lifiPayload(overrides = {}) {
  return {
    action: {
      fromChainId: 5000,
      toChainId: 5000,
      fromToken: { address: ADDRESSES.USDT0 },
      toToken: { address: ADDRESSES.mETH },
      fromAmount: "12000000",
    },
    estimate: {
      toAmount: "6000000000000000",
      toAmountMin: "5970000000000000",
      approvalAddress: ROUTER,
    },
    tool: "nordstern",
    transactionRequest: {
      to: ROUTER,
      data: "0xdeadbeef",
      value: "0x0",
      chainId: 5000,
      gasLimit: "0x493e0",
    },
    ...overrides,
  };
}

describe("LifiDEX", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("encodes the actual token decimals and validates the returned route", async () => {
    let requestedUrl;
    global.fetch = async (url) => {
      requestedUrl = String(url);
      return { ok: true, json: async () => lifiPayload() };
    };
    const dex = new LifiDEX(null, { address: WALLET }, { dryRun: true });

    const quote = await dex.getQuote("USDT0", "mETH", ethers.parseEther("12"));

    expect(requestedUrl).toContain(`fromToken=${ADDRESSES.USDT0}`);
    expect(requestedUrl).toContain(`toToken=${ADDRESSES.mETH}`);
    expect(requestedUrl).toContain("fromAmount=12000000");
    expect(requestedUrl).toContain("slippage=0.005");
    expect(quote).toMatchObject({
      viable: true,
      amountIn: 12,
      estimatedOut: 0.006,
      minimumOut: 0.00597,
      approvalAddress: ROUTER,
      routeTool: "nordstern",
    });
  });

  test("rejects a route that changes the requested token", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () =>
        lifiPayload({
          action: {
            ...lifiPayload().action,
            toToken: { address: ADDRESSES.WMNT },
          },
        }),
    });
    const dex = new LifiDEX(null, { address: WALLET }, { dryRun: true });

    await expect(
      dex.getQuote("USDT0", "mETH", ethers.parseEther("12"))
    ).resolves.toMatchObject({ viable: false, error: expect.stringMatching(/invalid route/i) });
  });

  test("reports an invalid route as an execution block, never as an executable intent", async () => {
    const dex = new LifiDEX(null, { address: WALLET }, { dryRun: false });

    await expect(
      dex.executeSwap("USDT0", "mETH", ethers.parseEther("12"), {
        quote: { viable: false, error: "LI.FI returned an invalid route payload" },
      })
    ).resolves.toMatchObject({
      executed: false,
      executionBlocked: true,
      reason: expect.stringMatching(/invalid route/i),
    });
  });

  test("rejects an API route that tries to redirect approval to another contract", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () =>
        lifiPayload({
          estimate: {
            ...lifiPayload().estimate,
            approvalAddress: "0x1111111111111111111111111111111111111111",
          },
        }),
    });
    const dex = new LifiDEX(null, { address: WALLET }, { dryRun: true });

    await expect(
      dex.getQuote("USDT0", "mETH", ethers.parseEther("12"))
    ).resolves.toMatchObject({ viable: false, error: expect.stringMatching(/invalid route/i) });
  });

  test("does not broadcast when the exact LI.FI transaction fails preflight", async () => {
    const provider = {
      estimateGas: jest.fn().mockRejectedValue(Object.assign(new Error("revert"), {
        reason: "TRANSFER_FROM_FAILED",
      })),
      call: jest.fn().mockRejectedValue(Object.assign(new Error("revert"), {
        reason: "TRANSFER_FROM_FAILED",
      })),
    };
    const sendTransaction = jest.fn();
    const wallet = { address: WALLET, provider, sendTransaction };
    const quote = {
      viable: true,
      quotedAt: Date.now(),
      amountInRaw: 12000000n,
      approvalAddress: ROUTER,
      routerAddress: ROUTER,
      txData: "0xdeadbeef",
      txValue: "0",
      estimatedOut: 0.006,
      amountIn: 12,
    };
    const dex = new LifiDEX(provider, wallet, {
      dryRun: false,
      tokenContractFactory: () => ({ allowance: async () => 12000000n }),
    });

    const result = await dex.executeSwap("USDT0", "mETH", ethers.parseEther("12"), {
      quote,
    });

    expect(result).toMatchObject({
      executed: false,
      executionBlocked: true,
      reason: expect.stringMatching(/TRANSFER_FROM_FAILED/),
    });
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  test("does not use a quote that expires while an exact approval is confirming", async () => {
    const initialNow = 1_000_000;
    const nowSpy = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(initialNow)
      .mockReturnValueOnce(initialNow + 45_001);
    const sendTransaction = jest.fn();
    const wallet = { address: WALLET, provider: {}, sendTransaction };
    const quote = {
      viable: true,
      quotedAt: initialNow,
      amountInRaw: 12000000n,
      approvalAddress: ROUTER,
      routerAddress: ROUTER,
      txData: "0xdeadbeef",
      txValue: "0",
      estimatedOut: 0.006,
      amountIn: 12,
    };
    const dex = new LifiDEX({}, wallet, {
      dryRun: false,
      tokenContractFactory: () => ({
        allowance: async () => 0n,
        approve: async () => ({ wait: async () => ({ status: 1 }) }),
      }),
    });

    try {
      await expect(
        dex.executeSwap("USDT0", "mETH", ethers.parseEther("12"), { quote })
      ).resolves.toMatchObject({
        executed: false,
        executionBlocked: true,
        reason: expect.stringMatching(/expired while preparing/i),
      });
      expect(sendTransaction).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });
});
