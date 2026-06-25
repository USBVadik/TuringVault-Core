const { ethers } = require("ethers");
const {
  OpenOceanDEX,
  ADDRESSES,
  decimalsOf,
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
            to: "0xRouter",
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
    expect(q.viable).toBe(true);
    expect(q.amountIn).toBe(12);
    expect(q.estimatedOut).toBeCloseTo(23.7, 6);
  });

  test("getQuote parses 6-dec output when the target is a 6-decimal stable", async () => {
    global.fetch = async () => ({
      json: async () => ({
        code: 200,
        data: {
          outAmount: "12150000", // 12.15 USDT0 (6 dec)
          to: "0xR",
          data: "0x",
          value: "0",
          estimatedGas: 1,
        },
      }),
    });
    const dex = new OpenOceanDEX(null, null, { dryRun: true });
    const q = await dex.getQuote("WMNT", "USDT0", ethers.parseEther("24"));
    expect(q.estimatedOut).toBeCloseTo(12.15, 6);
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
});
