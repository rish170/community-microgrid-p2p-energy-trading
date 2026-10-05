"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, Wallet, Shield, Moon, Sun, Layers, Radio, ShieldAlert } from "lucide-react";

export default function Navbar() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (document.documentElement.classList.contains("light")) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
            <Zap className="w-6 h-6 text-black fill-black" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
              MICROGRID <span className="text-emerald-400 font-normal">P2P</span>
            </span>
            <span className="text-[10px] tracking-widest text-zinc-400 uppercase font-mono block -mt-1">
              Decentralized Energy Protocol
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-300">
          <a href="#overview" className="hover:text-emerald-400 transition-colors">Overview</a>
          <a href="#demo" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            P2P Simulator
          </a>
          <a href="#orderbook" className="hover:text-emerald-400 transition-colors">Order Book</a>
          <a href="#forecast" className="hover:text-emerald-400 transition-colors">Forecasts</a>
          <a href="#dashboard" className="hover:text-emerald-400 transition-colors">Dashboard</a>
          
          {/* Admin Control Link */}
          <Link 
            href="/admin" 
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors font-bold text-xs"
          >
            <Radio className="w-3 h-3 animate-pulse" />
            Admin Panel
          </Link>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-400" />}
          </button>
        </div>

      </div>
    </header>
  );
}
