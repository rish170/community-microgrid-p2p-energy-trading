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
      icon: <SunMedium className="w-6 h-6 text-amber-400" />,
      title: "Solar Prosumer Generation",
      description: "Households equipped with rooftop solar PV arrays generate green energy, powering local appliances while detecting real-time excess capacity for grid export."
    },
    {
      icon: <ArrowLeftRight className="w-6 h-6 text-emerald-400" />,
      title: "Direct Peer-to-Peer Trading",
      description: "Eliminates centralized utility middlemen. Consumers facing grid outages or high demand can buy energy directly from nearby neighbors at competitive local rates."
    },
    {
      icon: <Cpu className="w-6 h-6 text-sky-400" />,
      title: "ERC-20 Tokenized Energy (ENG)",
      description: "Every kilowatt-hour (kWh) generated is represented on Ethereum/Sepolia by 1 EnergyToken (ENG), enabling verifiable, cryptographic unit-level accounting."
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-teal-400" />,
      title: "Autonomous Escrow & Settlement",
      description: "The Trading.sol smart contract locks payment in escrow, validates available prosumer token balance, and atomically settles upon physical meter confirmation."
    },
    {
      icon: <Database className="w-6 h-6 text-indigo-400" />,
      title: "Supabase Realtime Mirroring",
      description: "On-chain trade logs and household microgrid telemetry are mirrored to Supabase in real-time, feeding live analytics, Power BI dashboards, and ML forecasts."
    },
    {
      icon: <Activity className="w-6 h-6 text-purple-400" />,
      title: "Automated Load Balancing",
      description: "Dynamic pricing algorithms adjust rates per node distance and load deficit, incentivizing local resilience during peak stress or storm outages."
    }
  ];

  return (
    <section id="overview" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-800/80">
      
      {/* Section Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4">
          <Layers className="w-3.5 h-3.5" /> Project Architecture
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
          How Community Microgrid P2P Trading Works
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          A zero-trust, resilient energy infrastructure combining distributed solar microgrids, 
          Ethereum smart contracts, and real-time telemetry.
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((f, i) => (
          <div 
            key={i}
            className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-900/90 transition-all duration-300 group hover:-translate-y-1"
          >
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 w-fit mb-4 group-hover:scale-110 transition-transform">
              {f.icon}
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
              {f.title}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {f.description}
            </p>
          </div>
        ))}
      </div>

      {/* Architecture Flow Diagram Box */}
      <div id="architecture" className="mt-16 p-8 rounded-3xl bg-zinc-950/80 border border-zinc-800 relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-emerald-400" /> End-to-End System Integration Flow
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-xs font-mono text-emerald-400 block mb-1">01. GENERATION</span>
              <h4 className="font-bold text-white text-sm mb-1">IoT Smart Meter</h4>
              <p className="text-xs text-zinc-400">Reads solar generation (100 kWh) vs household load (70 kWh), detecting 30 kWh surplus.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-xs font-mono text-sky-400 block mb-1">02. ON-CHAIN MINT</span>
              <h4 className="font-bold text-white text-sm mb-1">EnergyToken.sol</h4>
              <p className="text-xs text-zinc-400">Owner contract mints 30 ENG tokens representing surplus kWh onto the Sepolia testnet.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-xs font-mono text-amber-400 block mb-1">03. ESCROW MATCHING</span>
              <h4 className="font-bold text-white text-sm mb-1">Trading.sol</h4>
              <p className="text-xs text-zinc-400">Consumer in outage buys 15 kWh @ 1.5 ETH. Smart contract safely locks funds & swaps tokens.</p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <span className="text-xs font-mono text-teal-400 block mb-1">04. MIRROR & DISPATCH</span>
              <h4 className="font-bold text-white text-sm mb-1">Supabase & Power BI</h4>
              <p className="text-xs text-zinc-400">Express listener captures `TradeExecuted` events, syncing database rows & live dashboards.</p>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
