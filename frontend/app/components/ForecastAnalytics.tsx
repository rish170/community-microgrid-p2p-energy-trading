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
    <section id="forecast" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-800/80">
      
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20 mb-4">
          <BarChart4 className="w-3.5 h-3.5" /> Week 14: Data-API & Power BI Integration
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
          Solar Forecasting & Power BI Analytics
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          Coupling machine-learning solar irradiance prediction models with Power BI analytics to optimize community peak shaving.
        </p>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Forecast vs Actual Generation Curve */}
        <div className="lg:col-span-8 bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-400" /> 24-Hour Solar Generation vs Load Curve
              </h3>
              <span className="text-xs text-zinc-400">ML Forecast (Data-API) vs Physical Smart Meter Telemetry</span>
            </div>

            {/* Time Horizon Pills */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              {(["24h", "7d", "30d"] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHorizon(h)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    selectedHorizon === h ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {h.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Visual SVG Chart */}
          <div className="relative w-full h-64 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-4 flex flex-col justify-between">
            
            {/* Legend */}
            <div className="flex items-center justify-end gap-5 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-amber-400 rounded-full" />
                <span className="text-zinc-300">Actual Solar Gen (kWh)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-emerald-400 rounded-full border-b border-dashed" />
                <span className="text-zinc-300">ML Forecast Model</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-0.5 bg-sky-400 rounded-full" />
                <span className="text-zinc-300">Community Demand</span>
              </div>
            </div>

            {/* SVG Wave Lines */}
            <div className="h-44 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 700 160" preserveAspectRatio="none">
                {/* Horizontal Gridlines */}
                <line x1="0" y1="40" x2="700" y2="40" stroke="#27272a" strokeDasharray="4,4" />
                <line x1="0" y1="80" x2="700" y2="80" stroke="#27272a" strokeDasharray="4,4" />
                <line x1="0" y1="120" x2="700" y2="120" stroke="#27272a" strokeDasharray="4,4" />

                {/* Solar Bell Curve (Amber Filled Gradient) */}
                <defs>
                  <linearGradient id="solarGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
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
                  stroke="#f59e0b"
                  strokeWidth="3.5"
                />

                {/* ML Forecast Path (Emerald dashed) */}
                <path
                  d="M 0,150 Q 150,150 250,95 T 350,25 T 450,95 Q 550,150 700,150"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeDasharray="6,6"
                />

                {/* Demand Curve (Sky blue) */}
                <path
                  d="M 0,110 Q 180,90 350,110 T 520,60 Q 620,70 700,110"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            {/* X-Axis Labels */}
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              {timeLabels.map((t, idx) => (
                <span key={idx}>{t}</span>
              ))}
            </div>

          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span className="text-emerald-400 font-semibold">Model Accuracy: 96.8% R² Score</span>
            <span>Data-API Latency: 120ms</span>
          </div>

        </div>

        {/* Right: Power BI Analytics Highlights */}
        <div className="lg:col-span-4 bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" /> Power BI Sync
              </h3>
              <span className="text-xs text-zinc-400">Aggregated Microgrid KPIs</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 uppercase">
              LIVE REPLAY
            </span>
          </div>

          {/* Metric 1 */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase">Community Cost Saved</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">$14,890 <span className="text-xs text-zinc-400 font-normal">USD</span></div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Avoided utility peak-demand surcharges</div>
          </div>

          {/* Metric 2 */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase">Clean Carbon Offset</span>
              <Leaf className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-black text-white">32.4 <span className="text-xs text-zinc-400 font-normal">Tons CO₂</span></div>
            <div className="text-[11px] text-teal-400 mt-0.5">Equivalent to planting 1,480 trees</div>
          </div>

          {/* Metric 3 */}
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-400 font-semibold uppercase">Grid Resilience Index</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">99.98% <span className="text-xs text-zinc-400 font-normal">Uptime</span></div>
            <div className="text-[11px] text-amber-400 mt-0.5">Zero unhandled outages across 28 nodes</div>
          </div>

        </div>

      </div>

    </section>
  );
}
