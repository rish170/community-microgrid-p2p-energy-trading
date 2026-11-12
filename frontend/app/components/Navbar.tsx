"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  Zap, 
  Settings, 
  RotateCcw,
  Menu, 
  X,
  Radio
} from "lucide-react";
import { useMicrogridData } from "../hooks/useMicrogridData";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const {
    autoAcceptEnabled,
    toggleAutoAcceptAction,
    isSocietyOutage,
    triggerSocietyOutage,
    restoreSocietyGrid,
    resetMicrogridAction,
  } = useMicrogridData();

  // Close settings popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [settingsOpen]);

  const navLinks = [
    { label: "Overview", href: "/#overview" },
    { label: "Order Book", href: "/dashboard#orderbook" },
    { label: "Forecasts", href: "/#forecast" },
    { label: "Dashboard", href: "/dashboard#dashboard" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 border-b border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.03)] backdrop-blur-md">
      <div className="w-full px-6 sm:px-10 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name (Moved to left, tags removed) */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/25 flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs">
            <Zap className="w-5 h-5 text-[#16A34A] fill-[#16A34A]/20" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#000000]">
            Energy<span className="text-[#16A34A]">OS</span>
          </span>
        </Link>

        {/* Right Section: All Navigation Links + Settings Button (Pushed to the right) */}
        <div className="flex items-center gap-7 lg:gap-8">
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-8">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[15px] font-semibold text-[#000000] hover:text-[#16A34A] transition-colors flex items-center gap-2"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Settings Icon Button (with animated controls popover) */}
          <div className="relative flex items-center" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#1E293B] hover:text-[#000000] transition-all cursor-pointer shadow-xs active:scale-95"
              title="Microgrid Controls & Settings"
              aria-label="Microgrid Controls & Settings"
            >
              <Settings className={`w-5 h-5 transition-transform duration-300 ${settingsOpen ? "rotate-90 text-[#16A34A]" : ""}`} />
            </button>

            {/* Settings Window / Popover */}
            {settingsOpen && (
              <div className="absolute right-0 top-14 w-84 bg-white/98 backdrop-blur-xl border border-[#CBD5E1] rounded-2xl p-5 shadow-[0_20px_45px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-200 font-sans z-50">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#000000]">Microgrid Settings</h3>
                    <p className="text-[11px] text-[#64748B]">Live controls & simulation parameters</p>
                  </div>
                  <button 
                    onClick={() => setSettingsOpen(false)}
                    className="p-1 rounded-lg text-[#64748B] hover:text-[#000000] hover:bg-[#F1F5F9] transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3.5">
                  {/* 1. Prosumer Auto-Accept Toggle Switch */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-semibold text-[#000000]">Auto-Accept Requests</div>
                      <div className="text-[11px] text-[#64748B]">Simulates 2s network latency</div>
                    </div>
                    <button
                      onClick={() => toggleAutoAcceptAction()}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        autoAcceptEnabled ? "bg-[#16A34A]" : "bg-[#CBD5E1]"
                      }`}
                      aria-label="Toggle Auto-Accept"
                    >
                      <span 
                        className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          autoAcceptEnabled ? "translate-x-5" : "translate-x-0.5"
                        }`} 
                      />
                    </button>
                  </div>

                  {/* 2. Simulate Outage Toggle Switch */}
                  <div className="flex items-center justify-between py-1">
                    <div>
                      <div className="text-xs font-semibold text-[#000000]">Simulate Outage</div>
                      <div className="text-[11px] text-[#64748B]">
                        {isSocietyOutage ? "Grid disconnected (Islanded)" : "Nominal grid connection"}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (isSocietyOutage) {
                          restoreSocietyGrid();
                        } else {
                          triggerSocietyOutage();
                        }
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isSocietyOutage ? "bg-[#DC2626]" : "bg-[#CBD5E1]"
                      }`}
                      aria-label="Toggle Outage Simulation"
                    >
                      <span 
                        className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          isSocietyOutage ? "translate-x-5" : "translate-x-0.5"
                        }`} 
                      />
                    </button>
                  </div>

                  {/* 3. Reset Grid Button */}
                  <div className="pt-2 border-t border-[#E2E8F0]">
                    <button
                      onClick={() => {
                        resetMicrogridAction();
                        setSettingsOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#000000] font-semibold text-xs transition cursor-pointer active:scale-98 shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#0284C7]" />
                      <span>Reset Grid to Baseline</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#000000] hover:bg-[#F1F5F9]"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-white/98 backdrop-blur-xl p-4 shadow-lg space-y-2">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-semibold text-[#000000] hover:text-[#16A34A] hover:bg-[#F8FAFC] transition"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-[#16A34A] hover:bg-[#F8FAFC] transition"
          >
            <Radio className="w-4 h-4" />
            <span>Operator SCADA Console</span>
          </Link>
        </div>
      )}
    </header>
  );
}