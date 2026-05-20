import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API endpoint: /api/reasoning
 * Returns latest AI reasoning cycle data for Glass Mode visualization
 */
export async function GET() {
  try {
    // Read latest loop output
    const loopLogPath = path.resolve(process.cwd(), '../data/loop_output.log');
    const evolutionLogPath = path.resolve(process.cwd(), '../src/data/evolution_log.json');
    const intentQueuePath = path.resolve(process.cwd(), '../data/intent_queue.json');
    const progressPath = path.resolve(process.cwd(), '../data/loop_progress.json');

    let latestCycle = null;
    let evolution = null;
    let intents = [];
    let progress = null;

    // Parse loop progress
    if (fs.existsSync(progressPath)) {
      progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    }

    // Parse evolution log
    if (fs.existsSync(evolutionLogPath)) {
      evolution = JSON.parse(fs.readFileSync(evolutionLogPath, 'utf8'));
    }

    // Parse intent queue
    if (fs.existsSync(intentQueuePath)) {
      intents = JSON.parse(fs.readFileSync(intentQueuePath, 'utf8'));
    }

    // Parse last cycle from loop output
    if (fs.existsSync(loopLogPath)) {
      const log = fs.readFileSync(loopLogPath, 'utf8');
      const cycles = log.split('━━━ CYCLE');
      const lastCycleText = cycles[cycles.length - 1] || '';
      
      // Extract structured data from last cycle
      latestCycle = parseCycleOutput(lastCycleText);
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      latestCycle,
      evolution: evolution ? {
        totalEvolutions: evolution.evolutions?.length || 0,
        latest: evolution.evolutions?.[evolution.evolutions.length - 1] || null,
      } : null,
      progress,
      intentQueue: intents.slice(-5), // last 5 intents
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseCycleOutput(text: string) {
  // Extract key metrics from cycle output text
  const ethMatch = text.match(/ETH:\s*\$([0-9,.]+)\s*\(([+-]?[0-9.]+)%\)/);
  const sentimentMatch = text.match(/Sentiment:\s*(\w+)\s*\(F&G:\s*(\d+)\)/);
  const dexMatch = text.match(/DEX:\s*1 MNT = \$([0-9.]+) USDT/);
  const analystMatch = text.match(/ANALYST:\s*(\w+)\s+(\w+)\s*\((\d+)%\)/);
  const validatorMatch = text.match(/VALIDATOR:\s*(✅|❌)\s*\((\d+)% conf, risk=(\d+)\)/);
  const consensusMatch = text.match(/Consensus:\s*(APPROVED|REJECTED)\s*(✅|❌)/);
  const varMatch = text.match(/VaR:\s*(\d+)\s*bps/);
  const autonomyMatch = text.match(/Autonomy:\s*(\w+)/);
  const rwaMatch = text.match(/RWA:\s*(\w+)\s*Target:\s*(\d+)%/);
  const proposalMatch = text.match(/Proposal #(\d+)/);

  return {
    market: {
      ethPrice: ethMatch ? parseFloat(ethMatch[1].replace(',', '')) : null,
      ethChange: ethMatch ? parseFloat(ethMatch[2]) : null,
      sentiment: sentimentMatch?.[1] || null,
      fearGreed: sentimentMatch ? parseInt(sentimentMatch[2]) : null,
      mntPrice: dexMatch ? parseFloat(dexMatch[1]) : null,
    },
    analyst: {
      action: analystMatch?.[1] || null,
      target: analystMatch?.[2] || null,
      confidence: analystMatch ? parseInt(analystMatch[3]) : null,
    },
    validator: {
      approved: validatorMatch?.[1] === '✅',
      confidence: validatorMatch ? parseInt(validatorMatch[2]) : null,
      riskScore: validatorMatch ? parseInt(validatorMatch[3]) : null,
    },
    consensus: {
      result: consensusMatch?.[1] || null,
      approved: consensusMatch?.[2] === '✅',
    },
    risk: {
      var_bps: varMatch ? parseInt(varMatch[1]) : null,
      autonomy: autonomyMatch?.[1] || null,
    },
    rwa: {
      signal: rwaMatch?.[1] || null,
      targetPct: rwaMatch ? parseInt(rwaMatch[2]) : null,
    },
    proposalId: proposalMatch ? parseInt(proposalMatch[1]) : null,
  };
}
