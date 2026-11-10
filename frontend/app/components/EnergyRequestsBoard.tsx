"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  BatteryCharging,
  MapPin,
  RefreshCw,
  Sliders,
  Check,
  ExternalLink,
} from "lucide-react";
import { useMicrogridData, EnergyRequest } from "../hooks/useMicrogridData";
import { HOUSES_CONFIG, HouseConfig } from "../config/houses";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export default function EnergyRequestsBoard() {
  const {
    houses,
    energyRequests,
    autoAcceptEnabled,
    toggleAutoAcceptAction,
    createEnergyRequestAction,
    respondEnergyRequestAction,
    settleEnergyRequestAction,
    fetchEnergyRequests,
  } = useMicrogridData();

  const [activeTab, setActiveTab] = useState<"all" | "active" | "accepted" | "history">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // Form state for creating an energy request
  const [selectedRequesterId, setSelectedRequesterId] = useState<number>(18); // Default C1 (18)
  const [durationHours, setDurationHours] = useState<number>(4.0);
  const [requestedKwh, setRequestedKwh] = useState<string>("3.80");
  const [isLoadingEstimate, setIsLoadingEstimate] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Fetch estimated kWh for the selected house when requester or duration changes
  useEffect(() => {
    let isCancelled = false;
    async function loadEstimate() {
      setIsLoadingEstimate(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/backup/estimate?hours=${durationHours}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && Array.isArray(json.needs)) {
            const need = json.needs.find((n: { household_id: number }) => n.household_id === selectedRequesterId);
            if (need && need.need_kwh) {
              setRequestedKwh(need.need_kwh.toFixed(2));
            }
          }
        }
      } catch {
        // Fallback calculation
        if (!isCancelled) {
          setRequestedKwh((0.95 * durationHours).toFixed(2));
        }
      } finally {
        if (!isCancelled) setIsLoadingEstimate(false);
      }
    }

    if (isModalOpen) {
      loadEstimate();
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedRequesterId, durationHours, isModalOpen]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const kwh = parseFloat(requestedKwh);
    if (!kwh || kwh <= 0) {
      setSubmitError("Please enter a valid energy amount in kWh.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await createEnergyRequestAction({
      requesterHouseholdId: selectedRequesterId,
      unitsKwh: kwh,
      durationHours,
      priceEth: 0.0001,
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsModalOpen(false);
      setActionSuccessMsg(`Energy request for ${kwh} kWh dispatched! Nearest prosumer pinged.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } else {
      setSubmitError(result.error || "Failed to submit request.");
    }
  };

  const handleRespond = async (requestId: string, decision: "accept" | "deny", householdId: number) => {
    const res = await respondEnergyRequestAction(requestId, decision, householdId);
    if (res.success) {
      setActionSuccessMsg(`Prosumer ${decision === "accept" ? "ACCEPTED" : "DENIED"} request.`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    }
  };

  const handleSettle = async (requestId: string) => {
    setSettlingId(requestId);
    const result = await settleEnergyRequestAction(requestId);
    setSettlingId(null);
    if (result.success) {
      setActionSuccessMsg(`Trade settled on Sepolia! TxHash: ${result.txHash ? result.txHash.slice(0, 10) + '...' : 'Confirmed'}`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } else {
      setActionSuccessMsg(`Settlement error: ${result.error}`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    }
  };

  // Filter requests
  const filteredRequests = useMemo(() => {
    if (activeTab === "active") {
      return energyRequests.filter((r) => r.status === "open" || r.status === "pinged");
    }
    if (activeTab === "accepted") {
      return energyRequests.filter((r) => r.status === "accepted" || r.status === "settling");
    }
    if (activeTab === "history") {
      return energyRequests.filter((r) => r.status === "settled" || r.status === "unfulfilled" || r.status === "denied");
    }
    return energyRequests;
  }, [energyRequests, activeTab]);

  const consumers = HOUSES_CONFIG.filter((h) => h.type === "consumer");

  return (
    <section id="orderbook" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
      {/* Anchor for nav compatibility */}
      <span id="requests" className="block -mt-24 pt-24" />

      {/* Header & Badges */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20 mb-3">
            <Zap className="w-3.5 h-3.5 fill-[#3A7D5C]/20" />
            <span>Nearest-Prosumer Matching Engine • IEEE 2030.7</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F]">
            P2P Energy Requests Board
          </h2>
          <p className="text-sm text-[#6E6E73] mt-1.5 max-w-2xl">
            Live demand dispatch board. Blacked-out or islanded consumers broadcast emergency energy requests.
            The engine prioritizes the nearest prosumer with available battery storage using 3D Euclidean coordinates.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => toggleAutoAcceptAction()}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-medium border transition-all flex items-center gap-2 cursor-pointer ${
              autoAcceptEnabled
                ? "bg-[#3A7D5C]/10 border-[#3A7D5C]/30 text-[#27845B] hover:bg-[#3A7D5C]/15"
                : "bg-white border-[#D8D8DE] text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
            title="Toggle whether prosumers automatically accept incoming pings after 2s network delay"
          >
            <span className={`w-2 h-2 rounded-full ${autoAcceptEnabled ? "bg-[#27845B] animate-pulse" : "bg-[#94A3B8]"}`} />
            <span>Auto-Accept (2s delay): {autoAcceptEnabled ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] active:scale-98 text-white text-xs font-medium font-mono transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#3A7D5C]" />
            <span>New Energy Request</span>
          </button>

          <button
            onClick={() => fetchEnergyRequests()}
            className="p-2 rounded-xl bg-white border border-[#D8D8DE] text-[#6E6E73] hover:text-[#1D1D1F] transition cursor-pointer"
            title="Refresh requests"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="mb-6 p-3.5 rounded-xl bg-[#3A7D5C]/10 border border-[#3A7D5C]/20 text-[#27845B] text-xs font-mono flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-[#27845B] hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Counter */}
      <div className="flex items-center justify-between gap-4 border-b border-[#D8D8DE] pb-3 mb-6">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "all" ? "bg-white border border-[#D8D8DE] font-semibold text-[#1D1D1F] shadow-xs" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            All Requests ({energyRequests.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "active" ? "bg-white border border-[#D8D8DE] font-semibold text-[#1D1D1F] shadow-xs" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Active Pings ({energyRequests.filter((r) => r.status === "open" || r.status === "pinged").length})
          </button>
          <button
            onClick={() => setActiveTab("accepted")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "accepted" ? "bg-white border border-[#D8D8DE] font-semibold text-[#1D1D1F] shadow-xs" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            Accepted ({energyRequests.filter((r) => r.status === "accepted" || r.status === "settling").length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "history" ? "bg-white border border-[#D8D8DE] font-semibold text-[#1D1D1F] shadow-xs" : "text-[#6E6E73] hover:text-[#1D1D1F]"
            }`}
          >
            History ({energyRequests.filter((r) => r.status === "settled" || r.status === "unfulfilled" || r.status === "denied").length})
          </button>
        </div>

        <span className="text-[11px] font-mono text-[#86868B] hidden sm:block">
          Fixed Settlement: <span className="font-semibold text-[#1D1D1F]">0.000100 SepoliaETH</span> / trade
        </span>
      </div>

      {/* Main Board Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white border border-[#D8D8DE] rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] border border-[#D8D8DE] flex items-center justify-center mx-auto mb-3.5 text-[#86868B]">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-[#1D1D1F]">No Energy Requests Found</h3>
          <p className="text-xs text-[#6E6E73] mt-1 max-w-sm mx-auto">
            Click &ldquo;New Energy Request&rdquo; above or select any blacked-out consumer in the 3D neighbourhood to request emergency backup energy.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1D1D1F] text-white text-xs font-mono font-medium hover:bg-[#343438] transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#3A7D5C]" />
            <span>Create First Request</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-[#D8D8DE] rounded-2xl overflow-hidden shadow-xs divide-y divide-[#E2E8F0]">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-[#F8FAFC] text-[11px] font-mono font-semibold text-[#64748B] uppercase tracking-wider">
            <div className="col-span-3">Requester Household</div>
            <div className="col-span-2">Energy &amp; Duration</div>
            <div className="col-span-2">Candidate Prosumer</div>
            <div className="col-span-3">Routing &amp; Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Request Rows */}
          {filteredRequests.map((req) => {
            const requesterCfg = HOUSES_CONFIG.find((h) => h.householdId === req.requester_household_id);
            const candidateCfg = req.current_candidate_household_id
              ? HOUSES_CONFIG.find((h) => h.householdId === req.current_candidate_household_id)
              : null;
            const currentCandidate = req.candidates.find(
              (c) => c.household_id === req.current_candidate_household_id
            );

            return (
              <div
                key={req.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-5 sm:px-6 py-4 items-center hover:bg-[#F8FAFC] transition-colors"
              >
                {/* Requester Household */}
                <div className="md:col-span-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F5F5F7] border border-[#D8D8DE] flex items-center justify-center shrink-0">
                    <span className="text-xs font-mono font-bold text-[#1D1D1F]">
                      {requesterCfg ? requesterCfg.id : `C-${req.requester_household_id}`}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-[#1D1D1F] truncate">
                        {requesterCfg ? requesterCfg.name : `Household #${req.requester_household_id}`}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                        #{req.requester_household_id}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#86868B] block truncate">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Energy & Duration */}
                <div className="md:col-span-2 font-mono text-xs">
                  <div className="font-semibold text-[#1D1D1F]">
                    {req.units_kwh.toFixed(2)} kWh
                  </div>
                  <div className="text-[11px] text-[#64748B] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#94A3B8]" />
                    <span>{req.duration_hours}h window</span>
                  </div>
                </div>

                {/* Candidate Prosumer */}
                <div className="md:col-span-2 font-mono text-xs">
                  {candidateCfg && currentCandidate ? (
                    <div>
                      <div className="font-semibold text-[#1D1D1F] flex items-center gap-1">
                        <span>{candidateCfg.id} (#{candidateCfg.householdId})</span>
                      </div>
                      <div className="text-[11px] text-[#27845B] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{currentCandidate.distance}m away</span>
                        <span className="text-[#94A3B8]">• {currentCandidate.battery_kwh.toFixed(1)} kWh</span>
                      </div>
                    </div>
                  ) : req.status === "unfulfilled" ? (
                    <span className="text-[11px] text-[#DC2626]">No Prosumer Available</span>
                  ) : (
                    <span className="text-[11px] text-[#94A3B8]">Pending Assignment</span>
                  )}
                </div>

                {/* Routing & Status */}
                <div className="md:col-span-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {req.status === "pinged" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#F59E0B]/10 text-[#D97706] border border-[#F59E0B]/30 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                        Pinging Prosumer {currentCandidate ? currentCandidate.code : ""} (30s)
                      </span>
                    )}

                    {req.status === "accepted" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#3A7D5C]/10 text-[#27845B] border border-[#3A7D5C]/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Accepted • Ready for On-Chain Settlement
                      </span>
                    )}

                    {req.status === "settling" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/30">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Settling on Sepolia...
                      </span>
                    )}

                    {req.status === "settled" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#8271B8]/10 text-[#8271B8] border border-[#8271B8]/30">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Settled On-Chain (0.0001 ETH)
                      </span>
                    )}

                    {req.status === "unfulfilled" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Unfulfilled (Prosumers Depleted)
                      </span>
                    )}

                    {req.status === "denied" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-[#94A3B8]/10 text-[#64748B] border border-[#94A3B8]/30">
                        Denied
                      </span>
                    )}
                  </div>

                  {req.candidates.length > 1 && (
                    <div className="mt-1 text-[10px] font-mono text-[#94A3B8]">
                      Candidates ranked: {req.candidates.map((c) => `${c.code}(${c.status})`).join(" → ")}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="md:col-span-2 flex items-center justify-end gap-2">
                  {req.status === "pinged" && req.current_candidate_household_id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRespond(req.id, "accept", req.current_candidate_household_id!)}
                        className="px-2.5 py-1 rounded-lg bg-[#27845B]/10 hover:bg-[#27845B]/20 text-[#27845B] border border-[#27845B]/30 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Accept incoming request"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, "deny", req.current_candidate_household_id!)}
                        className="px-2 py-1 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                        title="Deny request and pass to next nearest prosumer"
                      >
                        <X className="w-3 h-3" />
                        <span>Deny</span>
                      </button>
                    </div>
                  )}

                  {req.status === "accepted" && (
                    <button
                      onClick={() => handleSettle(req.id)}
                      disabled={settlingId === req.id}
                      className="px-2.5 py-1.5 rounded-lg bg-[#5277D5] hover:bg-[#3B5BBD] text-white text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-60 shadow-xs"
                      title="Settle trade on Sepolia testnet with test ETH"
                    >
                      {settlingId === req.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Settling...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3 h-3 text-[#FACC15]" />
                          <span>Settle (0.0001 ETH)</span>
                        </>
                      )}
                    </button>
                  )}

                  {req.status === "settling" && (
                    <span className="text-[11px] font-mono text-[#5277D5] flex items-center gap-1.5 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Broadcasting Tx...</span>
                    </span>
                  )}

                  {req.status === "settled" && req.tx_hash && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[#16A34A] font-bold">Settled</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${req.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#5277D5]/10 text-[#5277D5] hover:bg-[#5277D5]/20 text-[10px] font-mono transition"
                        title="View transaction on Sepolia Etherscan"
                      >
                        <span>Etherscan</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= CREATE ENERGY REQUEST MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-[0_24px_48px_rgba(0,0,0,0.18)] max-w-md w-full p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3A7D5C] animate-pulse" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#3A7D5C]">
                Emergency Demand Dispatch
              </span>
            </div>
            <h3 className="text-xl font-semibold text-[#1D1D1F] mb-1">
              Request Energy Backup
            </h3>
            <p className="text-xs text-[#6E6E73] mb-5">
              Broadcast energy demand to the community microgrid. The matching engine pings the closest prosumer with battery surplus.
            </p>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              {/* Requester Household Selector */}
              <div>
                <label className="block text-xs font-mono text-[#64748B] mb-1.5">
                  Select Consumer Household
                </label>
                <select
                  value={selectedRequesterId}
                  onChange={(e) => setSelectedRequesterId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] bg-[#F8FAFC] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#3A7D5C]/30 focus:border-[#3A7D5C]"
                >
                  {consumers.map((c) => (
                    <option key={c.householdId} value={c.householdId}>
                      {c.name} (Ausgrid #{c.householdId}) {c.isShowcase ? "★ Showcase" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Duration Horizon */}
              <div>
                <label className="block text-xs font-mono text-[#64748B] mb-1.5">
                  Backup Duration Horizon
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[2.0, 4.0, 8.0].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDurationHours(h)}
                      className={`py-2 rounded-xl text-xs font-mono font-semibold transition cursor-pointer border ${
                        durationHours === h
                          ? "bg-[#1D1D1F] text-white border-[#1D1D1F]"
                          : "bg-[#F8FAFC] text-[#64748B] border-[#D8D8DE] hover:bg-white"
                      }`}
                    >
                      {h} Hours
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommended Energy Amount (Pre-filled from /api/backup/estimate) */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-mono text-[#64748B]">
                    Energy Required (kWh)
                  </label>
                  {isLoadingEstimate && (
                    <span className="text-[10px] font-mono text-[#3A7D5C] animate-pulse">
                      Estimating via ML API...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="50.0"
                    value={requestedKwh}
                    onChange={(e) => setRequestedKwh(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] bg-white text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#3A7D5C]/30 focus:border-[#3A7D5C]"
                    placeholder="3.80"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-mono text-[#94A3B8]">
                    kWh
                  </span>
                </div>
                <span className="text-[10px] text-[#86868B] font-mono mt-1 block">
                  Pre-filled via ML forecast model for {durationHours}h outage window.
                </span>
              </div>

              {/* Fixed Settlement Price */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center text-[#64748B]">
                  <span>On-Chain Settlement:</span>
                  <span className="font-semibold text-[#1D1D1F]">0.000100 SepoliaETH</span>
                </div>
                <div className="flex justify-between items-center text-[#64748B]">
                  <span>Smart Escrow:</span>
                  <span className="text-[#27845B] font-semibold">Sepolia (11155111)</span>
                </div>
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] text-xs font-mono">
                  {submitError}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D8D8DE] text-xs font-mono text-[#64748B] hover:text-[#1D1D1F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] active:scale-98 text-white text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[#3A7D5C]" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

