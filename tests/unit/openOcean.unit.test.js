const { ethers } = require("ethers");
const {
  OpenOceanDEX,
  ADDRESSES,
  OPENOCEAN_SLIPPAGE_BPS,
  MAX_SWAP_GAS_LIMIT,
  boundedGasLimit,
  decimalsOf,
  rawAmountForToken,
} = require("../../src/dex/openOcean");

describe("OpenOceanDEX hardening (USDT0 address + decimals)", () => {
  let origFetch;
  beforeEach(() => {
    origFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = origFetch;
  });

  test("USDT0 resolves to a real address and 6 decimals", () => {
    expect(ADDRESSES.USDT0).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(decimalsOf("USDT0")).toBe(6);
    expect(decimalsOf("USDT")).toBe(6);
    expect(decimalsOf("WMNT")).toBe(18);
    expect(decimalsOf("mETH")).toBe(18);
    expect(rawAmountForToken("12.345678", "USDT0")).toBe(12345678n);
    expect(rawAmountForToken("12.3456789", "USDT0")).toBe(12345678n);
  });

  test("getQuote sends the USDT0 token address (not the symbol) and parses 18-dec WMNT output", async () => {
    let capturedUrl;
    global.fetch = async (url) => {
      capturedUrl = String(url);
      return {
        json: async () => ({
          code: 200,
          data: {
            outAmount: "23700000000000000000", // 23.7 WMNT (18 dec)
            minOutAmount: "23628900000000000000", // 23.6289 WMNT
            to: "0x1111111111111111111111111111111111111111",
            data: "0xdeadbeef",
            value: "0",
            estimatedGas: 300000,
          },
        }),
      };
    };
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("USDT0", "WMNT", ethers.parseEther("12"));
    expect(capturedUrl).toContain(ADDRESSES.USDT0);
    expect(capturedUrl).toContain(ADDRESSES.WMNT);
    expect(capturedUrl).not.toContain("inTokenAddress=USDT0");
    expect(capturedUrl).toContain(
      `slippage=${OPENOCEAN_SLIPPAGE_BPS / 100}`
    );
    expect(q.viable).toBe(true);
    expect(q.amountIn).toBe(12);
    expect(q.estimatedOut).toBeCloseTo(23.7, 6);
    expect(q.minimumOut).toBeCloseTo(23.6289, 6);
  });

  test("getQuote parses 6-dec output when the target is a 6-decimal stable", async () => {
    global.fetch = async () => ({
      json: async () => ({
        code: 200,
        data: {
          outAmount: "12150000", // 12.15 USDT0 (6 dec)
          minOutAmount: "12113550", // 12.11355 USDT0
          to: "0x1111111111111111111111111111111111111111",
          data: "0xdeadbeef",
          value: "0",
          estimatedGas: 1,
        },
      }),
    });
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("WMNT", "USDT0", ethers.parseEther("24"));
    expect(q.estimatedOut).toBeCloseTo(12.15, 6);
    expect(q.minimumOut).toBeCloseTo(12.11355, 6);
  });

  test("a non-200 aggregator response is reported as not viable", async () => {
    global.fetch = async () => ({
      json: async () => ({
        code: 400,
        errorMsg: "No intoken information obtained",
      }),
    });
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("USDT0", "WMNT", ethers.parseEther("12"));
    expect(q.viable).toBe(false);
  });

  test("rejects ERC-20 quotes that try to spend native MNT", async () => {
    global.fetch = async () => ({
      json: async () => ({
        code: 200,
        data: {
          outAmount: "12150000",
          to: "0x1111111111111111111111111111111111111111",
          data: "0xdeadbeef",
          value: "1",
          estimatedGas: 300000,
        },
      }),
    });
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("WMNT", "USDT0", ethers.parseEther("24"));
    expect(q.viable).toBe(false);
    expect(q.error).toMatch(/invalid transaction/i);
  });

  test("rejects an impossible minimum output above the quoted output", async () => {
    global.fetch = async () => ({
      json: async () => ({
        code: 200,
        data: {
          outAmount: "12150000",
          minOutAmount: "12150001",
          to: "0x1111111111111111111111111111111111111111",
          data: "0xdeadbeef",
          value: "0",
          estimatedGas: 300000,
        },
      }),
    });
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("WMNT", "USDT0", ethers.parseEther("24"));
    expect(q.viable).toBe(false);
    expect(q.error).toMatch(/invalid output/i);
  });

  test("caps untrusted aggregator gas estimates", () => {
    expect(boundedGasLimit(300000)).toBe(600000n);
    expect(boundedGasLimit("999999999999")).toBe(MAX_SWAP_GAS_LIMIT);
    expect(boundedGasLimit("not-a-number")).toBe(1000000n);
  });
});
