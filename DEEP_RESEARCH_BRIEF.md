# TuringVault — Deep Research Brief для Внешнего Аналитика

> **Цель документа:** Дать полный контекст проекта TuringVault внешнему аналитику (Claude/GPT/DeepSeek в режиме Deep Research) для получения рекомендаций по усилению проекта с максимальным шансом победы на Mantle Turing Test Hackathon 2026.

---

## 1. КОНТЕКСТ ХАКАТОНА

### Основная информация
- **Название:** The Turing Test Hackathon 2026
- **Организатор:** Mantle Network (backed by Bybit, 4th largest crypto exchange)
- **Платформа:** DoraHacks
- **Призовой фонд:** $100,000 USD
- **Даты:** 1 мая — 15 июня 2026 (45 дней)
- **Формат:** Virtual (онлайн)
- **URL:** https://dorahacks.io/hackathon/mantleturingtesthackathon2026

### Текущая конкуренция (на 19 мая 2026)
- Зарегистрировано: 594 хакеров
- Подали заявки: 84
- Сабмитнули проекты: 0 (!)
- Команд: 6
- Осталось дней: ~25

### Спонсоры и партнёры хакатона
| Партнёр | Роль | Что предоставляют |
|---------|------|-------------------|
| **Mantle Network** | Организатор | Блокчейн L2, гранты, ERC-8004 |
| **Bybit** | Backing Partner | Trading API, Wallet, дистрибуция |
| **Byreal** | Sponsor (Agentic Track) | RealClaw, Agent Skills, Perps CLI |
| **Tencent Cloud** | Infrastructure | Cloud credits, KMS инфраструктура |
| **Mirana Ventures** | Sponsor (Alpha Track) | VC funding для победителей |
| **Animoca Brands** | Ecosystem | Web3 gaming, NFT opportunities |
| **Nansen** | Data Partner | On-chain analytics, Smart Money data |
| **Z.ai** | AI Partner | GLM-5 модель, AI infrastructure |
| **Blockchain for Good (BGA)** | Sponsor (Trading Track) | Social impact + funding |
| **Ondo Finance** | RWA Partner | USDY tokenized T-Bills on Mantle |
| **Merchant Moe** | DEX Partner | Native Mantle DEX, LB Router |

---

## 2. ТРЕКИ И КРИТЕРИИ ОЦЕНКИ

### 2.1 Треки (можно подать максимум в 2)

| # | Трек | Вес (приоритет) | Спонсор | Суть |
|---|------|-----------------|---------|------|
| 1 | AI Trading & Strategy | 6 (макс) | BGA | AI quant боты, macro-driven контракты |
| 2 | AI Alpha & Data | 5 | Mirana Ventures | On-chain аналитика, AI-driven trading |
| 3 | AI & RWA | 4 | Mantle Network | Токенизация реальных активов + AI |
| 4 | Consumer & Viral DApps | 3 | — | Геймификация, вирусные приложения |
| 5 | AI DevTools | 2 | — | Инструменты разработчика для Mantle |
| 6 | Agentic Wallets & Economy | 1 | Byreal | Агенты с Byreal Skills/RealClaw |

### 2.2 Специальные награды
| Награда | Приз | Критерий |
|---------|------|----------|
| Grand Champion | $15-25k | Лучший проект across all tracks |
| Best UI/UX | $3-5k | Дизайн, взаимодействие, AI UX, доступность |
| Community Voting | $3-5k | Голосование в Twitter/X |
| 20 Deployment Awards | $500-1k каждый | Первые 20 задеплоенных проектов (ГАРАНТИРОВАНО) |

### 2.3 Критерии Grand Champion
| Критерий | Вес | Описание |
|----------|-----|----------|
| Technical Depth | 30% | AI × on-chain integration, архитектура, код |
| Innovation | 25% | Новая AI × Web3 парадигма, оригинальность |
| Mantle Ecosystem Contribution | 25% | Вклад в экосистему Mantle, долгосрочная ценность |
| Product Completeness | 20% | Работающее демо, UX, масштабируемость |

### 2.4 Критерии AI Alpha & Data Track
- **General (60%):** Data quality, AI depth, technical completeness, sustainability
- **Track-specific (40%):** 
  - Путь A (Analytics): Уникальность инсайтов + визуализация
  - Путь B (Trading): Сложность стратегии + верифицируемость

### 2.5 Критерии AI & RWA Track
- **General (60%):** AI × RWA integration depth, completeness, Mantle integration, compliance
- **Track-specific (40%):**
  - Infrastructure: Полнота токенизации + инновационность
  - Application: Ясность актива + целевой пользователь + UX

### 2.6 Критерии Agentic Economy Track
- **General (70%):** Byreal integration depth, agent autonomy, completeness, sustainability
- **Track-specific (30%):** Strategy alpha OR real-world validity

### 2.7 Критерии Best UI/UX
| Критерий | Вес |
|----------|-----|
| Visual Design | 30% |
| Interaction & Flow | 30% |
| AI Interaction Design | 25% |
| Accessibility | 15% |

### 2.8 Обязательные требования для сабмита
- ✅ Smart contract на Mantle (Mainnet или Testnet), верифицирован на Explorer
- ✅ Минимум ОДНА AI-powered on-chain функция
- ✅ Публично доступный frontend (не localhost)
- ✅ Demo video ≥ 2 минуты
- ✅ Open-source GitHub репозиторий с README
- ✅ One-line pitch + полное описание проекта

---

## 3. ПОЛНОЕ ОПИСАНИЕ ПРОЕКТА TURINGVAULT

### 3.1 Одна строка
> Hardware-Secured AI Vault with Decentralized Verification of Intent — Multi-Agent Proof-of-Reasoning on Mantle

### 3.2 Проблема
AI агенты, управляющие капиталом — непрозрачные "чёрные ящики". Пользователи не могут верифицировать:
- **Почему** совершена сделка
- **Какие данные** информировали решение
- Галлюцинирует ли AI или действительно рассуждает
- Соблюдаются ли параметры риска

Это создаёт неразрешимую дилемму доверия: невозможно отличить компетентного агента от генератора случайных чисел без **верифицируемого доказательства когнитивного процесса**.

### 3.3 Решение: Proof-of-Reasoning (PoR)
TuringVault — НЕ торговый бот. Это **криптографически верифицируемый фреймворк AI когниции**:

1. **Dual-Model Consensus** — Два независимых LLM (GLM-5 Analyst + Claude 4.6 Validator) должны прийти к согласию перед любым действием
2. **Immutable Reasoning Chain** — Каждое решение с полным контекстом записывается on-chain на Mantle
3. **Pre-Action Checks** — On-chain validation gates предотвращают исполнение без консенсуса
4. **Hardware-Secured Signing** — AI генерирует "intents", никогда не касается приватных ключей (KMS pipeline через Tencent Cloud)
5. **Self-Evolution** — Агент читает собственную on-chain производительность и перезаписывает свой system prompt через IPFS

### 3.4 Архитектура (полная)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      TRUSTLESS COGNITIVE TRADING LOOP                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐│
│  │   CONTEXT    │   │  COGNITIVE  │   │  EXECUTION   │   │   ATTESTATION    ││
│  │ ACQUISITION  │──▶│  SYNTHESIS  │──▶│    ENGINE    │──▶│   (ON-CHAIN)     ││
│  └──────────────┘   └─────────────┘   └──────────────┘   └──────────────────┘│
│        │                  │                  │                   │            │
│  ┌─────┴──────┐     ┌─────┴──────┐     ┌─────┴──────┐     ┌──────┴─────────┐ │
│  │ Nansen MCP │     │ Analyst    │     │ Byreal     │     │ ERC-8004       │ │
│  │ CoinGecko  │     │ (GLM-5)    │     │ Perps CLI  │     │ Identity       │ │
│  │ DeFiLlama  │     │     ↓      │     │ Merchant   │     │ Validation     │ │
│  │ Merchant   │     │ Validator  │     │ Moe LB v2  │     │ Reputation     │ │
│  │ Moe Bins   │     │ (Claude)   │     │ Tencent    │     │ Decision Log   │ │
│  │ Fear&Greed │     │     ↓      │     │ KMS HSM    │     │ Router         │ │
│  │ USDY Yield │     │ Consensus  │     │ Sign+Send  │     │ IPFS Pinata    │ │
│  └────────────┘     └────────────┘     └────────────┘     └────────────────┘ │
│                                                                               │
│                           ┌──────────────────────┐                            │
│                           │  SELF-EVOLUTION LOOP │                            │
│                           │  Read perf → Reflect │                            │
│                           │  → Validate → IPFS   │                            │
│                           │  → setAgentURI() TX  │                            │
│                           └──────────────────────┘                            │
│                                                                               │
│  Chain: Mantle Mainnet (5000)  │  AI: Z.ai GLM-5 + Claude Sonnet 4.6        │
│  VaR Gate: <50 auto │ 50-150 supervised │ >300 blocked                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 Ключевая инновация: On-Chain Prompt Evolution

TuringVault — **самосовершенствующийся кибернетический организм на блокчейне**:

1. Агент делает 20+ торговых решений → записывает на Mantle
2. Evolution module читает производительность из `ReputationRegistry`
3. GLM-5 выполняет **self-reflection** — анализирует свои ошибки
4. Claude 4.6 **валидирует** предложенную эволюцию (предотвращает деградацию)
5. Новый Agent Card загружается в **IPFS** (Pinata)
6. `setAgentURI()` вызывается on-chain → **tokenURI указывает на эволюционировавший промпт**
7. Следующий цикл загружает промпт из IPFS — агент буквально переписал себя

**4 итерации эволюции завершены**, каждая создаёт более консервативного, data-driven агента.

### 3.6 VaR-Based Autonomy (Human vs AI Mode)

```
VaR < 50 bps  → AUTONOMOUS: AI исполняет без человека
VaR 50-150    → SUPERVISED: AI предлагает, человек подтверждает через intent queue
VaR > 300     → BLOCKED: Слишком рисковано, действий не производится
```

### 3.7 Deployed Contracts — Mantle Mainnet (ВСЕ ВЕРИФИЦИРОВАНЫ)

| Contract | Address | Статус |
|----------|---------|--------|
| TuringVaultIdentity (ERC-8004) | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | ✅ Sourcify |
| TuringVaultDecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | ✅ Sourcify |
| TuringVaultReputationRegistry | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | ✅ Sourcify |
| TuringVaultValidation (Pre-Action) | `0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705` | ✅ Sourcify |
| TuringVaultRouter | `0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001` | ✅ Sourcify |

**Статистика:** Token #0 | 60+ on-chain decisions | ~1 MNT total gas

### 3.8 Интеграции с партнёрами хакатона

| Партнёр | Интеграция | Модуль |
|---------|-----------|--------|
| **Z.ai** | GLM-5 (через AWS Bedrock) | Основная аналитическая модель — агрессивный поиск альфы |
| **Tencent Cloud** | KMS HSM signing pipeline | DER ASN.1 parse → EIP-2 → EIP-155 replay protection |
| **Nansen** | MCP Protocol (24 инструмента) | Smart Money tracking, анализ токенов, профилирование кошельков |
| **Byreal** | Perps CLI + RealClaw | Институциональный execution layer — CLMM + перпетуалы |
| **Merchant Moe** | LB Router v2.1 | On-chain DEX quotes — реальная симуляция свопов с bin-step pricing |
| **Mantle** | ERC-8004 + mETH/USDY | 5 верифицированных контрактов, 60+ on-chain решений |
| **Bybit** | Wallet Integration | RainbowKit connector для Bybit Web3 Wallet |
| **Ondo Finance** | USDY (RWA) | Токенизированные US T-Bills — адаптивная аллокация 10-50% |

### 3.9 Технический стек

| Слой | Технология | Назначение |
|------|-----------|------------|
| AI Models | Z.ai GLM-5 + Claude 4.6 (Bedrock) | Dual-model consensus |
| Smart Contracts | Solidity 0.8.28, OpenZeppelin v5, Hardhat | 5 контрактов ERC-8004 |
| DEX | Merchant Moe LB Router v2.1 | Реальные on-chain котировки |
| RWA | USDY (Ondo Finance, 26M supply on Mantle) | 5.25% APY from US T-Bills |
| Key Security | Tencent KMS (DER, EIP-2, EIP-155) | Hardware-secured signing |
| Smart Money | Nansen MCP (24 tools) | Institutional flow detection |
| Execution | Byreal Perps CLI | CLMM + perpetual futures |
| Storage | IPFS (Pinata) | Agent Cards, reasoning hashes |
| Frontend | Next.js 15 + Tailwind + RainbowKit + wagmi | Glass Mode dark dashboard |
| Chain | Mantle Mainnet (ID: 5000) | $0.01/TX, EVM compatible |

### 3.10 Структура проекта (файловая)

```
turingvault/
├── contracts/                         # Solidity (5 контрактов)
│   ├── TuringVaultIdentity.sol           # ERC-8004 (ERC-721 + metadata + EIP-712)
│   ├── TuringVaultDecisionLog.sol        # Immutable decision history
│   ├── TuringVaultRouter.sol             # Strategy routing + execution
│   ├── TuringVaultReputationRegistry.sol # Reputation + PnL tracking
│   └── TuringVaultValidation.sol         # Pre-Action Checks
├── src/
│   ├── orchestrator/                  # AI Core
│   │   ├── multiAgent.js                # Dual-model engine
│   │   ├── multiAgentLoop.js            # Full cycle: data → AI → chain
│   │   ├── integratedOrchestrator.js    # v2: VaR + intent queue
│   │   └── unifiedMarketData.js         # 5-source aggregator
│   ├── dex/merchantMoe.js             # Merchant Moe LB v2.1
│   ├── rwa/usdyModule.js             # USDY allocation (Ondo)
│   ├── kms/tencentKMS.js             # KMS pipeline
│   ├── evolution/promptEvolution.js   # Self-evolution
│   ├── execution/executionEngine.js   # Byreal Perps CLI
│   ├── mcp/nansenMCP.js              # Nansen Smart Money
│   └── ipfs/storage.js               # Pinata IPFS
├── frontend/                          # Next.js 15
├── test/                              # 103 теста (Hardhat + Jest)
├── scripts/                           # Deploy, verify
└── assets/                            # Agent Card JSON
```

### 3.11 On-Chain Доказательства

| Claim | Proof |
|-------|-------|
| 60+ AI решений | `DecisionLog.totalDecisions()` on-chain |
| Agent зарегистрирован | `Identity.tokenURI(0)` → IPFS |
| Prompt evolution (4×) | tokenURI changed 4 times (TX на explorer) |
| Pre-Action checks | Events на Validation контракте |
| Multi-agent consensus | Каждая TX содержит hashes от обоих моделей |

### 3.12 Тесты
- **91 тест контрактов** (Hardhat)
- **12 тестов оркестратора** (Jest)
- **Итого: 103 passing tests**

---

## 4. ЧТО УЖЕ РЕАЛИЗОВАНО vs ЧТО В ПЛАНЕ

### Реализовано ✅
- [x] 5 контрактов на Mantle Mainnet (все верифицированы на Sourcify)
- [x] Dual-model consensus engine (GLM-5 + Claude 4.6)
- [x] 60+ реальных on-chain решений
- [x] 4 итерации self-evolution (IPFS → tokenURI)
- [x] Tencent KMS signing pipeline
- [x] Nansen MCP integration (24 tools)
- [x] Byreal Perps CLI integration
- [x] Merchant Moe DEX quotes (live)
- [x] USDY (Ondo) RWA module
- [x] VaR-based autonomy system
- [x] Frontend V2 (Glass Mode dark UI)
- [x] 103 passing tests
- [x] Agent Card на IPFS
- [x] README с полной документацией

### В работе / Планируется 🔄
- [ ] Анимированный маскот (реактивный к рынку)
- [ ] Видео-демо (2+ минуты)
- [ ] Полировка frontend до "вау-эффекта"
- [ ] DoraHacks submission form
- [ ] Nansen integration с новым API ключом (текущий — кредиты исчерпаны)
- [ ] Публичный деплой frontend (Vercel/Cloudflare)

---

## 5. СЛАБЫЕ МЕСТА И ВОПРОСЫ ДЛЯ АНАЛИТИКА

### 5.1 Потенциальные слабости

**A. Product Completeness (20% Grand Champion)**
- Frontend пока не на "вау" уровне — V2 хороший, но не на уровне Linear/Vercel
- Нет публичного URL (только Cloudflare tunnel, эфемерный)
- Нет user onboarding flow (пользователь не поймёт что делать)
- Маскот концептуально утверждён, но не реализован

**B. Mantle Ecosystem Contribution (25% Grand Champion)**
- Хорошая интеграция с партнёрами, но нет unique value proposition для экосистемы
- Не очевидно, как проект приносит пользу другим разработчикам на Mantle
- ERC-8004 — наш стандарт, но не принят широко

**C. Nansen Integration**
- API ключ исчерпан (кредиты кончились)
- MCP integration написана, но не демонстрируется в live
- Может выглядеть как "бумажная" интеграция для судей

**D. Execution Reality**
- Byreal Perps CLI интеграция есть, но реальные сделки не показаны в демо
- Нет backtesting results или P&L track record
- 60+ decisions on-chain — но не ясно насколько прибыльны

**E. Community/Viral Factor**
- Нет социального присутствия проекта
- Нет Twitter thread, no community engagement
- Для Community Voting Prize нужна маркетинговая кампания

**F. Video Demo**
- Отсутствует (обязательное требование для сабмита)
- Нужно 2+ минуты, но для Grand Champion лучше 5-7 минут

### 5.2 Конкурентные угрозы

- Проекты с real P&L (кто покажет реальную прибыль — те сильнее)
- "Простые и красивые" проекты могут выиграть UI/UX за счёт polish
- Команды с маркетинг-машиной выиграют Community Voting
- Проекты с более глубокой Byreal интеграцией (RealClaw использование)

---

## 6. ВОПРОСЫ ДЛЯ АНАЛИТИКА

### Стратегические вопросы

1. **Выбор треков (макс 2).** Учитывая наш проект, в какие 2 трека из 6 нам оптимально подать? Сейчас мы покрываем:
   - Agentic Wallets & Economy (Byreal integration, ERC-8004)
   - AI & RWA (USDY/Ondo module)
   - AI Trading & Strategy (Byreal Perps, VaR system)
   - AI Alpha & Data (Nansen, 5-source data)
   
   Какая комбинация даёт максимальный шанс победы с учётом весов треков?

2. **Grand Champion vs Track Prize.** Стоит ли оптимизировать под Grand Champion ($15-25k) или лучше гарантировать Top-3 в треке ($3-12k)?

3. **Усиление Mantle Ecosystem Contribution (25%).** Как нам показать, что TuringVault создаёт ценность для ВСЕЙ экосистемы Mantle, а не только для нас? Что можно добавить за 5-7 дней работы чтобы усилить этот критерий?

4. **Innovation positioning (25%).** Proof-of-Reasoning — это действительно новая парадигма или судьям покажется что это "just logging to blockchain"? Как лучше позиционировать инновацию?

5. **Deployment Award.** У нас уже есть 5 верифицированных контрактов на Mainnet + frontend. Достаточно ли это для гарантированного Deployment Award или нужно что-то ещё?

### Технические вопросы

6. **Byreal integration depth.** У нас есть Perps CLI + execution engine. Достаточно ли это для Agentic Track, или нам нужно глубже интегрировать RealClaw (как платформу агента)?

7. **Nansen without credits.** Как показать Nansen integration если API ключ без кредитов? Варианты:
   - Использовать free tier (general_search)
   - Мок-данные + показать код
   - Получить новый ключ
   - Что-то ещё?

8. **ERC-8004 как стандарт.** Мы упоминаем ERC-8004 как стандарт, но это наш собственный design. Как это правильно преподнести судьям — как предложение к экосистеме или как внутреннюю архитектуру?

9. **Self-Evolution uniqueness.** On-chain prompt evolution — это наша killer feature. Как сделать это максимально демонстрабельным для видео? Как визуализировать?

10. **Multi-Agent Consensus verification.** Как доказать судьям что это НЕ просто "один API call переименованный в consensus"? Какие артефакты on-chain это подтверждают?

### Дизайн и UX вопросы

11. **UI/UX Award targeting.** Стоит ли инвестировать 3-5 дней в полировку UI для отдельной награды Best UI/UX ($3-5k)? Или лучше потратить на core features?

12. **Маскот.** Мы планируем анимированного маскота (реагирует на Fear/Greed Index и действия агента). Это усилит или ослабит серьёзность проекта для судей?

13. **Frontend scope.** Текущий frontend — dashboard с AI brain анимацией, reasoning panel, evolution timeline, partner bar. Что критично добавить за 5 дней?

### Маркетинг и Submission

14. **Video demo strategy.** Как структурировать видео для максимального впечатления? Что показать в первые 30 секунд? Сколько длиться оптимально?

15. **Community Voting.** Стоит ли тратить усилия на Twitter campaign для Community Voting ($3-5k) или сфокусироваться на judges?

16. **One-line pitch.** Как сформулировать pitch в одну строку для DoraHacks submission чтобы зацепить?

### Усиление проекта

17. **Что добавить за 7 дней чтобы из TOP-5 стать TOP-1?** Конкретные фичи/модули, которые дадут максимальный импакт при минимальных затратах времени.

18. **Как использовать все партнёров максимально?** У нас уже интеграция с 8 из ~10 партнёров хакатона. Есть ли способ добавить оставшихся (Animoca Brands?) или углубить текущие?

19. **Backtesting / P&L.** Нужно ли показывать реальные результаты торговли? Если да — как быстро это можно нагенерить? Или "сухие" on-chain records (60+ decisions) достаточны?

20. **Open source vs competitive advantage.** Репо сейчас приватный (USBVadik/TuringVault-Core). Для сабмита нужен public. Риски copy-paste конкурентами за оставшиеся дни?

---

## 7. КОНКУРЕНТНЫЕ ПРЕИМУЩЕСТВА (что уже есть)

1. **Максимальное покрытие партнёров** — 8 из ~10 партнёров хакатона интегрированы
2. **Mainnet deployment** — 5 контрактов на Mainnet (не testnet)
3. **On-chain activity** — 60+ реальных решений (не мок)
4. **Self-evolution** — 4 итерации (уникальная фича)
5. **103 теста** — серьёзная инженерия
6. **Dual-model architecture** — не "один GPT call"
7. **Hardware security** — Tencent KMS (не plaintext keys)
8. **Cross-track eligibility** — подходит под 4 из 6 треков

---

## 8. ЧТО ДЕЛАЮТ КОНКУРЕНТЫ (предположение)

Судя по 0 сабмитов и типичным хакатонам:
- **Простые торговые боты** — GPT wrapper + простой swap (много таких)
- **Аналитические дашборды** — красивый UI + Nansen/Dune данные
- **RWA tokenization MVPs** — basic ERC-20 + UI для покупки
- **Chat-with-wallet** — NL interface для Web3 операций
- **Portfolio trackers** — Basic wallet view + AI recommendations

**Наше отличие от них:** Мы единственные кто делает PROVABLE AI reasoning on-chain. Конкуренты в лучшем случае — "AI calls, result logged". Мы — "full reasoning chain, dual validation, self-evolution, cryptographic attestation".

---

## 9. ТАЙМЛАЙН ДО ДЕДЛАЙНА

- **Сейчас:** ~25 дней до 15 июня 2026
- **Приоритет 1 (дни 1-5):** Усиление ядра по рекомендациям аналитика
- **Приоритет 2 (дни 5-10):** Frontend polish + маскот
- **Приоритет 3 (дни 10-15):** Video demo + documentation
- **Приоритет 4 (дни 15-20):** Submission + marketing
- **Buffer:** 5 дней на непредвиденное

---

## 10. ЗАДАНИЕ ДЛЯ АНАЛИТИКА

На основе всей информации выше, пожалуйста:

1. **Оцени наши шансы** на каждый приз (Grand Champion, каждый трек, UI/UX, Deployment, Community) по шкале 1-10

2. **Определи оптимальную стратегию** — какие 2 трека выбрать, на что фокусироваться

3. **Предложи конкретные усиления** (ranked by impact/effort ratio) которые мы можем реализовать за 7-10 дней

4. **Оцени слабые места** и предложи как минимизировать каждое

5. **Предложи positioning** — как преподнести проект в one-liner, в описании, в видео

6. **Креативные идеи** — что может сделать проект незабываемым для судей (wow-factor)

7. **Risk mitigation** — что может пойти не так и как подстраховаться

8. **Дай рекомендации по видео** — структура, хронометраж, что показывать, tone of voice

9. **Оцени нужность маскота** — усилит или ослабит проект для данного хакатона

10. **Предложи вариации названия/бренда** если текущий TuringVault недостаточно запоминающийся

---

## ПРИЛОЖЕНИЕ A: Ключевые URLs

- Hackathon: https://dorahacks.io/hackathon/mantleturingtesthackathon2026
- Mantle Explorer: https://explorer.mantle.xyz
- Byreal Agent Skills: https://github.com/byreal-git/byreal-agent-skills
- Byreal Perps CLI: https://github.com/byreal-git/byreal-perps-cli  
- RealClaw: https://www.byreal.io/en/realclaw
- Mantle Docs: https://docs.mantle.xyz
- Nansen: https://nansen.ai
- Ondo/USDY: https://ondo.finance
- Merchant Moe: https://merchantmoe.com
- Z.ai: https://z.ai
- Our Repo: https://github.com/USBVadik/TuringVault-Core (private, will be public for submission)

## ПРИЛОЖЕНИЕ B: Mantle Network Specifics

- **Тип:** ZK Validity Rollup (не Optimistic)
- **TVL:** $4B+
- **Gas Token:** $MNT
- **Mainnet Chain ID:** 5000
- **Особенности:** Modular architecture, immediate finality, EVM compatible
- **Backed by:** Bybit (4th largest crypto exchange)
- **Ключевые активы:** mETH, fBTC, USDY (Ondo), USDe

## ПРИЛОЖЕНИЕ C: Полный перечень файлов проекта

```
contracts/
  TuringVaultIdentity.sol        — ERC-8004 Agent Identity NFT
  TuringVaultDecisionLog.sol     — Immutable decision records
  TuringVaultRouter.sol          — Strategy routing
  TuringVaultReputationRegistry.sol — PnL + reputation
  TuringVaultValidation.sol      — Pre-Action Checks
  interfaces/IMerchantMoeLBRouter.sol
  mocks/MockERC20.sol, MockLBRouter.sol

src/orchestrator/
  multiAgent.js           — Core dual-model engine
  multiAgentLoop.js       — Full decision cycle
  integratedOrchestrator.js — v2 VaR + intent queue
  unifiedMarketData.js    — 5-source aggregator
  aiEngine.js             — AI model wrapper
  validator.js            — Validation logic
  config.js, main.js, fullLoop.js

src/dex/merchantMoe.js    — DEX quotes
src/rwa/usdyModule.js     — USDY allocation
src/kms/tencentKMS.js     — KMS signing
src/evolution/promptEvolution.js — Self-evolution
src/execution/executionEngine.js — Byreal integration
src/mcp/nansenMCP.js      — Nansen Smart Money
src/ipfs/storage.js       — IPFS/Pinata

frontend/                 — Next.js 15 app
test/                     — 103 tests
```

---

*Документ подготовлен для Deep Research сессии. Все данные актуальны на 21 мая 2026.*
