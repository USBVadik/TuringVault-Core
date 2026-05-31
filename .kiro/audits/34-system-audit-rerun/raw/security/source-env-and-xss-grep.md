README.md:252:Live mode is gated by `CHALLENGE_LIVE_ENABLED=true` (Vercel env var). When
README.md:298:- Default-off behind `EVOLVED_PROMPTS_ENABLED=true` env flag while
README.md:391:# Set: PRIVATE_KEY, NANSEN_API_KEY, AWS_*, PINATA_*, GOOGLE_APPLICATION_CREDENTIALS
.github/workflows/agent-cycle.yml:37:      RWA_EXECUTE_ENABLED: "true"
.github/workflows/agent-cycle.yml:40:      HEARTBEAT_MODE_ENABLED: ${{ secrets.HEARTBEAT_MODE_ENABLED }}
.github/workflows/agent-cycle.yml:44:      PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
.github/workflows/agent-cycle.yml:46:      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
.github/workflows/agent-cycle.yml:48:      NANSEN_API_KEY: ${{ secrets.NANSEN_API_KEY }}
.github/workflows/agent-cycle.yml:50:      PINATA_JWT: ${{ secrets.PINATA_JWT }}
.github/workflows/agent-cycle.yml:51:      PINATA_API_KEY: ${{ secrets.PINATA_API_KEY }}
.github/workflows/agent-cycle.yml:52:      PINATA_SECRET: ${{ secrets.PINATA_SECRET }}
.github/workflows/replay-validator.yml:46:      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
.github/workflows/replay-validator.yml:118:          [ -z "${AWS_SECRET_ACCESS_KEY}" ] && MISSING="${MISSING} AWS_SECRET_ACCESS_KEY"
src/orchestrator/unifiedMarketData.js:26:const NANSEN_CACHE_TTL = 15 * 60 * 1000; // 15 min for Nansen (expensive)
src/orchestrator/unifiedMarketData.js:107:  return cached("nansen_mcp", NANSEN_CACHE_TTL, async () => {
src/orchestrator/unifiedMarketData.js:108:    const apiKey = process.env.NANSEN_API_KEY;
src/orchestrator/unifiedMarketData.js:204:    context += `[NANSEN SMART MONEY - mETH/Mantle]\n`;
src/orchestrator/unifiedMarketData.js:216:    context += `[NANSEN SMART MONEY - Token Holdings]\n`;
src/orchestrator/main.js:32:const provider = new ethers.JsonRpcProvider(process.env.MANTLE_SEPOLIA_RPC_URL);
src/orchestrator/main.js:33:const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
src/orchestrator/disciplineLayer.js:16:const MANTLE_RPC = process.env.MANTLE_RPC || "https://rpc.mantle.xyz";
src/orchestrator/disciplineLayer.js:18:  process.env.WALLET_ADDRESS || "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";
src/orchestrator/runChallenge.js:154:          process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz"
src/orchestrator/runChallenge.js:157:        deps.wallet ?? new ethers.Wallet(process.env.PRIVATE_KEY, provider);
src/orchestrator/challengeBudget.js:50:  const raw = process.env.CHALLENGE_DAILY_CAP;
src/orchestrator/integratedOrchestrator.js:21:    process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
src/orchestrator/integratedOrchestrator.js:22:  if (_env.AWS_SECRET_ACCESS_KEY)
src/orchestrator/integratedOrchestrator.js:23:    process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
src/orchestrator/integratedOrchestrator.js:49:  mode: process.env.ORCHESTRATOR_MODE || "autonomous", // autonomous | supervised | paper
src/orchestrator/integratedOrchestrator.js:181:    (process.env.PRIVATE_KEY?.startsWith("0x") ? "" : "0x") +
src/orchestrator/integratedOrchestrator.js:182:      process.env.PRIVATE_KEY,
src/orchestrator/fullLoop.js:33:    process.env.MANTLE_SEPOLIA_RPC_URL
src/orchestrator/fullLoop.js:35:  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
src/evolution/promptEvolution.js:71:      : new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
src/config/rwaLimits.js:5: * Each value can be overridden via `process.env.RWA_*` without code
src/ipfs/storage.js:8: *   1. Pinata Cloud (PINATA_JWT in .env) — persistent pinning
src/ipfs/storage.js:13:const PINATA_JWT_ENV_READ <- process.env.PINATA_JWT || "";
src/ipfs/storage.js:14:const PINATA_GATEWAY =
src/ipfs/storage.js:15:  process.env.PINATA_GATEWAY || "green-linear-jay-761.mypinata.cloud";
src/ipfs/storage.js:24:  if (!PINATA_JWT) {
src/ipfs/storage.js:48:          Authorization: `Bearer ${PINATA_JWT}`,
src/ipfs/storage.js:62:                gateway: `https://${PINATA_GATEWAY}/ipfs/${parsed.IpfsHash}`,
src/ipfs/storage.js:191:          process.env.AGENT_ADDRESS ||
src/orchestrator/signalEngine.js:250:    const apiKey = process.env.NANSEN_API_KEY;
src/orchestrator/aiEngine.js:10:  region: process.env.AWS_REGION || "us-east-1",
src/orchestrator/aiEngine.js:12:    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
src/orchestrator/aiEngine.js:13:    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
src/mcp/nansenMCP.js:10: * Auth: NANSEN-API-KEY header
src/mcp/nansenMCP.js:14:const NANSEN_MCP_ENDPOINT = "https://mcp.nansen.ai/ra/mcp";
src/mcp/nansenMCP.js:19:    this.endpoint = NANSEN_MCP_ENDPOINT;
src/mcp/nansenMCP.js:54:          "NANSEN-API-KEY": this.apiKey,
src/mcp/nansenMCP.js:253:    let context = "=== NANSEN SMART MONEY INTELLIGENCE ===\n";
src/mcp/nansenMCP.js:275:    context += "\n=== END NANSEN DATA ===";
src/mcp/nansenMCP.js:297:        "NANSEN-API-KEY": this.apiKey,
src/orchestrator/heartbeatMode.js:17: *   - is gated behind HEARTBEAT_MODE_ENABLED env flag (default OFF)
src/orchestrator/heartbeatMode.js:66:  if (env.HEARTBEAT_MODE_ENABLED !== "true") {
src/config/constants.js:53:  NANSEN_WEIGHT: 0.15, // Weight of smart money flow
src/orchestrator/geminiArbiter.js:19:    process.env.GOOGLE_APPLICATION_CREDENTIALS,
src/orchestrator/geminiArbiter.js:30:const PROJECT_ID = process.env.GEMINI_PROJECT_ID || "lina-494709";
src/orchestrator/multiAgentLoop.js:24:      process.env.AWS_ACCESS_KEY_ID = _env.AWS_ACCESS_KEY_ID;
src/orchestrator/multiAgentLoop.js:25:    if (_env.AWS_SECRET_ACCESS_KEY)
src/orchestrator/multiAgentLoop.js:26:      process.env.AWS_SECRET_ACCESS_KEY = _env.AWS_SECRET_ACCESS_KEY;
src/orchestrator/multiAgentLoop.js:209:  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
src/orchestrator/multiAgentLoop.js:223:  if (!dryRun && process.env.RWA_EXECUTE_ENABLED === "true") {
src/orchestrator/multiAgentLoop.js:682:      const usdt0 = new USDT0Module({ privateKey: process.env.PRIVATE_KEY });
src/orchestrator/multiAgentLoop.js:718:      // Step 4.6: Execute (gated by RWA_EXECUTE_ENABLED).
src/orchestrator/multiAgentLoop.js:719:      if (process.env.RWA_EXECUTE_ENABLED === "true") {
src/orchestrator/multiAgentLoop.js:721:          privateKey: process.env.PRIVATE_KEY,
src/orchestrator/multiAgentLoop.js:769:          `   [DRY] RWA_EXECUTE_ENABLED!='true' — intent logged, no TX`
src/orchestrator/multiAgentLoop.js:842:    if (process.env.RWA_EXECUTE_ENABLED !== "true") {
src/orchestrator/multiAgentLoop.js:844:        `   [DRY] RWA_EXECUTE_ENABLED!='true' — directional swap skipped`
src/orchestrator/multiAgentLoop.js:860:          privateKey: process.env.PRIVATE_KEY,
src/orchestrator/multiAgentLoop.js:969:          process.env.RWA_MAX_PER_CYCLE_USD || 5
src/orchestrator/multiAgentLoop.js:1188:  // Gated behind HEARTBEAT_MODE_ENABLED=true. Default OFF in CI.
src/orchestrator/multiAgentLoop.js:1271:      if (decision_.fire && process.env.RWA_EXECUTE_ENABLED === "true") {
src/orchestrator/multiAgentLoop.js:1279:          privateKey: process.env.PRIVATE_KEY,
src/kms/tencentKMS.js:58:    this.keyId = options.keyId || process.env.TENCENT_KMS_KEY_ID;
src/kms/tencentKMS.js:59:    this.secretId = options.secretId || process.env.TENCENT_KMS_SECRET_ID;
src/kms/tencentKMS.js:60:    this.secretKey = options.secretKey || process.env.TENCENT_KMS_SECRET_KEY;
src/kms/tencentKMS.js:281:    const rawKey = process.env.PRIVATE_KEY;
src/kms/tencentKMS.js:320:    const rawKey = process.env.PRIVATE_KEY;
src/execution/tencentKMS.js:177: * - Otherwise → local wallet from PRIVATE_KEY
src/execution/tencentKMS.js:180:  const kmsKeyId = process.env.TENCENT_KMS_KEY_ID;
src/execution/tencentKMS.js:181:  const kmsSecretId = process.env.TENCENT_SECRET_ID;
src/execution/tencentKMS.js:182:  const kmsSecretKey = process.env.TENCENT_SECRET_KEY;
src/execution/tencentKMS.js:183:  const privateKey = process.env.PRIVATE_KEY;
src/execution/tencentKMS.js:189:    region: process.env.TENCENT_REGION || "ap-guangzhou",
src/strategies/liveGridBot.js:41:    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
src/rwa/usdyModule.js:254:    const rwa = new RWAModule({ privateKey: process.env.PRIVATE_KEY });
src/rwa/usdt0Module.js:121:    const mod = new USDT0Module({ privateKey: process.env.PRIVATE_KEY });
src/rwa/usdt0Module.js:131:      console.log("No PRIVATE_KEY set — skipping live read.");
src/orchestrator/marketData.js:16:  NANSEN_NETFLOW: "https://api.nansen.ai/api/v1/smart-money/netflow",
src/orchestrator/marketData.js:21:const NANSEN_CACHE_MS = 15 * 60 * 1000;
src/orchestrator/marketData.js:46:  const apiKey = process.env.NANSEN_API_KEY;
src/orchestrator/marketData.js:53:  if (nansenCache.data && Date.now() - nansenCache.ts < NANSEN_CACHE_MS) {
src/orchestrator/marketData.js:64:    const data = await fetchWithTimeout(ENDPOINTS.NANSEN_NETFLOW, 15000, {
src/orchestrator/multiAgent.js:208:  region: process.env.AWS_REGION || "us-east-1",
src/orchestrator/multiAgent.js:210:    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
src/orchestrator/multiAgent.js:211:    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
src/orchestrator/multiAgent.js:620:  analyst: process.env.ANALYST_MODEL || "zai.glm-5", // Z.ai GLM-5 (latest, hackathon partner)
src/orchestrator/multiAgent.js:621:  validator: process.env.VALIDATOR_MODEL || "us.anthropic.claude-sonnet-4-6", // Claude as independent validator
src/orchestrator/multiAgent.js:756:// Operator opts in by setting EVOLVED_PROMPTS_ENABLED=true. When opted in,
src/orchestrator/multiAgent.js:760:const EVOLVED_PROMPTS_ENABLED = process.env.EVOLVED_PROMPTS_ENABLED === "true";
src/orchestrator/multiAgent.js:852:  // We now load evolved prompts ONLY when EVOLVED_PROMPTS_ENABLED=true and
src/orchestrator/multiAgent.js:860:  if (EVOLVED_PROMPTS_ENABLED && evolved?.analyst) {
src/orchestrator/multiAgent.js:868:      } available but disabled (EVOLVED_PROMPTS_ENABLED=false)`
src/dex/merchantMoe.js:559:      privateKey: process.env.PRIVATE_KEY,
src/data/elfa.js:34:const ELFA_BASE = process.env.ELFA_BASE_URL || "https://api.elfa.ai";
src/data/elfa.js:53:  const apiKey = process.env.ELFA_API_KEY;
src/data/elfa.js:251:  if (!process.env.ELFA_API_KEY) {
src/orchestrator/outcomeTracker.js:33:const OUTCOMES_PATH = process.env.OUTCOMES_PATH
src/orchestrator/outcomeTracker.js:34:  ? path.resolve(process.env.OUTCOMES_PATH)
src/orchestrator/outcomeTracker.js:38:const MANTLE_RPC = process.env.MANTLE_RPC || "https://rpc.mantle.xyz";
src/orchestrator/outcomeTracker.js:40:  process.env.WALLET_ADDRESS || "0xDC783CDBfA993f3FC299460627b204E83bf4fb5a";
frontend/app/api/strategy/route.ts:328:        process.env.RWA_EXECUTE_ENABLED === "true" ||
frontend/app/api/health/route.ts:11: *   5. process.env.AGENT_RUN_MODE             → manual | cron-* | unknown
frontend/app/api/health/route.ts:16: * Never echoes secrets. No PRIVATE_KEY, AWS_*, PINATA_*, NANSEN_API_KEY,
frontend/app/api/health/route.ts:359:    let mode = (process.env.AGENT_RUN_MODE ?? "unknown").slice(0, 32);
frontend/app/api/elfa-snapshot/route.ts:22:export const dynamic = "force-dynamic";const ELFA_BASE = process.env.ELFA_BASE_URL || "https://api.elfa.ai";
frontend/app/api/elfa-snapshot/route.ts:26:  const apiKey = process.env.ELFA_API_KEY;
frontend/app/api/elfa-snapshot/route.ts:154:  if (!process.env.ELFA_API_KEY) {
frontend/app/api/yield-meth/route.ts:181:      process.env.NEXT_PUBLIC_BASE_URL ||
frontend/app/api/challenge/route.ts:5: *   1. LIVE_MULTI_AGENT — when CHALLENGE_LIVE_ENABLED=true, invoke the
frontend/app/api/challenge/route.ts:237:      note: "Preview mode: deterministic rules. The same gates fire in production. Operator can flip CHALLENGE_LIVE_ENABLED=true to invoke the real multi-agent pipeline.",
frontend/app/api/challenge/route.ts:291:  const liveMode = process.env.CHALLENGE_LIVE_ENABLED === "true";
frontend/app/api/cron/trigger-cycle/route.ts:8: * Protected by CRON_SECRET (Vercel cron auth) to prevent abuse.
frontend/app/api/cron/trigger-cycle/route.ts:28:const GITHUB_TOKEN = process.env.GH_DISPATCH_TOKEN; // Fine-grained PAT with actions:write
frontend/app/api/cron/trigger-cycle/route.ts:45:  // Vercel cron sends Authorization header with CRON_SECRET
frontend/app/api/cron/trigger-cycle/route.ts:47:  const cronSecret = process.env.CRON_SECRET;
frontend/app/api/cron/trigger-cycle/route.ts:51:      { error: "CRON_SECRET not configured", triggered: false },
frontend/app/api/cron/trigger-cycle/route.ts:73:      { error: "GH_DISPATCH_TOKEN not configured", triggered: false },
