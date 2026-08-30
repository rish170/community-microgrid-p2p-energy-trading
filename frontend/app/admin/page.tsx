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
    { id: "H-01", name: "Node Alpha (Prosumer #04)", address: "0x3C44...93BC", type: "Prosumer", generation: "+100 kWh", load: "70 kWh", net: "+30 kWh", battery: "92%", status: "Normal" },
    { id: "H-02", name: "Node Beta (Consumer #12)", address: "0x71C7...976F", type: "Consumer", generation: "0 kWh", load: "15 kWh", net: "-15 kWh", battery: "18%", status: "Outage Mitigated" },
    { id: "H-03", name: "Node Gamma (Prosumer #09)", address: "0x92A1...33F1", type: "Prosumer", generation: "+85 kWh", load: "45 kWh", net: "+40 kWh", battery: "88%", status: "Normal" },
    { id: "H-04", name: "Node Delta (Consumer #03)", address: "0x44B8...121E", type: "Consumer", generation: "0 kWh", load: "20 kWh", net: "-20 kWh", battery: "64%", status: "Normal" },
    { id: "H-05", name: "Node Epsilon (Prosumer #14)", address: "0x15F2...66A8", type: "Prosumer", generation: "+120 kWh", load: "60 kWh", net: "+60 kWh", battery: "96%", status: "Normal" },
    { id: "H-06", name: "Node Zeta (Consumer #08)", address: "0x88C3...4192", type: "Consumer", generation: "0 kWh", load: "30 kWh", net: "-30 kWh", battery: "42%", status: "Normal" },
  ];

  // Live Supabase / WebSocket Realtime Events Stream
  const [realtimeLogs, setRealtimeLogs] = useState<string[]>([
    "[19:12:01] [Supabase] Subscribed to realtime channel: 'load_balancing_allocations'",
    "[19:11:45] [Hardhat] Contract event 'TradeExecuted' captured: 15 kWh @ 1.5 ETH",
    "[19:10:30] [Grid-IoT] Solar irradiance peaked at 940 W/m² (Microgrid Zone 1)",
    "[19:08:12] [Admin-Audit] Auto-frequency stabilizer adjusted baseline to 50.02 Hz"
  ]);

  const handleApplyOverride = (e: React.FormEvent) => {
    e.preventDefault();
    setOverrideStatus("applying");
    
    setTimeout(() => {
      setOverrideStatus("success");
      const logEntry = `[${new Date().toLocaleTimeString()}] [Admin-Override] Dispatched ${overridePowerAmount} kWh to ${selectedTargetNode} with tariff ${tariffMultiplier}x`;
      setRealtimeLogs((prev) => [logEntry, ...prev]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
              title="Return to Landing Page"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/30 mb-1">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> Operator Control Room
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                Microgrid Load Balancing & Admin Console
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Grid Frequency: <strong>50.02 Hz</strong></span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-xs font-mono">
              <Server className="w-4 h-4 text-sky-400" />
              <span>Supabase Realtime: <strong>Connected</strong></span>
            </div>
          </div>
        </div>

        {/* Top Control Cards: Islanding Mode & Tariff Control */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Islanding Toggle */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-zinc-400">Microgrid Mode</span>
              <ShieldAlert className={`w-5 h-5 ${isIslanded ? "text-amber-400" : "text-emerald-400"}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {isIslanded ? "Autonomous Island Mode" : "Main-Grid Interconnected"}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {isIslanded ? "Substation circuit disconnected. Local battery & solar balancing active." : "Operating synchronously with utility substation."}
              </p>
            </div>
            <button
              onClick={() => {
                setIsIslanded(!isIslanded);
                const log = `[${new Date().toLocaleTimeString()}] [Grid-State] Switched mode to ${!isIslanded ? "Autonomous Islanding" : "Grid-Connected"}`;
                setRealtimeLogs((prev) => [log, ...prev]);
              }}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                isIslanded
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {isIslanded ? "Reconnect to Main Utility Grid" : "Trigger Emergency Islanding"}
            </button>
          </div>

          {/* Dynamic Tariff Multiplier */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-zinc-400">Dynamic Tariff Regulator</span>
              <Sliders className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-white flex items-baseline gap-2">
                {tariffMultiplier.toFixed(1)}x <span className="text-xs font-normal text-zinc-400">({(1.5 * tariffMultiplier).toFixed(2)} ETH/kWh)</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Operator incentive multiplier to encourage prosumer discharge during peak stress.
              </p>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={tariffMultiplier}
              onChange={(e) => setTariffMultiplier(parseFloat(e.target.value))}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Emergency Power Allocation Form */}
          <div className="p-6 rounded-3xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-zinc-400">Manual Power Allocation</span>
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <form onSubmit={handleApplyOverride} className="space-y-2.5">
              <select
                value={selectedTargetNode}
                onChange={(e) => setSelectedTargetNode(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
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
                  className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  placeholder="kWh"
                  required
                />
                <button
                  type="submit"
                  className="w-1/2 bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Dispatch
                </button>
              </div>
            </form>
            {overrideStatus === "success" && (
              <div className="text-[11px] text-emerald-400 font-mono">
                ✓ Dispatched {overridePowerAmount} kWh to {selectedTargetNode}
              </div>
            )}
          </div>

        </div>

        {/* 28 Household Topology Grid */}
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" /> Microgrid Household Nodes (28 Total)
              </h3>
              <span className="text-xs text-zinc-400">Live IoT smart meter telemetry and battery state of charge (SoC)</span>
            </div>
            <span className="text-xs font-mono text-emerald-400">28/28 Synced</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="uppercase text-zinc-400 bg-zinc-900/60 border-b border-zinc-800">
                <tr>
                  <th className="py-3 px-4 rounded-l-lg">Node ID</th>
                  <th className="py-3 px-4">Node / Household</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Generation</th>
                  <th className="py-3 px-4">Household Load</th>
                  <th className="py-3 px-4">Net Surplus/Deficit</th>
                  <th className="py-3 px-4">Battery SoC</th>
                  <th className="py-3 px-4 rounded-r-lg">Grid Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {households.map((h) => (
                  <tr key={h.id} className="hover:bg-zinc-900/40 transition">
                    <td className="py-3.5 px-4 text-zinc-400">{h.id}</td>
                    <td className="py-3.5 px-4 font-bold text-white font-sans">{h.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        h.type === "Prosumer" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                      }`}>
                        {h.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400">{h.generation}</td>
                    <td className="py-3.5 px-4 text-zinc-400">{h.load}</td>
                    <td className={`py-3.5 px-4 font-bold ${h.net.startsWith("+") ? "text-emerald-400" : "text-amber-400"}`}>
                      {h.net}
                    </td>
                    <td className="py-3.5 px-4 text-white font-bold">{h.battery}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Supabase Realtime Log Stream */}
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 shadow-2xl space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <span className="text-white font-bold flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-400 animate-pulse" /> Live Supabase & Hardhat Event Stream
            </span>
            <span className="text-[11px] text-zinc-500">Auto-scrolling realtime socket</span>
          </div>
          <div className="space-y-1.5 bg-black/60 p-4 rounded-2xl border border-zinc-800/80 text-zinc-300 max-h-44 overflow-y-auto">
            {realtimeLogs.map((log, i) => (
              <div key={i} className="text-zinc-400 hover:text-white transition">
                {log}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
