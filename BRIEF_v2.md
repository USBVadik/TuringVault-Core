# TuringVault — Детализированный Технический Бриф v2.0
## Для внешней экспертной оценки

---

## 1. ПОЗИЦИОНИРОВАНИЕ (ONE-LINER)

**TuringVault — это Proof-of-Reasoning Layer для автономных AI-агентов на Mantle: каждое решение AI по управлению капиталом проходит валидацию перед исполнением, записывается на блокчейн и привязывается к эволюционирующей ERC-8004 репутационной идентичности.**

Мы НЕ трейдинг-бот. Мы — инфраструктурный слой доверия для любого AI-агента, управляющего деньгами.

---

## 2. ПРОБЛЕМА

AI-агенты уже управляют капиталом on-chain, но:

| Проблема | Последствие |
|----------|-------------|
| Нет верифицируемого следа рассуждений | Невозможно аудировать ПОЧЕМУ агент принял решение |
| Нет доказательства реального анализа | Модель могла галлюцинировать вместо анализа данных |
| Нет гейта между "AI хочет торговать" и "сделка происходит" | Любая ошибка мгновенно конвертируется в потерю капитала |
| Нет репутации | Новый агент и проверенный боем — выглядят идентично |
| Нет self-improvement с гарантиями | Агент не эволюционирует или эволюционирует бесконтрольно |

**Результат:** Пользователь вынужден слепо доверять непрозрачному чёрному ящику свой капитал.

---

## 3. НАШЕ РЕШЕНИЕ — 5 СТОЛПОВ

### 3.1. Dual-Model Adversarial Consensus
- **Analyst (Z.ai GLM-5)** — агрессивный аналитик, ищет альфу
- **Validator (Claude Sonnet 4.6 via Bedrock)** — консервативный риск-менеджер, оценивает risk score
- Два независимых LLM ДОЛЖНЫ согласиться перед любым действием
- Analyst предлагает → Validator challenge'ит → только при согласии = действие

### 3.2. On-Chain Decision Provenance
- Каждое предложение, валидация и исход записываются на Mantle Mainnet
- 4 транзакции на цикл: proposal, validation, decision log, reputation update
- Полный контекст рассуждений сохраняется в IPFS (Pinata)
- Любой может верифицировать: DecisionLog.getRecentDecisions() → IPFS CID → полный reasoning

### 3.3. Pre-Action Validation Gates (VaR-based Autonomy)
```
VaR < 50 bps  → AUTONOMOUS: AI исполняет без вмешательства человека
VaR 50-150    → SUPERVISED: AI предлагает, человек одобряет через intent queue
VaR > 150     → BLOCKED: Слишком рискованно, действие отменяется
```
- Не бинарное on/off — непрерывная шкала автономии на основе Value-at-Risk
- Smart contract проверяет перед исполнением (Pre-Action Check)

### 3.4. Hardware-Secured Signing Pipeline (Tencent KMS-compatible)
- AI генерирует НАМЕРЕНИЯ (intents), никогда не касается приватных ключей
- Full DER → secp256k1 recovery → EIP-2 (low-S) → EIP-155 (chain-id) pipeline implemented
- Production mode: Tencent Cloud KMS HSM подписывает только после Pre-Action Check
- Demo mode: Cryptographically valid simulation with identical pipeline stages
- Ключ физически недоступен для AI, даже при компрометации модели

### 3.5. Self-Evolution with Safety Validator
- Агент читает свою производительность из ReputationRegistry (on-chain)
- GLM-5 выполняет self-reflection — анализирует паттерны ошибок
- Claude 4.6 ВАЛИДИРУЕТ предложенную эволюцию (предотвращает деградацию)
- Новый Agent Card загружается на IPFS
- setAgentURI() on-chain → tokenURI указывает на эволюционированный промт
- Следующий цикл загружает промт из IPFS — агент буквально переписал себя

**Завершено 4 эволюционных итерации.** Каждая верифицируема: `tokenURI → IPFS CID → полный промт + параметры`.

---

## 4. АРХИТЕКТУРА — DECISION PIPELINE (7 ШАГОВ)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROOF-OF-REASONING PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [1] CONTEXT        [2] COGNITIVE      [3] SAFETY        [4] ATTESTATION   │
│  ACQUISITION    →   SYNTHESIS      →   GATES        →   (ON-CHAIN)         │
│                                                                             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────────┐  │
│  │ CoinGecko  │    │ Analyst    │    │ VaR Gate   │    │ ERC-8004       │  │
│  │ DeFiLlama  │    │ (GLM-5)   │    │ Pre-Action │    │ Identity       │  │
│  │ Fear&Greed │    │     ↓      │    │ Check      │    │ Validation     │  │
│  │ Merchant   │    │ Validator  │    │ KMS Sign   │    │ Reputation     │  │
│  │ Moe Bins   │    │ (Claude)   │    │ or BLOCK   │    │ Decision Log   │  │
│  │ USDY Yield │    │     ↓      │    │            │    │ IPFS Proof     │  │
│  │ Nansen MCP │    │ Consensus  │    │            │    │                │  │
│  └────────────┘    └────────────┘    └────────────┘    └────────────────┘  │
│                                                                             │
│                         ┌──────────────────────┐                           │
│                         │  SELF-EVOLUTION LOOP  │                           │
│                         │  Read perf → Reflect  │                           │
│                         │  → Validate → IPFS    │                           │
│                         │  → setAgentURI() TX   │                           │
│                         └──────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Детальный Flow:

1. **Market Data Aggregation** — 5 источников параллельно:
   - CoinGecko (ETH/MNT цена, 24h change, volume)
   - DeFiLlama (Mantle TVL, protocol flows)
   - Fear & Greed Index (market sentiment 0-100)
   - Merchant Moe LB v2.1 (active bins, реальные котировки DEX)
   - Ondo USDY (RWA yield rate, 5.25% APY)
   - (Опционально) Nansen MCP — Smart Money flows, token scoring

2. **GLM-5 Analysis** — Analyst принимает решение:
   - Input: unified market context
   - Output: `{action, targetAsset, confidence, reasoning}`
   - Actions: hold / swap / provide_liquidity / increase_rwa

3. **Claude Validation** — Validator оценивает:
   - Input: proposal от Analyst + тот же market context
   - Output: `{approved, riskScore (0-100), validatorConfidence, reasoning}`
   - Reject если risk > 65 ИЛИ confidence < 0.6

4. **VaR Gate** — Smart contract проверяет:
   - Рассчитывается VaR в basis points
   - Определяется уровень автономии
   - Pre-Action Check on-chain

5. **KMS Signing** — Аппаратная подпись:
   - Intent → Tencent KMS → DER encoded signature → EIP-2 normalization → EIP-155 replay protection
   - Или BLOCK если VaR > 300

6. **On-Chain Recording** — 4 транзакции:
   - DecisionLog.logDecision() — решение + reasoning hash
   - ValidationRegistry.submitValidation() — результат валидации
   - ReputationRegistry.updateReputation() — performance tracking
   - Identity tokenURI update (при эволюции)

7. **IPFS Proof** — Pinata:
   - Полный reasoning document (analyst + validator + context)
   - CID hash записывается в reasoningHash поле on-chain
   - Любой может проверить: txHash → reasoningHash → IPFS → полный контекст

---

## 5. SMART CONTRACTS — DEPLOYED ON MANTLE MAINNET

| Контракт | Адрес | Верификация | Назначение |
|----------|-------|-------------|------------|
| **TuringVaultIdentity** | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | ✅ Sourcify | ERC-8004 — идентичность агента как NFT с evolving metadata |
| **TuringVaultDecisionLog** | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Sourcify | Immutable history всех решений с reasoning hashes |
| **TuringVaultReputationRegistry** | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | ✅ Sourcify | Performance tracking: score, success rate, total decisions |
| **TuringVaultValidation** | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | ✅ Sourcify | Pre-Action checks — валидация перед исполнением |
| **TuringVaultRouter** | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ⏳ Pending | DEX routing через Merchant Moe LB v2.1 |

**Solidity 0.8.28 / OpenZeppelin v5 / Hardhat / 91 контрактных тестов passing**

---

## 6. ON-CHAIN PROOF OF SAFETY

| Метрика | Значение | Интерпретация |
|---------|----------|---------------|
| Total Proposals | 20 | Analyst предложил 20 рыночных действий |
| Blocked by Validator | 19 | Risk firewall отклонил 19 небезопасных предложений |
| Approved Executions | 1 | Только 1 действие прошло все safety thresholds |
| Consensus Rate | 100% | Каждое решение прошло полный dual-model pipeline |
| Avg VaR | ~150 bps | Рынок был волатильным → большинство → BLOCKED/SUPERVISED |
| Gas Efficiency | ~0.005 MNT/TX | Каждая запись стоит ~$0.01 |

> **19/20 заблокировано — это не провал, это доказательство работающей системы безопасности.** Risk firewall, который ничего не блокирует = security theater.

---

## 7. SELF-EVOLUTION — 4 ИТЕРАЦИИ

| # | Timestamp | Reason | Validator |
|---|-----------|--------|-----------|
| 1 | 2026-05-20 20:19 | "Increased confidence thresholds and reduced position sizing — operating in vacuum with no signal" | ✅ APPROVED (low risk) |
| 2 | 2026-05-20 21:38 | "Adding explicit output structure and conservative risk parameters — zero feedback suggests prioritize capital preservation" | ✅ APPROVED (low risk) |
| 3 | 2026-05-20 21:39 | "Establishing explicit decision thresholds and signal weights to reduce passivity" | ✅ APPROVED (low risk) |
| 4 | 2026-05-20 21:41 | "Establishing baseline parameters and structured decision framework for meaningful feedback collection" | ✅ APPROVED (low risk) |

**Каждая эволюция:** self-reflection → validator approval → IPFS upload → on-chain setAgentURI() TX → следующий цикл загружает из IPFS.

---

## 8. PARTNER INTEGRATIONS

| Партнёр | Интеграция | Роль в Pipeline |
|---------|-----------|-----------------|
| **Z.ai** | GLM-5 via AWS Bedrock | Primary analyst — aggressive alpha identification |
| **Anthropic** | Claude 4.6 via Bedrock | Conservative validator — risk scoring + evolution approval |
| **Tencent Cloud** | KMS HSM (SECP256K1) | Hardware key security — DER → EIP-2 → EIP-155 pipeline |
| **Nansen** | MCP Protocol (36 tools) | Smart Money tracking, token scoring, wallet profiling |
| **Merchant Moe** | LB Router v2.1 | On-chain DEX quotes with bin-step pricing |
| **Ondo Finance** | USDY (RWA) | Tokenized US T-Bills, adaptive 10-50% yield allocation |
| **Mantle** | ERC-8004 + native DeFi | Chain infrastructure, 5 deployed contracts |
| **Bybit** | Web3 Wallet | End-user access via RainbowKit connector |
| **Byreal** | Perps CLI + RealClaw | Institutional CLMM + perpetual futures execution |
| **Pinata** | IPFS Pinning | Reasoning proofs, Agent Cards, evolution history |

---

## 9. TECHNOLOGY STACK

| Слой | Технология | Назначение |
|------|-----------|-----------|
| AI Models | Z.ai GLM-5 + Claude 4.6 (AWS Bedrock) | Dual-model consensus |
| Smart Contracts | Solidity 0.8.28, OZ v5, Hardhat | 5 контрактов, 4 верифицированы |
| Testing | Hardhat (91) + Jest (19) = 110 тестов | Full coverage контрактов + orchestrator |
| DEX | Merchant Moe LB Router v2.1 | Real swap quotes, bin-step liquidity |
| RWA | Ondo USDY | 5.25% APY, adaptive allocation 10-50% |
| Key Security | Tencent KMS HSM | Hardware signing, air-gapped from AI |
| Smart Money | Nansen MCP (36 tools) | Institutional flow detection |
| Storage | IPFS (Pinata) | Immutable reasoning proofs |
| Frontend | Next.js 16 + Tailwind + RainbowKit + wagmi | Proof Explorer dashboard |
| Chain | Mantle Mainnet (ID: 5000) | Low gas, EVM, ERC-8004 native support |

---

## 10. SDK — ДЛЯ ЭКОСИСТЕМЫ

TuringVault не closed-system — это открытый протокол. Любой AI-агент может стать PoR-enabled:

```javascript
const { TuringVaultSDK } = require('@turingvault/sdk');

const sdk = new TuringVaultSDK({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://rpc.mantle.xyz',
  pinataJwt: process.env.PINATA_JWT,
});

// Record verifiable AI decision on-chain
const proof = await sdk.createPoRDecision({
  analyst: { model: 'any-model', action: 'swap', confidence: 0.85 },
  validator: { model: 'any-validator', riskScore: 35, approved: true },
  targetAsset: 'WETH',
});
// → decisionId, txHash, ipfsCid, approved, gasUsed
```

Read-only (без ключа): `sdk.getRecentDecisions(10)`, `sdk.getTotalDecisions()`

---

## 11. FRONTEND — PROOF EXPLORER

Живой дашборд (Next.js 16 + Server Components) отображающий:
- **Decision Timeline** — все 20 on-chain решений с expansion details
- **Decision Pipeline** — визуализация 7-step flow
- **Agent Identity** — ERC-8004 данные из IPFS
- **Safety Metrics** — VaR thresholds, block rate
- **On-Chain Links** — прямые ссылки на Mantle Explorer для верификации

Каждый элемент кликабелен → показывает reasoning hash, TX hash, IPFS link.

---

## 12. КОНКУРЕНТНОЕ ПРЕИМУЩЕСТВО

| | Другие AI Agents | TuringVault |
|---|---|---|
| **Reasoning** | Скрытый / prompt-injected | On-chain, IPFS-pinned, аудируемый |
| **Consensus** | Одна модель | Dual-model adversarial (propose + challenge) |
| **Key Security** | Plaintext в .env | KMS HSM pipeline (DER + EIP-2 + EIP-155) |
| **Self-Improvement** | Ручной промт-тюнинг | Автономная эволюция с safety validator |
| **Trust** | "Trust me bro" | Verifiable decision provenance (ERC-8004) |
| **Autonomy** | Binary (on/off) | Continuous (VaR-based sliding scale) |
| **Safety Proof** | Надеемся что работает | 19/20 blocked — on-chain доказательство |
| **SDK/Ecosystem** | Closed black box | Open SDK — любой агент может стать PoR-enabled |

---

## 13. HACKATHON TRACKS

### 🏆 AI Trading & Strategy (Primary)
- Dual-model consensus предотвращает импульсивные сделки
- VaR-based autonomy (Human vs AI mode)
- Реальные on-chain DEX котировки (Merchant Moe LB v2.1)
- Risk firewall proof: 19/20 blocked = safety works
- RWA allocation (USDY) как safe haven при высоком VaR

### 🤖 Agentic Wallets & Economy
- Full ERC-8004 implementation (5 контрактов)
- Agent Identity как NFT с evolving IPFS metadata
- Tencent Cloud KMS pipeline
- Pre-Action Checks как on-chain governance gates
- Agent Trust SDK для ecosystem builders

---

## 14. ДЕМОНСТРИРУЕМЫЕ РЕЗУЛЬТАТЫ (VERIFIABLE)

| Claim | Proof | Как проверить |
|-------|-------|---------------|
| 20 AI decisions | DecisionLog.totalDecisions() | [Explorer](https://explorer.mantle.xyz/address/0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5#readContract) |
| 19/20 blocked | ValidationRegistry events | [Explorer](https://explorer.mantle.xyz/address/0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705) |
| ERC-8004 Agent | Identity.tokenURI(0) | [IPFS](https://ipfs.io/ipfs/QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw) |
| 4 evolution iterations | tokenURI changed 4× | TX history on explorer |
| Dual-model consensus | Reasoning hashes in every TX | DecisionLog entries |
| 110 tests passing | `npm test` | Hardhat (91) + Jest (19) |
| Live Proof Explorer | Frontend dashboard | [Live URL при деплое] |

---

## 15. ШАГИ РЕАЛИЗАЦИИ (ЧТО БЫЛО СДЕЛАНО)

### Phase 1: Smart Contract Infrastructure ✅
- Разработка 5 Solidity контрактов (Identity, DecisionLog, Validation, Reputation, Router)
- 91 контрактный тест (Hardhat)
- Деплой на Mantle Mainnet
- Верификация 4/5 на Sourcify

### Phase 2: Multi-Agent Orchestrator ✅
- Unified Market Data (5 источников)
- GLM-5 Analyst integration (Z.ai via Bedrock)
- Claude 4.6 Validator integration (Anthropic via Bedrock)
- Consensus logic + VaR calculation
- 19 orchestrator тестов (Jest)

### Phase 3: Security & Signing ✅
- Tencent KMS HSM integration
- DER → EIP-2 → EIP-155 pipeline
- Pre-Action Check enforcement
- Intent-based architecture (AI never touches keys)

### Phase 4: Self-Evolution ✅
- Performance read from ReputationRegistry
- GLM-5 self-reflection module
- Claude validator for evolution proposals
- IPFS upload → setAgentURI() → prompt loading from IPFS
- 4 successful evolution cycles completed

### Phase 5: Frontend & SDK ✅
- Proof Explorer (Next.js 16 + Server Components)
- RainbowKit + wagmi wallet connection
- Agent Trust SDK (npm package)
- Live deployment via cloudflare tunnel

### Phase 6: Remaining 🔲
- [ ] Video demo (2-3 min)
- [ ] DoraHacks submission
- [ ] Final documentation polish

---

## 16. ВОПРОСЫ ДЛЯ ВНЕШНЕГО АНАЛИТИКА

### Архитектурные:
1. Достаточно ли dual-model consensus (2 модели) для production safety, или нужен N-of-M quorum?
2. VaR-based autonomy — убедительна ли скользящая шкала (50/150/300 bps) как механизм human-AI governance?
3. Pre-Action Check on-chain — это реально добавляет security или это можно обойти (owner bypass)?
4. Self-evolution с validator — достаточно ли одного Claude проверять эволюцию, или нужна формальная верификация?

### Безопасность:
5. KMS pipeline (Tencent) — насколько убедительна как альтернатива MPC/AA wallets?
6. Если owner key скомпрометирован — какие атаки возможны (bypass validation, drain funds)?
7. IPFS reasoning proofs — что мешает загрузить фейковый reasoning после факта?
8. Oracle problem: market data приходит off-chain — как доказать что агент видел РЕАЛЬНЫЕ данные?

### Экономические:
9. Модель монетизации SDK — как это может стать sustainable business beyond hackathon?
10. Gas cost 4 TX/decision × ~0.005 MNT — scalable ли это при 1000+ decisions/day?
11. "19/20 blocked" — для judges это proof of safety или proof of uselessness?

### Слабые места:
12. Validator (Claude) тоже может ошибаться — кто валидирует валидатора?
13. Evolution может привести к drift — агент через 100 итераций может стать unrecognizable
14. Нет реальных денег в системе — proof of concept vs. production-ready?
15. Зависимость от централизованных APIs (Bedrock, CoinGecko, Pinata) — single points of failure?

### Позиционирование:
16. "Proof-of-Reasoning Layer" — уникально ли это или существуют конкуренты (Ritual, Giza, Modulus)?
17. ERC-8004 — насколько это принятый стандарт vs. наш собственный proposal?
18. Mantle-specific или chain-agnostic? Как портировать на другие L2?

### Рекомендации:
19. Что бы вы убрали/упростили для более чистого нарратива?
20. Что является killer feature которую стоит усилить в демо?
21. Какие red flags увидит искушённый Web3 judge?
22. Стоит ли подчёркивать "не трейдинг-бот" или это контрпродуктивно для AI Trading track?

---

## 17. RAW DATA ДЛЯ ВЕРИФИКАЦИИ

### IPFS Agent Card CID:
`QmUc6Qo4yoH2SboEesPeKuojs93MaJNxFjw9mDRTZp4axw`

### Evolution TX Hashes:
1. `0xa5715caa7e073720da53833e81eb5eaeb88c56b01424c367021dafb210875a0d`
2. `0x7c8f0028719f4b32caaf5f0141861e32215af7a5c5154626f8a68cc3d50f77c0`
3. `0xc9d15a029147586fec78bc2f5f34453d3a902c1269a337abc8f7e2da28c1b1f8`
4. `0xbe178c26d1d333f0ce5eeb89b680227bc92aac3b4c8b027a08c95e00537fde64`

### Recent Decision TX (sample):
- `0xd216d56512c6c9c8dd885ed0e7b9f707cee8ad49ef65202b879abf105219e5ff` (BLOCKED, VaR:176)
- `0x37d83f87929ecbdcd3afb3944144b68b0c71efdd15e7031375d64713173dd67b` (APPROVED, risk=28)

### Test Command:
```bash
cd turingvault && npm test  # 110 tests (91 Hardhat + 19 Jest)
```

---

*Документ подготовлен: 21 мая 2026 | TuringVault v2.0 | Mantle Turing Test Hackathon*
