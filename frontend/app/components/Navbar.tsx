"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  Shield,
  BarChart3,
  Swords,
  TrendingUp,
  Activity,
  MessageCircle,
  History,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/challenge", label: "Challenge", icon: Swords },
  { href: "/backtest", label: "Performance", icon: TrendingUp },
  { href: "/proof-explorer", label: "Proofs", icon: Shield },
  { href: "/replay", label: "Replay", icon: History },
  { href: "/discipline", label: "Discipline", icon: Activity },
  { href: "/social", label: "Social", icon: MessageCircle },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 overflow-x-hidden backdrop-blur-xl bg-[#07080b]/88 border-b border-white/[0.06]" style={{ zIndex: "var(--z-nav)" }}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="relative w-8 h-8">
            <div className="relative w-8 h-8 rounded-lg bg-[#0d1117] border border-cyan-400/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-300/80" />
            </div>
          </div>
          <span className="text-sm font-bold tracking-tight">
            TuringVault<span className="text-cyan-300/55">.ai</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden lg:flex items-center gap-1 min-w-0">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-cyan-400/10 text-cyan-100 border border-cyan-400/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Network Badge */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/80">
              Mantle Mainnet
            </span>
          </div>
        </div>

        <button
          type="button"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
          className="lg:hidden shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-white/70"
        >
          {isOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>
      {isOpen && (
        <div className="lg:hidden border-t border-white/[0.06] bg-[#07080b]/96 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                    isActive
                      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
                      : "border-white/[0.06] bg-white/[0.02] text-white/55"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
