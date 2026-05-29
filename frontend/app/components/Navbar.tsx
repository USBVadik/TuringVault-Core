"use client";

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

  return (
    <nav className="fixed top-0 left-0 right-0 backdrop-blur-xl bg-[#030308]/80 border-b border-white/[0.06]" style={{ zIndex: "var(--z-nav)" }}>
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500 to-green-500 opacity-40 blur-md group-hover:opacity-60 transition-opacity" />
            <div className="relative w-8 h-8 rounded-lg bg-[#0a0a14] border border-purple-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <span className="text-sm font-bold tracking-tight">
            TuringVault<span className="text-purple-400/50">.ai</span>
          </span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/80">
              Mantle Mainnet
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
