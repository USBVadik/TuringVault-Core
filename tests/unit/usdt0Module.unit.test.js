/**
 * Unit tests for src/rwa/usdt0Module.js
 *
 * Verifies module shape, zero-yield invariant, and getPosition error
 * path. Provider is mocked — no live RPC calls.
 *
 * Spec: rwa-allocation-active T5.
 */

jest.mock("ethers", () => {
  // Minimal mock — only what USDT0Module exercises.
  const formatUnits = (n, d) => {
    const div = BigInt(10) ** BigInt(d);
    return (Number(n) / Number(div)).toString();
  };
  return {
    ethers: {
      JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
      Wallet: jest.fn().mockImplementation((privateKey, _provider) => ({
        address: "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a",
      })),
      Contract: jest.fn().mockImplementation(() => ({
        balanceOf: jest.fn().mockResolvedValue(2387000n), // 2.387 USDT0 (6 decimals)
        decimals: jest.fn().mockResolvedValue(6n),
        totalSupply: jest.fn().mockResolvedValue(50_000_000_000_000n), // 50M
      })),
      formatUnits,
    },
  };
});

describe("USDT0Module", () => {
  // Match the dummy 32-byte hex used in the mocked Wallet.
  const DUMMY_PK = "0x" + "1".repeat(64);

  beforeEach(() => {
    delete require.cache[require.resolve("../../src/rwa/usdt0Module")];
  });

  test("exports class and address", () => {
    const { USDT0Module, USDT0_ADDRESS } = require("../../src/rwa/usdt0Module");
    expect(typeof USDT0Module).toBe("function");
    expect(USDT0_ADDRESS).toBe("0x779Ded0c9e1022225f8E0630b35a9b54bE713736");
  });

  test("static metadata is honest (no APY claim)", () => {
    const { USDT0Module } = require("../../src/rwa/usdt0Module");
    const m = new USDT0Module();
    expect(m.assetClass).toBe("rwa-treasury");
    expect(m.currentAPY).toBe(0);
    expect(m.issuer).toMatch(/Tether/i);
    expect(m.underlying).toMatch(/Treasury/i);
    expect(m.liquidityRoute).toMatch(/USDT\/USDT0/);
  });

  test("getPosition returns shape with apy=0", async () => {
    const { USDT0Module } = require("../../src/rwa/usdt0Module");
    const m = new USDT0Module({ privateKey: DUMMY_PK });
    const pos = await m.getPosition();
    expect(pos.token).toBe("USDT0");
    expect(pos.apy).toBe(0);
    expect(typeof pos.balance).toBe("number");
    expect(pos.assetClass).toBe("rwa-treasury");
  });

  test("getPosition throws when no address available", async () => {
    const { USDT0Module } = require("../../src/rwa/usdt0Module");
    const m = new USDT0Module(); // no privateKey, no wallet
    await expect(m.getPosition()).rejects.toThrow(/no address/i);
  });

  test("getContextForAI explicitly states no yield", async () => {
    const { USDT0Module } = require("../../src/rwa/usdt0Module");
    const m = new USDT0Module({ privateKey: DUMMY_PK });
    const ctx = await m.getContextForAI();
    // Honest no-yield framing: must say "none" / "no APY" / "0%".
    expect(ctx.yield.toLowerCase()).toMatch(/(none|no apy|0%|not yield)/);
    // Hard guard: must NOT advertise a positive APY number for USDT0.
    expect(ctx.yield).not.toMatch(/[1-9](\.\d+)?\s*%/); // no "5%" / "5.25%" claim
    expect(ctx.yield).not.toMatch(/yields\b/i); // no "yields X"
  });
});
