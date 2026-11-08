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
      units: "15.0 units",
      totalPrice: "22.50 ETH",
      rate: "1.50 ETH/unit",
      time: "Just now",
      status: "Settled"
    },
    {
      id: "TRD-8941",
      seller: "0x92A1...33F1 (Node Gamma)",
      buyer: "0x44B8...121E (Node Delta)",
      units: "8.5 units",
      totalPrice: "8.50 ETH",
      rate: "1.00 ETH/unit",
      time: "4 mins ago",
      status: "Settled"
    },
    {
      id: "TRD-8940",
      seller: "0x15F2...66A8 (Node Epsilon)",
      buyer: "0x88C3...4192 (Node Zeta)",
      units: "22.0 units",
      totalPrice: "22.00 ETH",
      rate: "1.00 ETH/unit",
      time: "12 mins ago",
      status: "Settled"
    },
    {
      id: "TRD-8939",
      seller: "0x77D9...014B (Node Eta)",
      buyer: "0x29E4...887C (Node Theta)",
      units: "12.0 units",
      totalPrice: "14.40 ETH",
      rate: "1.20 ETH/unit",
      time: "25 mins ago",
      status: "Settled"
    }
  ];

  return (
    <section id="dashboard" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
      
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#8271B8]/10 text-[#8271B8] border border-[#8271B8]/20 mb-3.5">
          <Activity className="w-3.5 h-3.5" />
          <span>Real-Time Telemetry &amp; On-Chain Ledger</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
          Microgrid Operational Dashboard
        </h2>
        <p className="text-[#6E6E73] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Aggregated microgrid telemetries, bilateral settlement records, smart contract verification, and mirrored Supabase database feeds.
        </p>
      </div>

      {/* Grid Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[#6E6E73] mb-2 text-xs font-medium uppercase tracking-wider">
            <span>Average P2P Tariff</span>
            <TrendingUp className="w-4 h-4 text-[#27845B]" />
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F] font-mono tabular-nums">1.18 <span className="text-xs text-[#6E6E73] font-normal">ETH/unit</span></div>
          <div className="text-[11px] text-[#27845B] mt-1 font-medium">-18% cheaper than utility grid</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[#6E6E73] mb-2 text-xs font-medium uppercase tracking-wider">
            <span>Daily Traded Volume</span>
            <BatteryCharging className="w-4 h-4 text-[#5277D5]" />
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F] font-mono tabular-nums">412.5 <span className="text-xs text-[#6E6E73] font-normal">units</span></div>
          <div className="text-[11px] text-[#5277D5] mt-1 font-medium">94.2% peer self-consumption</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[#6E6E73] mb-2 text-xs font-medium uppercase tracking-wider">
            <span>Grid Frequency</span>
            <Activity className="w-4 h-4 text-[#D99A22]" />
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F] font-mono tabular-nums">50.02 <span className="text-xs text-[#6E6E73] font-normal">Hz</span></div>
          <div className="text-[11px] text-[#D99A22] mt-1 font-medium">Nominal ±0.04% (Ultra-Stable)</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between text-[#6E6E73] mb-2 text-xs font-medium uppercase tracking-wider">
            <span>Active Microgrid Nodes</span>
            <Layers className="w-4 h-4 text-[#8271B8]" />
          </div>
          <div className="text-2xl font-bold text-[#1D1D1F] font-mono tabular-nums">28 <span className="text-xs text-[#6E6E73] font-normal">Nodes</span></div>
          <div className="text-[11px] text-[#8271B8] mt-1 font-medium">18 Prosumers • 10 Consumers</div>
        </div>
      </div>

      {/* Main Dashboard Container */}
      <div className="bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        
        {/* Navigation Tabs - Apple Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-[#EBEBEF] rounded-xl mb-6 w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab("feed")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "feed"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Live Trade Feed
          </button>
          <button
            onClick={() => setActiveTab("contracts")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "contracts"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Smart Contracts (Sepolia)
          </button>
          <button
            onClick={() => setActiveTab("supabase")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "supabase"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Supabase DB Schema
          </button>
        </div>

        {/* Tab 1: Live Trades */}
        {activeTab === "feed" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="uppercase text-[#6E6E73] bg-[#F5F5F7] border-b border-[#E5E5EA] text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5 rounded-l-lg font-semibold">Trade ID</th>
                  <th className="py-2.5 px-3.5 font-semibold">Seller (Prosumer)</th>
                  <th className="py-2.5 px-3.5 font-semibold">Buyer (Consumer)</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Energy</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Total Price</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Time</th>
                  <th className="py-2.5 px-3.5 rounded-r-lg text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEF]">
                {liveTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F5F5F7]/80 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-[#1D1D1F]">{t.id}</td>
                    <td className="py-3 px-3.5 text-[#27845B] font-sans font-medium">{t.seller}</td>
                    <td className="py-3 px-3.5 text-[#5277D5] font-sans font-medium">{t.buyer}</td>
                    <td className="py-3 px-3.5 font-semibold text-[#1D1D1F] text-right tabular-nums">{t.units}</td>
                    <td className="py-3 px-3.5 text-[#1D1D1F] font-semibold text-right tabular-nums">{t.totalPrice}</td>
                    <td className="py-3 px-3.5 text-[#6E6E73] text-right">{t.time}</td>
                    <td className="py-3 px-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20">
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
            <div className="p-5 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#27845B] font-semibold">ERC-20 Token Contract</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#1D1D1F] font-mono border border-[#D8D8DE]">v0.8.20</span>
              </div>
              <h4 className="font-semibold text-[#1D1D1F] text-base">EnergyToken.sol</h4>
              <p className="text-xs text-[#6E6E73] font-sans leading-relaxed">
                Mints 1 token per 1 kWh generated by solar PV. Supports user burn upon physical consumption, maintaining physical-to-digital parity.
              </p>
              <div className="p-3.5 bg-[#F5F5F7] rounded-xl border border-[#E5E5EA] font-mono text-xs text-[#1D1D1F] space-y-1">
                <div className="text-[#27845B]">function mint(address to, uint256 kWh) external onlyOwner</div>
                <div className="text-[#5277D5]">function burn(uint256 kWh) external</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#5277D5] font-semibold">Settlement &amp; Escrow</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white text-[#1D1D1F] font-mono border border-[#D8D8DE]">v0.8.30</span>
              </div>
              <h4 className="font-semibold text-[#1D1D1F] text-base">Trading.sol</h4>
              <p className="text-xs text-[#6E6E73] font-sans leading-relaxed">
                Atomic buy/sell order matching. Verifies seller balance, transfers tokens, and safely dispatches ETH with reentrancy protection.
              </p>
              <div className="p-3.5 bg-[#F5F5F7] rounded-xl border border-[#E5E5EA] font-mono text-xs text-[#1D1D1F] space-y-1">
                <div className="text-[#5277D5]">function buyEnergy(address seller, uint256 kWh) external payable</div>
                <div className="text-[#8271B8]">event TradeExecuted(buyer, seller, kWh, totalPrice)</div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Supabase Schema */}
        {activeTab === "supabase" && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 rounded-xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <div className="text-[#8271B8] font-semibold mb-2">Table: households</div>
              <div className="text-[#6E6E73] grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            <div className="p-4 rounded-xl bg-[#FBFBFC] border border-[#EBEBEF]">
              <div className="text-[#27845B] font-semibold mb-2">Table: trades</div>
              <div className="text-[#6E6E73] grid grid-cols-2 sm:grid-cols-4 gap-2">
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
