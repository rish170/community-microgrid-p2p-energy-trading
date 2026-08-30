"use client";

import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 text-zinc-400">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Community Microgrid P2P Energy Trading</span>
            <span className="text-xs text-zinc-500 block">Weeks 1–8 Foundation, Smart Contracts & Live UI</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Hardhat Local / Sepolia Testnet</span>
          </div>
          <div className="text-zinc-600">|</div>
          <div>Next.js 16 • Tailwind CSS • R3F • Ethers.js</div>
        </div>

      </div>
    </footer>
  );
}
