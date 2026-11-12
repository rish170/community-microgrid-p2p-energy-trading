"use client";

import React from "react";
import dynamic from "next/dynamic";
import { MicrogridDataProvider } from "./hooks/useMicrogridData";
import Navbar from "./components/Navbar";
import ProjectExplanation from "./components/ProjectExplanation";
import ForecastAnalytics from "./components/ForecastAnalytics";
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

          {/* ================= PROJECT EXPLANATION & ARCHITECTURE ================= */}
          <ProjectExplanation />

          {/* ================= SOLAR FORECASTING & POWER BI ANALYTICS ================= */}
          <ForecastAnalytics />

          {/* ================= VIVA PREP & ARCHITECTURE GUIDE ================= */}
          <VivaDefenseModal />

        </main>

        {/* Footer */}
        <Footer />
      </div>
    </MicrogridDataProvider>
  );
}
