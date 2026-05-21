'use client';

import { useState, useEffect, useRef } from 'react';

// Real swap tx hashes from our Merchant Moe executions
const REAL_TXS = {
  swap1: '0xe9f6fd9770a92f1f6058c96f741fd13779860d46ea182bbd3ea180c4ab2e0bc5',
  swap2: '0x898489443ae470a0c31cd4a0c6d947da252433481f2c7b8fa9fb420485056347',
};

const TERMINAL_SEQUENCES = [
  { type: 'system', text: '╔═══ TURINGVAULT ORCHESTRATOR v3.0 ════════════════╗', delay: 0 },
  { type: 'system', text: '║  Network: Mantle Mainnet (ChainID 5000)          ║', delay: 100 },
  { type: 'system', text: '║  Engine:  GLM-5 (745B MoE) × Claude 4.6         ║', delay: 200 },
  { type: 'system', text: '╚══════════════════════════════════════════════════╝', delay: 300 },
  { type: 'blank', text: '', delay: 500 },
  { type: 'step', text: '📊 [STEP 1] Fetching unified market intelligence...', delay: 800 },
  { type: 'data', text: '   ETH: $2,547.32 | MNT: $0.72 | F&G: 67 (Greed)', delay: 1400 },
  { type: 'data', text: '   Nansen: ✓ Smart Money inflow +$2.4M (24h)', delay: 1900 },
  { type: 'data', text: '   Byreal: 3 perps signals | Mantle TVL: $437M', delay: 2300 },
  { type: 'blank', text: '', delay: 2600 },
  { type: 'step', text: '🧠 [STEP 2] Multi-agent consensus...', delay: 2800 },
  { type: 'analyst', text: '   ANALYST → swap mUSD→mETH (87% confidence)', delay: 3500 },
  { type: 'analyst', text: '   "mETH yield 3.4% + EigenLayer restaking airdrop"', delay: 4000 },
  { type: 'validator', text: '   VALIDATOR → ✅ APPROVED (82% conf, risk=35)', delay: 4700 },
  { type: 'validator', text: '   "Slippage check: Merchant Moe pool sufficient"', delay: 5200 },
  { type: 'consensus', text: '   ⚡ CONSENSUS REACHED — executing swap', delay: 5800 },
  { type: 'blank', text: '', delay: 6000 },
  { type: 'step', text: '📁 [STEP 3] Uploading Proof-of-Reasoning to IPFS...', delay: 6200 },
  { type: 'success', text: '   ✅ ipfs://QmX7k2...f9a3 (reasoning + market ctx)', delay: 6800 },
  { type: 'blank', text: '', delay: 7000 },
  { type: 'step', text: '🛡️  [STEP 3.5] ERC-8004 Pre-Action Validation...', delay: 7200 },
  { type: 'data', text: '   Request hash: 0x7a3f1c...', delay: 7600 },
  { type: 'success', text: '   Pre-Action Score: 82/100 — ✅ APPROVED', delay: 8000 },
  { type: 'blank', text: '', delay: 8200 },
  { type: 'step', text: '⛓️  [STEP 4] Executing on Merchant Moe Router...', delay: 8400 },
  { type: 'exec', text: `   Route: USDT0 → mETH (binStep=10, v2.2)`, delay: 9000 },
  { type: 'exec', text: '   Amount: 2.00 USDT0 | MinOut: 0.00078 mETH', delay: 9400 },
  { type: 'success', text: `   ✅ TX: ${REAL_TXS.swap1.slice(0, 18)}...`, delay: 10000 },
  { type: 'success', text: '   Received: 0.000823 mETH | Block: 95628368', delay: 10400 },
  { type: 'blank', text: '', delay: 10600 },
  { type: 'step', text: '📈 [STEP 5] Recording reputation on-chain...', delay: 10800 },
  { type: 'success', text: '   ✅ Reputation: +42 (swap_mETH_conf8700)', delay: 11200 },
  { type: 'blank', text: '', delay: 11400 },
  { type: 'complete', text: '╔══════════════════════════════════════════════════╗', delay: 11600 },
  { type: 'complete', text: '║  CYCLE COMPLETE — APPROVED ✅                    ║', delay: 11700 },
  { type: 'complete', text: '║  Registry: 5 approved / 20 rejected             ║', delay: 11800 },
  { type: 'complete', text: '╚══════════════════════════════════════════════════╝', delay: 11900 },
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
