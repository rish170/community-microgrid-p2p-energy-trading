"use client";

import React from "react";
import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[#D8D8DE] bg-[#F5F5F7] py-12 px-4 sm:px-6 lg:px-8 text-[#6E6E73]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#3A7D5C]/10 text-[#3A7D5C] flex items-center justify-center border border-[#3A7D5C]/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[#1D1D1F] block">
              EnergyOS • Community Microgrid P2P Energy Trading
            </span>
            <span className="text-xs text-[#6E6E73] block font-mono">
              Blockchain-Enabled Peer-to-Peer Trading &amp; Load Balancing with ML Forecasting
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono flex-wrap">
          <div className="flex items-center gap-1.5 text-[#1D1D1F]">
            <span className="w-2 h-2 rounded-full bg-[#27845B] animate-pulse" />
            <span>Ethereum Sepolia Testnet</span>
          </div>
          <span className="text-[#D8D8DE]">|</span>
          <span className="text-[#6E6E73]">Next.js 16 • Tailwind CSS • R3F • Ethers.js</span>
          <span className="text-[#D8D8DE]">|</span>
          <span className="text-[#5277D5]">IEEE 2030.7</span>
        </div>

      </div>
    </footer>
  );
}
