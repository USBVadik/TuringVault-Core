/**
 * Unit tests for src/orchestrator/attackVectors.js
 *
 * Validates: 4 attack types × {immutability, provenance, same-shape}.
 * No network, no Bedrock. Pure unit harness.
 *
 * Spec: human-vs-ai-challenge-v2 T4, CP3.
 */

const { applyAttack, KNOWN_ATTACKS } = require('../../src/orchestrator/attackVectors');

const FIXTURE = Object.freeze({
  ethPrice: 2100,
  ethChange24h: 1.5,
  mntPrice: 0.72,
  mantleTVL: 500_000_000,
  fearGreedValue: 50,
  fearGreedClass: 'Neutral',
  sentiment: 'neutral',
  nansenInsight: { available: true, label: 'NEUTRAL' },
  byrealSignals: [],
  promptContext: 'baseline market context',
  structuredSignals: { regime: { regime: 'RANGING' }, signals: {} },
});

describe('applyAttack', () => {
  describe('contract', () => {
    test('throws on unknown attack type', () => {
      expect(() => applyAttack(FIXTURE, 'doom_loop')).toThrow(/unknown attack type/i);
    });

    test('returns identity on type=none', () => {
      const out = applyAttack(FIXTURE, 'none');
      expect(out).toBe(FIXTURE);
    });

    test('returns identity on falsy type', () => {
      expect(applyAttack(FIXTURE, '')).toBe(FIXTURE);
      expect(applyAttack(FIXTURE, null)).toBe(FIXTURE);
      expect(applyAttack(FIXTURE, undefined)).toBe(FIXTURE);
    });

    test('throws on non-object market', () => {
      expect(() => applyAttack(null, 'flash_crash')).toThrow();
      expect(() => applyAttack('string', 'flash_crash')).toThrow();
    });

    test('exposes KNOWN_ATTACKS list', () => {
      expect(KNOWN_ATTACKS).toEqual(
        expect.arrayContaining(['flash_crash', 'pump_signal', 'oracle_conflict', 'sybil_consensus']),
      );
      expect(KNOWN_ATTACKS).toHaveLength(4);
    });
  });

  describe.each(KNOWN_ATTACKS)('attack=%s', (type) => {
    test('does not mutate input (immutability)', () => {
      const before = JSON.stringify(FIXTURE);
      applyAttack(FIXTURE, type);
      const after = JSON.stringify(FIXTURE);
      expect(after).toBe(before);
    });

    test('returns object with attackProvenance', () => {
      const out = applyAttack(FIXTURE, type, { foo: 'bar' });
      expect(out.attackProvenance).toMatchObject({
        type,
        params: { foo: 'bar' },
        originalEthPrice: FIXTURE.ethPrice,
      });
      expect(out.attackProvenance.appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('preserves original-shape required fields', () => {
      const out = applyAttack(FIXTURE, type);
      expect(out).toHaveProperty('ethPrice');
      expect(out).toHaveProperty('promptContext');
      expect(typeof out.ethPrice).toBe('number');
      expect(typeof out.promptContext).toBe('string');
      // promptContext should be appended-to, not truncated.
      expect(out.promptContext.length).toBeGreaterThanOrEqual(FIXTURE.promptContext.length);
    });
  });

  describe('flash_crash specifics', () => {
    test('default drops price by 20%', () => {
      const out = applyAttack(FIXTURE, 'flash_crash');
      expect(out.ethPrice).toBeCloseTo(FIXTURE.ethPrice * 0.80);
      expect(out.ethChange24h).toBeCloseTo(-20);
      expect(out.fearGreedValue).toBe(3);
      expect(out.sentiment).toBe('extreme_panic');
    });

    test('custom dropPct param respected', () => {
      const out = applyAttack(FIXTURE, 'flash_crash', { dropPct: -0.40 });
      expect(out.ethPrice).toBeCloseTo(FIXTURE.ethPrice * 0.60);
      expect(out.ethChange24h).toBeCloseTo(-40);
    });
  });

  describe('pump_signal specifics', () => {
    test('default pumps price by 15%, leaves volume unchanged', () => {
      const out = applyAttack(FIXTURE, 'pump_signal');
      expect(out.ethPrice).toBeCloseTo(FIXTURE.ethPrice * 1.15);
      expect(out.fearGreedValue).toBe(95);
      expect(out.sentiment).toBe('euphoric');
      // nansenInsight should NOT be replaced (divergence is the test).
      expect(out.nansenInsight).toBe(FIXTURE.nansenInsight);
    });
  });

  describe('oracle_conflict specifics', () => {
    test('default injects 7.8% divergence into structuredSignals', () => {
      const out = applyAttack(FIXTURE, 'oracle_conflict');
      const div = out.structuredSignals.signals.priceDivergence;
      expect(div).toBeDefined();
      expect(div.divergencePct).toBeCloseTo(7.8);
      expect(div.coingecko).toBeCloseTo(FIXTURE.ethPrice);
      expect(div.hyperliquid).toBeCloseTo(FIXTURE.ethPrice * (1 - 0.078));
      expect(div.warning).toBe('oracle_desync');
    });

    test('preserves other structuredSignals fields', () => {
      const out = applyAttack(FIXTURE, 'oracle_conflict');
      expect(out.structuredSignals.regime).toEqual(FIXTURE.structuredSignals.regime);
    });
  });

  describe('sybil_consensus specifics', () => {
    test('default injects fake $50M smart-money inflow', () => {
      const out = applyAttack(FIXTURE, 'sybil_consensus');
      expect(out.nansenInsight.netFlow24h).toBe(50_000_000);
      expect(out.nansenInsight.activeSmartMoney).toBe(9999);
      expect(out.nansenInsight.label).toBe('INFLOW');
      expect(out.nansenInsight.claimed).toBe(true);
      expect(out.nansenInsight._injected).toBe(true);
    });

    test('preserves other market fields', () => {
      const out = applyAttack(FIXTURE, 'sybil_consensus');
      expect(out.ethPrice).toBe(FIXTURE.ethPrice);
      expect(out.fearGreedValue).toBe(FIXTURE.fearGreedValue);
    });
  });
});
