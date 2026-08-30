"use client";

import React from "react";
import dynamic from "next/dynamic";
import Navbar from "./components/Navbar";
import P2PTradingSimulator from "./components/P2PTradingSimulator";
import TradeOrderBook from "./components/TradeOrderBook";
import ProjectExplanation from "./components/ProjectExplanation";
import ForecastAnalytics from "./components/ForecastAnalytics";
import LiveDashboard from "./components/LiveDashboard";
import VivaDefenseModal from "./components/VivaDefenseModal";
import Footer from "./components/Footer";

// Dynamically import 3D Neighborhood Simulation with SSR disabled for WebGL Canvas
const NeighborhoodMicrogrid3D = dynamic(
  () => import("./components/NeighborhoodMicrogrid3D"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#07090d] text-slate-100 selection:bg-emerald-500 selection:text-black">
      {/* Sticky Navigation */}
      <Navbar />

      {/* Main Experience */}
      <main className="flex-1">
        
        {/* ================= OPENING EXPERIENCE: 12-HOUSE 3D RESIDENTIAL MICROGRID ================= */}
        <section className="relative w-full h-[92vh] border-b border-zinc-800/80 bg-[#07090d]">
          <NeighborhoodMicrogrid3D />
        </section>

        {/* ================= SECTION DIVIDER & MARKETPLACE ENTRY ================= */}
        <div id="marketplace" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800/60">
          <div>
            <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest">
              DECENTRALIZED ENERGY PROTOCOL
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
              Live Settlement & P2P Trading Marketplace
            </h2>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Sepolia Testnet • EnergyToken.sol • Trading.sol • Supabase Realtime
          </div>
        </div>

        {/* ================= INTERACTIVE DUAL-WALLET P2P TRANSACTION ================= */}
        <P2PTradingSimulator />

        {/* ================= ORDER BOOK & TRADE EXECUTION (WEEKS 9 & 10) ================= */}
        <TradeOrderBook />

        {/* ================= PROJECT EXPLANATION & ARCHITECTURE ================= */}
        <ProjectExplanation />

        {/* ================= SOLAR FORECASTING & POWER BI ANALYTICS (WEEK 14) ================= */}
        <ForecastAnalytics />

        {/* ================= LIVE DASHBOARD & CONTRACTS (WEEK 8) ================= */}
        <LiveDashboard />

        {/* ================= VIVA PREP & ARCHITECTURE GUIDE (WEEK 16) ================= */}
        <VivaDefenseModal />

      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
