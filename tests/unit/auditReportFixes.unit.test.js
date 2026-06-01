const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");

describe("post-audit report regression fixes", () => {
  test("Vercel cron bridge runs hourly to cover missed GitHub slots", () => {
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "frontend/vercel.json"), "utf8")
    );

    const job = vercelConfig.crons?.find(
      (entry) => entry.path === "/api/cron/trigger-cycle"
    );

    expect(job).toBeTruthy();
    expect(job.schedule).toBe("7 * * * *");
  });

  test("cron bridge dispatch policy only fires when health is stale or unknown", () => {
    const {
      CRON_STALE_AFTER_SEC,
      shouldDispatchAgentCycle,
    } = require("../../frontend/app/api/cron/trigger-cycle/cronTriggerPolicy.js");

    expect(
      shouldDispatchAgentCycle({
        status: "ok",
        lastCycleAge: CRON_STALE_AFTER_SEC - 1,
      })
    ).toMatchObject({ dispatch: false, reason: "cycle-fresh" });

    expect(
      shouldDispatchAgentCycle({
        status: "ok",
        lastCycleAge: CRON_STALE_AFTER_SEC,
      })
    ).toMatchObject({ dispatch: true, reason: "cycle-stale" });

    expect(shouldDispatchAgentCycle(null)).toMatchObject({
      dispatch: true,
      reason: "health-unavailable",
    });
  });

  test("agent-cycle workflow gives run-cycle enough time and preserves timeout evidence", () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/agent-cycle.yml"),
      "utf8"
    );

    expect(workflow).toMatch(/timeout-minutes:\s*15/);
    expect(workflow).toMatch(/timeout 600 node scripts\/run-cycle\.js/);
    expect(workflow).toMatch(/write-cycle-failure-summary\.js/);
  });

  test("cycle failure summary writer records timeout evidence without execution claims", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tv-cycle-failure-"));
    process.env.CYCLE_FAILURE_REPO_ROOT = tmp;
    jest.resetModules();
    const {
      writeFailureSummary,
    } = require("../../scripts/write-cycle-failure-summary.js");

    const summary = writeFailureSummary({
      message: "run-cycle exited 124",
      exitCode: 124,
    });

    expect(summary).toMatchObject({
      decisionTier: "CYCLE_TIMEOUT",
      executionStatus: "FAILED",
      txHashes: [],
      consensus: null,
    });

    const saved = JSON.parse(
      fs.readFileSync(path.join(tmp, "data/last-cycle-summary.json"), "utf8")
    );
    const failures = JSON.parse(
      fs.readFileSync(path.join(tmp, "data/cycle-failures.json"), "utf8")
    );

    expect(saved.decisionTier).toBe("CYCLE_TIMEOUT");
    expect(failures[0].exitCode).toBe(124);
    delete process.env.CYCLE_FAILURE_REPO_ROOT;
  });

  test("Proof Explorer derives current Sourcify summary from contracts data", () => {
    const {
      summarizeSourcifyContracts,
    } = require("../../frontend/app/lib/contractProofSummary.shared.js");
    const contracts = require("../../frontend/app/data/contracts.json");

    const summary = summarizeSourcifyContracts(contracts);

    expect(summary).toMatchObject({
      total: 6,
      verified: 5,
      detail: "6 contracts · 5/6 Sourcify-verified",
    });
    expect(summary.detail).not.toMatch(/4 Sourcify/);
  });

  test("README does not present mutable 24h cron uptime as a fixed live value", () => {
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    expect(readme).not.toMatch(/Cron uptime last 24h:\s*\d+\s+succeeded/i);
    expect(readme).toMatch(/Cron status is live-only/i);
  });

  test("Audit 25 Sourcify probe is explicitly superseded by Audit 26", () => {
    const audit25 = fs.readFileSync(
      path.join(repoRoot, ".kiro/audits/25-system-audit-20-points-bundle.md"),
      "utf8"
    );

    expect(audit25).toMatch(/Audit 26 supersedes/i);
    expect(audit25).toMatch(/5 of 6 current contracts/i);
    expect(audit25).not.toMatch(/README and pitch deck both claim 6\/6/);
  });

  test("secret scanner reports transaction hashes without failing the scan", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tv-secrets-"));
    const txHash = `0x${"a".repeat(64)}`;
    fs.writeFileSync(
      path.join(tmp, "response.json"),
      JSON.stringify({ txHash }, null, 2)
    );

    const res = spawnSync("bash", ["scripts/audit/check-secrets.sh", tmp], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/Transaction-hash-shaped strings/);
    expect(res.stdout).toMatch(/No named secret patterns found/);
  });

  test("secret scanner still fails on named secret assignments", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tv-secrets-"));
    fs.writeFileSync(
      path.join(tmp, "bad.env"),
      `PRIVATE_KEY=0x${"b".repeat(64)}\n`
    );

    const res = spawnSync("bash", ["scripts/audit/check-secrets.sh", tmp], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/Named secret pattern/);
    expect(res.stdout).toMatch(/FOUND named secret-shaped strings/);
  });
});
