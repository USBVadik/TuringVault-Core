/**
 * Unit tests for src/onchain/methRate.js
 *
 * Pattern mirrors priceSources.unit.test.js: redirect the disk
 * snapshot into a temp directory so the live src/data file is
 * not touched, then mock global.fetch to drive each source path.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

describe("methRate", () => {
  let methRate;
  let origFetch;
  let tmpDir;

  beforeEach(() => {
    origFetch = global.fetch;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tv-meth-"));
    jest.resetModules();
    methRate = require("../../src/onchain/methRate");

    const realWrite = fs.writeFileSync;
    jest.spyOn(fs, "writeFileSync").mockImplementation((p, data, ...rest) => {
      if (p === methRate.SNAPSHOT_PATH || p === methRate.SNAPSHOT_PATH + ".tmp") {
        return realWrite(path.join(tmpDir, path.basename(p)), data, ...rest);
      }
      return realWrite(p, data, ...rest);
    });
    const realRead = fs.readFileSync;
    jest.spyOn(fs, "readFileSync").mockImplementation((p, ...rest) => {
      if (p === methRate.SNAPSHOT_PATH) {
        return realRead(path.join(tmpDir, "meth_rate_history.json"), ...rest);
      }
      return realRead(p, ...rest);
    });
    const realExists = fs.existsSync;
    jest.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (p === methRate.SNAPSHOT_PATH || p === methRate.SNAPSHOT_PATH + ".tmp") {
        return realExists(path.join(tmpDir, path.basename(p)));
      }
      return realExists(p);
    });
    const realRename = fs.renameSync;
    jest.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      const remappedFrom = from === methRate.SNAPSHOT_PATH + ".tmp"
        ? path.join(tmpDir, "meth_rate_history.json.tmp")
        : from;
      const remappedTo = to === methRate.SNAPSHOT_PATH
        ? path.join(tmpDir, "meth_rate_history.json")
        : to;
      return realRename(remappedFrom, remappedTo);
    });
    const realUnlink = fs.unlinkSync;
    jest.spyOn(fs, "unlinkSync").mockImplementation((p) => {
      if (p === methRate.SNAPSHOT_PATH + ".tmp") {
        return realUnlink(path.join(tmpDir, "meth_rate_history.json.tmp"));
      }
      return realUnlink(p);
    });
  });

  afterEach(() => {
    global.fetch = origFetch;
    jest.restoreAllMocks();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignored */
    }
  });

  function jsonResp(data, ok = true, status = 200) {
    return Promise.resolve({
      ok,
      status,
      json: async () => data,
    });
  }

  // ── source chain ─────────────────────────────────────────────

  test("DefiLlama succeeds → primary source, apy returned", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("yields.llama.fi"))
        return jsonResp({
          data: [
            {
              project: "mantle-staked-ether",
              symbol: "METH",
              chain: "Ethereum",
              apy: 3.41,
              tvlUsd: 464_000_000,
            },
          ],
        });
      throw new Error("unexpected fetch: " + url);
    });
    const r = await methRate.fetchMethRate();
    expect(r.source).toBe("defillama");
    expect(r.apyPct).toBeCloseTo(3.41);
    expect(r.degraded).toBe(false);
    // DefiLlama doesn't carry redemption rate
    expect(r.currentRateAtomic).toBeNull();
  });

  test("DefiLlama 502 → meth.mantle.xyz fallback", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.includes("yields.llama.fi")) return jsonResp(null, false, 502);
      if (url.includes("meth.mantle.xyz/api/stats"))
        return jsonResp({
          exchangeRate: 1.0582,
          apy: 3.41,
          tvlUsd: 464_000_000,
        });
      throw new Error("unexpected fetch: " + url);
    });
    const r = await methRate.fetchMethRate();
    expect(r.source).toBe("meth.mantle.xyz");
    expect(BigInt(r.currentRateAtomic)).toBe(BigInt("1058200000000000000"));
    expect(r.degraded).toBe(false);
  });

  test("DefiLlama + Mantle stats both down → L1 RPC fallback", async () => {
    // bigint 1.058e18 in hex, 32 bytes padded
    const rateAtomic = BigInt("1058200000000000000");
    const hex =
      "0x" + rateAtomic.toString(16).padStart(64, "0");
    global.fetch = jest.fn(async (url, opts) => {
      if (url.includes("yields.llama.fi")) return jsonResp(null, false, 502);
      if (url.includes("meth.mantle.xyz")) return jsonResp(null, false, 503);
      if (url.includes("cloudflare") || url.includes("llamarpc") || url.includes("ankr.com")) {
        // Verify it's a POST eth_call
        expect(opts.method).toBe("POST");
        return jsonResp({ jsonrpc: "2.0", id: 1, result: hex });
      }
      throw new Error("unexpected fetch: " + url);
    });
    const r = await methRate.fetchMethRate();
    expect(r.source).toBe("l1-rpc");
    expect(BigInt(r.currentRateAtomic)).toBe(rateAtomic);
    expect(r.degraded).toBe(false);
  });

  test("all live sources fail + valid snapshot → snapshot served, degraded:true", async () => {
    // Step 1: populate snapshot via DefiLlama success.
    global.fetch = jest.fn(async (url) => {
      if (url.includes("yields.llama.fi"))
        return jsonResp({
          data: [
            {
              project: "mantle-staked-ether",
              symbol: "METH",
              chain: "Ethereum",
              apy: 3.5,
              tvlUsd: 100_000_000,
            },
          ],
        });
      throw new Error("nope");
    });
    await methRate.captureMethRate({ ethPriceUsd: 2200 });
    // Step 2: everything dies.
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    const r = await methRate.fetchMethRate();
    expect(r.degraded).toBe(true);
    expect(r.source).toMatch(/^cached:/);
    expect(typeof r.snapshotAgeSec).toBe("number");
  });

  test("all live sources fail + no snapshot → throws", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    });
    await expect(methRate.fetchMethRate()).rejects.toThrow();
  });

  // ── reference-rate persistence ───────────────────────────────

  test("first capture sets reference rate, second does NOT overwrite", async () => {
    const rate1 = "1058200000000000000"; // 1.0582
    const rate2 = "1059500000000000000"; // 1.0595
    let callIdx = 0;

    global.fetch = jest.fn(async (url) => {
      if (url.includes("yields.llama.fi")) return jsonResp(null, false, 502);
      if (url.includes("meth.mantle.xyz")) {
        callIdx += 1;
        return jsonResp({
          exchangeRate: callIdx === 1 ? 1.0582 : 1.0595,
          apy: 3.41,
        });
      }
      throw new Error("unexpected: " + url);
    });

    const first = await methRate.captureMethRate({ ethPriceUsd: 2200 });
    expect(first.referenceSet).toBe(true);
    // Float-to-atomic conversion has 1-2 wei tolerance via Math.round.
    expect(BigInt(first.snapshot.referenceRateAtomic)).toBeGreaterThan(
      BigInt("1058199999999999000")
    );
    expect(BigInt(first.snapshot.referenceRateAtomic)).toBeLessThan(
      BigInt("1058200000000001000")
    );
    const refAfterFirst = first.snapshot.referenceRateAtomic;

    const second = await methRate.captureMethRate({ ethPriceUsd: 2210 });
    expect(second.referenceSet).toBe(false);
    expect(second.snapshot.referenceRateAtomic).toBe(refAfterFirst); // unchanged
    expect(second.snapshot.captures.length).toBe(2);
    // Second capture rate ≈ 1.0595 within float tolerance.
    expect(BigInt(second.snapshot.captures[1].currentRateAtomic)).toBeGreaterThan(
      BigInt("1059499999999999000")
    );
    expect(BigInt(second.snapshot.captures[1].currentRateAtomic)).toBeLessThan(
      BigInt("1059500000001000000")
    );
  });

  test("captures array bounded to SNAPSHOT_MAX_CAPTURES", async () => {
    // Synthesise a snapshot just over the limit and ensure the
    // next capture trims it.
    const overcap = methRate.SNAPSHOT_MAX_CAPTURES + 5;
    const seedCaptures = Array.from({ length: overcap }, (_, i) => ({
      ts: new Date(Date.now() - (overcap - i) * 60_000).toISOString(),
      currentRateAtomic: "1058200000000000000",
      apyPct: 3.4,
      tvlUsd: null,
      source: "defillama",
      ethPriceUsd: 2200,
    }));
    const seed = {
      referenceRateAtomic: "1058200000000000000",
      referenceTs: seedCaptures[0].ts,
      referenceCapturedFromSource: "defillama",
      captures: seedCaptures,
    };
    fs.writeFileSync(methRate.SNAPSHOT_PATH, JSON.stringify(seed));

    global.fetch = jest.fn(async (url) => {
      if (url.includes("yields.llama.fi"))
        return jsonResp({
          data: [
            {
              project: "mantle-staked-ether",
              symbol: "METH",
              chain: "Ethereum",
              apy: 3.42,
              tvlUsd: 100_000_000,
            },
          ],
        });
      throw new Error("nope");
    });
    const out = await methRate.captureMethRate({ ethPriceUsd: 2210 });
    expect(out.snapshot.captures.length).toBe(methRate.SNAPSHOT_MAX_CAPTURES);
  });

  // ── calcPassiveYield ────────────────────────────────────────

  test("rate advanced 1% → returns positive yield, USD computed", () => {
    const rateRef = "1000000000000000000"; // 1.0
    const rateNow = "1010000000000000000"; // 1.01
    const r = methRate.calcPassiveYield({
      balanceFloat: 0.006,
      rateNowAtomic: rateNow,
      rateRefAtomic: rateRef,
      ethPriceUsd: 2200,
    });
    expect(r.assetHealth).toBe("ok");
    expect(r.rateDeltaBps).toBe(100); // 1%
    // 0.006 mETH × 0.01 ETH delta = 0.00006 ETH × $2200 = $0.132
    expect(r.passiveYieldUsd).toBeCloseTo(0.132, 4);
  });

  test("rate going backwards → 0 yield + assetHealth:drift, never negative number", () => {
    const r = methRate.calcPassiveYield({
      balanceFloat: 0.006,
      rateNowAtomic: "990000000000000000",
      rateRefAtomic: "1000000000000000000",
      ethPriceUsd: 2200,
    });
    expect(r.passiveYieldEthAtomic).toBe("0");
    expect(r.passiveYieldUsd).toBe(0);
    expect(r.assetHealth).toBe("drift");
    expect(r.rateDeltaBps).toBeLessThan(0);
  });

  test("missing rates → assetHealth:no-data + zero values", () => {
    const r = methRate.calcPassiveYield({
      balanceFloat: 0.006,
      rateNowAtomic: null,
      rateRefAtomic: null,
      ethPriceUsd: 2200,
    });
    expect(r.assetHealth).toBe("no-data");
    expect(r.passiveYieldEthAtomic).toBe("0");
    expect(r.passiveYieldUsd).toBe(0);
  });
});
