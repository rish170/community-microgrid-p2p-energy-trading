"use client";

import React, { useState } from "react";
import { 
  Zap, 
  ArrowDownUp, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  ExternalLink,
  PlusCircle,
  X
} from "lucide-react";

interface Order {
  id: string;
  type: "sell" | "buy";
  seller: string;
  amountKwh: number;
  pricePerKwh: number;
  totalEth: number;
  distance: string;
  time: string;
}

export default function TradeOrderBook() {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState<string>("10");
  const [customPrice, setCustomPrice] = useState<string>("1.2");
  
  const [orders, setOrders] = useState<Order[]>([
    { id: "ORD-101", type: "sell", seller: "0x3C44...93BC (Node Alpha)", amountKwh: 30, pricePerKwh: 1.5, totalEth: 45.0, distance: "0.5 mi", time: "1 min ago" },
    { id: "ORD-102", type: "sell", seller: "0x89A1...41EF (Node Gamma)", amountKwh: 20, pricePerKwh: 1.2, totalEth: 24.0, distance: "1.2 mi", time: "5 mins ago" },
    { id: "ORD-103", type: "sell", seller: "0x22F0...983A (Node Delta)", amountKwh: 15, pricePerKwh: 1.1, totalEth: 16.5, distance: "0.8 mi", time: "8 mins ago" },
    { id: "ORD-104", type: "buy", seller: "0x71C7...976F (Node Beta)", amountKwh: 15, pricePerKwh: 1.5, totalEth: 22.5, distance: "0.5 mi", time: "2 mins ago" },
    { id: "ORD-105", type: "buy", seller: "0x55D3...662B (Node Theta)", amountKwh: 25, pricePerKwh: 1.3, totalEth: 32.5, distance: "1.5 mi", time: "12 mins ago" },
  ]);

  // Transaction execution popup state
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStep, setTxStep] = useState<number>(0);
  const [txSuccess, setTxSuccess] = useState(false);
  const [errorSimulated, setErrorSimulated] = useState(false);

  const steps = [
    "Requesting MetaMask Signature (SIWE Session)...",
    "Sending Transaction to Trading.sol (Sepolia RPC)...",
    "Smart Escrow Locking Payment in Escrow...",
    "Transferring ERC-20 ENG Tokens to Buyer...",
    "Confirming On-Chain & Mirroring to Supabase DB..."
  ];

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const kwh = parseFloat(amount);
    const rate = parseFloat(customPrice);
    if (!kwh || !rate) return;

    setIsProcessing(true);
    setTxSuccess(false);
    setErrorSimulated(false);
    setTxStep(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current < steps.length) {
        setTxStep(current);
      } else {
        clearInterval(interval);
        setIsProcessing(false);
        setTxSuccess(true);

        const newOrder: Order = {
          id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
          type: activeTab,
          seller: activeTab === "sell" ? "0x3C44...93BC (You)" : "0x71C7...976F (You)",
          amountKwh: kwh,
          pricePerKwh: rate,
          totalEth: Number((kwh * rate).toFixed(2)),
          distance: "0.2 mi",
          time: "Just now"
        };
        setOrders([newOrder, ...orders]);
      }
    }, 900);
  };

  return (
    <section id="orderbook" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-800/80">
      
      {/* Header */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
          <ArrowDownUp className="w-3.5 h-3.5" /> Weeks 9 & 10 Core Engine
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
          Live P2P Order Book & Trade Execution
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          Place instant market or limit orders on the microgrid. Direct contract interaction with Ethers.js and automated Supabase database syncing.
        </p>
      </div>

      {/* Grid: Order Placement + Live Book */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form: Create Order */}
        <div className="lg:col-span-5 bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" /> Create Energy Order
            </h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              Contract: 0x9f...3B
            </span>
          </div>

          {/* Buy/Sell Selector */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-900 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("buy")}
              className={`py-2.5 text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === "buy" 
                  ? "bg-sky-500 text-black shadow-lg" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Buy Energy (Demand)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sell")}
              className={`py-2.5 text-sm font-bold rounded-xl transition cursor-pointer ${
                activeTab === "sell" 
                  ? "bg-emerald-400 text-black shadow-lg" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sell Surplus (Solar)
            </button>
          </div>

          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Energy Quantity (kWh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="e.g. 15"
                  required
                />
                <span className="absolute right-4 top-3 text-xs font-mono text-zinc-400">kWh</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Price per Unit (ETH / kWh)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                  placeholder="e.g. 1.2"
                  required
                />
                <span className="absolute right-4 top-3 text-xs font-mono text-zinc-400">ETH</span>
              </div>
            </div>

            {/* Total Estimated Cost */}
            <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Estimated Total:</span>
                <span className="text-white font-bold text-sm">
                  {(parseFloat(amount || "0") * parseFloat(customPrice || "0")).toFixed(2)} ETH
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Estimated Gas:</span>
                <span className="text-emerald-400">~0.0024 ETH ($4.80)</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                <span>Escrow Fee (0%):</span>
                <span className="text-zinc-300">Community Zero Fee</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl text-sm font-extrabold text-black transition-all transform hover:-translate-y-0.5 cursor-pointer ${
                activeTab === "buy"
                  ? "bg-gradient-to-r from-sky-400 to-blue-400 hover:from-sky-300 hover:to-blue-300 shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                  : "bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
              }`}
            >
              {isProcessing ? "Processing On-Chain..." : `Submit ${activeTab === "buy" ? "Buy" : "Sell"} Order`}
            </button>
          </form>

          {/* Active Status Modal / Notification */}
          {isProcessing && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                <span>Transaction in Progress</span>
                <span>Step {txStep + 1} of {steps.length}</span>
              </div>
              <p className="text-xs text-zinc-300 font-mono">{steps[txStep]}</p>
            </div>
          )}

          {txSuccess && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-bold text-white">Order Confirmed on Sepolia!</div>
                <div className="text-zinc-400 font-mono">Tx: 0x4f19e...8c20 • Mirrored to Supabase</div>
              </div>
            </div>
          )}

        </div>

        {/* Right Panel: Live Depth Order Book */}
        <div className="lg:col-span-7 bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Live Microgrid Market Depth</h3>
                <span className="text-xs text-zinc-400">Real-time local neighborhood bids and asks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-mono text-emerald-400 font-semibold">MATCHING ACTIVE</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="uppercase text-zinc-400 bg-zinc-900/60 border-b border-zinc-800 font-mono">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg">Side</th>
                    <th className="py-2.5 px-3">Node</th>
                    <th className="py-2.5 px-3">Energy</th>
                    <th className="py-2.5 px-3">Rate</th>
                    <th className="py-2.5 px-3">Total ETH</th>
                    <th className="py-2.5 px-3">Distance</th>
                    <th className="py-2.5 px-3 rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          o.type === "sell" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                        }`}>
                          {o.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{o.seller}</td>
                      <td className="py-3 px-3 text-zinc-300 font-bold">{o.amountKwh} kWh</td>
                      <td className="py-3 px-3 text-emerald-400 font-bold">{o.pricePerKwh} ETH</td>
                      <td className="py-3 px-3 text-white font-bold">{o.totalEth} ETH</td>
                      <td className="py-3 px-3 text-zinc-400">{o.distance}</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setAmount(o.amountKwh.toString());
                            setCustomPrice(o.pricePerKwh.toString());
                            setActiveTab(o.type === "sell" ? "buy" : "sell");
                          }}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-sans font-bold transition cursor-pointer"
                        >
                          Match
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Escrow contracts audit-ready & verified</span>
            </div>
            <div className="font-mono text-emerald-400">Auto-Matching Latency: 42ms</div>
          </div>
        </div>

      </div>

    </section>
  );
}
