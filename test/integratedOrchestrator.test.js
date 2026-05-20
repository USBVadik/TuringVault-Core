/**
 * Tests for Integrated Orchestrator v2
 * VaR calculation, Intent Queue, autonomy levels
 */
const { calculateVaR, IntentQueue, CONFIG } = require("../src/orchestrator/integratedOrchestrator");
const fs = require("fs");
const path = require("path");

describe("VaR Calculator", () => {
  test("hold action = very low VaR", () => {
    const market = { ethChange24h: 0.5, fearGreedIndex: 50 };
    const decision = { analyst: { action: "hold", confidence: 0.85 } };
    const var_bps = calculateVaR(market, decision);
    expect(var_bps).toBeLessThan(CONFIG.varThreshold.autonomous);
  });

  test("swap + high volatility = high VaR", () => {
    const market = { ethChange24h: 5.0, fearGreedIndex: 15 };
    const decision = { analyst: { action: "swap", confidence: 0.55 } };
    const var_bps = calculateVaR(market, decision);
    expect(var_bps).toBeGreaterThan(CONFIG.varThreshold.supervised);
  });

  test("moderate conditions = supervised range", () => {
    const market = { ethChange24h: 1.5, fearGreedIndex: 45 };
    const decision = { analyst: { action: "swap", confidence: 0.7 } };
    const var_bps = calculateVaR(market, decision);
    expect(var_bps).toBeGreaterThanOrEqual(CONFIG.varThreshold.autonomous);
    expect(var_bps).toBeLessThanOrEqual(CONFIG.varThreshold.blocked);
  });

  test("extreme greed = premium added", () => {
    const market1 = { ethChange24h: 1, fearGreedIndex: 50 };
    const market2 = { ethChange24h: 1, fearGreedIndex: 90 };
    const decision = { analyst: { action: "buy", confidence: 0.7 } };
    const var1 = calculateVaR(market1, decision);
    const var2 = calculateVaR(market2, decision);
    expect(var2).toBeGreaterThan(var1);
  });

  test("zero volatility hold = near zero VaR", () => {
    const market = { ethChange24h: 0, fearGreedIndex: 50 };
    const decision = { analyst: { action: "hold", confidence: 0.95 } };
    const var_bps = calculateVaR(market, decision);
    expect(var_bps).toBeLessThan(10);
  });
});

describe("Intent Queue", () => {
  const testQueuePath = path.resolve(__dirname, "../data/test_intent_queue.json");
  let queue;

  beforeAll(() => {
    // Point queue to test path
    queue = new IntentQueue();
    queue.queuePath = testQueuePath;
    queue._ensureDir();
  });

  afterAll(() => {
    if (fs.existsSync(testQueuePath)) fs.unlinkSync(testQueuePath);
  });

  beforeEach(() => {
    fs.writeFileSync(testQueuePath, "[]");
  });

  test("add intent creates pending entry", async () => {
    const intent = await queue.addIntent({
      action: "swap",
      targetAsset: "mETH",
      var_bps: 75,
    });
    expect(intent.id).toMatch(/^intent_/);
    expect(intent.status).toBe("pending_human_approval");
    expect(intent.action).toBe("swap");
  });

  test("getPending returns only pending intents", async () => {
    await queue.addIntent({ action: "swap" });
    await queue.addIntent({ action: "hold" });
    const pending = queue.getPending();
    expect(pending.length).toBe(2);
  });

  test("approve changes status", async () => {
    const intent = await queue.addIntent({ action: "swap" });
    const approved = queue.approve(intent.id);
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toBeDefined();
    expect(queue.getPending().length).toBe(0);
  });

  test("reject changes status with reason", async () => {
    const intent = await queue.addIntent({ action: "swap" });
    const rejected = queue.reject(intent.id, "too risky");
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectReason).toBe("too risky");
  });

  test("approve nonexistent returns undefined", () => {
    const result = queue.approve("nonexistent_id");
    expect(result).toBeUndefined();
  });
});

describe("CONFIG thresholds", () => {
  test("threshold ordering is valid", () => {
    expect(CONFIG.varThreshold.autonomous).toBeLessThan(CONFIG.varThreshold.supervised);
    expect(CONFIG.varThreshold.supervised).toBeLessThan(CONFIG.varThreshold.blocked);
  });

  test("min confidence is reasonable", () => {
    expect(CONFIG.minConfidence).toBeGreaterThanOrEqual(0.5);
    expect(CONFIG.minConfidence).toBeLessThanOrEqual(0.9);
  });
});
