"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ShieldAlert, 
  Layers, 
  Activity, 
  Sliders, 
  Battery, 
  Sun, 
  Zap, 
  ArrowLeft, 
  CheckCircle2, 
  Radio, 
  RefreshCw,
  AlertTriangle,
  Server
} from "lucide-react";

export default function AdminControlRoom() {
  const [tariffMultiplier, setTariffMultiplier] = useState<number>(1.0);
  const [isIslanded, setIsIslanded] = useState<boolean>(false);
  const [selectedTargetNode, setSelectedTargetNode] = useState<string>("Node-Beta (0x71C7...976F)");
  const [overridePowerAmount, setOverridePowerAmount] = useState<string>("25");
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);

  // 28 Microgrid household nodes mock telemetry
  const households = [
    { id: "H-01", name: "Node Alpha (Prosumer #04)", address: "0x3C44...93BC", type: "Prosumer", generation: "+100 units", load: "70 units", net: "+30 units", battery: "92%", status: "Normal" },
    { id: "H-02", name: "Node Beta (Consumer #12)", address: "0x71C7...976F", type: "Consumer", generation: "0 units", load: "15 units", net: "-15 units", battery: "18%", status: "Outage Mitigated" },
    { id: "H-03", name: "Node Gamma (Prosumer #09)", address: "0x92A1...33F1", type: "Prosumer", generation: "+85 units", load: "45 units", net: "+40 units", battery: "88%", status: "Normal" },
    { id: "H-04", name: "Node Delta (Consumer #03)", address: "0x44B8...121E", type: "Consumer", generation: "0 units", load: "20 units", net: "-20 units", battery: "64%", status: "Normal" },
    { id: "H-05", name: "Node Epsilon (Prosumer #14)", address: "0x15F2...66A8", type: "Prosumer", generation: "+120 units", load: "60 units", net: "+60 units", battery: "96%", status: "Normal" },
    { id: "H-06", name: "Node Zeta (Consumer #08)", address: "0x88C3...4192", type: "Consumer", generation: "0 units", load: "30 units", net: "-30 units", battery: "42%", status: "Normal" },
  ];

  // Live Supabase / WebSocket Realtime Events Stream
  const [realtimeLogs, setRealtimeLogs] = useState<string[]>([
    "[19:12:01] [Supabase] Subscribed to realtime channel: 'load_balancing_allocations'",
    "[19:11:45] [Hardhat] Contract event 'TradeExecuted' captured: 15 units @ 1.5 ETH",
    "[19:10:30] [Grid-IoT] Solar irradiance peaked at 940 W/m² (Microgrid Zone 1)",
    "[19:08:12] [Admin-Audit] Auto-frequency stabilizer adjusted baseline to 50.02 Hz"
  ]);

  const handleApplyOverride = (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideStatus("applying");
    
    setTimeout(() => {
      setOverrideStatus("success");
      const logEntry = `[${new Date().toLocaleTimeString()}] [Admin-Override] Dispatched ${overridePowerAmount} units to ${selectedTargetNode} with tariff ${tariffMultiplier}x`;
      setRealtimeLogs((prev) => [logEntry, ...prev]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] p-4 sm:p-6 lg:p-8 selection:bg-[#3A7D5C]/20 selection:text-[#1D1D1F]">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8D8DE] pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-white border border-[#D8D8DE] hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition shadow-xs"
              title="Return to Microgrid View"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20 mb-1.5 font-mono">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Operator Console • Substation Control</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F]">
                Microgrid Load Balancing &amp; Dispatch Console
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-2 rounded-xl bg-white border border-[#D8D8DE] shadow-xs flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#27845B] animate-pulse" />
              <span className="text-[#6E6E73]">Frequency: <strong className="text-[#1D1D1F]">50.02 Hz</strong></span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white border border-[#D8D8DE] shadow-xs flex items-center gap-2 text-xs font-mono">
              <Server className="w-3.5 h-3.5 text-[#5277D5]" />
              <span className="text-[#6E6E73]">Supabase: <strong className="text-[#5277D5]">Connected</strong></span>
            </div>
          </div>
        </div>

        {/* Top Control Cards: Islanding Mode & Tariff Control */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Islanding Toggle */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">Microgrid Mode</span>
              <ShieldAlert className={`w-5 h-5 ${isIslanded ? "text-[#D99A22]" : "text-[#27845B]"}`} />
            </div>
            <div>
              <div className="text-lg font-semibold text-[#1D1D1F]">
                {isIslanded ? "Autonomous Island Mode" : "Main-Grid Interconnected"}
              </div>
              <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                {isIslanded 
                  ? "Substation circuit breaker tripped. Local battery & solar autonomous balancing active." 
                  : "Operating synchronously with utility substation (IEEE 2030.7 nominal)."}
              </p>
            </div>
            <button
              onClick={() => {
                setIsIslanded(!isIslanded);
                const log = `[${new Date().toLocaleTimeString()}] [Grid-State] Switched mode to ${!isIslanded ? "Autonomous Islanding" : "Grid-Connected"}`;
                setRealtimeLogs((prev) => [log, ...prev]);
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isIslanded
                  ? "bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/25 hover:bg-[#D99A22]/20"
                  : "bg-[#1D1D1F] hover:bg-[#343438] text-white shadow-sm"
              }`}
            >
              {isIslanded ? "Reconnect to Utility Grid" : "Trigger Emergency Islanding"}
            </button>
          </div>

          {/* Dynamic Tariff Multiplier */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">Dynamic Tariff Regulator</span>
              <Sliders className="w-5 h-5 text-[#5277D5]" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#1D1D1F] flex items-baseline gap-2 font-mono">
                <span className="text-[#5277D5]">{tariffMultiplier.toFixed(1)}x</span>
                <span className="text-xs font-normal text-[#6E6E73]">({(1.5 * tariffMultiplier).toFixed(2)} ETH / unit)</span>
              </div>
              <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                Operator incentive multiplier to encourage prosumer battery discharge during peak congestion.
              </p>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={tariffMultiplier}
              onChange={(e) => setTariffMultiplier(parseFloat(e.target.value))}
              className="w-full accent-[#5277D5] cursor-pointer"
            />
          </div>

          {/* Emergency Power Allocation Form */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">Manual Power Dispatch</span>
              <Zap className="w-5 h-5 text-[#27845B]" />
            </div>
            <form onSubmit={handleApplyOverride} className="space-y-2.5">
              <select
                value={selectedTargetNode}
                onChange={(e) => setSelectedTargetNode(e.target.value)}
                className="w-full bg-[#F5F5F7] border border-[#D8D8DE] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:border-[#1D1D1F]"
              >
                <option value="Node-Beta (0x71C7...976F)">Node-Beta (Consumer #12)</option>
                <option value="Node-Delta (0x44B8...121E)">Node-Delta (Consumer #03)</option>
                <option value="Node-Zeta (0x88C3...4192)">Node-Zeta (Consumer #08)</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={overridePowerAmount}
                  onChange={(e) => setOverridePowerAmount(e.target.value)}
                  className="w-1/2 bg-[#F5F5F7] border border-[#D8D8DE] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] font-mono focus:outline-none focus:border-[#1D1D1F]"
                  placeholder="units"
                  required
                />
                <button
                  type="submit"
                  className="w-1/2 bg-[#1D1D1F] hover:bg-[#343438] text-white font-medium text-xs rounded-xl transition cursor-pointer shadow-sm"
                >
                  Dispatch
                </button>
              </div>
            </form>
            {overrideStatus === "success" && (
              <div className="text-[11px] text-[#27845B] font-mono">
                ✓ Dispatched {overridePowerAmount} units to {selectedTargetNode}
              </div>
            )}
          </div>

        </div>

        {/* Household Topology Grid */}
        <div className="bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#27845B]" />
                <span>Microgrid Household Nodes Telemetry</span>
              </h3>
              <span className="text-xs text-[#6E6E73]">Real-time IoT smart meter telemetry and battery state of charge (SoC)</span>
            </div>
            <span className="text-xs font-mono text-[#27845B] bg-[#27845B]/10 px-2.5 py-1 rounded-lg border border-[#27845B]/20">
              28/28 Nodes Synced
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="uppercase text-[#6E6E73] bg-[#F5F5F7] border-b border-[#E5E5EA] text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5 rounded-l-lg font-semibold">Node ID</th>
                  <th className="py-2.5 px-3.5 font-semibold">Household Node</th>
                  <th className="py-2.5 px-3.5 font-semibold">Role</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Generation</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Load</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Net Balance</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Battery SoC</th>
                  <th className="py-2.5 px-3.5 rounded-r-lg text-center font-semibold">Grid Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEF]">
                {households.map((h) => (
                  <tr key={h.id} className="hover:bg-[#F5F5F7]/80 transition">
                    <td className="py-3 px-3.5 text-[#6E6E73]">{h.id}</td>
                    <td className="py-3 px-3.5 font-semibold text-[#1D1D1F] font-sans">{h.name}</td>
                    <td className="py-3 px-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        h.type === "Prosumer" ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20" : "bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20"
                      }`}>
                        {h.type}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-[#D99A22] font-semibold text-right tabular-nums">{h.generation}</td>
                    <td className="py-3 px-3.5 text-[#1D1D1F] text-right tabular-nums">{h.load}</td>
                    <td className={`py-3 px-3.5 font-bold text-right tabular-nums ${h.net.startsWith("+") ? "text-[#27845B]" : "text-[#D94F58]"}`}>
                      {h.net}
                    </td>
                    <td className="py-3 px-3.5 text-[#1D1D1F] font-semibold text-right tabular-nums">{h.battery}</td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium inline-block ${
                        h.status === "Normal" 
                          ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20" 
                          : "bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/20"
                      }`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Event Stream */}
        <div className="bg-white rounded-3xl border border-[#D8D8DE] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-3 flex-wrap gap-2">
            <span className="text-[#1D1D1F] font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#8271B8] animate-pulse" />
              <span>Live Supabase &amp; Hardhat Event Stream</span>
            </span>
            <span className="text-[11px] text-[#6E6E73]">WebSocket Realtime Channel Connected</span>
          </div>
          <div className="space-y-1.5 bg-[#F5F5F7] p-4 rounded-2xl border border-[#E5E5EA] text-[#1D1D1F] max-h-48 overflow-y-auto">
            {realtimeLogs.map((log, i) => (
              <div key={i} className="text-[#6E6E73] hover:text-[#1D1D1F] transition">
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
