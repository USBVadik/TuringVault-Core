# TuringVault Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Deploy a working AI-powered RWA router on Mantle Network for the Turing Test Hackathon 2026.

**Architecture:** Three Solidity contracts (Identity, DecisionLog, Router) + Node.js AI orchestrator + React dashboard. Orchestrator runs a 5-minute loop: collect data → LLM analysis → validate JSON → execute swap → log decision on-chain.

**Tech Stack:** Hardhat, Solidity 0.8.20, OpenZeppelin v5, Ethers.js v6, Node.js, Zod, Next.js, TailwindCSS.

---

## PHASE 1: FOUNDATION (Days 1-7)

---

### Task 1.1: Initialize Hardhat Project

**Objective:** Set up Hardhat with Mantle network configuration and all dependencies.

**Files:**
- Create: `hardhat.config.js`
- Create: `package.json`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize npm and install dependencies**

```bash
cd /root/turingvault
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts ethers dotenv
npm install --save-dev @nomicfoundation/hardhat-verify
```

**Step 2: Create hardhat.config.js**

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    mantleSepolia: {
      url: process.env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    mantleMainnet: {
      url: process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz",
      chainId: 5000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      mantleSepolia: process.env.MANTLESCAN_API_KEY || "placeholder",
      mantleMainnet: process.env.MANTLESCAN_API_KEY || "placeholder"
    },
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: "https://api-sepolia.mantlescan.xyz/api",
          browserURL: "https://sepolia.mantlescan.xyz"
        }
      },
      {
        network: "mantleMainnet",
        chainId: 5000,
        urls: {
          apiURL: "https://api.mantlescan.xyz/api",
          browserURL: "https://mantlescan.xyz"
        }
      }
    ]
  }
};
```

**Step 3: Verify compilation works**

Run: `npx hardhat compile`
Expected: "Nothing to compile" (no contracts yet)

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: initialize hardhat project with Mantle config"
```

---

### Task 1.2: Write TuringVaultIdentity Contract

**Objective:** ERC-8004 compliant identity NFT for the AI agent.

**Files:**
- Create: `contracts/TuringVaultIdentity.sol`
- Create: `tests/TuringVaultIdentity.test.js`

**Step 1: Write the contract**

(See MASTER_SPEC.md Section 4.1 for full code)

**Step 2: Write tests**

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TuringVaultIdentity", function () {
  let identity, owner, other;

  beforeEach(async () => {
    [owner, other] = await ethers.getSigners();
    const Identity = await ethers.getContractFactory("TuringVaultIdentity");
    identity = await Identity.deploy();
  });

  it("should register an agent with URI", async () => {
    const uri = "ipfs://QmTestAgentMetadata";
    const tx = await identity.registerAgent(uri);
    const receipt = await tx.wait();
    expect(await identity.tokenURI(0)).to.equal(uri);
  });

  it("should emit AgentRegistered event", async () => {
    await expect(identity.registerAgent("ipfs://test"))
      .to.emit(identity, "AgentRegistered")
      .withArgs(0, "ipfs://test");
  });

  it("should reject non-owner registration", async () => {
    await expect(identity.connect(other).registerAgent("ipfs://hack"))
      .to.be.revertedWithCustomError(identity, "OwnableUnauthorizedAccount");
  });

  it("should update agent URI", async () => {
    await identity.registerAgent("ipfs://old");
    await identity.updateAgentURI(0, "ipfs://new");
    expect(await identity.tokenURI(0)).to.equal("ipfs://new");
  });
});
```

**Step 3: Run tests**

Run: `npx hardhat test tests/TuringVaultIdentity.test.js`
Expected: 4 passing

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add TuringVaultIdentity (ERC-8004) contract + tests"
```

---

### Task 1.3: Write TuringVaultDecisionLog Contract

**Objective:** On-chain proof-of-reasoning log.

**Files:**
- Create: `contracts/TuringVaultDecisionLog.sol`
- Create: `tests/TuringVaultDecisionLog.test.js`

(See MASTER_SPEC.md Section 4.2 for contract code)

**Tests must cover:**
- Log a decision successfully
- Retrieve decision by ID
- Get recent decisions (pagination)
- Update performance metrics
- Reject non-owner calls

**Step: Run tests**

Run: `npx hardhat test tests/TuringVaultDecisionLog.test.js`
Expected: 5+ passing

---

### Task 1.4: Write TuringVaultRouter Contract

**Objective:** Core vault with swap execution via Merchant Moe.

**Files:**
- Create: `contracts/TuringVaultRouter.sol`
- Create: `contracts/interfaces/IMerchantMoeLBRouter.sol`
- Create: `tests/TuringVaultRouter.test.js`

(See MASTER_SPEC.md Section 4.3 for contract code)

**Tests must cover:**
- Deposit tokens
- Withdraw tokens
- Execute swap (with mock router)
- Risk check: max swap size
- Risk check: slippage
- Update risk parameters
- Get portfolio allocation

**Step: Run tests**

Run: `npx hardhat test tests/TuringVaultRouter.test.js`
Expected: 7+ passing

---

### Task 1.5: Deploy to Mantle Sepolia

**Objective:** Deploy all 3 contracts to testnet and verify.

**Files:**
- Create: `scripts/deploy.js`

**Prerequisites:**
- Get testnet MNT from faucet: https://faucet.sepolia.mantle.xyz
- Set PRIVATE_KEY in .env

**Step 1: Write deploy script**

```javascript
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MNT");

  // Deploy Identity
  const Identity = await hre.ethers.getContractFactory("TuringVaultIdentity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  console.log("TuringVaultIdentity:", await identity.getAddress());

  // Deploy DecisionLog
  const DecisionLog = await hre.ethers.getContractFactory("TuringVaultDecisionLog");
  const decisionLog = await DecisionLog.deploy();
  await decisionLog.waitForDeployment();
  console.log("TuringVaultDecisionLog:", await decisionLog.getAddress());

  // Deploy Router
  const Router = await hre.ethers.getContractFactory("TuringVaultRouter");
  const router = await Router.deploy();
  await router.waitForDeployment();
  console.log("TuringVaultRouter:", await router.getAddress());

  // Register agent
  const tx = await identity.registerAgent("ipfs://TuringVaultAgentMetadata_v1");
  await tx.wait();
  console.log("Agent registered with token ID 0");

  console.log("\n--- DEPLOYMENT COMPLETE ---");
  console.log("Update .env with these addresses");
}

main().catch(console.error);
```

**Step 2: Deploy**

Run: `npx hardhat run scripts/deploy.js --network mantleSepolia`

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: deploy script + testnet deployment"
```

---

### Task 1.6: AI Orchestrator Skeleton

**Objective:** Working Node.js orchestrator that calls LLM and gets valid JSON.

**Files:**
- Create: `src/orchestrator/index.js`
- Create: `src/orchestrator/aiEngine.js`
- Create: `src/orchestrator/validator.js`
- Create: `src/orchestrator/config.js`

**Step 1: Install orchestrator deps**

```bash
npm install openai zod node-cron winston dotenv
```

**Step 2: Write config.js**

```javascript
module.exports = {
  MANTLE_ASSETS: {
    MUSD: "0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3",
    METH: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0",
    USDY: "0x5bE26527e817998A7206475496fDE1E68957c5A6",
    WMNT: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8"
  },
  MERCHANT_MOE_ROUTER: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
  RISK_PARAMS: {
    minConfidence: 0.85,
    maxSlippageBps: 100,
    maxSingleSwapPct: 50
  },
  CYCLE_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
};
```

**Step 3: Write validator.js with Zod schema**

```javascript
const { z } = require("zod");

const DecisionSchema = z.object({
  action: z.enum(["swap", "hold"]),
  direction: z.enum(["risk_on", "risk_off", "neutral"]),
  targetAsset: z.enum(["mUSD", "mETH", "USDY"]),
  allocationPct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  path: z.object({
    pairBinSteps: z.array(z.number()),
    versions: z.array(z.number()),
    tokenPath: z.array(z.string())
  }),
  slippageTolerance: z.number().min(10).max(500),
  reasoning: z.string().max(200)
});

function validateDecision(raw) {
  try {
    const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    return { success: true, data: DecisionSchema.parse(parsed) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { validateDecision, DecisionSchema };
```

**Step 4: Write aiEngine.js**

```javascript
const OpenAI = require("openai");
const { validateDecision } = require("./validator");
const config = require("./config");

const SYSTEM_PROMPT = `You are the quantitative routing engine for TuringVault on the Mantle network.
Your ONLY output must be a valid, minified JSON object. No markdown, no greetings, no explanations.
...`; // (full prompt from MASTER_SPEC Section 5.1)

const client = new OpenAI({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: "https://api.anthropic.com/v1/" });

async function getAIDecision(marketData, portfolioState) {
  const userPrompt = JSON.stringify({ marketData, portfolioState, riskParams: config.RISK_PARAMS });

  const response = await client.chat.completions.create({
    model: "claude-sonnet-4-20250514",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.1,
    max_tokens: 500
  });

  const raw = response.choices[0].message.content;
  const validation = validateDecision(raw);

  if (!validation.success) {
    console.error("AI output validation failed:", validation.error);
    return { action: "hold", direction: "neutral", confidence: 0, reasoning: "validation_failed" };
  }

  return validation.data;
}

module.exports = { getAIDecision };
```

**Step 5: Test JSON output stability**

Run: `node -e "require('./src/orchestrator/aiEngine').getAIDecision({mETH:{price:3100}},{musd:1000}).then(console.log)"`
Expected: Valid JSON matching schema

---

### Task 1.7: Validate 100% JSON Output Stability

**Objective:** Run 10 consecutive LLM calls and verify ALL return valid JSON.

**Files:**
- Create: `tests/orchestrator/json-stability.test.js`

```javascript
const { getAIDecision } = require("../../src/orchestrator/aiEngine");

const testScenarios = [
  { market: { mETH: { price: 3100, change24h: 5.2 }, sentiment: "bullish" }, portfolio: { musd: 800, meth: 200 } },
  { market: { mETH: { price: 2800, change24h: -8.1 }, sentiment: "extreme_fear" }, portfolio: { musd: 200, meth: 800 } },
  { market: { mETH: { price: 3050, change24h: 0.3 }, sentiment: "neutral" }, portfolio: { musd: 500, meth: 500 } },
  // ... 7 more scenarios
];

async function runStabilityTest() {
  let passed = 0;
  for (const scenario of testScenarios) {
    const result = await getAIDecision(scenario.market, scenario.portfolio);
    if (result.action && result.confidence !== undefined) passed++;
  }
  console.log(`JSON Stability: ${passed}/${testScenarios.length} valid outputs`);
  if (passed < testScenarios.length) process.exit(1);
}

runStabilityTest();
```

**Target: 10/10 valid JSON outputs before proceeding to Phase 2.**

---

## PHASE 2-4: See MASTER_SPEC.md for full timeline

(Implementation details for Phase 2-4 will be written after Phase 1 completion)
