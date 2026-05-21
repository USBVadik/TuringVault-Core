const { runMultiAgentCycle } = require('./multiAgentLoop');

async function runBatch(count) {
  let approved = 0, failed = 0;
  for (let i = 1; i <= count; i++) {
    console.log('\n█ RUN ' + i + '/' + count);
    try {
      const result = await runMultiAgentCycle();
      if (result.consensus) approved++;
      console.log('>>> Cycle ' + i + ': consensus=' + result.consensus + ' (approved: ' + approved + ')');
    } catch (err) {
      failed++;
      console.error('>>> Cycle ' + i + ' FAILED:', err.message?.slice(0, 150));
    }
    if (i < count) await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\n=== BATCH: ' + approved + ' approved, ' + failed + ' failed/' + count + ' ===');
}

runBatch(5);
