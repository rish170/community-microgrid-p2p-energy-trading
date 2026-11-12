"use client";

import React from "react";
import { MicrogridDataProvider } from "../hooks/useMicrogridData";
import Navbar from "../components/Navbar";
import EnergyRequestsBoard from "../components/EnergyRequestsBoard";
import LiveDashboard from "../components/LiveDashboard";
import VivaDefenseModal from "../components/VivaDefenseModal";
import Footer from "../components/Footer";

export default function DashboardPage() {
  return (
    <MicrogridDataProvider>
      <div className="min-h-screen flex flex-col bg-[#F5F5F7] text-[#1D1D1F] selection:bg-[#3A7D5C]/20 selection:text-[#1D1D1F]">
        {/* Sticky Navigation */}
        <Navbar />

        {/* Main Operational Hub */}
        <main className="flex-1">
          {/* ================= 1. P2P ENERGY REQUESTS BOARD / ORDER BOOK ================= */}
          <EnergyRequestsBoard />

          {/* ================= 2. MICROGRID OPERATIONAL DASHBOARD & CONTRACTS ================= */}
          <LiveDashboard />

          {/* Architecture Modal */}
          <VivaDefenseModal />
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </MicrogridDataProvider>
  );
}

