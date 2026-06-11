#!/usr/bin/env node

const BASE_URL =
  process.env.JUDGE_SMOKE_BASE_URL || "https://frontend-seven-beta-46.vercel.app";

const MAX_LAST_CYCLE_AGE_SEC = Number(
  process.env.JUDGE_SMOKE_MAX_LAST_CYCLE_AGE_SEC || 6 * 60 * 60
);

async function readJson(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON (${res.status}): ${text.slice(0, 160)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${JSON.stringify(json).slice(0, 240)}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const failures = [];
  const warnings = [];

  const record = async (name, fn) => {
    try {
      const result = await fn();
      console.log(`PASS ${name}${result ? ` — ${result}` : ""}`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      console.error(`FAIL ${name} — ${error.message}`);
    }
  };

  await record("/api/health", async () => {
    const data = await readJson("/api/health");
    assert(data.status === "ok", `status=${data.status}`);
    const lastCycleAge = finiteNumber(data.lastCycleAge);
    assert(lastCycleAge !== null, "lastCycleAge missing");
    assert(
      lastCycleAge <= MAX_LAST_CYCLE_AGE_SEC,
      `lastCycleAge=${lastCycleAge}s exceeds ${MAX_LAST_CYCLE_AGE_SEC}s`
    );
    assert(Number(data.cyclesFailed24h || 0) === 0, `cyclesFailed24h=${data.cyclesFailed24h}`);
    const gasDays = finiteNumber(data.gasRunway?.daysRemaining);
    if (gasDays !== null && gasDays < 7) {
      warnings.push(`/api/health: gas runway is ${gasDays.toFixed(1)} days`);
    }
    return `lastCycleAge=${lastCycleAge}s; failed24h=${data.cyclesFailed24h || 0}`;
  });

  await record("/api/decisions", async () => {
    const data = await readJson("/api/decisions");
    const total = finiteNumber(data.totalProposals ?? data.totalDecisions ?? data.total);
    const approved = finiteNumber(data.totalApproved);
    const rejected = finiteNumber(data.totalRejected);
    assert(total !== null && total > 0, "total proposal count missing");
    assert(approved !== null && rejected !== null, "approved/rejected counts missing");
    assert(Math.abs(approved + rejected - total) <= 2, `counter drift too high: ${approved}+${rejected} vs ${total}`);
    assert(Array.isArray(data.decisions) && data.decisions.length > 0, "recent decisions missing");
    return `total=${total}; approved=${approved}; rejected=${rejected}`;
  });

  await record("/api/proof-explorer", async () => {
    const data = await readJson("/api/proof-explorer");
    assert(!data.error, `error=${data.error}`);
    const total = finiteNumber(data.totalDecisions);
    const proposals = finiteNumber(data.validation?.totalProposals);
    assert(total !== null && total > 0, "totalDecisions missing");
    assert(proposals !== null && proposals > 0, "validation.totalProposals missing");
    assert(Math.abs(total - proposals) <= 2, `DecisionLog/proposal drift too high: ${total} vs ${proposals}`);
    return `decisions=${total}; proposals=${proposals}`;
  });

  await record("/api/performance", async () => {
    const data = await readJson("/api/performance");
    assert(finiteNumber(data.settledCount) !== null, "settledCount missing");
    assert(finiteNumber(data.winRate) !== null, "winRate missing");
    assert(finiteNumber(data.outcomeScoreBps) !== null, "outcomeScoreBps missing");
    assert(
      data.realizedTradingPnlBps === null,
      `realizedTradingPnlBps must remain null, got ${data.realizedTradingPnlBps}`
    );
    return `settled=${data.settledCount}; winRate=${data.winRate}; score=${data.outcomeScoreBps}`;
  });

  await record("/api/agent-card", async () => {
    const data = await readJson("/api/agent-card");
    assert(["ok", "degraded"].includes(data.status), `status=${data.status}`);
    assert(data.systemPromptVersion, "systemPromptVersion missing");
    assert(!data.cardStats?.consensusRate, "ambiguous cardStats.consensusRate leaked");
    assert(
      ["card-author-declared", "sanitized", "stale-hidden", "missing"].includes(
        data.cardStatsStatus
      ),
      `unexpected cardStatsStatus=${data.cardStatsStatus}`
    );
    if (data.cardStatsStatus === "stale-hidden") {
      warnings.push("/api/agent-card: on-chain Agent Card stats are hidden because the IPFS snapshot is stale");
    }
    return `source=${data.source}; stats=${data.cardStatsStatus}`;
  });

  if (warnings.length) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(`WARN ${warning}`);
  }

  if (failures.length) {
    console.error("\nJudge smoke failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`\nJudge smoke passed for ${BASE_URL}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
