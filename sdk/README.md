# TuringVault Decision Provenance SDK

Infrastructure SDK for building **Proof-of-Reasoning** enabled AI agents on Mantle.

## Install

```bash
npm install @turingvault/sdk
# or use directly from the monorepo
const { TuringVaultSDK } = require('../sdk');
```

## Quick Start

### Full Proof-of-Reasoning Flow (Write)

```javascript
const { TuringVaultSDK } = require('@turingvault/sdk');

const sdk = new TuringVaultSDK({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://rpc.mantle.xyz',
  pinataJwt: process.env.PINATA_JWT, // optional: enables IPFS pinning
});

// Complete flow: submit → validate → record → pin
const result = await sdk.createValidatedDecision({
  analyst: {
    model: 'glm-5',
    action: 'swap',
    confidence: 0.85,
    reasoning: 'ETH oversold relative to 50-day MA, fear index at 22',
  },
  validator: {
    model: 'claude-4.6',
    riskScore: 35,       // 0-100
    approved: true,
    reasoning: 'Risk within tolerance, position size appropriate',
  },
  targetAsset: 'WETH',
  amountIn: 0,
});

console.log(result);
// {
//   proposalId: 20,
//   decisionId: 20,
//   txHash: '0x...',
//   proposalTxHash: '0x...',
//   validationTxHash: '0x...',
//   ipfsCid: 'Qm...',
//   approved: true,
//   gasUsed: '450000',
// }
```

### Read-Only (No Key Required)

```javascript
const sdk = new TuringVaultSDK(); // defaults to Mantle Mainnet

// Consensus rate from ValidationRegistry
const stats = await sdk.getConsensusRate();
// { approved: 1, rejected: 19, total: 20 }

// Recent proposals with full validation details
const proposals = await sdk.getRecentProposals(5);
// [{ action, targetAsset, confidence, riskScore, status: 'Approved'|'Rejected', ... }]

// Decision history
const decisions = await sdk.getRecentDecisions(10);
// [{ timestamp, action, targetAsset, confidence, reasoningHash, ... }]

// Total decisions count
const total = await sdk.getTotalDecisions(); // 20

// Agent identity (ERC-8004 + IPFS metadata)
const agent = await sdk.getAgentIdentity(0);
// { name, description, stats, models, capabilities, ... }
```

## Contracts (Mantle Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| ValidationRegistry | `0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6` | Adversarial consensus: submit → validate → approve/reject |
| DecisionLog | `0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5` | Immutable decision history with reasoning hashes |
| Identity | `0x6f862802e0d5463DF18d267e422347BeCacc28bD` | ERC-8004 agent identity as evolving NFT |
| Reputation | `0xC78119F3274B05046Ac7c38a14298a6cbD946e1a` | Performance tracking: score, success rate |

## SDK Methods

### Write (requires `privateKey`)
- `createValidatedDecision(params)` — Full PoR flow: propose → validate → log → pin
- `logDecision(params)` — Simple: record a pre-validated decision

### Read (no key needed)
- `getConsensusRate()` — Approved/rejected/total from ValidationRegistry
- `getRecentProposals(count)` — Full proposal data with validation results
- `getRecentDecisions(count)` — Decision history from DecisionLog
- `getTotalDecisions()` — Total decision count
- `getAgentIdentity(agentId)` — ERC-8004 metadata from IPFS

## Custom Configuration

```javascript
const sdk = new TuringVaultSDK({
  rpcUrl: 'https://your-rpc.example.com',
  contracts: {
    validationRegistry: '0x...', // override addresses
    decisionLog: '0x...',
  },
});
```

## License

MIT
