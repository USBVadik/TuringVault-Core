frontend/app/api/proof-explorer/route.ts:5:// (multiple contract calls + IPFS fetch). s-maxage=30 with stale-while-revalidate
frontend/app/api/proof-explorer/route.ts:14:        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
frontend/app/api/strategy/route.ts:5:export const dynamic = "force-dynamic";
frontend/app/api/strategy/route.ts:7:// in-memory cache, but with revalidate=0 every cold-start hit the
frontend/app/api/strategy/route.ts:9:export const revalidate = 30;
frontend/app/api/strategy/route.ts:168:      db = JSON.parse(fs.readFileSync(p, "utf-8"));
frontend/app/api/strategy/route.ts:173:          "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/src/data/outcomes.json";
frontend/app/api/strategy/route.ts:174:        const res = await fetch(url, { next: { revalidate: 0 } });
frontend/app/api/strategy/route.ts:200:      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
frontend/app/api/strategy/route.ts:222:        const raw = fs.readFileSync(statePath, "utf-8");
frontend/app/api/strategy/route.ts:227:          "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/src/data/position_state.json";
frontend/app/api/strategy/route.ts:363:      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
frontend/app/api/market/route.ts:7:export const revalidate = 60;
frontend/app/api/market/route.ts:8:export const dynamic = "force-dynamic";
frontend/app/api/market/route.ts:79:            "Cache-Control":
frontend/app/api/market/route.ts:80:              "public, s-maxage=60, stale-while-revalidate=600",
frontend/app/api/market/route.ts:111:        "Cache-Control":
frontend/app/api/market/route.ts:112:          "public, s-maxage=60, stale-while-revalidate=600",
frontend/app/api/market/route.ts:129:            "Cache-Control":
frontend/app/api/market/route.ts:130:              "public, s-maxage=60, stale-while-revalidate=600",
frontend/app/api/performance/route.ts:29:export const dynamic = "force-dynamic";
frontend/app/api/performance/route.ts:31:// for wallet balances + CoinGecko for prices. With s-maxage=30 below,
frontend/app/api/performance/route.ts:33:export const revalidate = 30;
frontend/app/api/performance/route.ts:40:  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
frontend/app/api/performance/route.ts:127:    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
frontend/app/api/performance/route.ts:133:async function fetchFromGitHub<T>(filePath: string): Promise<T | null> {
frontend/app/api/performance/route.ts:135:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
frontend/app/api/performance/route.ts:136:    const res = await fetch(url, { next: { revalidate: 30 } });
frontend/app/api/performance/route.ts:258:    outcomes = await fetchFromGitHub<Outcomes>("src/data/outcomes.json");
frontend/app/api/reasoning/route.ts:5:export const dynamic = "force-dynamic";
frontend/app/api/reasoning/route.ts:36:        return JSON.parse(fs.readFileSync(localPath, "utf8"));
frontend/app/api/reasoning/route.ts:39:        const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${githubPath}`;
frontend/app/api/reasoning/route.ts:58:      const log = fs.readFileSync(loopLogPath, "utf8");
frontend/app/api/reasoning/route.ts:79:      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
frontend/app/api/challenge/route.ts:28:export const maxDuration = 60;
frontend/app/api/challenge/route.ts:29:export const dynamic = "force-dynamic";
frontend/app/api/challenge/route.ts:30:export const revalidate = 0;
frontend/app/api/cron/trigger-cycle/route.ts:25:export const dynamic = "force-dynamic";
frontend/app/api/cron/trigger-cycle/route.ts:26:export const revalidate = 0;
frontend/app/api/reputation/route.ts:5:export const dynamic = "force-dynamic";
frontend/app/api/reputation/route.ts:9:export const revalidate = 30;
frontend/app/api/reputation/route.ts:60:          "Cache-Control":
frontend/app/api/reputation/route.ts:61:            "public, s-maxage=30, stale-while-revalidate=300",
frontend/app/api/reputation/route.ts:111:            "Cache-Control":
frontend/app/api/reputation/route.ts:112:              "public, s-maxage=30, stale-while-revalidate=300",
frontend/app/api/yield-meth/route.ts:28:export const revalidate = 60;
frontend/app/api/yield-meth/route.ts:67:      const raw = fs.readFileSync(p, "utf-8");
frontend/app/api/yield-meth/route.ts:77:async function fetchFromGitHub<T>(filePath: string): Promise<T | null> {
frontend/app/api/yield-meth/route.ts:79:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
frontend/app/api/yield-meth/route.ts:80:    const res = await fetch(url, { next: { revalidate: 30 } });
frontend/app/api/yield-meth/route.ts:184:      next: { revalidate: 60 },
frontend/app/api/yield-meth/route.ts:204:    snapshot = await fetchFromGitHub<Snapshot>(
frontend/app/api/yield-meth/route.ts:238:          "Cache-Control":
frontend/app/api/yield-meth/route.ts:239:            "public, s-maxage=60, stale-while-revalidate=300",
frontend/app/api/yield-meth/route.ts:293:        "Cache-Control":
frontend/app/api/yield-meth/route.ts:294:          "public, s-maxage=60, stale-while-revalidate=300",
frontend/app/api/discipline/route.ts:22:export const dynamic = "force-dynamic";
frontend/app/api/discipline/route.ts:25:// raw on Vercel). Adding 30s ISR + s-maxage cache cuts cold-start
frontend/app/api/discipline/route.ts:27:export const revalidate = 30;
frontend/app/api/discipline/route.ts:71:  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
frontend/app/api/discipline/route.ts:82:    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
frontend/app/api/discipline/route.ts:88:async function fetchFromGitHub<T>(filePath: string): Promise<T | null> {
frontend/app/api/discipline/route.ts:90:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
frontend/app/api/discipline/route.ts:91:    const res = await fetch(url, { next: { revalidate: 30 } });
frontend/app/api/discipline/route.ts:175:    history = await fetchFromGitHub<HistoryEntry[]>("data/discipline-history.json");
frontend/app/api/evolution/route.ts:5:export const dynamic = "force-dynamic";
frontend/app/api/evolution/route.ts:119:      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
frontend/app/api/health/route.ts:29:export const dynamic = "force-dynamic";
frontend/app/api/health/route.ts:31:// runtime) — now 30s ISR. Combined with s-maxage=30 below this gives
frontend/app/api/health/route.ts:33:export const revalidate = 30;
frontend/app/api/health/route.ts:121:const NO_STORE: HeadersInit = { "Cache-Control": "no-store, max-age=0" };
frontend/app/api/health/route.ts:126: * every request a judge makes. With s-maxage + stale-while-revalidate
frontend/app/api/health/route.ts:138:  "Cache-Control":
frontend/app/api/health/route.ts:139:    "public, s-maxage=30, stale-while-revalidate=300",
frontend/app/api/health/route.ts:171:    const raw = fs.readFileSync(filePath, "utf-8");
frontend/app/api/health/route.ts:307:async function fetchFromGitHub<T>(filePath: string): Promise<T | null> {
frontend/app/api/health/route.ts:309:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
frontend/app/api/health/route.ts:310:    const res = await fetch(url, { next: { revalidate: 30 } }); // Cache for 30 seconds
frontend/app/api/health/route.ts:333:      outcomes = await fetchFromGitHub<Outcomes>("src/data/outcomes.json");
frontend/app/api/health/route.ts:370:      parseMetrics = await fetchFromGitHub<typeof parseMetrics>("src/data/parse_metrics.json");
frontend/app/api/health/route.ts:403:      thresholdState = await fetchFromGitHub<typeof thresholdState>("src/data/threshold_state.json");
frontend/app/api/health/route.ts:417:      lastCycleSummary = await fetchFromGitHub<LastCycleSummary>("data/last-cycle-summary.json");
frontend/app/api/health/route.ts:430:      historyAll = await fetchFromGitHub<CycleHistoryRaw[]>("data/cycle-history.json");
frontend/app/api/health/route.ts:445:      failures = await fetchFromGitHub<CycleFailureRaw[]>("data/cycle-failures.json");
frontend/app/api/backtest/route.ts:3:export const dynamic = "force-dynamic";
frontend/app/api/backtest/route.ts:9:      "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/src/data/outcomes.json",
frontend/app/api/backtest/route.ts:10:      { next: { revalidate: 60 } } // Cache for 60 seconds
frontend/app/api/backtest/route.ts:114:    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
frontend/app/api/decisions/route.ts:35:export const dynamic = "force-dynamic";
frontend/app/api/decisions/route.ts:37:// Now 60s ISR with s-maxage=60, stale-while-revalidate=600 below so
frontend/app/api/decisions/route.ts:39:export const revalidate = 60;
frontend/app/api/decisions/route.ts:168:      db = JSON.parse(fs.readFileSync(p, "utf-8"));
frontend/app/api/decisions/route.ts:170:      db = await fetchFromGitHub("src/data/outcomes.json");
frontend/app/api/decisions/route.ts:214:async function fetchFromGitHub(filePath: string): Promise<Record<string, unknown> | null> {
frontend/app/api/decisions/route.ts:216:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/${filePath}`;
frontend/app/api/decisions/route.ts:217:    const res = await fetch(url, { next: { revalidate: 30 } });
frontend/app/api/decisions/route.ts:359:          "Cache-Control":
frontend/app/api/decisions/route.ts:360:            "public, s-maxage=60, stale-while-revalidate=600",
frontend/app/api/replay/[id]/route.ts:26:export const dynamic = "force-dynamic";
frontend/app/api/replay/[id]/route.ts:27:// Cache for 60s on the edge; Vercel ISR revalidate after 5m. Manifests
frontend/app/api/replay/[id]/route.ts:30:export const revalidate = 300;
frontend/app/api/replay/[id]/route.ts:83:    return JSON.parse(fs.readFileSync(localPath, "utf8"));
frontend/app/api/replay/[id]/route.ts:87:    const url = `https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/.kiro/audits/raw/replay-manifests/${fname}`;
frontend/app/api/replay/[id]/route.ts:282:        "Cache-Control":
frontend/app/api/replay/[id]/route.ts:283:          "public, s-maxage=300, stale-while-revalidate=86400",
frontend/app/api/replay/route.ts:14:export const dynamic = "force-dynamic";
frontend/app/api/replay/route.ts:15:export const revalidate = 60;
frontend/app/api/replay/route.ts:36:      const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
frontend/app/api/replay/route.ts:121:        "Cache-Control":
frontend/app/api/replay/route.ts:122:          "public, s-maxage=60, stale-while-revalidate=300",
frontend/app/api/agent-card/route.ts:34:export const dynamic = "force-dynamic";
frontend/app/api/agent-card/route.ts:35:export const revalidate = 0;
frontend/app/api/agent-card/route.ts:38:  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
frontend/app/api/agent-card/route.ts:136:      return JSON.parse(fs.readFileSync(filePath, "utf-8")) as AgentCardRaw;
frontend/app/api/agent-card/route.ts:140:      "https://raw.githubusercontent.com/USBVadik/TuringVault-Core/main/assets/agent-card.json";
frontend/app/api/agent-card/route.ts:304:    headers: { "Cache-Control": "no-store, max-age=0" },
frontend/app/api/elfa-snapshot/route.ts:22:export const dynamic = "force-dynamic";const ELFA_BASE = process.env.ELFA_BASE_URL || "https://api.elfa.ai";
frontend/app/api/elfa-snapshot/route.ts:232:    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
