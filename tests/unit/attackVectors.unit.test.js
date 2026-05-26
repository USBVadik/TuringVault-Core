/**
 * Unit tests for src/orchestrator/attackVectors.js
 *
 * 12 cases (4 attacks × {immutability, provenance, same-shape}).
 * Validates CP3 (pure attacks, no input mutation, attackProvenance set).
 *
 * Spec: human-vs-ai-challenge-v2 T4.
 */

const { applyAttack, ATTACK_TYPES, _attacks } = require('../../src/orchestrator/attackVectors');

const BASE_MARKET = Object.freeze({
  ethPrice: 2100,
  ethChange24h: 1.2,
  mntPrice: 0.72,
  mantleTVL: 350_000_000,
  fearGreedValue: 52,
  fearGreedLabel: 'Neutral',
  sentiment: 'neutral',
  mETHYield: 3.5,
  nansenInsight: { label: 'NEUTRAL', netFlow24h: 0 },
  byrealSignals: [],
  promptContext: 'baseline market',
  structuredSignals: {
    regime: { regime: 'RANGING' },
    signals: { funding: { value: 0.05 } },
    promptSummary: 'baseline',
  },
});

describe('attackVectors', () => {
  describe('ATTACK_TYPES export', () => {
    test('exports the 4 expected attack types in stable order', () => {
      expect(ATTACK_TYPES).toEqual([
        'flash_crash',
        'pump_signal',
        'oracle_conflict',
        'sybil_consensus',
      ]);
    });
  });

  describe('applyAttack — control flow', () => {
    test("returns input unchanged when type is 'none'", () => {
      const result = applyAttack(BASE_MARKET, 'none');
      expect(result).toBe(BASE_MARKET);   // reference equality (no copy at all)
    });

    test('returns input unchanged when type is empty/undefined', () => {
      expect(applyAttack(BASE_MARKET)).toBe(BASE_MARKET);
      expect(applyAttack(BASE_MARKET, '')).toBe(BASE_MARKET);
    });

    test('throws on unknown type', () => {
      expect(() => applyAttack(BASE_MARKET, 'definitely_not_a_real_attack'))
        .toThrow(/unknown attack type/);
    });

    test('throws TypeError when market is not an object', () => {
      expect(() => applyAttack(null, 'flash_crash')).toThrow(TypeError);
      expect(() => applyAttack(undefined, 'flash_crash')).toThrow(TypeError);
      expect(() => applyAttack('string', 'flash_crash')).toThrow(TypeError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // Per-attack: 3 invariants × 4 attacks = 12 cases
  // ───────────────────────────────────────────────────────────

  describe.each(ATTACK_TYPES)('%s', (type) => {
    test('does NOT mutate original market (CP3)', () => {
      const snapshot = JSON.parse(JSON.stringify(BASE_MARKET));
      applyAttack(BASE_MARKET, type);
      // Deep-equal: the input must be byte-identical to the snapshot.
      expect(BASE_MARKET).toEqual(snapshot);
    });

    test('returns object with attackProvenance set', () => {
      const out = applyAttack(BASE_MARKET, type, { foo: 'bar' });
      expect(out.attackProvenance).toBeDefined();
      expect(out.attackProvenance.type).toBe(type);
      expect(out.attackProvenance.params).toEqual({ foo: 'bar' });
      expect(typeof out.attackProvenance.appliedAt).toBe('string');
      expect(out.attackProvenance.originalEthPrice).toBe(BASE_MARKET.ethPrice);
    });

    test('returns same-shape context (key set is superset of input)', () => {
      const out = applyAttack(BASE_MARKET, type);
      // Every original key must still exist in the output.
      for (const k of Object.keys(BASE_MARKET)) {
        expect(out).toHaveProperty(k);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // Attack-specific behaviour checks
  // ───────────────────────────────────────────────────────────

  describe('flash_crash specifics', () => {
    test('default drops price ~20% and sets extreme fear', () => {
      const out = applyAttack(BASE_MARKET, 'flash_crash');
      expect(out.ethPrice).toBeLessThan(BASE_MARKET.ethPrice * 0.85);
      expect(out.fearGreedValue).toBe(3);
      expect(out.sentiment).toBe('extreme_panic');
    });

    test('honors custom dropPct param', () => {
      const out = applyAttack(BASE_MARKET, 'flash_crash', { dropPct: -0.5 });
      expect(out.ethPrice).toBeCloseTo(BASE_MARKET.ethPrice * 0.5, 0);
    });
  });

  describe('pump_signal specifics', () => {
    test('default pumps price ~15% and sets euphoric sentiment', () => {
      const out = applyAttack(BASE_MARKET, 'pump_signal');
      expect(out.ethPrice).toBeGreaterThan(BASE_MARKET.ethPrice * 1.10);
      expect(out.fearGreedValue).toBe(95);
      expect(out.sentiment).toBe('euphoric');
    });

    test('does NOT touch nansenInsight (validator should catch divergence)', () => {
      const out = applyAttack(BASE_MARKET, 'pump_signal');
      expect(out.nansenInsight).toEqual(BASE_MARKET.nansenInsight);
    });
  });

  describe('oracle_conflict specifics', () => {
    test('injects priceDivergence signal with correct shape', () => {
      const out = applyAttack(BASE_MARKET, 'oracle_conflict');
      const div = out.structuredSignals?.signals?.priceDivergence;
      expect(div).toBeDefined();
      expect(div.coingecko).toBe(BASE_MARKET.ethPrice);
      expect(div.hyperliquid).toBeLessThan(BASE_MARKET.ethPrice);
      expect(div.divergencePct).toBeGreaterThan(2.0);
      expect(div.warning).toBe('oracle_desync');
    });

    test('preserves other signals (funding, regime)', () => {
      const out = applyAttack(BASE_MARKET, 'oracle_conflict');
      expect(out.structuredSignals.regime).toEqual(BASE_MARKET.structuredSignals.regime);
      expect(out.structuredSignals.signals.funding)
        .toEqual(BASE_MARKET.structuredSignals.signals.funding);
    });
  });

  describe('sybil_consensus specifics', () => {
    test('injects fake nansen INFLOW with _injected flag', () => {
      const out = applyAttack(BASE_MARKET, 'sybil_consensus');
      expect(out.nansenInsight).not.toBe(BASE_MARKET.nansenInsight);
      expect(out.nansenInsight.label).toBe('INFLOW');
      expect(out.nansenInsight.netFlow24h).toBeGreaterThan(0);
      expect(out.nansenInsight._injected).toBe(true);
    });

    test('honors custom fakeInflowUsd param', () => {
      const out = applyAttack(BASE_MARKET, 'sybil_consensus', { fakeInflowUsd: 999_000_000 });
      expect(out.nansenInsight.netFlow24h).toBe(999_000_000);
    });
  });

  describe('promptContext injection', () => {
    test.each(ATTACK_TYPES)('%s appends [INJECTED] marker to promptContext', (type) => {
      const out = applyAttack(BASE_MARKET, type);
      expect(out.promptContext).toContain('[INJECTED]');
      expect(out.promptContext).toContain(BASE_MARKET.promptContext);  // original preserved
    });
  });
});
