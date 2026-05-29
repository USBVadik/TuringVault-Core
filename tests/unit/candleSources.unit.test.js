/**
 * Tests for candleSources — the multi-source candle fetcher that
 * fixed the production "Insufficient price history" → 16-cycle
 * BLOCKED_BY_REGIME run on 2026-05-29.
 *
 * Each test mocks `global.fetch` to simulate one upstream failing
 * and asserts the fallback chain picks the next source. Final test
 * pins the disk-snapshot path so a future refactor can't silently
 * drop it.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

describe("candleSources.fetchCandlesMultiSource", () => {
  let candleSources;
  let origFetch;
  let tmpSnapshotPath;

  function makePrices(n, base = 2000) {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push([now - (n - i) * 3600 * 1000, base + i * 0.5]);
    }
    return out;
  }

  function makeBinanceKlines(n, base = 2000) {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push([
        now - (n - i) * 3600 * 1000,
        String(base + i * 0.5),
        String(base + i * 0.5 + 1),
        String(base + i * 0.5 - 1),
        String(base + i * 0.5 + 0.3),
        "100",
      ]);
    }
    return out;
  }

  function makeBybitKlines(n, base = 0.6) {
    // Bybit returns newest first.
    const now = Date.now();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.unshift([
        String(now - (n - i) * 3600 * 1000),
        String(base + i * 0.001),
        String(base + i * 0.001 + 0.0005),
        String(base + i * 0.001 - 0.0005),
        String(base + i * 0.001 + 0.0002),
        "1000",
        "100",
      ]);
    }
    return out;
  }

  function makeHyperliquidCandles(n, base = 2000) {
    const now = Date.now();
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        t: now - (n - i) * 3600 * 1000,
        c: String(base + i * 0.5),
      });
    }
    return out;
  }

  function makeJsonResponse(body, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
    };
  }

  beforeEach(() => {
    origFetch = global.fetch;
    // Redirect snapshot path into a tmp file so tests don't clobber
    // src/data/candle_cache.json.
    tmpSnapshotPath = fs.mkdtempSync(path.join(os.tmpdir(), "tv-candles-"));
    jest.resetModules();
    candleSources = require("../../src/strategies/candleSources");
    // Override module-private SNAPSHOT_PATH by reassigning fs.writeFile
    // to redirect; simpler: spy on writeFileSync to redirect into tmp.
    const realWrite = fs.writeFileSync;
    jest
      .spyOn(fs, "writeFileSync")
      .mockImplementation((p, data, ...rest) => {
        if (p === candleSources._SNAPSHOT_PATH) {
          return realWrite(
            path.join(tmpSnapshotPath, "candle_cache.json"),
            data,
            ...rest
          );
        }
        return realWrite(p, data, ...rest);
      });
    const realRead = fs.readFileSync;
    jest.spyOn(fs, "readFileSync").mockImplementation((p, ...rest) => {
      if (p === candleSources._SNAPSHOT_PATH) {
        return realRead(
          path.join(tmpSnapshotPath, "candle_cache.json"),
          ...rest
        );
      }
      return realRead(p, ...rest);
    });
    const realExists = fs.existsSync;
    jest.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (p === candleSources._SNAPSHOT_PATH) {
        return realExists(path.join(tmpSnapshotPath, "candle_cache.json"));
      }
      return realExists(p);
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
    try {
      fs.rmSync(tmpSnapshotPath, { recursive: true, force: true });
    } catch {
      /* noop */
    }
  });

  test("primary source (CoinGecko) succeeds → returned", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko")) {
        return makeJsonResponse({ prices: makePrices(48) });
      }
      throw new Error("unexpected " + url);
    });
    const r = await candleSources.fetchCandlesMultiSource(
      "ethereum",
      48,
      8
    );
    expect(r.source).toBe("coingecko");
    expect(r.candles).toHaveLength(48);
    expect(r.fromDiskSnapshot).toBe(false);
    expect(r.errors).toHaveLength(0);
  });

  test("CoinGecko 429 → falls back to Binance for ETH", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return makeJsonResponse(null, false, 429);
      if (url.includes("binance"))
        return makeJsonResponse(makeBinanceKlines(48));
      throw new Error("unexpected " + url);
    });
    const r = await candleSources.fetchCandlesMultiSource(
      "ethereum",
      48,
      8
    );
    expect(r.source).toBe("binance");
    expect(r.candles.length).toBe(48);
    expect(r.errors[0]).toMatch(/coingecko: HTTP 429/);
  });

  test("CoinGecko 429 → falls back to Bybit for MNT", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return makeJsonResponse(null, false, 429);
      if (url.includes("bybit"))
        return makeJsonResponse({
          result: { list: makeBybitKlines(48) },
        });
      throw new Error("unexpected " + url);
    });
    const r = await candleSources.fetchCandlesMultiSource("mantle", 48, 8);
    expect(r.source).toBe("bybit");
    expect(r.candles.length).toBe(48);
  });

  test("CoinGecko + Binance both fail → falls back to Hyperliquid for ETH", async () => {
    global.fetch = jest.fn(async (url, opts) => {
      if (url.includes("coingecko"))
        return makeJsonResponse(null, false, 503);
      if (url.includes("binance"))
        return makeJsonResponse(null, false, 502);
      if (url.includes("hyperliquid")) {
        // Verify it was a POST with candleSnapshot type.
        expect(opts?.method).toBe("POST");
        expect(opts?.body).toContain("candleSnapshot");
        return makeJsonResponse(makeHyperliquidCandles(48));
      }
      throw new Error("unexpected " + url);
    });
    const r = await candleSources.fetchCandlesMultiSource(
      "ethereum",
      48,
      8
    );
    expect(r.source).toBe("hyperliquid");
    expect(r.candles.length).toBe(48);
  });

  test("all upstream down + valid disk snapshot → snapshot served", async () => {
    // Step 1: populate the snapshot.
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return makeJsonResponse({ prices: makePrices(48) });
      throw new Error("unexpected " + url);
    });
    const first = await candleSources.fetchCandlesMultiSource(
      "ethereum",
      48,
      8
    );
    expect(first.source).toBe("coingecko");
    // Step 2: every source dies.
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const r = await candleSources.fetchCandlesMultiSource("ethereum", 48, 8);
    expect(r.fromDiskSnapshot).toBe(true);
    expect(r.source).toMatch(/-snapshot$/);
    expect(r.candles.length).toBe(48);
    expect(typeof r.snapshotAgeSec).toBe("number");
  });

  test("returns empty + provenance when ALL sources AND snapshot fail", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    // No snapshot exists in fresh tmp dir.
    const r = await candleSources.fetchCandlesMultiSource("ethereum", 48, 8);
    expect(r.candles).toHaveLength(0);
    expect(r.source).toBe("none");
    // All three upstream tries should have been attempted.
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("partial response (<minRequired candles) treated as failure for that source", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("coingecko"))
        return makeJsonResponse({ prices: makePrices(3) });
      if (url.includes("binance"))
        return makeJsonResponse(makeBinanceKlines(48));
      throw new Error("unexpected " + url);
    });
    const r = await candleSources.fetchCandlesMultiSource(
      "ethereum",
      48,
      8
    );
    expect(r.source).toBe("binance");
    expect(r.errors[0]).toMatch(/coingecko: only 3 candles/);
  });

  test("unknown asset throws cleanly", async () => {
    await expect(
      candleSources.fetchCandlesMultiSource("dogecoin", 48, 8)
    ).rejects.toThrow(/unknown asset/);
  });
});
