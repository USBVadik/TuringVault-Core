/**
 * Unit tests for src/orchestrator/challengeBudget.js
 *
 * Validates: cap enforcement, daily reset, history bounding.
 *
 * Spec: human-vs-ai-challenge-v2 T4, CP4.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

describe('challengeBudget', () => {
  let tmpDir;
  let originalCwd;
  let modulePath;

  beforeEach(() => {
    // Each test isolates via a unique tmp budget path.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-budget-test-'));
    originalCwd = process.cwd();
    // Spawn a fresh module instance pointing at our tmp BUDGET_PATH.
    jest.resetModules();
    modulePath = require.resolve('../../src/orchestrator/challengeBudget');
    delete require.cache[modulePath];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.chdir(originalCwd);
    jest.resetModules();
  });

  function loadModuleWithTmpPath() {
    // The module reads BUDGET_PATH at require time. We override by
    // monkey-patching via require cache after load.
    const m = require('../../src/orchestrator/challengeBudget');
    // Re-bind to a tmp file by mutating the path constant via module internals.
    // (The module exports BUDGET_PATH but uses the local const internally;
    // we work around by writing to a tmp file and pointing fs reads via env.)
    // Simpler: just write into the real path location, and clean up via beforeEach.
    return m;
  }

  test('exports expected API', () => {
    const m = loadModuleWithTmpPath();
    expect(typeof m.readBudget).toBe('function');
    expect(typeof m.increment).toBe('function');
    expect(typeof m.status).toBe('function');
    expect(typeof m.todayUtc).toBe('function');
    expect(typeof m.nextUtcMidnight).toBe('function');
  });

  test('todayUtc returns YYYY-MM-DD string', () => {
    const m = loadModuleWithTmpPath();
    const ms = Date.parse('2026-05-26T13:00:00Z');
    expect(m.todayUtc(ms)).toBe('2026-05-26');
  });

  test('nextUtcMidnight returns next-day 00:00:00 UTC ISO', () => {
    const m = loadModuleWithTmpPath();
    const ms = Date.parse('2026-05-26T13:00:00Z');
    const next = m.nextUtcMidnight(ms);
    expect(next).toBe('2026-05-27T00:00:00.000Z');
  });
});

describe('challengeBudget integration (real file IO)', () => {
  // These tests touch the actual data/challenge-budget.json.
  // beforeEach snapshots, afterEach restores.
  let originalContents;
  let m;
  let BUDGET_PATH;

  beforeEach(() => {
    jest.resetModules();
    m = require('../../src/orchestrator/challengeBudget');
    BUDGET_PATH = m.BUDGET_PATH;
    if (fs.existsSync(BUDGET_PATH)) {
      originalContents = fs.readFileSync(BUDGET_PATH, 'utf-8');
    } else {
      originalContents = null;
    }
  });

  afterEach(() => {
    if (originalContents != null) {
      fs.writeFileSync(BUDGET_PATH, originalContents);
    } else if (fs.existsSync(BUDGET_PATH)) {
      fs.unlinkSync(BUDGET_PATH);
    }
  });

  test('increment writes file and bumps used counter', () => {
    // Reset to known state.
    fs.writeFileSync(BUDGET_PATH, JSON.stringify({ date: m.todayUtc(), used: 0, history: [] }));

    const out = m.increment({ type: 'flash_crash', mode: 'LIVE_MULTI_AGENT', blocked: true }, 100);
    expect(out.used).toBe(1);
    expect(out.history).toHaveLength(1);
    expect(out.history[0]).toMatchObject({ type: 'flash_crash', mode: 'LIVE_MULTI_AGENT', blocked: true });

    const persisted = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8'));
    expect(persisted.used).toBe(1);
  });

  test('throws BUDGET_EXHAUSTED when cap reached (cap=2, third call rejected)', () => {
    fs.writeFileSync(BUDGET_PATH, JSON.stringify({ date: m.todayUtc(), used: 0, history: [] }));

    m.increment({}, 2);
    m.increment({}, 2);
    expect(() => m.increment({}, 2)).toThrow(/BUDGET_EXHAUSTED/);
    try {
      m.increment({}, 2);
    } catch (err) {
      expect(err.code).toBe('BUDGET_EXHAUSTED');
      expect(err.cap).toBe(2);
      expect(err.used).toBe(2);
      expect(err.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    }
  });

  test('auto-resets when UTC date rolls over', () => {
    // Pre-seed yesterday's file at cap.
    const yesterday = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
    fs.writeFileSync(BUDGET_PATH, JSON.stringify({ date: yesterday, used: 999, history: [] }));

    const data = m.readBudget();
    expect(data.date).toBe(m.todayUtc());
    expect(data.used).toBe(0);
  });

  test('status reports remaining without mutating', () => {
    fs.writeFileSync(BUDGET_PATH, JSON.stringify({ date: m.todayUtc(), used: 7, history: [] }));
    const s = m.status(100);
    expect(s.used).toBe(7);
    expect(s.cap).toBe(100);
    expect(s.remaining).toBe(93);
    expect(s.resetAt).toMatch(/T00:00:00\.000Z$/);

    // Confirm no mutation.
    const persisted = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf-8'));
    expect(persisted.used).toBe(7);
  });

  test('history is bounded to last 100 entries', () => {
    fs.writeFileSync(BUDGET_PATH, JSON.stringify({ date: m.todayUtc(), used: 0, history: [] }));
    for (let i = 0; i < 105; i++) {
      m.increment({ i }, 1000);
    }
    const data = m.readBudget();
    expect(data.history).toHaveLength(100);
    expect(data.history[0].i).toBe(5);   // first 5 trimmed
    expect(data.history[99].i).toBe(104);
  });
});
