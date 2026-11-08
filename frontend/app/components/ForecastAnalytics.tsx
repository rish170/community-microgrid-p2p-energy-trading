"use client";

import React, { useState } from "react";
import { 
  LineChart, 
  TrendingUp, 
  Sun, 
  CloudSun, 
  BarChart4, 
  Leaf, 
  DollarSign, 
  Zap,
  Layers,
  Database
} from "lucide-react";

export default function ForecastAnalytics() {
  const [selectedHorizon, setSelectedHorizon] = useState<"24h" | "7d" | "30d">("24h");

  // Simulated 24-hour data points for solar curve & consumption
  const timeLabels = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];

  return (
    <section id="forecast" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
      
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/20 mb-3.5">
          <BarChart4 className="w-3.5 h-3.5" />
          <span>LightGBM ML Forecasting &amp; Power BI Analytics</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
          Demand Forecasting &amp; Grid Analytics
        </h2>
        <p className="text-[#6E6E73] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Trained on Ausgrid smart-meter telemetry to predict next-day rooftop solar generation against community demand, optimizing peak-shaving and battery dispatch.
        </p>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Forecast vs Actual Generation Curve */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[#1D1D1F] flex items-center gap-2">
                <Sun className="w-4 h-4 text-[#D99A22]" />
                <span>24-Hour Solar Generation vs. Demand Curve</span>
              </h3>
              <span className="text-xs text-[#6E6E73]">ML Model (LightGBM) vs. Physical Smart Meter Telemetry</span>
            </div>

            {/* Time Horizon Pills - Apple Segmented */}
            <div className="flex items-center gap-1 bg-[#EBEBEF] p-1 rounded-xl">
              {(["24h", "7d", "30d"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHorizon(h)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    selectedHorizon === h 
                      ? "bg-white text-[#1D1D1F] shadow-xs font-semibold" 
                      : "text-[#6E6E73] hover:text-[#1D1D1F]"
                  }`}
                >
                  {h.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Visual SVG Chart */}
          <div className="relative w-full h-64 bg-[#FBFBFC] rounded-2xl border border-[#EBEBEF] p-4 flex flex-col justify-between">
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-5 text-xs font-medium flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#D99A22] rounded-full" />
                <span className="text-[#1D1D1F]">Actual Solar (units)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#27845B] rounded-full border-b border-dashed" />
                <span className="text-[#1D1D1F]">ML Forecast Model</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-[#5277D5] rounded-full" />
                <span className="text-[#1D1D1F]">Community Demand</span>
              </div>
            </div>

            {/* SVG Wave Lines */}
            <div className="h-44 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 160" preserveAspectRatio="none">
                {/* Horizontal Gridlines */}
                <line x1="0" y1="40" x2="700" y2="40" stroke="#E5E5EA" strokeDasharray="4,4" />
                <line x1="0" y1="80" x2="700" y2="80" stroke="#E5E5EA" strokeDasharray="4,4" />
                <line x1="0" y1="120" x2="700" y2="120" stroke="#E5E5EA" strokeDasharray="4,4" />

                {/* Solar Bell Curve Gradient */}
                <defs>
                  <linearGradient id="solarGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D99A22" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#D99A22" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0,150 Q 150,150 250,100 T 350,20 T 450,100 Q 550,150 700,150 L 700,160 L 0,160 Z"
                  fill="url(#solarGlow)"
                />
                
                {/* Actual Solar Path (Amber) */}
                <path
                  d="M 0,150 Q 150,150 250,100 T 350,20 T 450,100 Q 550,150 700,150"
                  fill="none"
                  stroke="#D99A22"
                  strokeWidth="3"
                />

                {/* ML Forecast Path (Emerald dashed) */}
                <path
                  d="M 0,150 Q 150,150 250,95 T 350,25 T 450,95 Q 550,150 700,150"
                  fill="none"
                  stroke="#27845B"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                />

                {/* Demand Curve (Blue) */}
                <path
                  d="M 0,110 Q 180,90 350,110 T 520,60 Q 620,70 700,110"
                  fill="none"
                  stroke="#5277D5"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="flex items-center justify-between text-[11px] text-[#6E6E73] font-mono">
              {timeLabels.map((t, idx) => (
                <span key={idx}>{t}</span>
              ))}
            </div>

          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[#6E6E73] font-mono flex-wrap gap-2">
            <span className="text-[#27845B] font-semibold">Model Accuracy: 96.8% R² Score (LightGBM)</span>
            <span>Inference Latency: 120ms</span>
          </div>

        </div>

        {/* Right: Power BI Analytics Highlights */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-3.5">
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#8271B8]" />
                <span>Power BI Synced Metrics</span>
              </h3>
              <span className="text-xs text-[#6E6E73]">Community Microgrid KPIs</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-[#8271B8]/10 text-[#8271B8] border border-[#8271B8]/20 uppercase font-mono">
              LIVE
            </span>
          </div>

          {/* Metric 1 */}
          <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
            <div className="flex items-center justify-between mb-1 text-xs text-[#6E6E73] font-medium uppercase tracking-wider">
              <span>Community Savings</span>
              <DollarSign className="w-4 h-4 text-[#27845B]" />
            </div>
            <div className="text-2xl font-bold text-[#1D1D1F] tabular-nums font-mono">$14,890 <span className="text-xs text-[#6E6E73] font-normal">USD</span></div>
            <div className="text-[11px] text-[#27845B] mt-0.5">Peak-demand utility surcharges avoided</div>
          </div>

          {/* Metric 2 */}
          <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
            <div className="flex items-center justify-between mb-1 text-xs text-[#6E6E73] font-medium uppercase tracking-wider">
              <span>Carbon Offset</span>
              <Leaf className="w-4 h-4 text-[#5277D5]" />
            </div>
            <div className="text-2xl font-bold text-[#1D1D1F] tabular-nums font-mono">32.4 <span className="text-xs text-[#6E6E73] font-normal">Tons CO₂</span></div>
            <div className="text-[11px] text-[#5277D5] mt-0.5">Equivalent to planting 1,480 mature trees</div>
          </div>

          {/* Metric 3 */}
          <div className="p-4 rounded-2xl bg-[#FBFBFC] border border-[#EBEBEF]">
            <div className="flex items-center justify-between mb-1 text-xs text-[#6E6E73] font-medium uppercase tracking-wider">
              <span>Resilience Index</span>
              <Zap className="w-4 h-4 text-[#D99A22]" />
            </div>
            <div className="text-2xl font-bold text-[#1D1D1F] tabular-nums font-mono">99.98% <span className="text-xs text-[#6E6E73] font-normal">Uptime</span></div>
            <div className="text-[11px] text-[#D99A22] mt-0.5">Zero unhandled outages across community</div>
          </div>

        </div>

      </div>

      {/* 12-Household Dataset Telemetry Breakdown (Ausgrid Smart Meter Units) */}
      <div className="mt-10 bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 border-b border-[#EBEBEF] pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#27845B]" />
              <span>Household Telemetry Breakdown (Ausgrid Dataset)</span>
            </h3>
            <p className="text-xs text-[#6E6E73] mt-0.5">
              Exact daily &amp; half-hourly energy units (1 unit = 1 kWh) and load/capacity (kW) per household node
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20">6 Prosumers</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20">6 Consumers</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] text-[#6E6E73] border border-[#D8D8DE]">1 unit = 1 kWh</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#E5E5EA] text-[#6E6E73] uppercase text-[11px] tracking-wider bg-[#F5F5F7]">
                <th className="py-2.5 px-3.5 rounded-l-lg font-semibold">House ID</th>
                <th className="py-2.5 px-3.5 font-semibold">Role</th>
                <th className="py-2.5 px-3.5 font-semibold">PV Capacity</th>
                <th className="py-2.5 px-3.5 text-right font-semibold">Daily Gen</th>
                <th className="py-2.5 px-3.5 text-right font-semibold">Daily Load</th>
                <th className="py-2.5 px-3.5 text-right font-semibold">Net Balance</th>
                <th className="py-2.5 px-3.5 text-right font-semibold">Current Slot</th>
                <th className="py-2.5 px-3.5 rounded-r-lg text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEF]">
              {[
                { id: "P1", name: "Residence P1", type: "Prosumer", cap: "3.5 kWp", gen: "18.40 units", cons: "7.20 units", net: "+11.20 units", isPos: true, slot: "+2.40 units", status: "Active Selling" },
                { id: "C1", name: "Residence C1", type: "Consumer", cap: "—", gen: "0.00 units", cons: "14.80 units", net: "-14.80 units", isPos: false, slot: "-1.20 units", status: "Active Buying" },
                { id: "P2", name: "Residence P2", type: "Prosumer", cap: "4.2 kWp", gen: "22.60 units", cons: "8.50 units", net: "+14.10 units", isPos: true, slot: "+1.80 units", status: "Active Selling" },
                { id: "C2", name: "Residence C2", type: "Consumer", cap: "—", gen: "0.00 units", cons: "18.20 units", net: "-18.20 units", isPos: false, slot: "-2.00 units", status: "Active Buying" },
                { id: "P3", name: "Residence P3 (Alpha)", type: "Prosumer", cap: "5.0 kWp", gen: "28.50 units", cons: "9.20 units", net: "+19.30 units", isPos: true, slot: "+3.10 units", status: "Active Selling" },
                { id: "C3", name: "Residence C3", type: "Consumer", cap: "—", gen: "0.00 units", cons: "13.50 units", net: "-13.50 units", isPos: false, slot: "-1.50 units", status: "Active Buying" },
                { id: "C4", name: "Residence C4", type: "Consumer", cap: "—", gen: "0.00 units", cons: "16.40 units", net: "-16.40 units", isPos: false, slot: "-1.80 units", status: "Active Buying" },
                { id: "P4", name: "Residence P4", type: "Prosumer", cap: "4.0 kWp", gen: "21.80 units", cons: "7.90 units", net: "+13.90 units", isPos: true, slot: "+2.70 units", status: "Active Selling" },
                { id: "C5", name: "Residence C5", type: "Consumer", cap: "—", gen: "0.00 units", cons: "11.60 units", net: "-11.60 units", isPos: false, slot: "-1.00 units", status: "Active Buying" },
                { id: "P5", name: "Residence P5", type: "Prosumer", cap: "4.8 kWp", gen: "26.40 units", cons: "8.80 units", net: "+17.60 units", isPos: true, slot: "+3.00 units", status: "Active Selling" },
                { id: "C6", name: "Residence C6 (Beta)", type: "Consumer", cap: "—", gen: "0.00 units", cons: "15.20 units", net: "-15.20 units", isPos: false, slot: "-1.50 units", status: "Outage Mitigated" },
                { id: "P6", name: "Residence P6", type: "Prosumer", cap: "3.8 kWp", gen: "20.50 units", cons: "8.10 units", net: "+12.40 units", isPos: true, slot: "+2.50 units", status: "Active Selling" },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-[#F5F5F7]/80 transition">
                  <td className="py-2.5 px-3.5 font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${row.type === "Prosumer" ? "bg-[#27845B]" : "bg-[#5277D5]"}`} />
                    {row.id}
                  </td>
                  <td className="py-2.5 px-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      row.type === "Prosumer" ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20" : "bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20"
                    }`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3.5 text-[#6E6E73]">{row.cap}</td>
                  <td className="py-2.5 px-3.5 text-[#D99A22] font-semibold text-right tabular-nums">{row.gen}</td>
                  <td className="py-2.5 px-3.5 text-[#1D1D1F] text-right tabular-nums">{row.cons}</td>
                  <td className={`py-2.5 px-3.5 font-bold text-right tabular-nums ${row.isPos ? "text-[#27845B]" : "text-[#D94F58]"}`}>
                    {row.net}
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-[#1D1D1F] text-right tabular-nums">{row.slot}</td>
                  <td className="py-2.5 px-3.5 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium inline-block ${
                      row.status.includes("Selling") ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20" :
                      row.status.includes("Outage") ? "bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/20" :
                      "bg-[#D94F58]/10 text-[#D94F58] border border-[#D94F58]/20"
                    }`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#D8D8DE] bg-[#F5F5F7] font-semibold text-[#1D1D1F]">
                <td className="py-3 px-3.5" colSpan={3}>Community Total (12 Households)</td>
                <td className="py-3 px-3.5 text-[#D99A22] text-right tabular-nums">138.20 units</td>
                <td className="py-3 px-3.5 text-[#1D1D1F] text-right tabular-nums">139.40 units</td>
                <td className="py-3 px-3.5 text-[#27845B] text-right tabular-nums">+6.50 units (Peak)</td>
                <td className="py-3 px-3.5 text-[#27845B] text-right tabular-nums">+6.50 units</td>
                <td className="py-3 px-3.5 text-[#27845B] text-center">99.1% Self-Sufficient</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </section>
  );
}
