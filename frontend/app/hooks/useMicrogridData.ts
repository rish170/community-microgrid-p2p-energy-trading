"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  HOUSES_CONFIG,
  HouseConfig,
  ALL_LIVE_HOUSEHOLD_IDS,
  SOLAR_HOUSEHOLD_IDS,
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
// House C6 (Household 141) starts with mock blackout to demonstrate consumer islanding
const INITIAL_LIVE_STATE: HouseLiveState[] = HOUSES_CONFIG.map((cfg) => {
  const isSolar = cfg.type === "prosumer";
  const isMockBlackout = cfg.id === "C6";
  const solarKwh = isSolar ? (cfg.id === "P3" ? 4.2 : cfg.id === "P1" ? 3.2 : 2.8) : 0.0;
  const usageKwh = isSolar ? (cfg.id === "P3" ? 1.1 : 0.9) : (cfg.id === "C1" ? 1.2 : cfg.id === "C6" ? 1.5 : 1.4);
  const netKwh = Number((usageKwh - solarKwh).toFixed(2));
  const surplusKwh = Number((-netKwh).toFixed(2));

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
    powerState: isMockBlackout ? "blackout" : "grid",
    batteryKwh: isSolar ? (cfg.initialBatteryKwh ?? 4.5) : 0,
    batteryCapacityKwh: isSolar ? (cfg.batteryCapacityKwh ?? 6.0) : 0,
    isOutage: isMockBlackout,
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

export function useMicrogridData() {
  const [houses, setHouses] = useState<HouseLiveState[]>(INITIAL_LIVE_STATE);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isSocietyOutage, setIsSocietyOutage] = useState<boolean>(false);
  const [cutLines, setCutLines] = useState<number[]>([]);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const [energyRequests, setEnergyRequests] = useState<EnergyRequest[]>([]);
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState<boolean>(true);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);
  const isSocietyOutageRef = useRef<boolean>(isSocietyOutage);

  useEffect(() => {
    isSocietyOutageRef.current = isSocietyOutage;
  }, [isSocietyOutage]);

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
          }
          if (Array.isArray(json.cutLines)) {
            setCutLines(json.cutLines.map(Number));
          }
          if (Array.isArray(json.houses) && json.houses.length > 0) {
            setHouses((prev) =>
              prev.map((h) => {
                const remote = json.houses.find(
                  (r: { household_id: number }) => r.household_id === h.householdId
                );
                if (!remote) return h;
                const pState = remote.power_state as HouseLiveState["powerState"];
                return {
                  ...h,
                  powerState: pState,
                  batteryKwh: Number(remote.battery_kwh ?? h.batteryKwh),
                  batteryCapacityKwh: Number(remote.battery_capacity_kwh ?? h.batteryCapacityKwh),
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
      }

      // Check active line cut events in Supabase
      const { data: cutEvents } = await supabase
        .from("grid_events")
        .select("household_id")
        .eq("scope", "house")
        .eq("event_type", "line_cut")
        .is("ended_at", null);

      if (cutEvents) {
        setCutLines(cutEvents.map((e) => Number(e.household_id)).filter(Boolean));
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

          const solar = reading ? Number(reading.gg_kwh) : h.solarKwh;
          const usage = reading ? Number(reading.gc_kwh) + Number(reading.cl_kwh) : h.usageKwh;
          const net = reading ? Number(reading.net_kwh) : Number((usage - solar).toFixed(2));
          const surplus = Number((-net).toFixed(2));

          const powerState = statusRow 
            ? (statusRow.power_state as HouseLiveState["powerState"]) 
            : h.powerState;
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
    setHouses((prev) =>
      prev.map((h) => {
        const isSolar = h.type === "prosumer";
        const powerState: HouseLiveState["powerState"] = isSolar
          ? h.batteryKwh > 0 ? "battery" : "blackout"
          : "blackout";
        return {
          ...h,
          powerState,
          isOutage: powerState === "blackout",
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
    setHouses((prev) =>
      prev.map((h) => ({
        ...h,
        powerState: "grid",
        isOutage: false,
      }))
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

  // Cut Individual or Multi-Selected House Power Lines (M3)
  const cutLinesAction = useCallback(async (householdIds: number[]) => {
    if (!householdIds || householdIds.length === 0) return;
    const numIds = householdIds.map(Number);

    setCutLines((prev) => Array.from(new Set([...prev, ...numIds])));
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

    setCutLines((prev) => prev.filter((id) => !numIds.includes(id)));
    setHouses((prev) =>
      prev.map((h) => {
        if (!numIds.includes(h.householdId)) return h;
        const isSolar = SOLAR_HOUSEHOLD_IDS.includes(h.householdId);
        const powerState: HouseLiveState["powerState"] = isSocietyOutage
          ? isSolar ? "battery" : "blackout"
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
          const powerState = isSocietyOutage ? (isSolar ? "battery" : "blackout") : "grid";
          await supabase
            .from("house_status")
            .update({ power_state: powerState, updated_at: endedAt })
            .eq("household_id", id);
        }
      }
    }
  }, [isSocietyOutage]);

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
              const solar = Number(row.gg_kwh);
              const usage = Number(row.gc_kwh) + Number(row.cl_kwh);
              const net = Number(row.net_kwh);
              const surplus = Number((-net).toFixed(2));

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
            setIsSocietyOutage(!row.ended_at);
          }
          fetchLatestTelemetry();
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

          setHouses((prev) =>
            prev.map((h) => {
              if (h.householdId !== row.household_id) return h;
              return {
                ...h,
                powerState: row.power_state,
                batteryKwh: Number(row.battery_kwh),
                batteryCapacityKwh: Number(row.battery_capacity_kwh),
                isOutage: row.power_state === "blackout" || row.power_state === "line_cut",
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
    cutLinesAction,
    restoreLinesAction,
    refetch: fetchLatestTelemetry,
  };
}
