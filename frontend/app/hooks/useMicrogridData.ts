"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  HOUSES_CONFIG,
  HouseConfig,
  ALL_LIVE_HOUSEHOLD_IDS,
} from "../config/houses";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

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
const INITIAL_LIVE_STATE: HouseLiveState[] = HOUSES_CONFIG.map((cfg) => {
  const isSolar = cfg.type === "prosumer";
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
    powerState: "grid",
    batteryKwh: isSolar ? (cfg.initialBatteryKwh ?? 4.5) : 0,
    batteryCapacityKwh: isSolar ? (cfg.batteryCapacityKwh ?? 6.0) : 0,
    isOutage: false,
    lastUpdated: new Date().toISOString(),
  };
});

export function useMicrogridData() {
  const [houses, setHouses] = useState<HouseLiveState[]>(INITIAL_LIVE_STATE);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null>(null);

  const fetchLatestTelemetry = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      // 1. Fetch household wallet addresses
      const { data: householdsData, error: hhErr } = await supabase
        .from("households")
        .select("household_id, wallet_address")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS);

      if (hhErr) {
        console.warn("[EnergyOS] Error fetching households:", hhErr.message);
      }

      // 2. Fetch latest readings for each of the 12 live houses
      const { data: readingsData, error: readErr } = await supabase
        .from("consumption_readings")
        .select("household_id, ts, gc_kwh, cl_kwh, gg_kwh, net_kwh")
        .in("household_id", ALL_LIVE_HOUSEHOLD_IDS)
        .order("ts", { ascending: false })
        .limit(36);

      if (readErr) {
        console.warn("[EnergyOS] Error fetching readings:", readErr.message);
      }

      // 3. Fetch latest forecasts
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

          if (!reading && !hh && !forecast) return h;

          const solar = reading ? Number(reading.gg_kwh) : h.solarKwh;
          const usage = reading ? Number(reading.gc_kwh) + Number(reading.cl_kwh) : h.usageKwh;
          const net = reading ? Number(reading.net_kwh) : Number((usage - solar).toFixed(2));
          const surplus = Number((-net).toFixed(2));

          return {
            ...h,
            solarKwh: Number(solar.toFixed(2)),
            usageKwh: Number(usage.toFixed(2)),
            netKwh: Number(net.toFixed(2)),
            surplusKwh: surplus,
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
      console.warn("[EnergyOS] Failed to query initial Supabase data:", err);
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

    // Subscribe to Realtime events
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

              return {
                ...h,
                solarKwh: Number(solar.toFixed(2)),
                usageKwh: Number(usage.toFixed(2)),
                netKwh: Number(net.toFixed(2)),
                surplusKwh: surplus,
                lastUpdated: row.ts,
              };
            })
          );
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
    lastTickTime,
    refetch: fetchLatestTelemetry,
  };
}
