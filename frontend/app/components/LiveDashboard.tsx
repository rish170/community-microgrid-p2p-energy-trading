"use client";

import React, { useState } from "react";
import { 
  BarChart3, 
  Activity, 
  TrendingUp, 
  Database, 
  ShieldAlert, 
  RefreshCw, 
  Check, 
  Layers,
  FileCode,
  Flame,
  BatteryCharging
} from "lucide-react";

export default function LiveDashboard() {
  const [activeTab, setActiveTab] = useState<"feed" | "contracts" | "supabase">("feed");

  // Simulated live trade transactions
  const liveTrades = [
    {
      id: "TRD-8942",
      seller: "0x3C44...93BC (Node Alpha)",
      buyer: "0x71C7...976F (Node Beta)",
      units: "15.0 kWh",
      totalPrice: "22.50 ETH",
      rate: "1.50 ETH/kWh",
      time: "Just now",
      status: "Settled"
    },
    {
      id: "TRD-8941",
      seller: "0x92A1...33F1 (Node Gamma)",
      buyer: "0x44B8...121E (Node Delta)",
      units: "8.5 kWh",
      totalPrice: "8.50 ETH",
      rate: "1.00 ETH/kWh",
      time: "4 mins ago",
      status: "Settled"
    },
    {
      id: "TRD-8940",
      seller: "0x15F2...66A8 (Node Epsilon)",
      buyer: "0x88C3...4192 (Node Zeta)",
      units: "22.0 kWh",
      totalPrice: "22.00 ETH",
      rate: "1.00 ETH/kWh",
      time: "12 mins ago",
      status: "Settled"
    },
    {
      id: "TRD-8939",
      seller: "0x77D9...014B (Node Eta)",
      buyer: "0x29E4...887C (Node Theta)",
      units: "12.0 kWh",
      totalPrice: "14.40 ETH",
      rate: "1.20 ETH/kWh",
      time: "25 mins ago",
      status: "Settled"
    }
  ];

  return (
    <section id="dashboard" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-800/80">
      
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-4">
          <Activity className="w-3.5 h-3.5" /> Week 8 Deliverable
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
          Microgrid Trading Dashboard
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          Live telemetries, market matching depth, smart contract registry, and mirrored Supabase data feeds.
        </p>
      </div>

      {/* Grid Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase">Average P2P Tariff</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">1.18 <span className="text-xs text-zinc-400 font-normal">ETH/kWh</span></div>
          <div className="text-[11px] text-emerald-400 mt-1 font-medium">-18% cheaper than main grid</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase">Daily Traded Volume</span>
            <BatteryCharging className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">412.5 <span className="text-xs text-zinc-400 font-normal">kWh</span></div>
          <div className="text-[11px] text-sky-400 mt-1 font-medium">94.2% peer self-consumption</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase">Grid Frequency</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">50.02 <span className="text-xs text-zinc-400 font-normal">Hz</span></div>
          <div className="text-[11px] text-amber-400 mt-1 font-medium">Nominal ±0.04% (Ultra-Stable)</div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase">Active Microgrid Nodes</span>
            <Layers className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-black text-white">28 <span className="text-xs text-zinc-400 font-normal">Nodes</span></div>
          <div className="text-[11px] text-teal-400 mt-1 font-medium">18 Prosumers • 10 Consumers</div>
        </div>
      </div>

      {/* Main Dashboard Container */}
      <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl">
        
        {/* Navigation Tabs */}
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === "feed"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Live Trade Feed
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === "contracts"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Smart Contracts (Hardhat / Sepolia)
          </button>
          <button
            onClick={() => setActiveTab("supabase")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === "supabase"
                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Supabase DB Schema
          </button>
        </div>

        {/* Tab 1: Live Trades */}
        {activeTab === "feed" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-zinc-400 bg-zinc-900/80 border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Trade ID</th>
                  <th className="py-3 px-4">Seller (Prosumer)</th>
                  <th className="py-3 px-4">Buyer (Consumer)</th>
                  <th className="py-3 px-4">Energy (kWh)</th>
                  <th className="py-3 px-4">Total Price</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-xs">
                {liveTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{t.id}</td>
                    <td className="py-3.5 px-4 text-emerald-400">{t.seller}</td>
                    <td className="py-3.5 px-4 text-sky-400">{t.buyer}</td>
                    <td className="py-3.5 px-4 font-bold text-zinc-200">{t.units}</td>
                    <td className="py-3.5 px-4 text-white font-bold">{t.totalPrice}</td>
                    <td className="py-3.5 px-4 text-zinc-400">{t.time}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3" /> {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Contracts */}
        {activeTab === "contracts" && (
          <div id="contracts" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400">ERC-20 Token Contract</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">0.8.20</span>
              </div>
              <h4 className="font-bold text-white text-base">EnergyToken.sol</h4>
              <p className="text-xs text-zinc-400 font-sans">
                Mints 1 token per 1 kWh generated by solar PV. Supports user burn upon physical consumption.
              </p>
              <div className="p-3 bg-black/60 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                <div>function mint(address to, uint256 kWh) external onlyOwner</div>
                <div>function burn(uint256 kWh) external</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-sky-400">Settlement & Escrow</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">0.8.30</span>
              </div>
              <h4 className="font-bold text-white text-base">Trading.sol</h4>
              <p className="text-xs text-zinc-400 font-sans">
                Atomic buy/sell order matching. Verifies seller balance, transfers tokens, and safely dispatches ETH.
              </p>
              <div className="p-3 bg-black/60 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                <div>function buyEnergy(address seller, uint256 kWh) external payable</div>
                <div>event TradeExecuted(buyer, seller, kWh, totalPrice)</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Supabase Schema */}
        {activeTab === "supabase" && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-indigo-400 font-bold mb-2">Table: households</div>
              <div className="text-zinc-400 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>id: uuid (PK)</div>
                <div>wallet_address: text</div>
                <div>is_prosumer: boolean</div>
                <div>capacity_kwh: numeric</div>
                <div>current_surplus: numeric</div>
                <div>distance_miles: numeric</div>
                <div>outage_active: boolean</div>
                <div>updated_at: timestamptz</div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-emerald-400 font-bold mb-2">Table: trades</div>
              <div className="text-zinc-400 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>id: uuid (PK)</div>
                <div>tx_hash: text (Unique)</div>
                <div>seller_address: text</div>
                <div>buyer_address: text</div>
                <div>kwh_amount: numeric</div>
                <div>eth_price: numeric</div>
                <div>status: text</div>
                <div>created_at: timestamptz</div>
              </div>
            </div>
          </div>
        )}

      </div>

    </section>
  );
}
