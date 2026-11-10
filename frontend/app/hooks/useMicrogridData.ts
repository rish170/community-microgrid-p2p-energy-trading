"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  HOUSES_CONFIG,
  HouseConfig,
  ALL_LIVE_HOUSEHOLD_IDS,
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

export function useMicrogridData() {
  const [houses, setHouses] = useState<HouseLiveState[]>(INITIAL_LIVE_STATE);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isSocietyOutage, setIsSocietyOutage] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isSupabaseConfigured()) {
      setIsLiveConnected(false);
      return;
    }

    // Initial fetch
    fetchLatestTelemetry();

    // Subscribe to Realtime events across readings, forecasts, grid_events, and house_status
    const channel = supabase.channel("microgrid_3d_live_feed");
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
                } else if (isSocietyOutage || h.powerState === "battery") {
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
      .subscribe((status) => {
        setIsLiveConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchLatestTelemetry, isSocietyOutage]);

  return {
    houses,
    setHouses,
    isLiveConnected,
    isSocietyOutage,
    lastTickTime,
    triggerSocietyOutage,
    restoreSocietyGrid,
    refetch: fetchLatestTelemetry,
  };
}
