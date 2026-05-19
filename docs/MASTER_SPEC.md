# TuringVault — Master Technical Specification

> **Hackathon:** Mantle Turing Test 2026 (Phase 2: AI Awakening)
> **Prize Pool:** $100,000
> **Deadline:** June 15, 2026 (26 days remaining)
> **Team:** Solo + 2 reserve devs + AI agent fleet

---

## 1. PRODUCT VISION

**TuringVault** is an autonomous AI-powered RWA (Real World Asset) router deployed on Mantle Network. It dynamically rebalances a portfolio between stable yield instruments (mUSD/USDY) and volatile yield (mETH) using cryptographically verifiable proof-of-reasoning.

### One-liner:
> "An AI fund manager that lives on-chain, thinks transparently, and earns yield autonomously."

### Why it wins:
- ✅ Satisfies ALL hackathon requirements (ERC-8004, on-chain logging, transparency)
- ✅ Directly targets "AI x RWA" track (less competition than generic trading bots)
- ✅ Integrates partner protocols (Nansen, Merchant Moe, Ondo Finance)
- ✅ Working demo with real mainnet transactions

---

## 2. HACKATHON SCORING ALIGNMENT

| Criterion | Weight | Our Strategy |
|-----------|--------|--------------|
| Technical Depth | 30% | ERC-8004 identity + LB routing math + TEE attestation concept |
| Innovation | 25% | Proof-of-reasoning on-chain (novel!) + AI reputation NFT |
| Ecosystem Contribution | 20% | Deep Mantle integration: mETH, mUSD, USDY, Merchant Moe |
| Product Completeness | 25% | Working demo, clean UI, real mainnet swaps |

---

## 3. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        TURINGVAULT SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   DATA LAYER     │    │   AI BRAIN       │                   │
│  │                  │    │                  │                   │
│  │  • Nansen API    │───▶│  • Claude/GPT    │                   │
│  │  • DeFiLlama    │    │  • System Prompt │                   │
│  │  • Elfa AI      │    │  • JSON Output   │                   │
│  │  • On-chain     │    │  • Confidence    │                   │
│  │    view calls    │    │    scoring       │                   │
│  └──────────────────┘    └────────┬─────────┘                   │
│                                   │                              │
│                                   ▼                              │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              VALIDATION LAYER                         │       │
│  │                                                      │       │
│  │  • JSON Schema validation (Zod)                      │       │
│  │  • Risk bounds check (max allocation %, slippage)    │       │
│  │  • Cross-model verification (optional)               │       │
│  └──────────────────────────┬───────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              EXECUTION LAYER (On-chain)               │       │
│  │                                                      │       │
│  │  • Ethers.js transaction builder                     │       │
│  │  • Merchant Moe LBRouter swap                        │       │
│  │  • Gas estimation + 20% buffer                       │       │
│  │  • Decision logging to TuringVault contract          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              IDENTITY LAYER (ERC-8004)                │       │
│  │                                                      │       │
│  │  • Agent NFT (ERC-721 + URI metadata)                │       │
│  │  • Reputation Registry (performance tracking)         │       │
│  │  • Decision History (proof-of-reasoning log)          │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              FRONTEND (Dashboard)                     │       │
│  │                                                      │       │
│  │  • Portfolio allocation pie chart                     │       │
│  │  • Decision history timeline                          │       │
│  │  • AI reasoning display (human-readable)              │       │
│  │  • Performance metrics (PnL, Sharpe, etc.)            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. SMART CONTRACTS SPECIFICATION

### 4.1 TuringVaultIdentity.sol (ERC-8004 Compliant)

**Purpose:** Mint a unique NFT identity for the AI agent on Mantle mainnet.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TuringVaultIdentity is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    // Agent metadata URI (IPFS/Arweave)
    // Contains: capabilities, endpoints, model info, owner
    
    event AgentRegistered(uint256 indexed tokenId, string agentURI);
    event AgentURIUpdated(uint256 indexed tokenId, string newURI);

    constructor() ERC721("TuringVault Agent", "TVA") Ownable(msg.sender) {}

    function registerAgent(string memory agentURI) external onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(msg.sender, tokenId);
        _setTokenURI(tokenId, agentURI);
        emit AgentRegistered(tokenId, agentURI);
        return tokenId;
    }

    function updateAgentURI(uint256 tokenId, string memory newURI) external onlyOwner {
        require(ownerOf(tokenId) == msg.sender, "Not agent owner");
        _setTokenURI(tokenId, newURI);
        emit AgentURIUpdated(tokenId, newURI);
    }
}
```

**Deployment:** Mantle Mainnet (Chain ID: 5000)
**Gas estimate:** ~200k gas for registerAgent

---

### 4.2 TuringVaultDecisionLog.sol

**Purpose:** Immutably record every AI decision on-chain (proof-of-reasoning).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TuringVaultDecisionLog is Ownable {
    struct Decision {
        uint256 timestamp;
        string action;           // "swap_to_mETH" | "swap_to_mUSD" | "hold"
        string targetAsset;      // address of target token
        uint256 amountIn;
        uint256 amountOut;
        uint256 confidence;      // 0-100 (basis points: 8500 = 85%)
        string reasoningHash;    // IPFS hash of full reasoning JSON
        bytes32 txHash;          // hash of executed swap tx
    }

    Decision[] public decisions;
    uint256 public totalDecisions;

    // Reputation metrics
    uint256 public successfulSwaps;
    uint256 public totalPnLBasisPoints; // cumulative PnL in bps

    event DecisionLogged(
        uint256 indexed decisionId,
        string action,
        string targetAsset,
        uint256 confidence,
        string reasoningHash
    );

    event PerformanceUpdated(
        uint256 indexed decisionId,
        int256 pnlBasisPoints
    );

    constructor() Ownable(msg.sender) {}

    function logDecision(
        string memory action,
        string memory targetAsset,
        uint256 amountIn,
        uint256 amountOut,
        uint256 confidence,
        string memory reasoningHash,
        bytes32 txHash
    ) external onlyOwner returns (uint256) {
        uint256 decisionId = decisions.length;
        decisions.push(Decision({
            timestamp: block.timestamp,
            action: action,
            targetAsset: targetAsset,
            amountIn: amountIn,
            amountOut: amountOut,
            confidence: confidence,
            reasoningHash: reasoningHash,
            txHash: txHash
        }));
        totalDecisions++;
        emit DecisionLogged(decisionId, action, targetAsset, confidence, reasoningHash);
        return decisionId;
    }

    function updatePerformance(uint256 decisionId, int256 pnlBps) external onlyOwner {
        if (pnlBps > 0) successfulSwaps++;
        totalPnLBasisPoints += uint256(pnlBps > 0 ? pnlBps : -pnlBps);
        emit PerformanceUpdated(decisionId, pnlBps);
    }

    function getDecision(uint256 id) external view returns (Decision memory) {
        return decisions[id];
    }

    function getRecentDecisions(uint256 count) external view returns (Decision[] memory) {
        uint256 start = decisions.length > count ? decisions.length - count : 0;
        uint256 length = decisions.length - start;
        Decision[] memory recent = new Decision[](length);
        for (uint256 i = 0; i < length; i++) {
            recent[i] = decisions[start + i];
        }
        return recent;
    }
}
```

**Key insight:** Storing full reasoning on-chain is too expensive. We store a hash (IPFS CID) and the summary. Full reasoning JSON lives on IPFS/Arweave for auditors.

---

### 4.3 TuringVaultRouter.sol (Main Contract)

**Purpose:** Core vault logic — holds funds, executes swaps via Merchant Moe, enforces risk limits.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMerchantMoeLBRouter {
    struct Path {
        uint256[] pairBinSteps;
        uint8[] versions;
        address[] tokenPath;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}

contract TuringVaultRouter is Ownable {
    using SafeERC20 for IERC20;

    // Mantle Mainnet addresses
    address public constant MERCHANT_MOE_ROUTER = 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a;
    address public constant MUSD = 0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3;
    address public constant METH = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;
    address public constant USDY = 0x5bE26527e817998A7206475496fDE1E68957c5A6;

    // Risk parameters (adjustable by owner/agent)
    uint256 public maxSlippageBps = 100;       // 1% max slippage
    uint256 public minConfidence = 8500;        // 85% minimum confidence
    uint256 public maxSingleSwapPct = 5000;     // 50% max single swap (of total portfolio)

    // State
    uint256 public totalDeposited;
    mapping(address => uint256) public assetBalances;

    event SwapExecuted(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event RiskParamsUpdated(uint256 maxSlippage, uint256 minConfidence, uint256 maxSwapPct);
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    // --- DEPOSIT/WITHDRAW ---

    function deposit(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        assetBalances[token] += amount;
        totalDeposited += amount;
        emit Deposited(token, amount);
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        require(assetBalances[token] >= amount, "Insufficient balance");
        assetBalances[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, amount);
    }

    // --- AI SWAP EXECUTION ---

    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256[] calldata pairBinSteps,
        uint8[] calldata versions
    ) external onlyOwner returns (uint256) {
        require(amountIn <= assetBalances[tokenIn], "Exceeds balance");
        
        // Risk check: max single swap
        require(amountIn * 10000 / totalDeposited <= maxSingleSwapPct, "Exceeds max swap size");

        // Approve router
        IERC20(tokenIn).approve(MERCHANT_MOE_ROUTER, amountIn);

        // Build path
        address[] memory tokenPath = new address[](2);
        tokenPath[0] = tokenIn;
        tokenPath[1] = tokenOut;

        IMerchantMoeLBRouter.Path memory path = IMerchantMoeLBRouter.Path({
            pairBinSteps: pairBinSteps,
            versions: versions,
            tokenPath: tokenPath
        });

        // Execute swap
        uint256 amountOut = IMerchantMoeLBRouter(MERCHANT_MOE_ROUTER).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300 // 5 min deadline
        );

        // Update balances
        assetBalances[tokenIn] -= amountIn;
        assetBalances[tokenOut] += amountOut;

        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }

    // --- RISK MANAGEMENT ---

    function updateRiskParams(
        uint256 _maxSlippageBps,
        uint256 _minConfidence,
        uint256 _maxSingleSwapPct
    ) external onlyOwner {
        maxSlippageBps = _maxSlippageBps;
        minConfidence = _minConfidence;
        maxSingleSwapPct = _maxSingleSwapPct;
        emit RiskParamsUpdated(_maxSlippageBps, _minConfidence, _maxSingleSwapPct);
    }

    // --- VIEW FUNCTIONS ---

    function getPortfolioAllocation() external view returns (
        uint256 musdBalance,
        uint256 methBalance,
        uint256 usdyBalance
    ) {
        return (
            assetBalances[MUSD],
            assetBalances[METH],
            assetBalances[USDY]
        );
    }
}
```

---

## 5. AI ORCHESTRATOR SPECIFICATION

### 5.1 System Prompt (Locked)

```
You are the quantitative routing engine for TuringVault on the Mantle network.
Your ONLY output must be a valid, minified JSON object. No markdown, no greetings, no explanations.

You will receive:
1. Market data (prices, volumes, TVL changes)
2. Smart money flows (Nansen)
3. Sentiment scores (Elfa AI)
4. Current portfolio allocation
5. Risk parameters

Rules:
1. If confidence < 0.85 OR sentiment == "extreme_fear" → route to mUSD (risk-off)
2. If confidence >= 0.85 AND sentiment == "bullish" → route to mETH (risk-on)
3. If confidence >= 0.90 AND no clear signal → HOLD (no action)
4. NEVER exceed maxSingleSwapPct of portfolio in one trade
5. ALWAYS include reasoning hash (32-char summary of logic)

Output Schema:
{
  "action": "swap" | "hold",
  "direction": "risk_on" | "risk_off" | "neutral",
  "targetAsset": "mUSD" | "mETH" | "USDY",
  "allocationPct": <number 0-100>,
  "confidence": <number 0.0-1.0>,
  "path": {
    "pairBinSteps": [<number>],
    "versions": [2],
    "tokenPath": ["<address>", "<address>"]
  },
  "slippageTolerance": <number in bps>,
  "reasoning": "<max 200 chars explaining logic>"
}
```

### 5.2 Orchestrator Flow (Node.js)

```
src/orchestrator/
├── index.js              # Main loop (PM2 managed)
├── dataCollector.js      # Fetches Nansen, DeFiLlama, on-chain data
├── aiEngine.js           # LLM call with system prompt
├── validator.js          # Zod schema validation
├── executor.js           # Ethers.js swap execution
├── logger.js             # On-chain decision logging
└── config.js             # Network, addresses, risk params
```

**Main Loop (every 5 minutes):**
```
1. COLLECT: Fetch market data from all sources
2. ANALYZE: Send to LLM, get JSON decision
3. VALIDATE: Zod schema + risk bounds check
4. EXECUTE: If action == "swap" → build tx → sign → broadcast
5. LOG: Write decision to TuringVaultDecisionLog contract
6. STORE: Upload full reasoning to IPFS
```

### 5.3 Data Sources Priority

| Source | Purpose | Latency | Cost |
|--------|---------|---------|------|
| On-chain view calls | Real-time price/liquidity | <100ms | Free (RPC) |
| Nansen MCP | Smart money flows | ~2s | 100 free credits |
| DeFiLlama | TVL, macro context | ~5s | Free |
| Elfa AI | Sentiment | ~1s | TBD (hackathon credits) |

---

## 6. NETWORK CONFIGURATION

### Mantle Mainnet
```
Chain ID: 5000
RPC: https://rpc.mantle.xyz
Explorer: https://mantlescan.xyz
Native Token: MNT (for gas)
```

### Mantle Sepolia (Testing)
```
Chain ID: 5003
RPC: https://rpc.sepolia.mantle.xyz
Explorer: https://sepolia.mantlescan.xyz
Faucet: https://faucet.sepolia.mantle.xyz
```

### Key Contract Addresses (Mainnet)
```
Merchant Moe LBRouter: 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a
mUSD (Ondo):          0xab575258d37EaA5C8956EfABe71F4eE8F6397cF3
USDY (Ondo):          0x5bE26527e817998A7206475496fDE1E68957c5A6
mETH:                 0xcDA86A272531e8640cD7F1a92c01839911B90bb0
USDY Oracle:          0xA96abbe61AfEdEB0D14a20440Ae7100D9aB4882f
WMNT (Wrapped MNT):   0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8
```

---

## 7. DEVELOPMENT TIMELINE

### PHASE 1: Foundation (Days 1-7) — May 19-25
```
□ P1.1: Setup Hardhat project + Mantle network config
□ P1.2: Write & test TuringVaultIdentity.sol (ERC-8004)
□ P1.3: Write & test TuringVaultDecisionLog.sol
□ P1.4: Write & test TuringVaultRouter.sol
□ P1.5: Deploy ALL to Mantle Sepolia testnet
□ P1.6: AI Orchestrator skeleton (data → LLM → JSON)
□ P1.7: Zod validation achieving 100% valid JSON output
```

### PHASE 2: Integration (Days 8-14) — May 26-Jun 1
```
□ P2.1: Connect Nansen API (smart money flows)
□ P2.2: Connect DeFiLlama API (TVL, prices)
□ P2.3: Integrate Merchant Moe swap execution
□ P2.4: Test full loop: data → AI → swap on testnet
□ P2.5: IPFS upload for reasoning storage
□ P2.6: Deploy to Mantle Mainnet
□ P2.7: First REAL mainnet swap (small amount $5-10)
```

### PHASE 3: Polish (Days 15-21) — Jun 2-8
```
□ P3.1: Frontend dashboard (React/Next.js)
□ P3.2: Portfolio visualization
□ P3.3: Decision history timeline
□ P3.4: AI reasoning display
□ P3.5: Add Elfa AI sentiment feed
□ P3.6: Run agent for 3-5 days collecting real data
□ P3.7: Performance metrics (PnL tracking)
```

### PHASE 4: Submission (Days 22-26) — Jun 9-15
```
□ P4.1: Demo video (screen recording with voiceover)
□ P4.2: Technical documentation
□ P4.3: README + architecture diagrams
□ P4.4: DoraHacks submission form
□ P4.5: Profile setup (@turingvault_core)
□ P4.6: Final mainnet verification
□ P4.7: SUBMIT (before June 15 deadline)
```

---

## 8. RISK MITIGATION

### Financial Risks
- **Max test capital:** $100-200 in vault
- **Max single swap:** 50% of portfolio
- **Emergency kill switch:** owner can withdraw all
- **Slippage cap:** 1% max

### Technical Risks
- **LLM hallucination:** Zod validation rejects invalid JSON → fallback to HOLD
- **RPC failure:** Retry 3x with backoff, then HOLD
- **Gas spike:** 20% buffer, abort if gas > threshold
- **Contract bug:** Extensive testnet testing first

### Competition Risks
- **Scope creep:** STRICT scope — only 3 contracts + orchestrator + dashboard
- **Over-engineering:** MVP first, polish later
- **Time pressure:** Phase 4 is BUFFER — if behind, cut frontend features

---

## 9. TECH STACK

### Smart Contracts
- Solidity ^0.8.20
- Hardhat 3.x (compilation, testing, deployment)
- OpenZeppelin Contracts v5 (ERC-721, Ownable, SafeERC20)
- Ethers.js v6 (deployment scripts, orchestrator)

### AI Orchestrator
- Node.js v22
- OpenAI SDK / Anthropic SDK (LLM calls)
- Zod (schema validation)
- ethers.js v6 (on-chain execution)
- node-cron (scheduling)
- winston (logging)
- dotenv (config)

### Frontend
- Next.js 14 (React)
- TailwindCSS
- Recharts (data visualization)
- wagmi + viem (wallet connection)
- IPFS HTTP client

### Infrastructure
- PM2 (process management)
- IPFS/Pinata (reasoning storage)
- Mantle RPC (direct)

---

## 10. FILE STRUCTURE

```
turingvault/
├── contracts/
│   ├── TuringVaultIdentity.sol
│   ├── TuringVaultDecisionLog.sol
│   ├── TuringVaultRouter.sol
│   └── interfaces/
│       └── IMerchantMoeLBRouter.sol
├── scripts/
│   ├── deploy.js
│   ├── register-agent.js
│   └── verify.js
├── src/
│   └── orchestrator/
│       ├── index.js
│       ├── dataCollector.js
│       ├── aiEngine.js
│       ├── validator.js
│       ├── executor.js
│       ├── logger.js
│       └── config.js
├── frontend/
│   └── (Next.js app)
├── tests/
│   ├── TuringVaultIdentity.test.js
│   ├── TuringVaultDecisionLog.test.js
│   └── TuringVaultRouter.test.js
├── docs/
│   ├── MASTER_SPEC.md (this file)
│   ├── ARCHITECTURE.md
│   └── SUBMISSION.md
├── hardhat.config.js
├── package.json
├── .env.example
└── README.md
```

---

## 11. ENVIRONMENT VARIABLES

```env
# Network
MANTLE_RPC_URL=https://rpc.mantle.xyz
MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz

# Wallet
PRIVATE_KEY=0x...  (deployer/agent wallet)

# AI
ANTHROPIC_API_KEY=sk-...  (Claude for orchestrator)
OPENAI_API_KEY=sk-...     (GPT-4o fallback)

# Data Sources
NANSEN_API_KEY=...
ELFA_API_KEY=...

# Storage
PINATA_JWT=...           (IPFS pinning)

# Contracts (filled after deployment)
IDENTITY_CONTRACT=0x...
DECISION_LOG_CONTRACT=0x...
ROUTER_CONTRACT=0x...
```

---

## 12. SUCCESS CRITERIA

### Minimum Viable Submission (MUST HAVE):
- [ ] 3 contracts deployed on Mantle Mainnet
- [ ] Agent NFT minted (ERC-8004)
- [ ] At least 5 on-chain decisions logged
- [ ] At least 1 real swap executed
- [ ] AI reasoning visible and verifiable
- [ ] Demo video showing full cycle
- [ ] Documentation

### Nice to Have:
- [ ] Dashboard UI
- [ ] 3+ days of autonomous operation
- [ ] Positive PnL
- [ ] Nansen integration working
- [ ] Sentiment analysis active

### Stretch Goals:
- [ ] TEE attestation concept
- [ ] Multi-asset routing (3+ tokens)
- [ ] Community-facing dApp
- [ ] Cross-validation with second LLM

---

## 13. IMMEDIATE NEXT STEPS

1. ✅ Create project structure
2. ✅ Write MASTER_SPEC.md (this document)
3. ⬜ Initialize Hardhat project with Mantle config
4. ⬜ Install dependencies (OpenZeppelin, ethers, etc.)
5. ⬜ Write + test contracts on local Hardhat network
6. ⬜ Deploy to Mantle Sepolia
7. ⬜ Build AI orchestrator skeleton
8. ⬜ Achieve 100% valid JSON output from LLM
