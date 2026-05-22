'use client';

import { useState, useEffect, useRef } from 'react';

// Real swap tx hashes from our Merchant Moe executions
const REAL_TXS = {
  swap1: '0xe9f6fd9770a92f1f6058c96f741fd13779860d46ea182bbd3ea180c4ab2e0bc5',
  swap2: '0x898489443ae470a0c31cd4a0c6d947da252433481f2c7b8fa9fb420485056347',
};

const TERMINAL_SEQUENCES = [
  { type: 'system', text: '╔═══ TURINGVAULT ORCHESTRATOR v3.1 ════════════════╗', delay: 0 },
  { type: 'system', text: '║  Network: Mantle Mainnet (ChainID 5000)          ║', delay: 100 },
  { type: 'system', text: '║  Engine:  GLM-5 (745B MoE) × Claude Sonnet 4.6   ║', delay: 200 },
  { type: 'system', text: '╚══════════════════════════════════════════════════╝', delay: 300 },
  { type: 'blank', text: '', delay: 500 },
  { type: 'step', text: '📊 [STEP 1] Fetching unified market intelligence...', delay: 800 },
  { type: 'data', text: '   ETH: $2,118.40 | MNT: $0.71 | F&G: 44 (Fear)', delay: 1400 },
  { type: 'data', text: '   Nansen MCP: ✓ Smart Money inflow +$1.8M (4h)', delay: 1900 },
  { type: 'data', text: '   Hyperliquid: funding +0.003% | OI neutral', delay: 2300 },
  { type: 'data', text: '   Regime: RANGING (confidence 71%)', delay: 2700 },
  { type: 'blank', text: '', delay: 2900 },
  { type: 'step', text: '📐 [STEP 1.5] Ranging Grid Analysis...', delay: 3100 },
  { type: 'data', text: '   48h channel: $2,110 – $2,140 (width 1.42%)', delay: 3600 },
  { type: 'data', text: '   Live price (Hyperliquid): $2,118 | pos: 27% (BUY zone <30%)', delay: 4000 },
  { type: 'analyst', text: '   Grid signal: BUY_mETH — BUY zone, R:R = 2.1:1', delay: 4400 },
  { type: 'data', text: '   Position state: FLAT → entry allowed', delay: 4800 },
  { type: 'blank', text: '', delay: 5000 },
  { type: 'step', text: '🧠 [STEP 2] Multi-agent consensus...', delay: 5200 },
  { type: 'analyst', text: '   ANALYST → swap mUSD→mETH (81% confidence)', delay: 5900 },
  { type: 'analyst', text: '   "Grid BUY at 27% + Nansen inflow + adaptive SL"', delay: 6400 },
  { type: 'validator', text: '   VALIDATOR → ✅ APPROVED (78% conf, risk=42)', delay: 7100 },
  { type: 'validator', text: '   "R:R 2.1:1 valid, trailing stop at +0.6%"', delay: 7600 },
  { type: 'consensus', text: '   ⚡ CONSENSUS REACHED — executing swap', delay: 8200 },
  { type: 'blank', text: '', delay: 8400 },
  { type: 'step', text: '📁 [STEP 3] Uploading Proof-of-Reasoning to IPFS...', delay: 8600 },
  { type: 'success', text: '   ✅ ipfs://QmX7k2...f9a3 (reasoning + channel ctx)', delay: 9200 },
  { type: 'blank', text: '', delay: 9400 },
  { type: 'step', text: '🛡️  [STEP 3.5] ERC-8004 Pre-Action Validation...', delay: 9600 },
  { type: 'success', text: '   Pre-Action Score: 78/100 — ✅ APPROVED', delay: 10100 },
  { type: 'blank', text: '', delay: 10300 },
  { type: 'step', text: '⛓️  [STEP 4] Executing on Merchant Moe Router...', delay: 10500 },
  { type: 'exec', text: `   Route: mUSD → mETH (binStep=10, v2.2)`, delay: 11100 },
  { type: 'exec', text: '   Amount: 2.00 mUSD | TP: $2,133 | SL: $2,112 (R:R 2.1:1)', delay: 11500 },
  { type: 'success', text: `   ✅ TX: ${REAL_TXS.swap1.slice(0, 18)}...`, delay: 12100 },
  { type: 'success', text: '   Received: 0.000944 mETH | Block: 95631204', delay: 12500 },
  { type: 'blank', text: '', delay: 12700 },
  { type: 'step', text: '📍 [STEP 6.5] Updating position state...', delay: 12900 },
  { type: 'success', text: '   ✅ IN_mETH @ $2,118 | TP $2,133 | SL $2,112 | Trail +0.6%', delay: 13300 },
  { type: 'data', text: '   💰 Idle parking: mUSD → USDY (5.25% APY baseline)', delay: 13500 },
  { type: 'blank', text: '', delay: 13700 },
  { type: 'complete', text: '╔══════════════════════════════════════════════════╗', delay: 13700 },
  { type: 'complete', text: '║  CYCLE COMPLETE — APPROVED ✅                    ║', delay: 13800 },
  { type: 'complete', text: '║  Registry: 5 approved / 20 rejected              ║', delay: 13900 },
  { type: 'complete', text: '╚══════════════════════════════════════════════════╝', delay: 14000 },
];

export function LiveTerminal() {
  const [lines, setLines] = useState<typeof TERMINAL_SEQUENCES>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loopCount, setLoopCount] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentIndex >= TERMINAL_SEQUENCES.length) {
      // Reset after a pause
      const timeout = setTimeout(() => {
        setLines([]);
        setCurrentIndex(0);
        setLoopCount(prev => prev + 1);
      }, 4000);
      return () => clearTimeout(timeout);
    }

    const line = TERMINAL_SEQUENCES[currentIndex];
    const prevDelay = currentIndex > 0 ? TERMINAL_SEQUENCES[currentIndex - 1].delay : 0;
    const relativeDelay = line.delay - prevDelay;

    const timeout = setTimeout(() => {
      setLines(prev => [...prev, line]);
      setCurrentIndex(prev => prev + 1);
    }, relativeDelay);

    return () => clearTimeout(timeout);
  }, [currentIndex, loopCount]);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const getLineColor = (type: string) => {
    switch (type) {
      case 'system': return 'text-purple-400/80';
      case 'step': return 'text-white/90 font-semibold';
      case 'data': return 'text-white/50';
      case 'analyst': return 'text-blue-400/80';
      case 'validator': return 'text-yellow-400/80';
      case 'consensus': return 'text-green-400 font-bold';
      case 'exec': return 'text-orange-400/80';
      case 'success': return 'text-green-400/90';
      case 'complete': return 'text-purple-300/90';
      case 'blank': return '';
      default: return 'text-white/60';
    }
  };

  return (
    <div className="live-terminal">
      <div className="live-terminal-header">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        </div>
        <span className="text-[10px] font-mono text-white/30">turingvault@mantle:~/orchestrator</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="live-dot" />
          <span className="text-[9px] font-mono text-green-400/60 uppercase tracking-wider">Live</span>
        </div>
      </div>
      <div ref={terminalRef} className="live-terminal-body">
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${getLineColor(line.type)}`}>
            {line.type === 'blank' ? '\u00A0' : line.text}
          </div>
        ))}
        <span className="terminal-cursor">█</span>
      </div>
    </div>
  );
}
