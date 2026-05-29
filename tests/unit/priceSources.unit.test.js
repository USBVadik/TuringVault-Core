/**
 * Tests for priceSources.fetchPricesMultiSource — sister module to
 * candleSources, fixes the second layer of CoinGecko 429 starvation
 * (see audit 19 + the simple/price extension).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("priceSources.fetchPricesMultiSource", () => {
  let priceSources;
  let origFetch;
  let tmpDir;

  function jsonResp(body, ok = true, status = 200) {
    return { ok, status, json: async () => body };
  }

  beforeEach(() => {
    origFetch = global.fetch;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tv-prices-"));
    jest.resetModules();
    priceSources = require("../../src/strategies/priceSources");
    const realWrite = fs.writeFileSync;
    jest.spyOn(fs, "writeFileSync").mockImplementation((p, data, ...rest) => {
      if (p === priceSources._SNAPSHOT_PATH) {
        return realWrite(path.join(tmpDir, "price_cache.json"), data, ...rest);
      }
      return realWrite(p, data, ...rest);
    });
    const realRead = fs.readFileSync;
    jest.spyOn(fs, "readFileSync").mockImplementation((p, ...rest) => {
      if (p === priceSources._SNAPSHOT_PATH) {
        return realRead(path.join(tmpDir, "price_cache.json"), ...rest);
      }
      return realRead(p, ...rest);
    });
    const realExists = fs.existsSync;
    jest.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (p === priceSources._SNAPSHOT_PATH) {
        return realExists(path.join(tmpDir, "price_cache.json"));
      }
      return realExists(p);
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  });

  test("CoinGecko succeeds → primary source", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return jsonResp({
          ethereum: { usd: 2030.5, usd_24h_change: 2.3 },
          mantle: { usd: 0.643, usd_24h_change: 3.7 },
        });
      throw new Error("unexpected " + url);
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.source).toBe("coingecko");
    expect(r.ethPrice).toBe(2030.5);
    expect(r.mntPrice).toBe(0.643);
    expect(r.ethChange24h).toBe(2.3);
    expect(r.mntChange24h).toBe(3.7);
    expect(r.fromDiskSnapshot).toBe(false);
    expect(r.errors).toHaveLength(0);
  });

  test("CoinGecko 429 → falls back to Binance+Bybit", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko")) return jsonResp(null, false, 429);
      if (url.includes("binance.com/api/v3/ticker/24hr"))
        return jsonResp({ lastPrice: "2031.0", priceChangePercent: "2.18" });
      if (url.includes("bybit.com/v5/market/tickers"))
        return jsonResp({
          result: {
            list: [{ lastPrice: "0.6442", price24hPcnt: "0.0354" }],
          },
        });
      throw new Error("unexpected " + url);
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.source).toBe("binance+bybit");
    expect(r.ethPrice).toBe(2031.0);
    expect(r.mntPrice).toBe(0.6442);
    expect(r.ethChange24h).toBeCloseTo(2.18, 2);
    // 0.0354 * 100 = 3.54 (Bybit returns fraction).
    expect(r.mntChange24h).toBeCloseTo(3.54, 2);
    expect(r.errors[0]).toMatch(/coingecko: HTTP 429/);
  });

  test("CoinGecko + Binance both down → Hyperliquid (no 24h change)", async () => {
    global.fetch = jest.fn(async (url, opts) => {
      if (url.includes("coingecko")) return jsonResp(null, false, 503);
      if (url.includes("binance.com")) return jsonResp(null, false, 502);
      if (url.includes("bybit.com")) return jsonResp(null, false, 502);
      if (url.includes("hyperliquid")) {
        expect(opts?.method).toBe("POST");
        expect(opts?.body).toContain("allMids");
        return jsonResp({ ETH: "2032.5", MNT: "0.6450" });
      }
      throw new Error("unexpected " + url);
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.source).toBe("hyperliquid");
    expect(r.ethPrice).toBe(2032.5);
    expect(r.mntPrice).toBe(0.645);
    // Steering rule §1: honest null vs fake zero for missing change.
    expect(r.ethChange24h).toBeNull();
    expect(r.mntChange24h).toBeNull();
  });

  test("all upstream down + valid snapshot → snapshot served", async () => {
    // 1. Populate snapshot.
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return jsonResp({
          ethereum: { usd: 2025.0, usd_24h_change: 1.5 },
          mantle: { usd: 0.64, usd_24h_change: 2.0 },
        });
      throw new Error("unexpected " + url);
    });
    const first = await priceSources.fetchPricesMultiSource();
    expect(first.source).toBe("coingecko");
    // 2. Everything dies.
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.fromDiskSnapshot).toBe(true);
    expect(r.source).toMatch(/-snapshot$/);
    expect(r.ethPrice).toBe(2025.0);
    expect(r.mntPrice).toBe(0.64);
    expect(typeof r.snapshotAgeSec).toBe("number");
  });

  test("fail-everything path returns zeros + provenance", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.source).toBe("none");
    expect(r.ethPrice).toBe(0);
    expect(r.mntPrice).toBe(0);
    // All three upstream tries should have been logged.
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("invalid eth price from CoinGecko (e.g. 0) treated as failure", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return jsonResp({
          ethereum: { usd: 0 },
          mantle: { usd: 0.64 },
        });
      if (url.includes("binance.com/api/v3/ticker/24hr"))
        return jsonResp({ lastPrice: "2031.0", priceChangePercent: "2.18" });
      if (url.includes("bybit.com"))
        return jsonResp({
          result: {
            list: [{ lastPrice: "0.6442", price24hPcnt: "0.0354" }],
          },
        });
      throw new Error("unexpected " + url);
    });
    const r = await priceSources.fetchPricesMultiSource();
    expect(r.source).toBe("binance+bybit");
    expect(r.errors[0]).toMatch(/coingecko: invalid eth price/);
  });

  test("Binance succeeds but Bybit fails → entire binance+bybit step rejected", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko")) return jsonResp(null, false, 429);
      if (url.includes("binance.com/api/v3/ticker/24hr"))
        return jsonResp({ lastPrice: "2031.0", priceChangePercent: "2.18" });
      if (url.includes("bybit.com")) return jsonResp(null, false, 503);
      if (url.includes("hyperliquid"))
        return jsonResp({ ETH: "2032.5", MNT: "0.6450" });
      throw new Error("unexpected " + url);
    });
    const r = await priceSources.fetchPricesMultiSource();
    // Promise.all rejects on first failure → we fall to Hyperliquid.
    expect(r.source).toBe("hyperliquid");
  });
});
