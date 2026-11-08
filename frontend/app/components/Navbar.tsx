"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Zap, 
  Radio, 
  Moon, 
  Sun, 
  Activity, 
  Menu, 
  X
} from "lucide-react";

export default function Navbar() {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  const navLinks = [
    { label: "Overview", href: "#overview" },
    { label: "P2P Simulator", href: "#demo", isLive: true },
    { label: "Order Book", href: "#orderbook" },
    { label: "Forecasts", href: "#forecast" },
    { label: "Dashboard", href: "#dashboard" },
  ];

  return (
    <header className="sticky top-3 z-50 w-full px-3 sm:px-6 max-w-7xl mx-auto transition-all">
      <div className="bg-white/80 backdrop-blur-xl border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-2xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] border border-[#D8D8DE] flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
            <Zap className="w-4 h-4 text-[#3A7D5C] fill-[#3A7D5C]/15" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-[#1D1D1F]">
                Energy<span className="text-[#3A7D5C]">OS</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#F5F5F7] text-[#6E6E73] border border-[#D8D8DE]">
                P2P Microgrid
              </span>
            </div>
            <span className="text-[10px] text-[#6E6E73] font-mono tracking-wide block -mt-0.5">
              IEEE 2030.7 • Sepolia
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#F5F5F7] border border-[#D8D8DE] px-1.5 py-1 rounded-full">
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-3.5 py-1 rounded-full text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white transition-all flex items-center gap-1.5"
            >
              {item.isLive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#27845B]" />
              )}
              {item.label}
            </a>
          ))}
        </nav>

        {/* Action Controls & Live Status */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Live Grid Telemetry Capsule */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F5F7] border border-[#D8D8DE] text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#27845B] animate-pulse" />
            <span className="text-[#6E6E73]">Grid:</span>
            <span className="text-[#1D1D1F] font-semibold tabular-nums">50.02 Hz</span>
          </div>

          {/* Admin Operator Console Link */}
          <Link 
            href="/admin" 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] hover:bg-white border border-[#D8D8DE] transition-colors font-mono text-xs font-medium shadow-2xs"
          >
            <Radio className="w-3 h-3 text-[#3A7D5C]" />
            <span className="hidden sm:inline">Operator</span>
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[#F5F5F7] border border-[#D8D8DE] text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white transition cursor-pointer"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-[#D99A22]" /> : <Moon className="w-3.5 h-3.5 text-[#343438]" />}
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-[#F5F5F7] border border-[#D8D8DE] text-[#6E6E73] hover:text-[#1D1D1F]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-2 rounded-2xl border border-[#D8D8DE] bg-white/95 backdrop-blur-xl p-4 shadow-lg space-y-2">
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-medium text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[#3A7D5C] hover:bg-[#F5F5F7] transition"
          >
            <Radio className="w-4 h-4" />
            <span>Operator Console</span>
          </Link>
        </div>
      )}
    </header>
  );
}
