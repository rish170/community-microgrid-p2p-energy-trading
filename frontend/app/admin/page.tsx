"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Layers,
  Activity,
  Sliders,
  Battery,
  BatteryCharging,
  Sun,
  Zap,
  ArrowLeft,
  CheckCircle2,
  Radio,
  RefreshCw,
  AlertTriangle,
  Server,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  Power,
  RotateCcw,
  Scissors,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { useMicrogridData } from "../hooks/useMicrogridData";
import { HOUSES_CONFIG } from "../config/houses";

export default function AdminControlRoom() {
  const {
    houses,
    isLiveConnected,
    isSocietyOutage,
    cutLines,
    lastTickTime,
    energyRequests,
    autoAcceptEnabled,
    toggleAutoAcceptAction,
    triggerSocietyOutage,
    restoreSocietyGrid,
    cutLinesAction,
    restoreLinesAction,
    refetch,
  } = useMicrogridData();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check existing session cookie on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/admin/verify");
        if (res.ok) {
          const json = await res.json();
          setIsAuthenticated(Boolean(json.authenticated));
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;

    setIsVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setAuthError(json.error || "Invalid operator authorization credentials");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication request failed";
      setAuthError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
  };

  // -------------------------------------------------------------
  // 1. LOADING SCREEN WHILE CHECKING SESSION
  // -------------------------------------------------------------
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-[#D8D8DE] flex items-center justify-center shadow-xs">
            <RefreshCw className="w-5 h-5 text-[#3A7D5C] animate-spin" />
          </div>
          <span className="text-xs font-mono text-[#6E6E73]">Verifying operator session...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. RESTRICTED OPERATOR LOGIN GATE (PASSWORD PROTECTED)
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-[#3A7D5C]/20">
        <header className="max-w-md mx-auto w-full pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-[#6E6E73] hover:text-[#1D1D1F] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Microgrid Simulation</span>
          </Link>
        </header>

        <main className="max-w-md mx-auto w-full my-auto py-8">
          <div className="bg-white rounded-3xl border border-[#D8D8DE] p-7 sm:p-9 shadow-[0_16px_40px_rgba(0,0,0,0.06)] space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1D1D1F] text-white flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-6 h-6 text-[#3A7D5C]" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20">
                <span>Restricted Operator Console</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Microgrid Substation Access
              </h1>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                Level 4 authorization required. This console permits society-wide grid disruption,
                automated feeder line isolation, and emergency dispatch overrides.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#64748B] mb-1.5">
                  Operator Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    autoFocus
                    placeholder="Enter operator password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] bg-[#F8FAFC] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#3A7D5C]/30 focus:border-[#3A7D5C]"
                  />
                  <KeyRound className="w-4 h-4 absolute right-3.5 top-3 text-[#94A3B8]" />
                </div>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] text-xs font-mono flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !passwordInput}
                className="w-full py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] active:scale-98 text-white text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#3A7D5C]" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-[#3A7D5C]" />
                    <span>Authorize &amp; Unlock Console</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-[#E2E8F0] text-center">
              <span className="text-[10px] font-mono text-[#94A3B8]">
                Protected by server-side HMAC session verification • IEEE 2030.7 Protocol
              </span>
            </div>
          </div>
        </main>

        <footer className="text-center text-[11px] font-mono text-[#94A3B8] pb-4">
          Community Microgrid EnergyOS • Operator Substation 04
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 3. AUTHENTICATED OPERATOR CONTROL ROOM
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] p-4 sm:p-6 lg:p-8 selection:bg-[#3A7D5C]/20">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D8D8DE] pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-white border border-[#D8D8DE] hover:bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] transition shadow-xs"
              title="Return to Microgrid Simulation"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20 mb-1.5 font-mono">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Authorized Session • Substation SCADA Console</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F]">
                Microgrid Dispatch &amp; Islanding Console
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3.5 py-2 rounded-xl bg-white border border-[#D8D8DE] shadow-xs flex items-center gap-2 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#27845B] animate-pulse" />
              <span className="text-[#6E6E73]">
                Grid: <strong className="text-[#1D1D1F]">{isSocietyOutage ? "Islanded (33kV Out)" : "Nominal (50.02 Hz)"}</strong>
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#D8D8DE] hover:bg-[#F8FAFC] text-[#DC2626] text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="End session and lock console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>

        {/* Top Control Deck: 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
          {/* Card 1: Society Outage / Substation Feeder */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Substation Feeder Breaker
                </span>
                <ShieldAlert className={`w-5 h-5 ${isSocietyOutage ? "text-[#DC2626]" : "text-[#16A34A]"}`} />
              </div>
              <div className="text-lg font-semibold text-[#1D1D1F]">
                {isSocietyOutage ? "Utility Outage Active" : "Grid Synchronized (Nominal)"}
              </div>
              <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                {isSocietyOutage
                  ? "Main 33kV utility feeder disconnected. Non-solar consumers are blacked out; solar prosumers operate autonomously on battery."
                  : "Microgrid synchronized with central utility feeder. All residential nodes receiving nominal electricity supply."}
              </p>
            </div>

            <button
              onClick={isSocietyOutage ? restoreSocietyGrid : triggerSocietyOutage}
              className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                isSocietyOutage
                  ? "bg-[#16A34A] hover:bg-[#15803D] text-white"
                  : "bg-[#DC2626] hover:bg-[#B91C1C] text-white"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{isSocietyOutage ? "Restore 33kV Utility Supply" : "Simulate Society Outage"}</span>
            </button>
          </div>

          {/* Card 2: Prosumer Auto-Accept Engine */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Matching Engine Auto-Accept
                </span>
                <Sliders className="w-5 h-5 text-[#5277D5]" />
              </div>
              <div className="text-lg font-semibold text-[#1D1D1F]">
                {autoAcceptEnabled ? "2-Second Delay Auto-Accept" : "Manual Operator Mode"}
              </div>
              <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                {autoAcceptEnabled
                  ? "Incoming emergency energy requests are automatically accepted by the nearest prosumer after a 2s simulated network delay."
                  : "Prosumers remain in 'pinged' state until manually accepted or denied, with a 30s timeout fallback to the next nearest prosumer."}
              </p>
            </div>

            <button
              onClick={() => toggleAutoAcceptAction()}
              className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
                autoAcceptEnabled
                  ? "bg-[#27845B] hover:bg-[#1E6948] text-white"
                  : "bg-[#F8FAFC] hover:bg-white text-[#64748B] border border-[#CBD5E1]"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autoAcceptEnabled ? "bg-white animate-pulse" : "bg-[#94A3B8]"}`} />
              <span>Auto-Accept: {autoAcceptEnabled ? "ENABLED (2s Delay)" : "DISABLED (Manual)"}</span>
            </button>
          </div>

          {/* Card 3: Batch Feeder Isolation */}
          <div className="p-6 rounded-3xl bg-white border border-[#D8D8DE] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Feeder Line Isolation
                </span>
                <Scissors className="w-5 h-5 text-[#D97706]" />
              </div>
              <div className="text-lg font-semibold text-[#1D1D1F]">
                {cutLines.length > 0 ? `${cutLines.length} House Feeder Lines Severed` : "All Lines Intact"}
              </div>
              <p className="text-xs text-[#6E6E73] mt-1 leading-relaxed">
                Simulate physical line dropouts on parcel boundaries. Severed houses are isolated from the central microgrid conduit.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                onClick={() => cutLinesAction(HOUSES_CONFIG.map((h) => h.householdId))}
                className="py-2.5 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Cut All</span>
              </button>
              <button
                onClick={() => restoreLinesAction(HOUSES_CONFIG.map((h) => h.householdId))}
                className="py-2.5 rounded-xl bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore All</span>
              </button>
            </div>
          </div>
        </div>

        {/* 12 Ausgrid Residential Nodes Telemetry Table */}
        <div className="bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#27845B]" />
                <span>12 Ausgrid Residential Nodes Telemetry</span>
              </h3>
              <span className="text-xs text-[#6E6E73]">
                Live Ausgrid smart meter readings (kWh per 30m tick), battery SoC, and power routing status.
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#D8D8DE] hover:bg-white text-xs font-mono text-[#6E6E73] hover:text-[#1D1D1F] transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Telemetry</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="uppercase text-[#6E6E73] bg-[#F5F5F7] border-b border-[#E5E5EA] text-[11px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3.5 rounded-l-lg font-semibold">Node</th>
                  <th className="py-2.5 px-3.5 font-semibold">Ausgrid #</th>
                  <th className="py-2.5 px-3.5 font-semibold">Role</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Solar (kWh)</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Load (kWh)</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Net Balance</th>
                  <th className="py-2.5 px-3.5 text-right font-semibold">Battery Storage</th>
                  <th className="py-2.5 px-3.5 text-center font-semibold">Power State</th>
                  <th className="py-2.5 px-3.5 rounded-r-lg text-right font-semibold">Line Feeder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEF]">
                {houses.map((h) => {
                  const isSevered = cutLines.includes(h.householdId) || h.powerState === "line_cut";
                  return (
                    <tr key={h.id} className="hover:bg-[#F5F5F7]/80 transition">
                      <td className="py-3 px-3.5 font-bold text-[#1D1D1F]">{h.id}</td>
                      <td className="py-3 px-3.5 text-[#6E6E73]">#{h.householdId}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            h.type === "prosumer"
                              ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20"
                              : "bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20"
                          }`}
                        >
                          {h.type}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-[#D97706] font-semibold text-right tabular-nums">
                        {h.solarKwh.toFixed(2)}
                      </td>
                      <td className="py-3 px-3.5 text-[#1D1D1F] text-right tabular-nums">
                        {h.usageKwh.toFixed(2)}
                      </td>
                      <td
                        className={`py-3 px-3.5 font-bold text-right tabular-nums ${
                          h.surplusKwh >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                        }`}
                      >
                        {h.surplusKwh >= 0 ? `+${h.surplusKwh.toFixed(2)}` : h.surplusKwh.toFixed(2)}
                      </td>
                      <td className="py-3 px-3.5 text-right tabular-nums font-semibold">
                        {h.type === "prosumer" ? (
                          <span className="text-[#1D1D1F]">
                            {h.batteryKwh.toFixed(1)} / {h.batteryCapacityKwh.toFixed(1)} kWh
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase inline-block ${
                            h.powerState === "blackout"
                              ? "bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 animate-pulse"
                              : h.powerState === "line_cut"
                              ? "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20"
                              : h.powerState === "battery"
                              ? "bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/20"
                              : "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                          }`}
                        >
                          {h.powerState}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        {isSevered ? (
                          <button
                            onClick={() => restoreLinesAction([h.householdId])}
                            className="px-2 py-0.5 rounded bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 text-[10px] font-bold transition cursor-pointer"
                          >
                            Reconnect
                          </button>
                        ) : (
                          <button
                            onClick={() => cutLinesAction([h.householdId])}
                            className="px-2 py-0.5 rounded bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[10px] font-bold transition cursor-pointer"
                          >
                            Cut Line
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Requests & Audit Stream */}
        <div className="bg-white rounded-3xl border border-[#D8D8DE] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-3 flex-wrap gap-2">
            <span className="text-[#1D1D1F] font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#3A7D5C] animate-pulse" />
              <span>Real-Time P2P Energy Requests Audit Stream</span>
            </span>
            <span className="text-[11px] text-[#6E6E73]">
              Active Requests: {energyRequests.length}
            </span>
          </div>
          <div className="space-y-1.5 bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0] max-h-56 overflow-y-auto">
            {energyRequests.length === 0 ? (
              <div className="text-[#94A3B8] text-center py-4">No active P2P energy requests logged.</div>
            ) : (
              energyRequests.map((req) => (
                <div key={req.id} className="text-[#64748B] hover:text-[#1D1D1F] transition text-[11px] flex items-center justify-between">
                  <span>
                    [{new Date(req.created_at).toLocaleTimeString()}] Household #{req.requester_household_id} requested {req.units_kwh} kWh &rarr; Candidate #{req.current_candidate_household_id || "None"} [{req.status.toUpperCase()}]
                  </span>
                  {req.tx_hash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${req.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5277D5] hover:underline"
                    >
                      {req.tx_hash.slice(0, 8)}... ↗
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
