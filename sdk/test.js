/**
 * SDK Smoke Test — verifies read operations against Mantle Mainnet
 * Run: node sdk/test.js
 */
const { TuringVaultSDK, DEFAULT_CONTRACTS } = require('./index');

async function main() {
  console.log('═══ TuringVault SDK Smoke Test ═══\n');
  
  const sdk = new TuringVaultSDK();
  let passed = 0;
  let failed = 0;
  
  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✅ ${name}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Test 1: Contract addresses
  console.log('1. Contract addresses');
  assert('validationRegistry', DEFAULT_CONTRACTS.validationRegistry === '0x6841d3DAF81A446C8Bd6934F7516f2Ee1b4d63b6');
  assert('decisionLog', DEFAULT_CONTRACTS.decisionLog === '0x7bCd905678ed5dB1e87852b933f1aEfE544cfbB5');
  assert('identity', DEFAULT_CONTRACTS.identity === '0x6f862802e0d5463DF18d267e422347BeCacc28bD');
  assert('reputation', DEFAULT_CONTRACTS.reputation === '0xC78119F3274B05046Ac7c38a14298a6cbD946e1a');

  // Test 2: getConsensusRate
  console.log('\n2. getConsensusRate()');
  try {
    const rate = await sdk.getConsensusRate();
    assert('returns object', typeof rate === 'object');
    assert('has approved', typeof rate.approved === 'number', `approved=${rate.approved}`);
    assert('has rejected', typeof rate.rejected === 'number', `rejected=${rate.rejected}`);
    assert('has total', typeof rate.total === 'number', `total=${rate.total}`);
    assert('total = approved + rejected', rate.total === rate.approved + rate.rejected);
    assert('total >= 20', rate.total >= 20, `total=${rate.total}`);
  } catch (e) {
    assert('getConsensusRate succeeds', false, e.message);
  }

  // Test 3: getTotalDecisions
  console.log('\n3. getTotalDecisions()');
  try {
    const total = await sdk.getTotalDecisions();
    assert('returns number', typeof total === 'number', `total=${total}`);
    assert('total >= 20', total >= 20);
  } catch (e) {
    assert('getTotalDecisions succeeds', false, e.message);
  }

  // Test 4: getRecentDecisions
  console.log('\n4. getRecentDecisions(5)');
  try {
    const decisions = await sdk.getRecentDecisions(5);
    assert('returns array', Array.isArray(decisions), `length=${decisions.length}`);
    assert('has 5 items', decisions.length === 5);
    if (decisions.length > 0) {
      const d = decisions[0];
      assert('has timestamp', typeof d.timestamp === 'number');
      assert('has action', typeof d.action === 'string', d.action);
      assert('has targetAsset', typeof d.targetAsset === 'string', d.targetAsset);
      assert('has reasoningHash', typeof d.reasoningHash === 'string');
    }
  } catch (e) {
    assert('getRecentDecisions succeeds', false, e.message);
  }

  // Test 5: getRecentProposals
  console.log('\n5. getRecentProposals(3)');
  try {
    const proposals = await sdk.getRecentProposals(3);
    assert('returns array', Array.isArray(proposals), `length=${proposals.length}`);
    if (proposals.length > 0) {
      const p = proposals[0];
      assert('has status field', ['Pending', 'Approved', 'Rejected', 'Expired'].includes(p.status), p.status);
      assert('has riskScore', typeof p.riskScore === 'number');
      assert('has validatorReasoning', typeof p.validatorReasoning === 'string');
    }
  } catch (e) {
    assert('getRecentProposals succeeds', false, e.message);
  }

  // Test 6: getAgentIdentity
  console.log('\n6. getAgentIdentity(0)');
  try {
    const agent = await sdk.getAgentIdentity(0);
    assert('returns data', agent !== null);
    if (agent && agent.name) {
      assert('has name', typeof agent.name === 'string', agent.name);
    } else if (agent && agent.cid) {
      assert('has IPFS cid', typeof agent.cid === 'string', agent.cid.slice(0, 20) + '...');
    }
  } catch (e) {
    assert('getAgentIdentity succeeds', false, e.message);
  }

  // Test 7: Write guard
  console.log('\n7. Write operation guards');
  try {
    await sdk.createValidatedDecision({ analyst: { action: 'swap', confidence: 0.8 }, validator: { riskScore: 30 } });
    assert('requires private key', false, 'should have thrown');
  } catch (e) {
    assert('requires private key', e.message.includes('Private key required'), e.message);
  }

  // Summary
  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
