const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Sepolia RPC Provider with fallback endpoints
const SEPOLIA_RPCS = [
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  "https://rpc.sepolia.org",
  "https://sepolia.gateway.tenderly.co",
  "https://rpc2.sepolia.org"
];

let provider;
try {
  provider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[0]);
} catch (err) {
  console.warn("Failed to initialize primary Sepolia RPC, using fallback.", err);
  provider = new ethers.JsonRpcProvider(SEPOLIA_RPCS[1]);
}

// Supabase Service Role Client
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[Backend] Supabase service role client initialized successfully.");
  } catch (err) {
    console.warn("[Backend] Failed to initialize Supabase client:", err.message);
  }
} else {
  console.warn("[Backend] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. In-memory state will be used as fallback.");
}

// 12 Live Microgrid Households (Ausgrid dataset IDs)
const SOLAR_HOUSE_IDS = [282, 33, 212, 55, 244, 112];
const CONSUMER_HOUSE_IDS = [18, 26, 48, 90, 117, 141];
const ALL_HOUSE_IDS = [...SOLAR_HOUSE_IDS, ...CONSUMER_HOUSE_IDS];

// In-Memory Authoritative State Fallback (synchronizes with Supabase house_status & grid_events)
const inMemoryGridState = {
  isSocietyOutage: false,
  activeOutageEvent: null,
  cutLines: new Set(),
  houseStatus: new Map(
    ALL_HOUSE_IDS.map((id) => {
      const isSolar = SOLAR_HOUSE_IDS.includes(id);
      const isMockBlackout = id === 141; // C6 starts in blackout as demonstrated in simulation
      return [
        id,
        {
          household_id: id,
          power_state: isMockBlackout ? "blackout" : "grid",
          battery_kwh: isSolar ? 4.5 : 0.0,
          battery_capacity_kwh: isSolar ? 6.0 : 0.0,
          is_supplied_by_trade: false,
          updated_at: new Date().toISOString()
        }
      ];
    })
  )
};

// In-memory trade database
let tradesDatabase = [
  {
    id: "TRD-INIT-01",
    txHash: "0x8b3a7281f6c49e0c19a952d7e48270b2df7e89104c947c61f22e8417c8052de6",
    seller: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    buyer: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    units: 15,
    ethPerUnit: 0.2,
    totalEth: 3.0,
    timestamp: new Date().toISOString(),
    status: "Confirmed",
    network: "Sepolia Testnet (ChainId 11155111)"
  }
];

// Health Check
app.get("/", (req, res) => {
  res.json({
    message: "Community Microgrid P2P Energy Trading API is running",
    status: "success",
    network: "Sepolia Testnet (ChainId 11155111)",
    activeTradesCount: tradesDatabase.length,
  });
});

// GET Wallet Balance on Sepolia
app.get("/api/wallets/balance", async (req, res) => {
  const { address } = req.query;
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid Ethereum address" });
  }

  try {
    const balanceWei = await provider.getBalance(address);
    const balanceEth = parseFloat(ethers.formatEther(balanceWei)).toFixed(4);
    res.json({
      address,
      balanceEth,
      currency: "SepoliaETH",
      network: "Sepolia",
    });
  } catch (error) {
    console.error(`Error querying balance for ${address}:`, error.message);
    res.json({
      address,
      balanceEth: "0.0000",
      error: "Unable to query live balance from RPC",
      currency: "SepoliaETH"
    });
  }
});

// POST Automated On-Chain Trade: Buyer Wallet signs & sends SepoliaETH to Seller Wallet
app.post("/api/trade/execute-auto", async (req, res) => {
  const { 
    prosumerAddress, 
    consumerAddress, 
    buyerPrivateKey, 
    units, 
    ethPerUnit = 0.2, 
    totalEth 
  } = req.body;

  if (!prosumerAddress || !ethers.isAddress(prosumerAddress)) {
    return res.status(400).json({ error: "Invalid Seller (Prosumer) address" });
  }

  const rawKey = buyerPrivateKey || process.env.BUYER_PRIVATE_KEY;
  if (!rawKey) {
    return res.status(400).json({ 
      error: "Missing Buyer (Consumer) private key to authorize automated on-chain transfer" 
    });
  }

  const formattedKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;

  try {
    const buyerWallet = new ethers.Wallet(formattedKey, provider);
    const actualBuyerAddress = buyerWallet.address;
    console.log(`[BACKEND P2P] Buyer Wallet Initialized: ${actualBuyerAddress}`);
    console.log(`[BACKEND P2P] Transferring ${totalEth} SepoliaETH to Seller: ${prosumerAddress}`);

    // Check buyer's Sepolia balance
    const balanceWei = await provider.getBalance(actualBuyerAddress);
    const amountWei = ethers.parseEther(totalEth.toString());

    if (balanceWei < amountWei) {
      const balanceEth = ethers.formatEther(balanceWei);
      return res.status(400).json({
        error: `Insufficient SepoliaETH in Buyer wallet (${actualBuyerAddress}). Balance: ${balanceEth} SepoliaETH, Required: ${totalEth} SepoliaETH`
      });
    }

    // Broadcast on-chain transaction from Buyer to Seller
    const tx = await buyerWallet.sendTransaction({
      to: prosumerAddress,
      value: amountWei
    });

    console.log(`[BACKEND P2P] On-Chain Transaction Broadcasted! TxHash: ${tx.hash}`);

    const tradeId = `TRD-${Date.now().toString().slice(-6)}`;
    const newTrade = {
      id: tradeId,
      txHash: tx.hash,
      seller: prosumerAddress,
      buyer: actualBuyerAddress,
      units: Number(units),
      ethPerUnit: Number(ethPerUnit),
      totalEth: Number(totalEth),
      timestamp: new Date().toISOString(),
      status: "Settled On-Chain",
      verification: "Broadcasted to Sepolia Mempool",
      network: "Sepolia Testnet"
    };

    tradesDatabase.unshift(newTrade);

    res.json({
      success: true,
      message: `Successfully transferred ${totalEth} SepoliaETH from Buyer (${actualBuyerAddress.slice(0, 8)}...) to Seller (${prosumerAddress.slice(0, 8)}...)`,
      txHash: tx.hash,
      trade: newTrade,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
    });

  } catch (err) {
    console.error("[BACKEND P2P] Automated on-chain trade error:", err);
    res.status(500).json({ 
      error: err.message || "Failed to execute on-chain transaction" 
    });
  }
});

// POST Manual / Frontend Signed Trade
app.post("/api/trade/execute", async (req, res) => {
  const { 
    prosumerAddress, 
    consumerAddress, 
    units, 
    ethPerUnit = 0.2, 
    totalEth, 
    txHash 
  } = req.body;

  if (!prosumerAddress || !consumerAddress || !units) {
    return res.status(400).json({ error: "Missing required trade parameters" });
  }

  const tradeId = `TRD-${Date.now().toString().slice(-6)}`;
  let onChainVerification = "Pending/Simulated";
  let blockNumber = null;

  if (txHash && txHash.startsWith("0x")) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        onChainVerification = receipt.status === 1 ? "Confirmed On-Chain" : "Reverted";
        blockNumber = receipt.blockNumber;
      } else {
        onChainVerification = "Broadcasted to Mempool (Pending confirmation)";
      }
    } catch (err) {
      console.warn("RPC verification check skipped:", err.message);
      onChainVerification = "Submitted (RPC verification deferred)";
    }
  }

  const newTrade = {
    id: tradeId,
    txHash: txHash || `0x${Math.random().toString(16).substring(2, 66)}`,
    seller: prosumerAddress,
    buyer: consumerAddress,
    units: Number(units),
    ethPerUnit: Number(ethPerUnit),
    totalEth: Number(totalEth || (units * ethPerUnit).toFixed(4)),
    timestamp: new Date().toISOString(),
    status: "Settled",
    verification: onChainVerification,
    blockNumber,
    network: "Sepolia Testnet"
  };

  tradesDatabase.unshift(newTrade);

  res.json({
    message: "Trade successfully recorded in backend",
    trade: newTrade,
    etherscanUrl: `https://sepolia.etherscan.io/tx/${newTrade.txHash}`
  });
});

// GET Dataset Readings for 12 Community Households (Ausgrid Solar & Smart Meter Dataset)
app.get("/api/microgrid/dataset-readings", (req, res) => {
  const datasetHouseholds = [
    { id: "P1", name: "Residence P1", type: "prosumer", solarCapacityKwp: 3.5, dailyGenerationUnits: 18.4, dailyConsumptionUnits: 7.2, dailyNetSurplusUnits: 11.2, currentGenerationUnits: 3.2, currentConsumptionUnits: 0.8, currentSurplusUnits: 2.4, dailyGenerationKwh: 18.4, dailyConsumptionKwh: 7.2, dailyNetKwh: 11.2, currentGenerationKwh: 3.2, currentConsumptionKwh: 0.8, currentSurplusKwh: 2.4, peakLoadKw: 0.85, walletAddress: "0x11A2...8F01", status: "Active Selling" },
    { id: "C1", name: "Residence C1", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 14.8, dailyNetSurplusUnits: -14.8, currentGenerationUnits: 0.0, currentConsumptionUnits: 1.2, currentSurplusUnits: -1.2, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 14.8, dailyNetKwh: -14.8, currentGenerationKwh: 0.0, currentConsumptionKwh: 1.2, currentSurplusKwh: -1.2, peakLoadKw: 1.45, walletAddress: "0x22B3...4E12", status: "Active Buying" },
    { id: "P2", name: "Residence P2", type: "prosumer", solarCapacityKwp: 4.2, dailyGenerationUnits: 22.6, dailyConsumptionUnits: 8.5, dailyNetSurplusUnits: 14.1, currentGenerationUnits: 2.8, currentConsumptionUnits: 1.0, currentSurplusUnits: 1.8, dailyGenerationKwh: 22.6, dailyConsumptionKwh: 8.5, dailyNetKwh: 14.1, currentGenerationKwh: 2.8, currentConsumptionKwh: 1.0, currentSurplusKwh: 1.8, peakLoadKw: 1.10, walletAddress: "0x33C4...9D23", status: "Active Selling" },
    { id: "C2", name: "Residence C2", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 18.2, dailyNetSurplusUnits: -18.2, currentGenerationUnits: 0.0, currentConsumptionUnits: 2.0, currentSurplusUnits: -2.0, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 18.2, dailyNetKwh: -18.2, currentGenerationKwh: 0.0, currentConsumptionKwh: 2.0, currentSurplusKwh: -2.0, peakLoadKw: 1.85, walletAddress: "0x55E6...1B45", status: "Active Buying" },
    { id: "P3", name: "Residence P3 (Node Alpha)", type: "prosumer", solarCapacityKwp: 5.0, dailyGenerationUnits: 28.5, dailyConsumptionUnits: 9.2, dailyNetSurplusUnits: 19.3, currentGenerationUnits: 4.2, currentConsumptionUnits: 1.1, currentSurplusUnits: 3.1, dailyGenerationKwh: 28.5, dailyConsumptionKwh: 9.2, dailyNetKwh: 19.3, currentGenerationKwh: 4.2, currentConsumptionKwh: 1.1, currentSurplusKwh: 3.1, peakLoadKw: 1.20, walletAddress: "0x3C44...93BC", status: "Active Selling" },
    { id: "C3", name: "Residence C3", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 13.5, dailyNetSurplusUnits: -13.5, currentGenerationUnits: 0.0, currentConsumptionUnits: 1.5, currentSurplusUnits: -1.5, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 13.5, dailyNetKwh: -13.5, currentGenerationKwh: 0.0, currentConsumptionKwh: 1.5, currentSurplusKwh: -1.5, peakLoadKw: 1.30, walletAddress: "0x66F7...7A56", status: "Active Buying" },
    { id: "C4", name: "Residence C4", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 16.4, dailyNetSurplusUnits: -16.4, currentGenerationUnits: 0.0, currentConsumptionUnits: 1.8, currentSurplusUnits: -1.8, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 16.4, dailyNetKwh: -16.4, currentGenerationKwh: 0.0, currentConsumptionKwh: 1.8, currentSurplusKwh: -1.8, peakLoadKw: 1.60, walletAddress: "0x77A8...3C67", status: "Active Buying" },
    { id: "P4", name: "Residence P4", type: "prosumer", solarCapacityKwp: 4.0, dailyGenerationUnits: 21.8, dailyConsumptionUnits: 7.9, dailyNetSurplusUnits: 13.9, currentGenerationUnits: 3.6, currentConsumptionUnits: 0.9, currentSurplusUnits: 2.7, dailyGenerationKwh: 21.8, dailyConsumptionKwh: 7.9, dailyNetKwh: 13.9, currentGenerationKwh: 3.6, currentConsumptionKwh: 0.9, currentSurplusKwh: 2.7, peakLoadKw: 0.95, walletAddress: "0x88B9...2E78", status: "Active Selling" },
    { id: "C5", name: "Residence C5", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 11.6, dailyNetSurplusUnits: -11.6, currentGenerationUnits: 0.0, currentConsumptionUnits: 1.0, currentSurplusUnits: -1.0, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 11.6, dailyNetKwh: -11.6, currentGenerationKwh: 0.0, currentConsumptionKwh: 1.0, currentSurplusKwh: -1.0, peakLoadKw: 1.15, walletAddress: "0x99C0...9F89", status: "Active Buying" },
    { id: "P5", name: "Residence P5", type: "prosumer", solarCapacityKwp: 4.8, dailyGenerationUnits: 26.4, dailyConsumptionUnits: 8.8, dailyNetSurplusUnits: 17.6, currentGenerationUnits: 3.8, currentConsumptionUnits: 0.8, currentSurplusUnits: 3.0, dailyGenerationKwh: 26.4, dailyConsumptionKwh: 8.8, dailyNetKwh: 17.6, currentGenerationKwh: 3.8, currentConsumptionKwh: 0.8, currentSurplusKwh: 3.0, peakLoadKw: 1.15, walletAddress: "0xBBD2...6C01", status: "Active Selling" },
    { id: "C6", name: "Residence C6 (Node Beta)", type: "consumer", solarCapacityKwp: 0.0, dailyGenerationUnits: 0.0, dailyConsumptionUnits: 15.2, dailyNetSurplusUnits: -15.2, currentGenerationUnits: 0.0, currentConsumptionUnits: 1.5, currentSurplusUnits: -1.5, dailyGenerationKwh: 0.0, dailyConsumptionKwh: 15.2, dailyNetKwh: -15.2, currentGenerationKwh: 0.0, currentConsumptionKwh: 1.5, currentSurplusKwh: -1.5, peakLoadKw: 1.50, walletAddress: "0x71C7...976F", status: "Outage Mitigated" },
    { id: "P6", name: "Residence P6", type: "prosumer", solarCapacityKwp: 3.8, dailyGenerationUnits: 20.5, dailyConsumptionUnits: 8.1, dailyNetSurplusUnits: 12.4, currentGenerationUnits: 3.2, currentConsumptionUnits: 0.7, currentSurplusUnits: 2.5, dailyGenerationKwh: 20.5, dailyConsumptionKwh: 8.1, dailyNetKwh: 12.4, currentGenerationKwh: 3.2, currentConsumptionKwh: 0.7, currentSurplusKwh: 2.5, peakLoadKw: 0.90, walletAddress: "0xCCE3...8D12", status: "Active Selling" },
  ];

  const totalGeneration = datasetHouseholds.reduce((acc, h) => acc + h.dailyGenerationUnits, 0);
  const totalConsumption = datasetHouseholds.reduce((acc, h) => acc + h.dailyConsumptionUnits, 0);
  const currentTotalGen = datasetHouseholds.reduce((acc, h) => acc + h.currentGenerationUnits, 0);
  const currentTotalCons = datasetHouseholds.reduce((acc, h) => acc + h.currentConsumptionUnits, 0);

  res.json({
    datasetSource: "Ausgrid Solar Home Electricity Dataset (Half-Hourly Smart Meter Readings)",
    unit: "Units (1 Unit = 1 kWh)",
    powerUnit: "kW (Kilowatts)",
    timestamp: new Date().toISOString(),
    summary: {
      totalHouses: 12,
      prosumersCount: 6,
      consumersCount: 6,
      dailyTotalGenerationUnits: Number(totalGeneration.toFixed(2)),
      dailyTotalConsumptionUnits: Number(totalConsumption.toFixed(2)),
      dailyNetSurplusUnits: Number((totalGeneration - totalConsumption).toFixed(2)),
      currentSlotGenerationUnits: Number(currentTotalGen.toFixed(2)),
      currentSlotConsumptionUnits: Number(currentTotalCons.toFixed(2)),
      currentSlotNetSurplusUnits: Number((currentTotalGen - currentTotalCons).toFixed(2)),
      communitySelfSufficiencyPct: Number(((totalGeneration / totalConsumption) * 100).toFixed(1))
    },
    households: datasetHouseholds
  });
});

// GET Microgrid Status (Society Outage & House States)
app.get("/api/status", async (req, res) => {
  let isSocietyOutage = inMemoryGridState.isSocietyOutage;
  let activeOutageEvent = inMemoryGridState.activeOutageEvent;
  let houses = Array.from(inMemoryGridState.houseStatus.values());
  let cutLines = Array.from(inMemoryGridState.cutLines);

  if (supabase) {
    try {
      const { data: eventData } = await supabase
        .from("grid_events")
        .select("*")
        .eq("scope", "society")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);

      if (eventData && eventData.length > 0) {
        isSocietyOutage = true;
        activeOutageEvent = eventData[0];
      } else {
        isSocietyOutage = false;
        activeOutageEvent = null;
      }

      // Check active line cuts
      const { data: cutEvents } = await supabase
        .from("grid_events")
        .select("household_id")
        .eq("scope", "house")
        .eq("event_type", "line_cut")
        .is("ended_at", null);

      if (cutEvents) {
        inMemoryGridState.cutLines = new Set(cutEvents.map((e) => e.household_id));
        cutLines = Array.from(inMemoryGridState.cutLines);
      }

      const { data: statusData } = await supabase
        .from("house_status")
        .select("*")
        .in("household_id", ALL_HOUSE_IDS);

      if (statusData && statusData.length > 0) {
        houses = statusData;
        // Sync in-memory map
        for (const row of statusData) {
          inMemoryGridState.houseStatus.set(row.household_id, row);
        }
      }
    } catch (err) {
      console.warn("[Backend] Error querying Supabase status, using fallback:", err.message);
    }
  }

  res.json({
    success: true,
    isSocietyOutage,
    activeOutageEvent,
    cutLines,
    houses
  });
});

// POST Trigger Society-Wide Grid Outage
app.post("/api/outage", async (req, res) => {
  inMemoryGridState.isSocietyOutage = true;
  const startedAt = new Date().toISOString();
  inMemoryGridState.activeOutageEvent = {
    scope: "society",
    event_type: "outage",
    started_at: startedAt
  };

  // Update in-memory statuses:
  // Non-solar houses enter Blackout; solar houses switch to On Battery (or Blackout if empty)
  for (const [id, house] of inMemoryGridState.houseStatus.entries()) {
    const isSolar = SOLAR_HOUSE_IDS.includes(id);
    if (!isSolar) {
      house.power_state = house.is_supplied_by_trade ? "battery" : "blackout";
    } else {
      house.power_state = house.battery_kwh > 0 ? "battery" : "blackout";
    }
    house.updated_at = startedAt;
  }

  if (supabase) {
    try {
      // 1. Insert outage event
      await supabase.from("grid_events").insert({
        scope: "society",
        event_type: "outage",
        started_at: startedAt
      });

      // 2. Update house statuses
      const updates = Array.from(inMemoryGridState.houseStatus.values());
      for (const u of updates) {
        await supabase
          .from("house_status")
          .upsert(u, { onConflict: "household_id" });
      }
    } catch (err) {
      console.warn("[Backend] Supabase outage update error:", err.message);
    }
  }

  console.log(`[Backend Grid Engine] Society Outage TRIGGERED at ${startedAt}`);

  res.json({
    success: true,
    message: "Society-wide grid outage triggered. Non-solar houses in Blackout, solar houses on Battery.",
    isSocietyOutage: true,
    started_at: startedAt
  });
});

// POST Restore Society-Wide Grid
app.post("/api/outage/restore", async (req, res) => {
  inMemoryGridState.isSocietyOutage = false;
  inMemoryGridState.activeOutageEvent = null;
  const endedAt = new Date().toISOString();

  // Reset all houses to nominal grid supply
  for (const [id, house] of inMemoryGridState.houseStatus.entries()) {
    house.power_state = "grid";
    house.is_supplied_by_trade = false;
    house.updated_at = endedAt;
  }

  if (supabase) {
    try {
      // 1. Close active society outage events
      await supabase
        .from("grid_events")
        .update({ ended_at: endedAt })
        .eq("scope", "society")
        .is("ended_at", null);

      // 2. Restore house statuses
      const updates = Array.from(inMemoryGridState.houseStatus.values());
      for (const u of updates) {
        await supabase
          .from("house_status")
          .upsert(u, { onConflict: "household_id" });
      }
    } catch (err) {
      console.warn("[Backend] Supabase restore update error:", err.message);
    }
  }

  console.log(`[Backend Grid Engine] Society Grid RESTORED at ${endedAt}`);

  res.json({
    success: true,
    message: "Society grid supply restored. All houses connected to nominal utility grid.",
    isSocietyOutage: false,
    ended_at: endedAt
  });
});

// POST Cut Individual House Lines (Isolates selected houses from distribution grid)
app.post("/api/lines/cut", async (req, res) => {
  const { household_ids = [], household_id } = req.body;
  const targetIds = household_ids.length > 0 
    ? household_ids.map(Number) 
    : household_id ? [Number(household_id)] : [];

  if (targetIds.length === 0) {
    return res.status(400).json({ success: false, error: "No household IDs provided" });
  }

  const startedAt = new Date().toISOString();

  for (const id of targetIds) {
    inMemoryGridState.cutLines.add(id);
    const house = inMemoryGridState.houseStatus.get(id);
    if (house) {
      house.power_state = "line_cut";
      house.updated_at = startedAt;
    }
  }

  if (supabase) {
    try {
      // 1. Insert line_cut event for each house
      const events = targetIds.map((id) => ({
        scope: "house",
        household_id: id,
        event_type: "line_cut",
        started_at: startedAt
      }));
      await supabase.from("grid_events").insert(events);

      // 2. Upsert house_status
      const updates = targetIds
        .map((id) => inMemoryGridState.houseStatus.get(id))
        .filter(Boolean);
      for (const u of updates) {
        await supabase.from("house_status").upsert(u, { onConflict: "household_id" });
      }
    } catch (err) {
      console.warn("[Backend] Supabase line cut error:", err.message);
    }
  }

  console.log(`[Backend Grid Engine] Lines CUT for households: ${targetIds.join(", ")}`);

  res.json({
    success: true,
    message: `Power lines cut for households: ${targetIds.join(", ")}`,
    cutLines: Array.from(inMemoryGridState.cutLines),
    houses: Array.from(inMemoryGridState.houseStatus.values())
  });
});

// POST Restore Individual House Lines
app.post("/api/lines/restore", async (req, res) => {
  const { household_ids = [], household_id } = req.body;
  const targetIds = household_ids.length > 0 
    ? household_ids.map(Number) 
    : household_id ? [Number(household_id)] : [];

  if (targetIds.length === 0) {
    return res.status(400).json({ success: false, error: "No household IDs provided" });
  }

  const endedAt = new Date().toISOString();
  const isSocietyOutage = inMemoryGridState.isSocietyOutage;

  for (const id of targetIds) {
    inMemoryGridState.cutLines.delete(id);
    const house = inMemoryGridState.houseStatus.get(id);
    if (house) {
      const isSolar = SOLAR_HOUSE_IDS.includes(id);
      if (isSocietyOutage) {
        house.power_state = isSolar ? "battery" : "blackout";
      } else {
        house.power_state = "grid";
      }
      house.updated_at = endedAt;
    }
  }

  if (supabase) {
    try {
      // 1. Close active line_cut events for these households
      await supabase
        .from("grid_events")
        .update({ ended_at: endedAt })
        .eq("scope", "house")
        .eq("event_type", "line_cut")
        .in("household_id", targetIds)
        .is("ended_at", null);

      // 2. Upsert house_status
      const updates = targetIds
        .map((id) => inMemoryGridState.houseStatus.get(id))
        .filter(Boolean);
      for (const u of updates) {
        await supabase.from("house_status").upsert(u, { onConflict: "household_id" });
      }
    } catch (err) {
      console.warn("[Backend] Supabase line restore error:", err.message);
    }
  }

  console.log(`[Backend Grid Engine] Lines RESTORED for households: ${targetIds.join(", ")}`);

  res.json({
    success: true,
    message: `Power lines restored for households: ${targetIds.join(", ")}`,
    cutLines: Array.from(inMemoryGridState.cutLines),
    houses: Array.from(inMemoryGridState.houseStatus.values())
  });
});

// POST Tick Sync (Battery physics: charges on solar surplus, drains on load during outage/night)
app.post("/api/tick-sync", async (req, res) => {
  const { readings = [] } = req.body;
  const isOutage = inMemoryGridState.isSocietyOutage;

  for (const r of readings) {
    const householdId = Number(r.household_id);
    if (!SOLAR_HOUSE_IDS.includes(householdId)) continue;

    const house = inMemoryGridState.houseStatus.get(householdId);
    if (!house) continue;

    const solarGen = Number(r.gg_kwh || 0);
    const homeLoad = Number(r.gc_kwh || 0) + Number(r.cl_kwh || 0);
    const net = solarGen - homeLoad;

    if (net > 0) {
      // Surplus solar charges battery up to 6.0 kWh capacity
      house.battery_kwh = Math.min(
        house.battery_capacity_kwh,
        Number((house.battery_kwh + net).toFixed(2))
      );
    } else if (isOutage) {
      // During outage, deficit drains battery
      house.battery_kwh = Math.max(
        0,
        Number((house.battery_kwh + net).toFixed(2))
      );
      if (house.battery_kwh <= 0 && solarGen < homeLoad) {
        house.power_state = "blackout";
      }
    }
    house.updated_at = new Date().toISOString();
  }

  if (supabase) {
    try {
      const updates = Array.from(inMemoryGridState.houseStatus.values()).filter((h) =>
        SOLAR_HOUSE_IDS.includes(h.household_id)
      );
      for (const u of updates) {
        await supabase.from("house_status").upsert(u, { onConflict: "household_id" });
      }
    } catch (err) {
      console.warn("[Backend] Supabase tick battery sync error:", err.message);
    }
  }

  res.json({
    success: true,
    message: "Battery levels synced with tick telemetry",
    houseStatus: Array.from(inMemoryGridState.houseStatus.values())
  });
});

// GET Trade History
app.get("/api/trade/history", (req, res) => {
  res.json({
    count: tradesDatabase.length,
    trades: tradesDatabase
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`Connected to Sepolia Network via Ethers.js`);
});