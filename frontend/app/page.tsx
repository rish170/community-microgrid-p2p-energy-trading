"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MicrogridDataProvider } from "./hooks/useMicrogridData";
import Navbar from "./components/Navbar";
import P2PTradingSimulator from "./components/P2PTradingSimulator";
import EnergyRequestsBoard from "./components/EnergyRequestsBoard";
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
    <MicrogridDataProvider>
      <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F] selection:bg-[#3A7D5C]/20 selection:text-[#1D1D1F]">
        {/* Sticky Navigation */}
        <Navbar />

        {/* Main Experience */}
        <main className="flex-1">
        
        {/* ================= OPENING EXPERIENCE: 12-HOUSE 3D RESIDENTIAL MICROGRID ================= */}
        <section className="relative w-full h-[92vh] border-b border-[#D8D8DE] bg-[#F5F5F7]">
          <NeighborhoodMicrogrid3D />
        </section>

        {/* ================= SECTION DIVIDER & MARKETPLACE ENTRY ================= */}
        <div id="overview" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#D8D8DE]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3A7D5C] animate-pulse" />
              Decentralized Microgrid Settlement Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]">
              Peer-to-Peer Energy Trading & Load Balancing
            </h2>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-mono text-[#6E6E73]">
            <span className="px-3 py-1 rounded-lg bg-white border border-[#D8D8DE] text-[#1D1D1F] shadow-xs">
              Sepolia Testnet
            </span>
            <span className="px-3 py-1 rounded-lg bg-white border border-[#D8D8DE] text-[#6E6E73] shadow-xs">
              EnergyToken.sol
            </span>
            <span className="px-3 py-1 rounded-lg bg-white border border-[#D8D8DE] text-[#6E6E73] shadow-xs">
              Trading.sol
            </span>
          </div>
        </div>

        {/* ================= INTERACTIVE DUAL-WALLET P2P TRANSACTION ================= */}
        <P2PTradingSimulator />

        {/* ================= P2P ENERGY REQUESTS & MATCHING ENGINE (WEEKS 9 & 10) ================= */}
        <EnergyRequestsBoard />

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
  </MicrogridDataProvider>
);
}
