# TuringVault — Полный технический и стратегический анализ проекта
# Документ для deep research и выявления пробелов

---

## 1. ОБЩАЯ КОНЦЕПЦИЯ И УНИКАЛЬНОЕ ЦЕННОСТНОЕ ПРЕДЛОЖЕНИЕ

### 1.1 Что такое TuringVault

TuringVault — автономная система принятия торговых решений на базе мульти-агентного ИИ с криптографически верифицируемым аудиторским следом на блокчейне Mantle. 

Ключевое нововведение: **Proof-of-Reasoning (PoR)** — каждое решение ИИ записывается on-chain не как просто транзакция, а как полная цепочка рассуждений:
- Какие данные получил агент (5 источников)
- Что предложил Аналитик (GLM-5)
- Как оценил Валидатор (Claude)
- Достигнут ли консенсус (математические пороги)
- IPFS-хеш полного JSON рассуждений
- Репутационный скоринг по результату

### 1.2 Почему это важно

Проблема: все существующие AI trading bots — чёрные ящики. Пользователь не может проверить:
- Почему бот купил/продал
- На каких данных основано решение  
- Не галлюцинирует ли модель
- Какой track record у алгоритма

TuringVault решает это через:
1. Dual-agent adversarial consensus (две разные модели проверяют друг друга)
2. Immutable on-chain logging (нельзя подправить историю задним числом)
3. IPFS storage full reasoning (любой может скачать и проверить полный JSON)
4. Reputation Registry (математически доказуемый win rate)

### 1.3 Позиционирование на хакатоне

Mantle Turing Test 2026 — $100k призовой фонд (фаза AI Awakening).
Дедлайн: 15 июня 2026 (осталось 26 дней).

Мы целимся на 3 трека одновременно:
- **AI Trading & Strategy** — multi-model consensus + Byreal execution
- **AI Alpha & Data** — Nansen MCP (24 tools) + 5-source aggregation
- **Agentic Wallets & Economy** — ERC-8004 (Identity + Validation + Reputation) + Tencent KMS

---

## 2. АРХИТЕКТУРА И СТРУКТУРА КОДА

### 2.1 Репозиторий

GitHub: https://github.com/USBVadik/TuringVault-Core (PUBLIC)
Frontend: https://frontend-seven-beta-46.vercel.app (LIVE)

```
turingvault/
├── contracts/                        # 5 Solidity контрактов + interfaces + mocks
│   ├── TuringVaultIdentity.sol           # ERC-721 Agent Identity (ERC-8004)
│   ├── TuringVaultDecisionLog.sol        # Immutable decision history
│   ├── TuringVaultRouter.sol             # Strategy routing + Merchant Moe integration
│   ├── TuringVaultValidationRegistry.sol # Multi-agent consensus on-chain
│   ├── TuringVaultReputationRegistry.sol # ERC-8004 Reputation + PnL tracking ← NEW
│   ├── interfaces/
│   │   └── IMerchantMoeLBRouter.sol      # Merchant Moe Liquidity Book interface
│   └── mocks/
│       ├── MockERC20.sol
│       └── MockLBRouter.sol
├── src/
│   ├── orchestrator/                 # AI Cognitive Core
│   │   ├── multiAgent.js                # Dual-model engine (GLM-5 + Claude)
│   │   ├── multiAgentLoop.js            # Full cycle: data → AI → IPFS → on-chain
│   │   ├── unifiedMarketData.js         # 5-source market intelligence aggregator
│   │   ├── mainMultiAgent.js            # Production 5-min cron orchestrator
│   │   ├── marketData.js                # Legacy data module (replaced by unified)
│   │   ├── aiEngine.js                  # Single-agent engine (legacy)
│   │   ├── validator.js                 # Zod schema validation
│   │   └── config.js                    # Environment configuration
│   ├── execution/                    # Trade Execution Layer
│   │   ├── executionEngine.js            # Byreal Perps CLI wrapper + risk guardrails
│   │   └── tencentKMS.js                # Tencent Cloud KMS HSM signer (AbstractSigner)
│   ├── mcp/                          # Protocol Integrations
│   │   └── nansenMCP.js                  # Nansen MCP client (24 tools, JSON-RPC/SSE)
│   └── ipfs/                         # Decentralized Storage
│       └── storage.js                    # Pinata IPFS pinning + Agent Card upload
├── frontend/                         # Next.js 15 + RainbowKit + wagmi v2
├── test/                             # 63 tests (5 test files)
├── scripts/                          # Deploy + verify scripts
├── docs/                             # Architecture, Vision, Submission docs
├── hardhat.config.js                 # Solidity 0.8.28, cancun, optimizer 200
└── package.json                      # 10 deps + 17 devDeps
```

### 2.2 Метрики кодовой базы

- **Solidity:** 5 контрактов + 2 mocks + 1 interface = ~800 lines
- **JavaScript (src):** 19 файлов = ~2400 lines
- **Tests:** 63/63 passing (Hardhat + Chai)
- **Git history:** 20+ commits, clean feature-based progression
- **Dependencies:** минимальные (10 runtime: ethers, @aws-sdk, zod, dotenv, node-cron, etc.)

### 2.3 Контракты на Mantle Mainnet (Chain ID: 5000)

| Контракт | Адрес | Verified |
|----------|-------|----------|
| TuringVaultIdentity | 0x582E6a649B99784829193E14bB7Af8c4A482E165 | ✅ Sourcify |
| TuringVaultDecisionLog | 0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5 | ✅ Sourcify |
| TuringVaultRouter | 0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001 | ✅ Sourcify |
| TuringVaultValidationRegistry | 0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6 | ✅ Sourcify |
| TuringVaultReputationRegistry | 0xC78119F3274B05046Ac7c38a14298a6cbD946e1a | ✅ Sourcify |

Agent NFT: Token #0 (minted as cognitive agent identity)
Wallet balance: ~6.5 MNT (достаточно для 200+ transactions)

---

## 3. КОГНИТИВНАЯ АРХИТЕКТУРА (MULTI-MODEL AI)

### 3.1 Модели

| Role | Model | Provider | Latency | Назначение |
|------|-------|----------|---------|-----------|
| Analyst | Z.ai GLM-5 | AWS Bedrock | ~1.4s | Primary reasoning, market analysis |
| Validator | Claude Sonnet 4.6 | AWS Bedrock | ~8s | Independent adversarial verification |
| (planned) Tiebreaker | GLM-4.7-flash | AWS Bedrock | ~0.8s | Fast tiebreaker in split decisions |

### 3.2 Почему multi-model

Одна модель может галлюцинировать. Две РАЗНЫЕ модели от РАЗНЫХ компаний крайне маловероятно галлюцинируют одинаково. Это аналог institutional investment desk:
- GLM-5 (аналитик) — агрессивный, ищет alpha
- Claude (риск-менеджер) — консервативный, защищает капитал

### 3.3 Consensus Mathematics

```
Execution = True IFF:
  analyst.confidence ≥ 0.75 (75%)
  validator.confidence ≥ 0.70 (70%)  
  validator.riskScore ≤ 65 (из 100)
  validator.approved === true

Otherwise: HOLD (safe default)
```

Обе модели ограничены Zod-схемами (AnalystSchema, ValidatorSchema). Невалидный JSON → автоматический HOLD. Это code-level protection, не prompt-level.

### 3.4 Data Pipeline (5 sources)

```
CoinGecko ────→ ETH/MNT price, 24h change, market cap
DeFiLlama ───→ Mantle ecosystem TVL
Fear & Greed ─→ Market sentiment (0-100)
Nansen MCP ──→ Smart Money flows, token analysis, 53M+ labels
Byreal Perps ─→ Trading signals (RSI, funding rates, OI)
         ↓
   unifiedMarketData.js (aggregator, cached)
         ↓
   promptContext string → LLM
```

### 3.5 Decision Flow (Full Cycle)

```
Step 1: Fetch 5-source unified market data (5-15 seconds)
Step 2: GLM-5 Analyst generates proposal (1.4s)
        Claude Validator verifies independently (8s)
        Zod validates both outputs
        Consensus check (mathematical thresholds)
Step 3: Upload Proof-of-Reasoning to IPFS (instant with deterministic CID)
Step 4: Record on-chain (4 transactions, ~0.04 MNT total):
        TX1: ValidationRegistry.submitProposal()
        TX2: ValidationRegistry.validateProposal()
        TX3: DecisionLog.logDecision() + IPFS hash
        TX4: ReputationRegistry.submitFeedback()
Step 5: Summary output + next cycle in 5 min
```

---

## 4. ПАРТНЁРСКИЕ ИНТЕГРАЦИИ

### 4.1 Nansen MCP (Model Context Protocol)

- **Endpoint:** https://mcp.nansen.ai/ra/mcp
- **Protocol:** JSON-RPC 2.0 over Server-Sent Events (SSE)
- **Auth:** NANSEN-API-KEY header
- **Tools available:** 24 (address_portfolio, wallet_pnl_summary, transaction_lookup, general_search, growth_chain_rank, etc.)
- **Coverage:** 53M+ labeled addresses, 25+ blockchains
- **Status:** WORKING. general_search бесплатный, paid tools требуют credit upgrade.
- **Integration file:** src/mcp/nansenMCP.js

Что работает сейчас:
- general_search → получаем данные по mETH, Smart Money labels
- Fallback если credits exhausted → estimated TVL data

Что нужно для полной работы:
- Апгрейд Nansen API key (больше credits)
- Активное использование wallet_pnl_summary для Copy Farming
- address_portfolio для tracking Smart Money movements

### 4.2 Byreal (Execution Layer)

- **CLI:** @byreal-io/byreal-perps-cli (installed globally, v0.3.7)
- **Capabilities:** Perpetual futures (Hyperliquid), trading signals
- **Commands:** order market buy/sell, position leverage, signal scan
- **Integration:** src/execution/executionEngine.js
- **Status:** WORKING. Signals fetched successfully. Orders in DRY_RUN mode.

Risk guardrails (code-level, NOT prompt-level):
- maxLeverage: 5x
- maxPositionSize: 0.1 BTC equivalent
- maxDrawdown: 10%
- minConfidence: 80% for live execution

### 4.3 Tencent Cloud KMS

- **Integration:** src/execution/tencentKMS.js (AbstractSigner subclass)
- **Algorithm:** ECDSA secp256k1 (EVM-compatible)
- **Flow:** unsigned TX → Tencent KMS API → HSM signs → (v,r,s)
- **Status:** INTERFACE READY. Falls back to local wallet (no real Tencent credentials yet).
- **Value:** Shows institutional-grade security architecture to judges

### 4.4 Z.ai (GLM-5)

- **Model:** zai.glm-5 (latest on Bedrock)
- **Fallback:** zai.glm-4.7-flash (low-latency mode)
- **Status:** FULLY WORKING as primary Analyst model
- **Why:** Z.ai is hackathon partner — using their model = maximum ecosystem points

### 4.5 Merchant Moe (DeFi Protocol on Mantle)

- **Integration:** contracts/interfaces/IMerchantMoeLBRouter.sol
- **Purpose:** Concentrated liquidity (CLMM) for mETH/mUSD pools
- **Status:** Interface defined, Router contract references it, but NO live swaps executed yet

---

## 5. ERC-8004 IMPLEMENTATION (TRUSTLESS AGENTS STANDARD)

### 5.1 Три реестра стандарта

| Registry | Status | Contract | Function |
|----------|--------|----------|----------|
| Identity | ✅ DEPLOYED | TuringVaultIdentity.sol | ERC-721 NFT for agent discoverability |
| Validation | ✅ DEPLOYED | TuringVaultValidationRegistry.sol | On-chain consensus attestation |
| Reputation | ✅ DEPLOYED | TuringVaultReputationRegistry.sol | PnL-based performance tracking |

### 5.2 Что реализовано

- Agent зарегистрирован как NFT Token #0
- Каждый цикл: submitProposal() + validateProposal() + logDecision()
- Reputation feedback записывается после каждого цикла
- Anti-Sybil: EIP-191 signature verification для feedback

### 5.3 Что НЕ реализовано (gap)

- tokenURI не обновлён на IPFS Agent Card (сейчас пустой или placeholder)
- Reputation не используется для gating (т.е. нет логики "если репутация < X, уменьшить позицию")
- Нет интеграции с другими агентами (peer reputation scoring)
- Agent Card JSON не загружен на IPFS (модуль готов, но не вызван для обновления tokenURI)

---

## 6. ФРОНТЕНД

### 6.1 Текущее состояние

- **URL:** https://frontend-seven-beta-46.vercel.app
- **Stack:** Next.js 15 + TypeScript + TailwindCSS + RainbowKit + wagmi v2
- **Wallets:** MetaMask, WalletConnect, Bybit Wallet
- **Features:** Connect wallet, view decisions, dark theme

### 6.2 Что НЕ реализовано (critical gap для 30% Visual Design + 25% AI Interaction Design)

- **Glass Mode** — визуализация мышления агента в реальном времени
- **Nansen heatmaps** — отображение Smart Money flows
- **Validator Report Card** — диалог Analyst↔Validator в human-readable формате
- **Proof-of-Reasoning граф** — кликабельные связи (решение → IPFS → MantleScan TX)
- **Live orchestrator status** — текущий цикл, countdown до следующего
- **Reputation dashboard** — win rate, cumulative score, history chart
- **Responsive design** — mobile-friendly
- **Animations** — smooth transitions для AI thinking steps

---

## 7. ON-CHAIN STATISTICS (LIVE DATA)

### 7.1 Текущие показатели

- Proposals submitted: 20+
- Consensus APPROVED: 6+
- Consensus REJECTED: 14+
- Approval rate: ~30% (conservative by design — fear market)
- Total on-chain transactions: 60+ (3-4 per cycle)
- Reputation entries: 1+ (just started)
- Gas spent: ~0.7 MNT total

### 7.2 Проблемы

- Orchestrator был на sepolia, переключён на mainnet сегодня
- Старые 19 proposals на другом contract address
- Reputation Registry fresh — мало entries
- Нужно минимум 72 часа continuous running для хорошего track record
- ~50+ decisions нужно для убедительной демонстрации

---

## 8. КРИТЕРИИ ОЦЕНКИ И НАШЕ ПОКРЫТИЕ

### 8.1 Technical Block (50%)

| Критерий | Вес | Наш балл (оценка) | Обоснование |
|----------|-----|-------------------|-------------|
| Technical Depth | 30% | 8/10 | Multi-model, 5 sources, 5 contracts, MCP protocol, CLI execution |
| Innovation | 25% | 9/10 | Proof-of-Reasoning — НОВАЯ концепция, нет аналогов |
| Ecosystem Contribution | 25% | 7/10 | Mainnet deploy, mETH/mUSD, но нет LIVE swaps, нет USDY |
| Product Completeness | 20% | 6/10 | Working backend, but frontend basic, no video demo |

### 8.2 Design Block (50%)

| Критерий | Вес | Наш балл (оценка) | Обоснование |
|----------|-----|-------------------|-------------|
| Visual Design | 30% | 4/10 | Basic dark theme, no wow-factor, no brand identity |
| Interaction & Flow | 30% | 3/10 | Minimal navigation, no real user journey |
| AI Interaction Design | 25% | 2/10 | No Glass Mode, no thinking visualization |
| Accessibility | 15% | 5/10 | Wallet connect works, basic but functional |

### 8.3 ИТОГО (грубая оценка)

Technical: (8×0.30 + 9×0.25 + 7×0.25 + 6×0.20) × 0.5 = ~3.8/5.0
Design: (4×0.30 + 3×0.30 + 2×0.25 + 5×0.15) × 0.5 = ~1.7/5.0
**TOTAL: ~5.5/10**

Это означает: **сильный backend, слабый frontend**. Без UI работы мы не в топе.

---

## 9. ПОЧЕМУ МЫ МОЖЕМ ПОБЕДИТЬ

### 9.1 Уникальные сильные стороны

1. **Proof-of-Reasoning** — ни один конкурент не делает верифицируемый аудит РАССУЖДЕНИЙ ИИ on-chain. Все просто логируют транзакции.

2. **Multi-model adversarial consensus** — GLM-5 (Z.ai, партнёр) + Claude (Anthropic). Разные архитектуры, разные biases = настоящая проверка.

3. **5 контрактов verified на Mainnet** — большинство конкурентов деплоят на testnet или не верифицируют.

4. **Nansen MCP (рабочая интеграция)** — реальный institutional-grade data provider, не игрушечный API.

5. **Byreal CLI (рабочий)** — execution через партнёрскую инфраструктуру, не самописный router.

6. **GLM-5 как primary model** — используем ПОСЛЕДНЮЮ модель партнёра хакатона. Судьи из Z.ai это оценят.

7. **ERC-8004 все 3 реестра** — полная имплементация стандарта, а не частичная.

8. **63 теста** — professional engineering quality, не хакатонный спагетти-код.

9. **20+ decisions on-chain** — демонстрация РЕАЛЬНОЙ работы, не mock.

10. **Охват 3 треков** — AI Trading + Alpha & Data + Agentic Wallets = тройной шанс на приз.

### 9.2 Сравнение с вероятными конкурентами

| Аспект | Типичный конкурент | TuringVault |
|--------|-------------------|-------------|
| Модель | Один LLM (обычно GPT-4) | Multi-model: GLM-5 + Claude |
| Данные | CoinGecko only | 5 sources + Nansen MCP |
| On-chain | Testnet или 1 контракт | 5 verified mainnet contracts |
| Standard | Нет | ERC-8004 полный |
| Execution | ethers.js напрямую | Byreal CLI (партнёр) |
| Security | .env private key | Tencent KMS HSM interface |
| Transparency | Логирует результат | Proof-of-Reasoning (full chain) |

---

## 10. СЛАБЫЕ СТОРОНЫ И ПРОБЕЛЫ (ДЛЯ DEEP RESEARCH)

### 10.1 КРИТИЧЕСКИЕ (могут стоить победы)

1. **Frontend примитивный** — это 50% оценки! Basic dark theme с кнопкой connect wallet. Нет Glass Mode, нет визуализации AI thinking, нет интерактивных графов.

2. **Нет видео-демо** — обязательное требование. Нужно min 2 минуты, показать полный цикл от данных до on-chain.

3. **Нет LIVE execution** — consensus достигается, но РЕАЛЬНЫХ свопов нет. Byreal integration dry-run only. Для трека AI Trading нужен хотя бы один реальный swap.

4. **USDY не интегрирован** — RWA (Real World Assets) — ключевое требование для AI & RWA трека. mETH есть как yield-bearing asset, но USDY (Ondo Finance) не используется. Это основной RWA актив на Mantle.

5. **Мало on-chain history** — нужно минимум 50-100 decisions для убедительности. Сейчас ~20, и часть на старом адресе.

### 10.2 ЗНАЧИТЕЛЬНЫЕ (снижают оценку)

6. **Token URI пустой** — Identity NFT не имеет IPFS Agent Card. Это формальный пробел в ERC-8004.

7. **Nansen credits exhausted** — paid MCP tools (address_portfolio, wallet_pnl_summary) не работают. general_search работает бесплатно, но для Copy Farming нужен апгрейд.

8. **Copy Farming не реализован** — это killer feature из ресерча (найти profitable wallet → скопировать стратегию). Модуль Nansen позволяет, но логика не написана.

9. **Tencent KMS — только interface** — нет реальных credentials. Для демо это ок (показываем архитектуру), но судьи могут спросить.

10. **GLM-5 "Preserved Thinking" не используется** — ресерч упоминает что GLM-4.7/5 может сохранять рассуждения между вызовами. Мы не используем эту feature (каждый цикл с нуля).

11. **Нет Telegram bot** — ресерч и документация Byreal подчёркивают Telegram как user interface. У нас только web.

### 10.3 ЖЕЛАТЕЛЬНЫЕ (nice-to-have)

12. **Нет zkML** — ERC-8004 поддерживает zero-knowledge proofs для валидации. Мы используем простой consensus, не ZK.

13. **Нет A2A (Agent-to-Agent) протокола** — агенты общаются внутри одного Node.js процесса, не через стандартизированный протокол.

14. **Нет multi-chain** — только Mantle. Для ecosystem contribution было бы полезно показать bridging или cross-chain data.

15. **Нет governance** — решения принимает AI автономно. Нет человеческого override через on-chain voting.

16. **Документация на английском** — README хороший, но нет tutorials, нет API docs, нет developer guide для форков.

---

## 11. РЕКОМЕНДУЕМЫЕ ДЕЙСТВИЯ (ПРИОРИТИЗИРОВАННЫЕ)

### Неделя 1 (21-27 мая): Critical fixes

| # | Задача | Impact | Effort | Priority |
|---|--------|--------|--------|----------|
| 1 | Glass Mode frontend (AI thinking viz) | 25% design score | 3 days | 🔴 CRITICAL |
| 2 | Запустить orchestrator 24/7 → 50+ decisions | Ecosystem proof | 1 hour setup | 🔴 CRITICAL |
| 3 | USDY интеграция (хотя бы price feed + allocation logic) | RWA track | 4 hours | 🔴 CRITICAL |
| 4 | Upload Agent Card to IPFS + update tokenURI | ERC-8004 completeness | 1 hour | 🟡 HIGH |
| 5 | Execute 1 real swap через Byreal or Merchant Moe | AI Trading proof | 2 hours | 🟡 HIGH |

### Неделя 2 (28 мая — 3 июня): Enhancement

| # | Задача | Impact | Effort | Priority |
|---|--------|--------|--------|----------|
| 6 | Copy Farming MVP (Nansen → Byreal) | Alpha track killer feature | 1 day | 🟡 HIGH |
| 7 | Video demo production (2+ min) | Mandatory submission | 4 hours | 🔴 CRITICAL |
| 8 | Reputation-gated execution (if rep < X → smaller positions) | Innovation points | 3 hours | 🟡 HIGH |
| 9 | Telegram bot (simple: /status, /decide, /history) | UX/Accessibility | 1 day | 🟢 MEDIUM |
| 10 | Update frontend to mainnet + show real data | Product completeness | 4 hours | 🟡 HIGH |

### Неделя 3 (4-10 июня): Polish

| # | Задача | Impact | Effort | Priority |
|---|--------|--------|--------|----------|
| 11 | Stress test 72h continuous | On-chain track record | Setup once | 🟡 HIGH |
| 12 | DoraHacks submission prep | Logistics | 2 hours | 🔴 CRITICAL |
| 13 | Brand identity (logo, color scheme, fonts) | Visual Design 30% | 3 hours | 🟢 MEDIUM |
| 14 | Developer documentation / tutorial | Completeness | 4 hours | 🟢 MEDIUM |

### Дни 11-15 июня: Buffer + Submit

| # | Задача | Impact | Effort | Priority |
|---|--------|--------|--------|----------|
| 15 | Final video re-record with polished UI | Presentation | 2 hours | 🔴 CRITICAL |
| 16 | Submit на DoraHacks | — | 30 min | 🔴 CRITICAL |

---

## 12. ТЕХНИЧЕСКИЕ ДЕТАЛИ ДЛЯ АНАЛИЗА

### 12.1 Зависимости (package.json dependencies)

```
@aws-sdk/client-bedrock-runtime  — AWS Bedrock for LLM inference
@openzeppelin/contracts           — Battle-tested Solidity libraries
ethers                            — Ethereum interaction (v6)
zod                               — Runtime type validation for LLM output
dotenv                            — Environment configuration
node-cron                         — Scheduling orchestrator cycles
hardhat                           — Smart contract development
chai                              — Test assertions
@nomicfoundation/hardhat-toolbox  — Hardhat plugins
```

### 12.2 Среда исполнения

- **Runtime:** Node.js (v18+)
- **Blockchain:** Mantle Mainnet (EVM, Chain ID 5000)
- **EVM version:** cancun
- **Solidity:** 0.8.28
- **Optimizer:** 200 runs
- **Network RPC:** https://rpc.mantle.xyz

### 12.3 Ключевые файлы для code review

1. `src/orchestrator/multiAgent.js` — ядро multi-model consensus
2. `src/orchestrator/multiAgentLoop.js` — полный цикл с IPFS + on-chain
3. `src/orchestrator/unifiedMarketData.js` — 5-source aggregator
4. `src/mcp/nansenMCP.js` — Nansen MCP protocol client
5. `src/execution/executionEngine.js` — Byreal CLI wrapper
6. `contracts/TuringVaultReputationRegistry.sol` — newest contract

### 12.4 Environment Variables

```
AWS_ACCESS_KEY_ID          — Bedrock access (GLM-5 + Claude)
AWS_SECRET_ACCESS_KEY      — Bedrock secret
AWS_REGION                 — us-east-1
PRIVATE_KEY                — Mantle wallet (for on-chain TXs)
NANSEN_API_KEY             — Nansen MCP authentication
PINATA_JWT                 — (optional) IPFS pinning
TENCENT_KMS_KEY_ID         — (optional) KMS key identifier
ANALYST_MODEL              — Override: default zai.glm-5
VALIDATOR_MODEL            — Override: default us.anthropic.claude-sonnet-4-6
```

---

## 13. КОНКУРЕНТНЫЙ АНАЛИЗ (ПРЕДПОЛОЖИТЕЛЬНЫЙ)

### 13.1 Что делают другие проекты на Mantle

Типичные AI trading projects:
- Обёртка над GPT-4 с CoinGecko API → простой "buy/sell" бот
- Copy trading с Nansen (без on-chain verification)
- DeFi yield optimizer (no AI, just math)
- NFT-based agent identity (без реального consensus mechanism)

### 13.2 Наше дифференцирование

Мы ЕДИНСТВЕННЫЕ кто:
1. Используем две РАЗНЫЕ модели для adversarial consensus
2. Записываем ПОЛНУЮ цепочку рассуждений on-chain (не только результат)
3. Имеем все 3 ERC-8004 реестра задеплоенные
4. Интегрируем Nansen через MCP (не REST API)
5. Используем GLM-5 (Z.ai) как primary — loyalty к партнёру
6. Имеем 63 теста (pro quality, не hackathon spaghetti)

### 13.3 Риски от конкурентов

- Кто-то может иметь ЛУЧШИЙ frontend (наш слабый)
- Кто-то может иметь РЕАЛЬНЫЕ profitable trades (у нас dry-run)
- Кто-то может использовать ZK proofs (мы нет)
- Кто-то может иметь Telegram bot из коробки (массовый UX)

---

## 14. ФИНАНСОВАЯ МОДЕЛЬ

### 14.1 Operational costs

- Bedrock GLM-5: ~$0.001 per call (7x cheaper than Claude)
- Bedrock Claude: ~$0.007 per call
- Total per cycle: ~$0.01 (2 LLM calls + data fetch)
- Per day (288 cycles): ~$3
- Mantle gas: ~0.004 MNT per TX = ~$0.0025

### 14.2 Wallet state

- Current balance: 6.5 MNT
- Enough for: ~1600 transactions = ~400 cycles = ~33 hours continuous
- Need top-up for 72h stress test: additional 10-15 MNT

---

## 15. ВОПРОСЫ ДЛЯ DEEP RESEARCH

1. Как именно судьи проверяют "Ecosystem Contribution"? Достаточно ли deploy на mainnet или нужен реальный TVL?

2. Есть ли референсные проекты-победители прошлых фаз (ClawHack)? Что они сделали?

3. Как конкуренты решают проблему "доказательства ИИ"? Есть ли альтернативы Proof-of-Reasoning?

4. Насколько критично использование USDY (Ondo)? Это hard requirement или bonus?

5. Есть ли формальная спецификация ERC-8004 (EIP draft)? Или это неформальный стандарт от Mantle?

6. Какие проекты уже используют Nansen MCP? Есть ли best practices?

7. Как оценивается "AI Interaction Design"? Есть ли примеры высоко оценённых AI UX?

8. Byreal CLI — можно ли через него РЕАЛЬНО торговать на Mantle (не только Hyperliquid)?

9. Tencent Cloud KMS — нужен ли реальный demo или достаточно архитектурного описания?

10. Есть ли у Z.ai official documentation по GLM-5 features (Interleaved Thinking, Preserved Thinking)? Как их активировать через Bedrock API?

11. Существует ли Grant или спонсорская программа от Mantle для получения MNT для тестирования?

12. Каков средний уровень проектов на DoraHacks AI hackathons? Сколько submission обычно?

---

## 16. СТРАТЕГИЧЕСКОЕ РЕЗЮМЕ

### Позиция проекта: STRONG CONTENDER (7/10)

**Мы точно в топ-10** благодаря:
- Глубине backend архитектуры
- Multi-model AI + ERC-8004 + 5 contracts mainnet
- Использованию GLM-5 (Z.ai partner)
- Proof-of-Reasoning как новый концепт

**Для топ-3 нужно:**
- Glass Mode UI (50% оценки это дизайн!)
- Video demo (обязательно для submission)
- Хотя бы 1 real execution (proof of concept)
- 50+ on-chain decisions (track record)
- USDY integration (RWA track requirement)

**Для Grand Champion:**
- Все вышеперечисленное ПЛЮС
- Killer UX (animations, real-time viz, Telegram bot)
- Copy Farming working demo
- 72h+ autonomous operation with positive PnL
- zkML или TEE attestation (academic innovation)

---

Документ подготовлен: 20 мая 2026
Автор: AI Engineering Team (TuringVault)
Для: Deep Research Analysis → выявление пробелов и стратегия оптимизации
