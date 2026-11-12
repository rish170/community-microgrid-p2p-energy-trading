"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  HOUSES_CONFIG,
  HouseConfig,
  ALL_LIVE_HOUSEHOLD_IDS,
  SOLAR_HOUSEHOLD_IDS,
  CONSUMER_HOUSEHOLD_IDS,
} from "../config/houses";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export interface HouseLiveState extends HouseConfig {
  solarKwh: number; // gg_kwh
  usageKwh: number; // gc_kwh + cl_kwh
  netKwh: number; // gc + cl - gg (positive = importing, negative = exporting)
  surplusKwh: number; // -netKwh (positive = export surplus, negative = deficit)
  predictedConsumptionKwh?: number;
  predictedGenerationKwh?: number;
  walletAddress: string;
  powerState: "grid" | "battery" | "blackout" | "line_cut";
  batteryKwh: number;
  batteryCapacityKwh: number;
  isOutage: boolean;
  lastUpdated?: string;
}

export interface EnergyRequestCandidate {
  household_id: number;
  code: string;
  distance: number;
  battery_kwh: number;
  status: "pending" | "pinged" | "denied" | "timeout" | "accepted";
}

export interface EnergyRequest {
  id: string;
  requester_household_id: number;
  requester_code?: string;
  units_kwh: number;
  duration_hours: number;
  price_eth_per_kwh: number;
  total_price_eth: number;
  status: "open" | "pinged" | "accepted" | "settling" | "settled" | "denied" | "unfulfilled" | "cancelled";
  current_candidate_household_id: number | null;
  candidates: EnergyRequestCandidate[];
  tx_hash?: string | null;
  created_at: string;
  updated_at: string;
}

// Initial realistic baseline state for the 12 houses before live ticks arrive
const INITIAL_LIVE_STATE: HouseLiveState[] = HOUSES_CONFIG.map((cfg) => {
  const isSolar = cfg.type === "prosumer";
  const solarKwh = isSolar 
    ? (cfg.id === "P3" ? 4.2 : cfg.id === "P6" ? 3.6 : cfg.id === "P1" ? 3.4 : 3.0) 
    : 0.0;
  const usageKwh = isSolar 
    ? (cfg.id === "P3" ? 1.1 : 0.9) 
    : (cfg.id === "C1" ? 1.2 : cfg.id === "C6" ? 1.4 : 1.3);
  const netKwh = Number((usageKwh - solarKwh).toFixed(2));
  const surplusKwh = Number((solarKwh - usageKwh).toFixed(2));

  // Default addresses highlighting showcase houses P3, C1, C2
  let walletAddress = `0x${cfg.householdId.toString(16).padStart(4, "0")}...${cfg.householdId * 1111}`;
  if (cfg.id === "P3") walletAddress = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  if (cfg.id === "C1") walletAddress = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";
  if (cfg.id === "C2") walletAddress = "0x22B34E12a900fa2b585dd299e03d12FA4293BC";

  return {
    ...cfg,
    solarKwh,
    usageKwh,
    netKwh,
    surplusKwh,
    walletAddress,
    powerState: "grid",
    batteryKwh: isSolar ? (cfg.initialBatteryKwh ?? 4.5) : 0,
    batteryCapacityKwh: isSolar ? (cfg.batteryCapacityKwh ?? 6.0) : 0,
    isOutage: false,
    lastUpdated: new Date().toISOString(),
  };
});

async function safeParseJson(res: Response) {
  const cType = res.headers.get("content-type") || "";
  if (cType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned HTTP ${res.status}: ${text.slice(0, 80)}`);
  }
}

function useMicrogridDataHookInternal() {
  const [houses, setHouses] = useState<HouseLiveState[]>(INITIAL_LIVE_STATE);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isSocietyOutage, setIsSocietyOutage] = useState<boolean>(false);
  const [cutLines, setCutLines] = useState<number[]>([]);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const [energyRequests, setEnergyRequests] = useState<EnergyRequest[]>([]);
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState<boolean>(true);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);
  const isSocietyOutageRef = useRef<boolean>(isSocietyOutage);
  const cutLinesRef = useRef<number[]>(cutLines);

  useEffect(() => {
    isSocietyOutageRef.current = isSocietyOutage;
  }, [isSocietyOutage]);

  useEffect(() => {
    cutLinesRef.current = cutLines;
  }, [cutLines]);

  // Sync initial auto-accept setting from backend
  useEffect(() => {
    async function loadAutoAccept() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/requests/admin/auto-accept`);
        if (res.ok) {
          const json = await safeParseJson(res);
          if (typeof json.autoAccept === "boolean") {
            setAutoAcceptEnabled(json.autoAccept);
          }
        }
      } catch {
        // Fallback default
      }
    }
    loadAutoAccept();
  }, []);

  const toggleAutoAcceptAction = useCallback(
    async (forcedVal?: boolean) => {
      const nextVal = typeof forcedVal === "boolean" ? forcedVal : !autoAcceptEnabled;
      setAutoAcceptEnabled(nextVal);
      try {
        const res = await fetch(`${BACKEND_URL}/api/requests/admin/auto-accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoAccept: nextVal }),
        });
        if (res.ok) {
          const json = await safeParseJson(res);
          if (typeof json.autoAccept === "boolean") {
            setAutoAcceptEnabled(json.autoAccept);
          }
        }
      } catch {
        // Retain optimistic state
      }
    },
    [autoAcceptEnabled]
  );

  const fetchLatestTelemetry = useCallback(async () => {
    // 1. Check backend status endpoint for authoritative grid and house state
    try {
      const res = await fetch(`${BACKEND_URL}/api/status`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          if (typeof json.isSocietyOutage === "boolean") {
            setIsSocietyOutage(json.isSocietyOutage);
            isSocietyOutageRef.current = json.isSocietyOutage;
          }
          if (Array.isArray(json.cutLines)) {
            const parsedCutLines = json.cutLines.map(Number);
            setCutLines(parsedCutLines);
            cutLinesRef.current = parsedCutLines;
          }
          if (Array.isArray(json.houses) && json.houses.length > 0) {
            const isOutage = typeof json.isSocietyOutage === "boolean" ? json.isSocietyOutage : isSocietyOutageRef.current;
            const currentCutLines = Array.isArray(json.cutLines) ? json.cutLines.map(Number) : cutLinesRef.current;

            setHouses((prev) =>
              prev.map((h) => {
                const remote = json.houses.find(
                  (r: { household_id: number }) => r.household_id === h.householdId
                );
                if (!remote) return h;
                let pState = remote.power_state as HouseLiveState["powerState"];
                const remoteBattery = Number(remote.battery_kwh ?? h.batteryKwh);
                const remoteCapacity = Number(remote.battery_capacity_kwh ?? h.batteryCapacityKwh);

                if (isOutage) {
                  pState = h.type === "prosumer"
                    ? (remoteBattery > 0 ? "battery" : "blackout")
                    : "blackout";
                } else if (currentCutLines.includes(h.householdId)) {
                  pState = "line_cut";
                } else if (pState === "blackout" || pState === "line_cut") {
                  pState = "grid";
                }

                return {
                  ...h,
                  powerState: pState,
                  batteryKwh: remoteBattery,
                  batteryCapacityKwh: remoteCapacity,
                  isOutage: pState === "blackout" || pState === "line_cut",
                };
              })
            );
          }
        }
      }
    } catch {
      // Backend not running, proceed directly to Supabase client
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      // 2. Check active society outage events in Supabase
      const { data: eventData } = await supabase
        .from("grid_events")
        .select("*")
        .eq("scope", "society")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      if (eventData && eventData.length > 0) {
        setIsSocietyOutage(true);
        isSocietyOutageRef.current = true;
      }

      // Check active line cut events in Supabase
      const { data: cutEvents } = await supabase
        .from("grid_events")
        .select("household_id")
        .eq("scope", "house")
        .eq("event_type", "line_cut")
        .is("ended_at", null);

      if (cutEvents) {
        const cutIds = cutEvents.map((e) => Number(e.household_id)).filter(Boolean);
        setCutLines(cutIds);
        cutLinesRef.current = cutIds;
      }

      // 3. Fetch persistent house status from Supabase
      const { data: houseStatusData } = await supabase
        .from("house_status")
        .select("*")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS);

      // 4. Fetch household wallet addresses
      const { data: householdsData, error: hhErr } = await supabase
        .from("households")
        .select("household_id, wallet_address")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS);

      if (hhErr) {
        console.warn("[EnergyOS] Error fetching households:", hhErr.message);
      }

      // 5. Fetch latest readings for each of the 12 live houses
      const { data: readingsData, error: readErr } = await supabase
        .from("consumption_readings")
        .select("household_id, ts, gc_kwh, cl_kwh, gg_kwh, net_kwh")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS)
        .order("ts", { ascending: false })
        .limit(36);

      if (readErr) {
        console.warn("[EnergyOS] Error fetching readings:", readErr.message);
      }

      // 6. Fetch latest forecasts
      const { data: forecastsData, error: fcErr } = await supabase
        .from("forecasts")
        .select("household_id, ts, predicted_consumption_kwh, predicted_generation_kwh")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS)
        .order("ts", { ascending: false })
        .limit(24);

      if (fcErr) {
        console.warn("[EnergyOS] Error fetching forecasts:", fcErr.message);
      }

      setHouses((prev) => {
        return prev.map((h) => {
          const hh = householdsData?.find((row) => row.household_id === h.householdId);
          const reading = readingsData?.find((row) => row.household_id === h.householdId);
          const forecast = forecastsData?.find((row) => row.household_id === h.householdId);
          const statusRow = houseStatusData?.find((row) => row.household_id === h.householdId);

          const nominalSolar = h.type === "prosumer"
            ? (h.id === "P3" ? 4.2 : h.id === "P6" ? 3.6 : h.id === "P1" ? 3.4 : 3.0)
            : 0.0;
          const readingSolar = reading ? Number(reading.gg_kwh) : 0;
          const solar = readingSolar > 0 ? readingSolar : (h.type === "prosumer" ? nominalSolar : 0);
          const readingUsage = reading ? Number(reading.gc_kwh) + Number(reading.cl_kwh) : 0;
          const usage = readingUsage > 0 ? readingUsage : h.usageKwh;
          const net = Number((usage - solar).toFixed(2));
          const surplus = Number((solar - usage).toFixed(2));

          let powerState = statusRow 
            ? (statusRow.power_state as HouseLiveState["powerState"]) 
            : h.powerState;

          const isOutageActive = isSocietyOutageRef.current;
          const activeCutLines = cutLinesRef.current;

          // Deterministic state computation prevents loop flipping and glitches
          if (isOutageActive) {
            powerState = h.type === "prosumer"
              ? (h.batteryKwh > 0 ? "battery" : "blackout")
              : "blackout";
          } else if (activeCutLines.includes(h.householdId)) {
            powerState = "line_cut";
          } else {
            // Normal grid operation: cannot be blackout unless line cut or outage is active
            if (powerState === "blackout" || powerState === "line_cut") {
              powerState = "grid";
            }
          }

          const batteryKwh = statusRow ? Number(statusRow.battery_kwh) : h.batteryKwh;
          const batteryCapacityKwh = statusRow ? Number(statusRow.battery_capacity_kwh) : h.batteryCapacityKwh;

          return {
            ...h,
            solarKwh: Number(solar.toFixed(2)),
            usageKwh: Number(usage.toFixed(2)),
            netKwh: Number(net.toFixed(2)),
            surplusKwh: surplus,
            powerState,
            batteryKwh,
            batteryCapacityKwh,
            isOutage: powerState === "blackout" || powerState === "line_cut",
            walletAddress: hh?.wallet_address || h.walletAddress,
            predictedConsumptionKwh: forecast ? Number(forecast.predicted_consumption_kwh) : h.predictedConsumptionKwh,
            predictedGenerationKwh: forecast ? Number(forecast.predicted_generation_kwh) : h.predictedGenerationKwh,
            lastUpdated: reading?.ts || h.lastUpdated,
          };
        });
      });

      if (readingsData && readingsData.length > 0) {
        setLastTickTime(readingsData[0].ts);
      }
    } catch (err: unknown) {
      console.warn("[EnergyOS] Failed to query Supabase data:", err);
    }
  }, []);

  // Trigger Society-Wide Grid Outage
  const triggerSocietyOutage = useCallback(async () => {
    setIsSocietyOutage(true);
    isSocietyOutageRef.current = true;
    setHouses((prev) =>
      prev.map((h) => {
        const isSolar = h.type === "prosumer";
        const powerState: HouseLiveState["powerState"] = isSolar
          ? h.batteryKwh > 0 ? "battery" : "blackout"
          : "blackout";
        return {
          ...h,
          powerState,
          isOutage: true,
        };
      })
    );

    try {
      await fetch(`${BACKEND_URL}/api/outage`, { method: "POST" });
    } catch (err) {
      console.warn("[EnergyOS] Backend offline on outage trigger, persisting to Supabase:", err);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase.from("grid_events").insert({
          scope: "society",
          event_type: "outage",
          started_at: new Date().toISOString(),
        });
      }
    }
  }, []);

  // Restore Society-Wide Grid
  const restoreSocietyGrid = useCallback(async () => {
    setIsSocietyOutage(false);
    isSocietyOutageRef.current = false;
    const activeCutLines = cutLinesRef.current;
    setHouses((prev) =>
      prev.map((h) => {
        const isCut = activeCutLines.includes(h.householdId);
        return {
          ...h,
          powerState: isCut ? "line_cut" : "grid",
          isOutage: isCut,
        };
      })
    );

    try {
      await fetch(`${BACKEND_URL}/api/outage/restore`, { method: "POST" });
    } catch (err) {
      console.warn("[EnergyOS] Backend offline on outage restore, persisting to Supabase:", err);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase
          .from("grid_events")
          .update({ ended_at: new Date().toISOString() })
          .eq("scope", "society")
          .is("ended_at", null);
      }
    }
  }, []);

  // Reset Entire Microgrid to initial baseline state (clears orders, nominal grid, resets battery reserves)
  const resetMicrogridAction = useCallback(async () => {
    setIsSocietyOutage(false);
    isSocietyOutageRef.current = false;
    setCutLines([]);
    cutLinesRef.current = [];
    setEnergyRequests([]);
    setHouses((prev) =>
      prev.map((h) => {
        const isSolar = h.type === "prosumer";
        return {
          ...h,
          powerState: "grid",
          isOutage: false,
          batteryKwh: isSolar ? 4.5 : 0.0,
          batteryCapacityKwh: isSolar ? 6.0 : 0.0,
          isSuppliedByTrade: false,
        };
      })
    );

    try {
      await fetch(`${BACKEND_URL}/api/grid/reset`, { method: "POST" });
    } catch (err) {
      console.warn("[EnergyOS] Backend offline on grid reset:", err);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase
          .from("energy_requests")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }
    }
  }, []);

  // Cut Individual or Multi-Selected House Power Lines (M3)
  const cutLinesAction = useCallback(async (householdIds: number[]) => {
    if (!householdIds || householdIds.length === 0) return;
    const numIds = householdIds.map(Number);
    const updated = Array.from(new Set([...cutLinesRef.current, ...numIds]));
    cutLinesRef.current = updated;
    setCutLines(updated);
    setHouses((prev) =>
      prev.map((h) => {
        if (!numIds.includes(h.householdId)) return h;
        return {
          ...h,
          powerState: "line_cut",
          isOutage: true,
        };
      })
    );

    try {
      await fetch(`${BACKEND_URL}/api/lines/cut`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ household_ids: numIds }),
      });
    } catch (err) {
      console.warn("[EnergyOS] Backend offline on line cut, updating Supabase:", err);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const startedAt = new Date().toISOString();
        const events = numIds.map((id) => ({
          scope: "house",
          household_id: id,
          event_type: "line_cut",
          started_at: startedAt,
        }));
        await supabase.from("grid_events").insert(events);
        for (const id of numIds) {
          await supabase
            .from("house_status")
            .update({ power_state: "line_cut", updated_at: startedAt })
            .eq("household_id", id);
        }
      }
    }
  }, []);

  // Restore Individual or Multi-Selected House Power Lines (M3)
  const restoreLinesAction = useCallback(async (householdIds: number[]) => {
    if (!householdIds || householdIds.length === 0) return;
    const numIds = householdIds.map(Number);
    const updated = cutLinesRef.current.filter((id) => !numIds.includes(id));
    cutLinesRef.current = updated;
    setCutLines(updated);
    const isOutage = isSocietyOutageRef.current;
    setHouses((prev) =>
      prev.map((h) => {
        if (!numIds.includes(h.householdId)) return h;
        const isSolar = SOLAR_HOUSEHOLD_IDS.includes(h.householdId);
        const powerState: HouseLiveState["powerState"] = isOutage
          ? (isSolar ? "battery" : "blackout")
          : "grid";
        return {
          ...h,
          powerState,
          isOutage: powerState === "blackout",
        };
      })
    );

    try {
      await fetch(`${BACKEND_URL}/api/lines/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ household_ids: numIds }),
      });
    } catch (err) {
      console.warn("[EnergyOS] Backend offline on line restore, updating Supabase:", err);
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const endedAt = new Date().toISOString();
        await supabase
          .from("grid_events")
          .update({ ended_at: endedAt })
          .eq("scope", "house")
          .eq("event_type", "line_cut")
          .in("household_id", numIds)
          .is("ended_at", null);

        for (const id of numIds) {
          const isSolar = SOLAR_HOUSEHOLD_IDS.includes(id);
          const powerState = isSocietyOutageRef.current ? (isSolar ? "battery" : "blackout") : "grid";
          await supabase
            .from("house_status")
            .update({ power_state: powerState, updated_at: endedAt })
            .eq("household_id", id);
        }
      }
    }
  }, []);

  const fetchEnergyRequests = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.requests)) {
          setEnergyRequests(json.requests);
          return;
        }
      }
    } catch {
      // Backend offline, fallback to Supabase
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from("energy_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) {
        setEnergyRequests(data as EnergyRequest[]);
      }
    } catch {
      // Supabase table or query error
    }
  }, []);

  const createEnergyRequestAction = useCallback(
    async (params: {
      requesterHouseholdId: number;
      unitsKwh: number;
      durationHours?: number;
      priceEth?: number;
    }) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requester_household_id: params.requesterHouseholdId,
            units_kwh: params.unitsKwh,
            duration_hours: params.durationHours ?? 4.0,
            total_price_eth: params.priceEth ?? 0.0001,
          }),
        });
        const json = await safeParseJson(res);
        if (json.success && json.request) {
          setEnergyRequests((prev) => [
            json.request,
            ...prev.filter((r) => r.id !== json.request.id),
          ]);
          return { success: true, request: json.request };
        }
        return { success: false, error: json.error || "Failed to create request" };
      } catch (err: unknown) {
        // Direct Supabase fallback if backend server is offline or unreachable
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          try {
            const fallbackId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`;
            const now = new Date().toISOString();
            const fallbackReq: EnergyRequest = {
              id: fallbackId,
              requester_household_id: params.requesterHouseholdId,
              units_kwh: params.unitsKwh,
              duration_hours: params.durationHours ?? 4.0,
              price_eth_per_kwh: 0.0001,
              total_price_eth: params.priceEth ?? 0.0001,
              status: "pinged",
              current_candidate_household_id: 282,
              candidates: [
                { household_id: 282, code: "P1", distance: 5.0, battery_kwh: 4.5, status: "pinged" }
              ],
              created_at: now,
              updated_at: now,
            };
            await supabase.from("energy_requests").insert([fallbackReq]);
            setEnergyRequests((prev) => [fallbackReq, ...prev.filter((r) => r.id !== fallbackId)]);
            return { success: true, request: fallbackReq };
          } catch {
            // Ignore fallback error
          }
        }
        const msg = err instanceof Error ? err.message : "Failed to connect to backend";
        return { success: false, error: msg };
      }
    },
    []
  );

  const respondEnergyRequestAction = useCallback(
    async (requestId: string, decision: "accept" | "deny", householdId: number) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/requests/${requestId}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, household_id: householdId }),
        });
        const json = await safeParseJson(res);
        if (json.success && json.request) {
          setEnergyRequests((prev) =>
            prev.map((r) => (r.id === json.request.id ? json.request : r))
          );
          return { success: true, request: json.request };
        }
        return { success: false, error: json.error || "Failed to respond to request" };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to connect to backend";
        return { success: false, error: msg };
      }
    },
    []
  );

  const settleEnergyRequestAction = useCallback(
    async (requestId: string) => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/requests/${requestId}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const json = await safeParseJson(res);
        if (json.success && json.request) {
          setEnergyRequests((prev) =>
            prev.map((r) => (r.id === json.request.id ? json.request : r))
          );
          fetchLatestTelemetry();
          return {
            success: true,
            txHash: json.txHash as string,
            etherscanUrl: json.etherscanUrl as string,
            trade: json.trade,
            request: json.request as EnergyRequest,
          };
        }
        return { success: false, error: json.error || "Failed to settle request" };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to connect to backend";
        return { success: false, error: msg };
      }
    },
    [fetchLatestTelemetry]
  );

  useEffect(() => {
    fetchEnergyRequests();
    const interval = setInterval(fetchEnergyRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchEnergyRequests]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isSupabaseConfigured()) {
      setIsLiveConnected(false);
      return;
    }

    // Initial fetch
    fetchLatestTelemetry();

    // Unique channel topic per hook instance to prevent collision across components on same page
    const uniqueChannelName = `microgrid_feed_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
    const channel = supabase.channel(uniqueChannelName);
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "consumption_readings",
        },
        (payload) => {
          const row = payload.new as {
            household_id: number;
            ts: string;
            gc_kwh: number;
            cl_kwh: number;
            gg_kwh: number;
            net_kwh: number;
          };

          if (!ALL_LIVE_HOUSEHOLD_IDS.includes(row.household_id)) return;

          setLastTickTime(row.ts);
          setHouses((prev) =>
            prev.map((h) => {
              if (h.householdId !== row.household_id) return h;
              const nominalSolar = h.type === "prosumer"
                ? (h.id === "P3" ? 4.2 : h.id === "P6" ? 3.6 : h.id === "P1" ? 3.4 : 3.0)
                : 0.0;
              const readingSolar = Number(row.gg_kwh || 0);
              const solar = readingSolar > 0 ? readingSolar : (h.type === "prosumer" ? nominalSolar : 0);
              const readingUsage = Number(row.gc_kwh || 0) + Number(row.cl_kwh || 0);
              const usage = readingUsage > 0 ? readingUsage : h.usageKwh;
              const net = Number((usage - solar).toFixed(2));
              const surplus = Number((solar - usage).toFixed(2));

              // Realtime Battery physics
              let batteryKwh = h.batteryKwh;
              let powerState = h.powerState;
              if (h.type === "prosumer") {
                if (surplus > 0) {
                  batteryKwh = Math.min(h.batteryCapacityKwh, Number((batteryKwh + surplus).toFixed(2)));
                } else if (isSocietyOutageRef.current || h.powerState === "battery" || h.powerState === "line_cut") {
                  batteryKwh = Math.max(0, Number((batteryKwh + surplus).toFixed(2)));
                  if (batteryKwh <= 0 && solar < usage) {
                    powerState = "blackout";
                  }
                }
              }

              return {
                ...h,
                solarKwh: Number(solar.toFixed(2)),
                usageKwh: Number(usage.toFixed(2)),
                netKwh: Number(net.toFixed(2)),
                surplusKwh: surplus,
                batteryKwh,
                powerState,
                isOutage: powerState === "blackout" || powerState === "line_cut",
                lastUpdated: row.ts,
              };
            })
          );

          // Sync tick with backend battery model
          fetch(`${BACKEND_URL}/api/tick-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ readings: [row] }),
          }).catch(() => {});
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "forecasts",
        },
        (payload) => {
          const row = payload.new as {
            household_id: number;
            predicted_consumption_kwh: number;
            predicted_generation_kwh: number;
          };

          if (!ALL_LIVE_HOUSEHOLD_IDS.includes(row.household_id)) return;

          setHouses((prev) =>
            prev.map((h) => {
              if (h.householdId !== row.household_id) return h;
              return {
                ...h,
                predictedConsumptionKwh: Number(row.predicted_consumption_kwh),
                predictedGenerationKwh: Number(row.predicted_generation_kwh),
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grid_events",
        },
        (payload) => {
          const row = (payload.new || payload.old) as {
            scope?: string;
            event_type?: string;
            household_id?: number;
            ended_at?: string | null;
          };
          if (row && row.scope === "society") {
            const active = !row.ended_at;
            setIsSocietyOutage(active);
            isSocietyOutageRef.current = active;
            setHouses((prev) =>
              prev.map((h) => {
                const isSolar = h.type === "prosumer";
                const pState: HouseLiveState["powerState"] = active
                  ? (isSolar ? (h.batteryKwh > 0 ? "battery" : "blackout") : "blackout")
                  : (cutLinesRef.current.includes(h.householdId) ? "line_cut" : "grid");
                return {
                  ...h,
                  powerState: pState,
                  isOutage: pState === "blackout" || pState === "line_cut",
                };
              })
            );
          } else if (row && (row.scope === "house" || row.event_type === "line_cut" || row.event_type === "line_restore")) {
            const targetId = Number(row.household_id);
            if (targetId) {
              const isCut = (row.event_type === "line_cut" && !row.ended_at && payload.eventType !== "DELETE");
              setCutLines((prev) => {
                const updated = isCut
                  ? Array.from(new Set([...prev, targetId]))
                  : prev.filter((id) => id !== targetId);
                cutLinesRef.current = updated;
                return updated;
              });
              setHouses((prev) =>
                prev.map((h) => {
                  if (h.householdId !== targetId) return h;
                  const isSolar = h.type === "prosumer";
                  const pState: HouseLiveState["powerState"] = isCut
                    ? "line_cut"
                    : (isSocietyOutageRef.current ? (isSolar ? (h.batteryKwh > 0 ? "battery" : "blackout") : "blackout") : "grid");
                  return {
                    ...h,
                    powerState: pState,
                    isOutage: pState === "blackout" || pState === "line_cut",
                  };
                })
              );
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "house_status",
        },
        (payload) => {
          const row = payload.new as {
            household_id: number;
            power_state: HouseLiveState["powerState"];
            battery_kwh: number;
            battery_capacity_kwh: number;
          };
          if (!row || !row.household_id) return;

          const isOutage = isSocietyOutageRef.current;
          const isCut = cutLinesRef.current ? cutLinesRef.current.includes(row.household_id) : false;

          let safePowerState = row.power_state;
          if (isOutage) {
            safePowerState = CONSUMER_HOUSEHOLD_IDS.includes(row.household_id)
              ? "blackout"
              : (Number(row.battery_kwh) > 0 ? "battery" : "blackout");
          } else if (row.power_state === "line_cut" || isCut) {
            safePowerState = "line_cut";
            if (!cutLinesRef.current.includes(row.household_id)) {
              const next = [...cutLinesRef.current, row.household_id];
              cutLinesRef.current = next;
              setCutLines(next);
            }
          } else {
            if (cutLinesRef.current.includes(row.household_id)) {
              const next = cutLinesRef.current.filter((id) => id !== row.household_id);
              cutLinesRef.current = next;
              setCutLines(next);
            }
            if (safePowerState === "blackout" || safePowerState === "line_cut") {
              safePowerState = "grid";
            }
          }

          setHouses((prev) =>
            prev.map((h) => {
              if (h.householdId !== row.household_id) return h;
              return {
                ...h,
                powerState: safePowerState,
                batteryKwh: Number(row.battery_kwh),
                batteryCapacityKwh: Number(row.battery_capacity_kwh),
                isOutage: safePowerState === "blackout" || safePowerState === "line_cut",
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "energy_requests",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as EnergyRequest;
            setEnergyRequests((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as EnergyRequest;
            setEnergyRequests((prev) =>
              prev.map((r) => (r.id === row.id ? row : r))
            );
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as { id?: string };
            if (oldRow && oldRow.id) {
              setEnergyRequests((prev) => prev.filter((r) => r.id !== oldRow.id));
            } else {
              setEnergyRequests([]);
            }
          }
        }
      )
      .subscribe((status) => {
        setIsLiveConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchLatestTelemetry]);

  // Periodic fallback telemetry sync with backend status endpoint (keeps outage and auto-accept 100% in sync)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestTelemetry();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchLatestTelemetry]);

  return {
    houses,
    setHouses,
    isLiveConnected,
    isSocietyOutage,
    cutLines,
    lastTickTime,
    energyRequests,
    autoAcceptEnabled,
    toggleAutoAcceptAction,
    createEnergyRequestAction,
    respondEnergyRequestAction,
    settleEnergyRequestAction,
    fetchEnergyRequests,
    triggerSocietyOutage,
    restoreSocietyGrid,
    resetMicrogridAction,
    cutLinesAction,
    restoreLinesAction,
    refetch: fetchLatestTelemetry,
  };
}

export type MicrogridContextType = ReturnType<typeof useMicrogridDataHookInternal>;

const MicrogridDataContext = createContext<MicrogridContextType | null>(null);

export function MicrogridDataProvider({ children }: { children: React.ReactNode }) {
  const data = useMicrogridDataHookInternal();
  return React.createElement(MicrogridDataContext.Provider, { value: data }, children);
}

export function useMicrogridData(): MicrogridContextType {
  const context = useContext(MicrogridDataContext);
  if (context) {
    return context;
  }
  return useMicrogridDataHookInternal();
}
