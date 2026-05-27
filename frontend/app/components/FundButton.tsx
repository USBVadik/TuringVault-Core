"use client";

import { useState } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { Wallet, CheckCircle2, Loader2, ArrowUpRight } from "lucide-react";

// Agent treasury — the router contract that executes swaps
const AGENT_TREASURY =
  "0x8187B23553B2a7DeD5C1C2854Ae66D24b5607001" as `0x${string}`;
const DEPOSIT_AMOUNT = "0.01"; // MNT for demo

export function FundButton() {
  const { isConnected } = useAccount();
  const [funded, setFunded] = useState(false);

  const { data: treasuryBalance } = useBalance({
    address: AGENT_TREASURY,
  });

  const {
    sendTransaction,
    data: txHash,
    isPending: isSending,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Show success state after confirmation
  if (isConfirmed && !funded) {
    setTimeout(() => setFunded(true), 500);
  }

  const handleFund = () => {
    sendTransaction({
      to: AGENT_TREASURY,
      value: parseEther(DEPOSIT_AMOUNT),
    });
  };

  if (funded) {
    return (
      <div className="fund-result">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="text-sm font-bold text-green-400">Agent Funded</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">
              Deposited
            </span>
            <span className="text-lg font-mono font-bold text-yellow-400">
              {DEPOSIT_AMOUNT} MNT
            </span>
          </div>
          <div className="verify-stat">
            <span className="text-[10px] text-white/30 uppercase">
              Treasury
            </span>
            <span className="text-lg font-mono font-bold text-white/80">
              {treasuryBalance
                ? Number(formatEther(treasuryBalance.value)).toFixed(3)
                : "—"}{" "}
              MNT
            </span>
          </div>
        </div>
        {txHash && (
          <a
            href={`https://explorer.mantle.xyz/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] text-purple-400/60 hover:text-purple-400 mt-3 font-mono transition-colors"
          >
            View TX <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
        <button
          onClick={() => setFunded(false)}
          className="text-[10px] text-purple-400/50 hover:text-purple-400 mt-2 block"
        >
          ↺ Fund again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Treasury balance */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
        <span className="text-[10px] text-white/30 uppercase">
          Agent Treasury
        </span>
        <span className="text-sm font-mono font-semibold text-white/70">
          {treasuryBalance
            ? Number(formatEther(treasuryBalance.value)).toFixed(4)
            : "—"}{" "}
          MNT
        </span>
      </div>

      {/* Fund button */}
      <button
        onClick={handleFund}
        disabled={!isConnected || isSending || isConfirming}
        className="verify-btn group w-full"
      >
        {isSending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Confirm in wallet...</span>
          </>
        ) : isConfirming ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Confirming on Mantle...</span>
          </>
        ) : !isConnected ? (
          <>
            <Wallet className="w-4 h-4" />
            <span className="text-white/40">Connect wallet first</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4 group-hover:text-yellow-400 transition-colors" />
            <span>Deposit {DEPOSIT_AMOUNT} MNT</span>
            <span className="text-[9px] text-white/20 ml-2">
              native transfer
            </span>
          </>
        )}
      </button>
    </div>
  );
}
