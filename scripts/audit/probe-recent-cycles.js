/**
 * Probe last N cycles via replay manifests + cycle-history. Bypasses
 * the 4h settle-wait so we see live trading direction.
 */
const fs = require("fs");
const path = require("path");

const N = Number(process.argv[2]) || 20;

const dir = path.resolve(__dirname, "../../.kiro/audits/raw/replay-manifests");
if (!fs.existsSync(dir)) {
  console.error("No replay-manifests dir");
  process.exit(1);
}
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("cycle-") && f.endsWith(".json"))
  .sort()
  .slice(-N);

console.log(`\n=== Recent ${files.length} cycles via replay manifests ===\n`);

const tally = { "risk-off": 0, "risk-on": 0, "no-swap": 0 };
const wraps = [];
const directions = [];

console.log(
  `${"cycle".padStart(5)} | ${"action".padEnd(12)} | ${"target".padEnd(7)} | ${"direction".padEnd(9)} | wrap`
);
console.log("-".repeat(70));

for (const f of files) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
    const cycle = m.cycleId || m.decisionId || f.match(/(\d+)/)?.[1];
    const analyst = m.captures?.find((c) => c.role === "analyst");
    const rawAnalyst = analyst?.rawText || analyst?.responseRaw || "";
    let parsed = {};
    try {
      // Most analysts return JSON directly or wrapped in markdown.
      const m1 = rawAnalyst.match(/\{[\s\S]*\}/);
      if (m1) parsed = JSON.parse(m1[0]);
    } catch {
      /* ignore parse fail */
    }
    const action = parsed.action || "-";
    const targetAsset = parsed.targetAsset || "-";
    const direction = parsed.direction || "-";
    const normalizedDirection = String(direction).replace(/_/g, "-");
    if (normalizedDirection === "risk-off") tally["risk-off"] += 1;
    else if (normalizedDirection === "risk-on") tally["risk-on"] += 1;
    else tally["no-swap"] += 1;
    directions.push({ cycle, action, target: targetAsset, direction });
    console.log(
      `${String(cycle).padStart(5)} | ${action.padEnd(12)} | ${String(targetAsset).padEnd(7)} | ${String(direction).padEnd(9)} | -`
    );
  } catch (err) {
    console.log(`${f}: parse error — ${err.message.slice(0, 40)}`);
  }
}

console.log(`\n--- Tally ---`);
Object.entries(tally).forEach(([k, v]) => console.log(`  ${k.padEnd(10)} ${v}`));
