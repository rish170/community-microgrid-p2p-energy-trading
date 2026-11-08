"use client";

import React from "react";
import { 
  SunMedium, 
  ArrowLeftRight, 
  ShieldCheck, 
  Cpu, 
  BarChart3, 
  Layers,
  Database,
  Activity,
  Code2
} from "lucide-react";

export default function ProjectExplanation() {
  const features = [
    {
      icon: <SunMedium className="w-5 h-5 text-[#FBBF24]" />,
      title: "Solar Prosumer Generation",
      description: "Households equipped with rooftop solar PV arrays generate green energy, powering local appliances while detecting real-time excess capacity for grid export."
    },
    {
      icon: <ArrowLeftRight className="w-5 h-5 text-[#34D399]" />,
      title: "Direct Peer-to-Peer Trading",
      description: "Eliminates centralized utility middlemen. Consumers facing grid outages or high demand can buy energy directly from nearby neighbors at competitive local rates."
    },
    {
      icon: <Cpu className="w-5 h-5 text-[#38BDF8]" />,
      title: "ERC-20 Tokenized Energy (ENG)",
      description: "Every unit of energy (1 unit = 1 kWh) generated is represented on Ethereum/Sepolia by 1 EnergyToken (ENG), enabling verifiable, cryptographic unit-level accounting."
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#38BDF8]" />,
      title: "Autonomous Escrow & Settlement",
      description: "The Trading.sol smart contract locks payment in escrow, validates available prosumer token balance, and atomically settles upon physical meter confirmation."
    },
    {
      icon: <Database className="w-5 h-5 text-[#A78BFA]" />,
      title: "Supabase Realtime Mirroring",
      description: "On-chain trade logs and household microgrid telemetry are mirrored to Supabase in real-time, feeding live analytics, Power BI dashboards, and ML forecasts."
    },
    {
      icon: <Activity className="w-5 h-5 text-[#FB7185]" />,
      title: "Automated Load Balancing",
      description: "Dynamic pricing algorithms adjust rates per node distance and load deficit, incentivizing local resilience during peak stress or storm outages."
    }
  ];

  return (
    <section id="overview" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
      
      {/* Section Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20 mb-3.5">
          <Layers className="w-3.5 h-3.5 text-[#3A7D5C]" />
          <span>System Architecture &amp; Methodology</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
          How Community Microgrid P2P Trading Works
        </h2>
        <p className="text-[#6E6E73] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          An integrated energy ecosystem combining rooftop solar PV generation, Ethereum smart contracts, IoT smart meters, and dynamic market clearing.
        </p>
      </div>

      {/* 6 Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div 
            key={i}
            className="p-6 rounded-3xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:border-[#B0B0B8] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center mb-4 border border-[#E5E5EA]">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-[#1D1D1F] mb-2">{f.title}</h3>
              <p className="text-[#6E6E73] text-xs sm:text-sm leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Architecture Flow Diagram Box */}
      <div id="architecture" className="mt-12 p-7 sm:p-8 rounded-3xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div>
          <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#27845B]" />
            <span>End-to-End System Integration Flow</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <span className="text-[10px] font-mono font-semibold text-[#D99A22] uppercase tracking-wider block mb-1">01. GENERATION</span>
              <h4 className="font-semibold text-[#1D1D1F] text-sm mb-1">IoT Smart Meter</h4>
              <p className="text-xs text-[#6E6E73] leading-relaxed">Reads solar generation (100 units) vs household load (70 units), detecting 30 units surplus.</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <span className="text-[10px] font-mono font-semibold text-[#5277D5] uppercase tracking-wider block mb-1">02. ON-CHAIN MINT</span>
              <h4 className="font-semibold text-[#1D1D1F] text-sm mb-1">EnergyToken.sol</h4>
              <p className="text-xs text-[#6E6E73] leading-relaxed">Owner contract mints 30 ENG tokens representing surplus units onto the Sepolia testnet.</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <span className="text-[10px] font-mono font-semibold text-[#27845B] uppercase tracking-wider block mb-1">03. ESCROW MATCHING</span>
              <h4 className="font-semibold text-[#1D1D1F] text-sm mb-1">Trading.sol</h4>
              <p className="text-xs text-[#6E6E73] leading-relaxed">Consumer in outage buys 15 units @ 1.5 ETH. Smart contract safely locks funds &amp; swaps tokens.</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <span className="text-[10px] font-mono font-semibold text-[#8271B8] uppercase tracking-wider block mb-1">04. MIRROR &amp; DISPATCH</span>
              <h4 className="font-semibold text-[#1D1D1F] text-sm mb-1">Supabase &amp; Power BI</h4>
              <p className="text-xs text-[#6E6E73] leading-relaxed">Express listener captures `TradeExecuted` events, syncing database rows &amp; live dashboards.</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
