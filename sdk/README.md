# TuringVault Agent Trust SDK

> Build Proof-of-Reasoning enabled AI agents on Mantle in minutes.

## Install

```bash
npm install @turingvault/sdk
# or copy sdk/ folder directly
```

## Quick Start

```javascript
const { TuringVaultSDK } = require('@turingvault/sdk');

const sdk = new TuringVaultSDK({
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://rpc.mantle.xyz',
  pinataJwt: process.env.PINATA_JWT, // optional: for IPFS proof storage
});

// Record a verifiable AI decision on-chain
const proof = await sdk.createPoRDecision({
  analyst: {
    model: 'gpt-4',
    action: 'swap',
    confidence: 0.85,
    reasoning: 'ETH oversold on 4h RSI, volume spike on Mantle DEXs',
  },
  validator: {
    model: 'claude-sonnet-4',
    riskScore: 35,
    approved: true,
    reasoning: 'Risk within acceptable bounds, market conditions stable',
  },
  targetAsset: 'WETH',
  tag: 'trade',
});

console.log(proof);
// {
//   decisionId: 21,
//   txHash: '0xabc...',
//   ipfsCid: 'QmXyz...',
//   approved: true,
//   gasUsed: '145000',
//   proofDocument: { ... full reasoning ... }
// }
```

## Read-Only (No Private Key Required)

```javascript
const sdk = new TuringVaultSDK(); // defaults to Mantle mainnet

// Get recent decisions
const decisions = await sdk.getRecentDecisions(10);
console.log(decisions);
// [{ timestamp, action, targetAsset, confidence, reasoningHash }]

// Get total count
const total = await sdk.getTotalDecisions();
console.log(`${total} decisions recorded on-chain`);
```

## How It Works

1. **Your AI agent** makes a decision (any model: GPT-4, Claude, Llama, etc.)
2. **Your validator** independently reviews the proposal (can be same or different model)
3. **SDK records** both outputs on Mantle via TuringVault DecisionLog contract
4. **IPFS proof** contains full reasoning context for auditability
5. **Anyone can verify** — decisions are public, immutable, and linked to your agent's ERC-8004 identity

## Architecture

```
Your AI Agent → createPoRDecision() → [IPFS Upload] → [On-Chain Record]
                                            ↓                ↓
                                    Full reasoning      DecisionLog contract
                                    document            on Mantle (5000)
```

## Configuration

```javascript
const sdk = new TuringVaultSDK({
  // Required for write operations
  privateKey: '0x...',
  
  // Network (default: Mantle Mainnet)
  rpcUrl: 'https://rpc.mantle.xyz',
  
  // IPFS (optional — falls back to hash)
  pinataJwt: 'eyJ...',
  
  // Custom contract addresses (optional)
  contracts: {
    decisionLog: '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5',
    validation: '0x0aeEd88959fCFC665284225dB93DED3e8A3Ff705',
    identity: '0x6f862802e0d5463DF18d267e422347BeCacc28bD',
    reputation: '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a',
  },
});
```

## Contracts (Mantle Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| DecisionLog | `0x7bCd...fbB5` | Immutable decision history |
| Validation | `0x0aeE...e1a` | Pre-action consensus checks |
| Identity | `0x6f86...8bD` | ERC-8004 agent registration |
| Reputation | `0xC781...e1a` | Performance tracking |

## License

MIT — Built for Mantle Turing Test Hackathon 2026
