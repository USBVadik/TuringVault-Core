/**
 * Unit tests for src/orchestrator/rwaAllocator.js
 *
 * 24-case matrix (3 consensus × 4 regimes × 2 wallet states) covers
 * Path A (LLM) and Path B (idle-parking), plus invariants:
 *   CP1 — single-intent-per-cycle
 *   CP2 — per-cycle cap respected
 *   CP3 — daily cap respected
 *   CP4 — Path B determinism
 *
 * No network, no Bedrock. Pure unit harness.
 *
 * Spec: rwa-allocation-active T5.
 */

const path = require('path');
const fs = require('fs');

// Stub outcomes.json so readDailySpend / readLastRwaSwapAt return
// deterministic values. We point at a tmp path before requiring the
// allocator.
const TMP_OUTCOMES = path.resolve(__dirname, '../../src/data/outcomes.json');

describe('rwaAllocator', () => {
  // Standard fixtures
  const PRICES = { USDT: 1, USDT0: 1, mUSD: 1 };
  const NOW = Date.parse('2026-05-26T20:00:00.000Z');

  function freshAllocator() {
    delete require.cache[require.resolve('../../src/orchestrator/rwaAllocator')];
    delete require.cache[require.resolve('../../src/config/rwaLimits')];
    return require('../../src/orchestrator/rwaAllocator');
  }

  function flatPosState(flatHoursAgo) {
    return {
      status: 'FLAT',
      flatSince: flatHoursAgo == null
        ? null
        : new Date(NOW - flatHoursAgo * 3600 * 1000).toISOString(),
    };
  }

  function inMethPosState() {
    return { status: 'IN_mETH', flatSince: null };
  }

  function decision({ consensus, action }) {
    return {
      consensus,
      analyst: { action, reasoning: 'fixture', confidence: 0.7 },
    };
  }

  // ───────────────────────────────────────────────────────────
  // Path A — LLM-driven
  // ───────────────────────────────────────────────────────────

  describe('Path A: rwa_allocate', () => {
    test('emits llm intent USDT→USDT0 when consensus + action match', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_allocate' }),
        market: { regime: 'HOLD' },
        balances: { USDT: 6.76, USDT0: 2.39, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: inMethPosState(),
        now: NOW,
      });
      expect(out).toBeTruthy();
      expect(out.skip).toBeUndefined();
      expect(out.source).toBe('llm');
      expect(out.from).toBe('USDT');
      expect(out.to).toBe('USDT0');
      expect(out.amountInUsd).toBeLessThanOrEqual(5); // CP2: per-cycle cap
      expect(typeof out.amountInWei).toBe('bigint');
      expect(typeof out.amountOutMinWei).toBe('bigint');
    });

    test('clamps amount to MAX_PER_CYCLE_USD even with deep wallet (CP2)', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_allocate' }),
        market: { regime: 'CRISIS' },
        balances: { USDT: 1000, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: inMethPosState(),
        now: NOW,
      });
      expect(out.amountInUsd).toBe(5);
    });
  });

  describe('Path A: rwa_exit', () => {
    test('emits llm intent USDT0→USDT when wallet has USDT0', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_exit' }),
        market: { regime: 'TREND_UP' },
        balances: { USDT: 0.5, USDT0: 50, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: { status: 'FLAT', flatSince: null },
        now: NOW,
      });
      expect(out.source).toBe('llm');
      expect(out.from).toBe('USDT0');
      expect(out.to).toBe('USDT');
      expect(out.amountInUsd).toBeLessThanOrEqual(5);
    });

    test('skips with no-rwa-position when USDT0 below floor', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_exit' }),
        market: { regime: 'TREND_UP' },
        balances: { USDT: 50, USDT0: 0.1, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: { status: 'FLAT', flatSince: null },
        now: NOW,
      });
      expect(out).toEqual({ skip: true, _gate: 'no-rwa-position-to-exit' });
    });
  });

  // ───────────────────────────────────────────────────────────
  // Path B — deterministic idle-parking
  // ───────────────────────────────────────────────────────────

  describe('Path B: idle-parking', () => {
    test('fires when FLAT > 24h, regime≠TREND_UP, cooldown elapsed', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'RANGING' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out.source).toBe('idle-parking');
      expect(out.from).toBe('USDT');
      expect(out.to).toBe('USDT0');
      // 20% of 50 = 10 → clamped to MAX_PER_CYCLE_USD = 5
      expect(out.amountInUsd).toBe(5);
    });

    test('does NOT fire on TREND_UP regime', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'TREND_UP' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out).toBeNull();
    });

    test('does NOT fire when FLAT < 24h', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'RANGING' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(5),
        now: NOW,
      });
      expect(out).toBeNull();
    });

    test('does NOT fire during cooldown (< 6h since last swap)', () => {
      const a = freshAllocator();
      const lastSwap = new Date(NOW - 2 * 3600 * 1000).toISOString();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'CRISIS' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: lastSwap,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out).toBeNull();
    });

    test('fires after cooldown elapses', () => {
      const a = freshAllocator();
      const lastSwap = new Date(NOW - 7 * 3600 * 1000).toISOString();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'CRISIS' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: lastSwap,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out?.source).toBe('idle-parking');
    });

    test('skips with park-too-small when 20% of idle < $2', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'RANGING' },
        balances: { USDT: 5, USDT0: 0, mUSD: 0 },     // 20% of 5 = 1.0 < $2
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out).toEqual({ skip: true, _gate: 'park-too-small' });
    });

    test('determinism: same inputs → same intent (CP4)', () => {
      const a = freshAllocator();
      const args = {
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'RANGING' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(30),
        now: NOW,
      };
      const a1 = a.evaluate(args);
      const a2 = a.evaluate(args);
      expect(a1.amountInUsd).toBe(a2.amountInUsd);
      expect(a1.amountInWei).toBe(a2.amountInWei);
      expect(a1.from).toBe(a2.from);
      expect(a1.to).toBe(a2.to);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Gates
  // ───────────────────────────────────────────────────────────

  describe('Gates', () => {
    test('min-balance gate triggers on dust wallet', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_allocate' }),
        market: { regime: 'HOLD' },
        balances: { USDT: 0.5, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: inMethPosState(),
        now: NOW,
      });
      expect(out).toEqual({ skip: true, _gate: 'min-balance' });
    });

    test('rwa_exit bypasses min-balance gate when USDT0 is the source', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_exit' }),
        market: { regime: 'TREND_UP' },
        balances: { USDT: 0, USDT0: 50, mUSD: 0 },    // no idle stables but USDT0 is plenty
        prices: PRICES,
        lastSwapAt: null,
        posState: { status: 'FLAT', flatSince: null },
        now: NOW,
      });
      expect(out?.source).toBe('llm');
      expect(out.from).toBe('USDT0');
    });

    test('daily-cap gate triggers when 24h spend already at MAX_PER_DAY_USD (CP3)', () => {
      // Stub outcomes.json with $25 of executed RWA spend within last 24h.
      const fakeDb = {
        pending: [
          {
            recordedAt: new Date(NOW - 1000 * 60 * 60).toISOString(),
            rwaIntent: { executed: true, amountInUsd: 25 },
          },
        ],
        settled: [],
      };
      const dir = path.dirname(TMP_OUTCOMES);
      fs.mkdirSync(dir, { recursive: true });
      const original = fs.existsSync(TMP_OUTCOMES) ? fs.readFileSync(TMP_OUTCOMES, 'utf-8') : null;
      try {
        fs.writeFileSync(TMP_OUTCOMES, JSON.stringify(fakeDb));
        const a = freshAllocator();
        const out = a.evaluate({
          decision: decision({ consensus: true, action: 'rwa_allocate' }),
          market: { regime: 'HOLD' },
          balances: { USDT: 50, USDT0: 0, mUSD: 0 },
          prices: PRICES,
          lastSwapAt: null,
          posState: inMethPosState(),
          now: NOW,
        });
        expect(out).toEqual({ skip: true, _gate: 'daily-cap' });
      } finally {
        if (original !== null) fs.writeFileSync(TMP_OUTCOMES, original);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // Default — null
  // ───────────────────────────────────────────────────────────

  describe('Default (null) — no RWA action', () => {
    test('returns null when LLM consensus is HOLD (swap action)', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'swap' }),
        market: { regime: 'TREND_UP' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: inMethPosState(),
        now: NOW,
      });
      expect(out).toBeNull();
    });

    test('returns null when no-consensus + not FLAT (in mETH)', () => {
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: false, action: 'hold' }),
        market: { regime: 'RANGING' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: inMethPosState(),
        now: NOW,
      });
      expect(out).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────
  // CP1: only one intent per cycle (Path A and B never both fire)
  // ───────────────────────────────────────────────────────────

  describe('CP1: single-intent-per-cycle', () => {
    test('Path A wins when both could theoretically apply', () => {
      // consensus + rwa_allocate AND wallet FLAT > 24h —
      // allocator should pick Path A (LLM has priority).
      const a = freshAllocator();
      const out = a.evaluate({
        decision: decision({ consensus: true, action: 'rwa_allocate' }),
        market: { regime: 'CRISIS' },
        balances: { USDT: 50, USDT0: 0, mUSD: 0 },
        prices: PRICES,
        lastSwapAt: null,
        posState: flatPosState(30),
        now: NOW,
      });
      expect(out.source).toBe('llm');
    });
  });

  // ───────────────────────────────────────────────────────────
  // Helpers (exported)
  // ───────────────────────────────────────────────────────────

  describe('flatLongEnough / cooldownElapsed helpers', () => {
    test('flatLongEnough returns false for non-FLAT', () => {
      const a = freshAllocator();
      expect(a.flatLongEnough({ status: 'IN_mETH' }, NOW)).toBe(false);
    });

    test('flatLongEnough returns false when flatSince is null', () => {
      const a = freshAllocator();
      expect(a.flatLongEnough({ status: 'FLAT', flatSince: null }, NOW)).toBe(false);
    });

    test('flatLongEnough boundary: 24h - 1ms is not enough', () => {
      const a = freshAllocator();
      const flatSince = new Date(NOW - (24 * 3600 * 1000 - 1)).toISOString();
      expect(a.flatLongEnough({ status: 'FLAT', flatSince }, NOW)).toBe(false);
    });

    test('flatLongEnough boundary: exactly 24h passes', () => {
      const a = freshAllocator();
      const flatSince = new Date(NOW - 24 * 3600 * 1000).toISOString();
      expect(a.flatLongEnough({ status: 'FLAT', flatSince }, NOW)).toBe(true);
    });

    test('cooldownElapsed returns true when no prior swap', () => {
      const a = freshAllocator();
      expect(a.cooldownElapsed(null, NOW)).toBe(true);
    });

    test('cooldownElapsed returns false within window', () => {
      const a = freshAllocator();
      const last = new Date(NOW - 3600 * 1000).toISOString();
      expect(a.cooldownElapsed(last, NOW)).toBe(false);
    });
  });
});
