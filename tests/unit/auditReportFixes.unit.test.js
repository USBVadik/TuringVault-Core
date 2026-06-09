const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");

describe("post-audit report regression fixes", () => {
  test("Vercel cron bridge keeps hourly daily watchdog slots within Hobby limits", () => {
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "frontend/vercel.json"), "utf8")
    );

    const jobs =
      vercelConfig.crons?.filter(
        (entry) => entry.path === "/api/cron/trigger-cycle"
      ) ?? [];

    expect(jobs).toHaveLength(24);
    expect(jobs.map((job) => job.schedule)).toEqual(
      Array.from({ length: 24 }, (_, hour) => `23 ${hour} * * *`)
    );
    for (const job of jobs) {
      expect(job.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    }
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
    expect(workflow).toMatch(/actions\/checkout@v6/);
    expect(workflow).toMatch(/actions\/setup-node@v6/);
    expect(workflow).not.toMatch(/actions\/checkout@v4|actions\/setup-node@v4/);
  });

  test("agent-cycle workflow starts cycles from the latest main revision", () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/agent-cycle.yml"),
      "utf8"
    );

    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(workflow).toMatch(/name:\s*Sync latest main before cycle/);
    expect(workflow).toMatch(/git pull --ff-only origin main/);
    expect(workflow.indexOf("name: Sync latest main before cycle")).toBeLessThan(
      workflow.indexOf("name: Run cycle")
    );
  });

  test("agent-cycle workflow does not rebase generated JSON state on push conflict", () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/agent-cycle.yml"),
      "utf8"
    );
    const commitScript = fs.readFileSync(
      path.join(repoRoot, "scripts/commit-cycle-state.sh"),
      "utf8"
    );

    expect(workflow).not.toMatch(/git pull --rebase --autostash/);
    expect(workflow).toMatch(/bash scripts\/commit-cycle-state\.sh/);
    expect(commitScript).toMatch(/origin\/main advanced after cycle generation/);
    expect(commitScript).toMatch(/Skipping stale cycle commit/);
  });

  test("agent-watchdog runs the rescue cycle itself instead of dispatching a workflow", () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, ".github/workflows/agent-watchdog.yml"),
      "utf8"
    );

    expect(workflow).toMatch(/node scripts\/run-cycle\.js/);
    expect(workflow).toMatch(/bash scripts\/commit-cycle-state\.sh/);
    expect(workflow).toMatch(/group:\s*agent-cycle/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(workflow).not.toMatch(/gh workflow run|actions:\s*write/);
  });

  test("GitHub workflows avoid Node 20 action versions", () => {
    const workflowDir = path.join(repoRoot, ".github/workflows");
    const workflows = fs
      .readdirSync(workflowDir)
      .filter((name) => name.endsWith(".yml"))
      .map((name) => [
        name,
        fs.readFileSync(path.join(workflowDir, name), "utf8"),
    ]);

    for (const [name, workflow] of workflows) {
      const labeledWorkflow = `${name}\n${workflow}`;
      expect(labeledWorkflow).not.toMatch(
        /actions\/(?:checkout|setup-node)@v4/
      );
      expect(labeledWorkflow).not.toMatch(/foundry-rs\/foundry-toolchain@v1/);
    }
  });

  test("Proof Explorer direct data path enriches rows with displayTier and real DecisionLog ids", () => {
    const proofData = fs.readFileSync(
      path.join(repoRoot, "frontend/app/lib/proof-data.ts"),
      "utf8"
    );
    const proofClient = fs.readFileSync(
      path.join(repoRoot, "frontend/app/proof-explorer/client.tsx"),
      "utf8"
    );

    expect(proofData).toMatch(/loadOutcomesIndex/);
    expect(proofData).toMatch(/outcomesIndex\.get\(decisionLogId \+ 1\)/);
    expect(proofData).toMatch(/id:\s*decisionLogId/);
    expect(proofData).toMatch(/displayTier:/);
    expect(proofData).toMatch(/executedOnChain:/);
    expect(proofClient).toMatch(/typeof d\.id === "number" \? d\.id/);
    expect(proofClient).not.toMatch(/const decisionNum = totalDecisions - i/);
  });

  test("mETH yield API does not mark fresh cron captures as degraded", () => {
    const route = fs.readFileSync(
      path.join(repoRoot, "frontend/app/api/yield-meth/route.ts"),
      "utf8"
    );

    expect(route).toMatch(/FRESH_CAPTURE_MAX_AGE_SEC\s*=\s*90\s*\*\s*60/);
    expect(route).toMatch(
      /degraded:\s*snapshotAgeSec\s*>\s*FRESH_CAPTURE_MAX_AGE_SEC/
    );
    expect(route).not.toMatch(/from\s+["']fs["']|from\s+["']path["']/);
    expect(route).not.toMatch(/degraded:\s*true,\s*\n\s*snapshotAgeSec/);
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
