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
    <section id="orderbook" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
      
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#8271B8]/10 text-[#8271B8] border border-[#8271B8]/20 mb-3.5">
          <ArrowDownUp className="w-3.5 h-3.5" />
          <span>Automated Matching Engine • Smart Escrow</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
          Microgrid Order Book &amp; Execution
        </h2>
        <p className="text-[#6E6E73] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Submit limit and market orders directly to the localized microgrid order book. Verified against on-chain smart escrow in Trading.sol and synced with Supabase.
        </p>
      </div>

      {/* Grid: Order Placement + Live Book */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Create Order Ticket */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-[#1D1D1F] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#5277D5]" />
              <span>Create Order Ticket</span>
            </h3>
            <span className="text-[11px] font-mono text-[#6E6E73] bg-[#F5F5F7] px-2.5 py-1 rounded-lg border border-[#D8D8DE]">
              Trading.sol: 0x9f...3B
            </span>
          </div>

          {/* Buy/Sell Selector Tabs - Apple Segmented Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#EBEBEF] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setActiveTab("buy")}
              className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "buy" 
                  ? "bg-white text-[#1D1D1F] shadow-xs font-semibold" 
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Buy Energy (Demand)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sell")}
              className={`py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === "sell" 
                  ? "bg-white text-[#1D1D1F] shadow-xs font-semibold" 
                  : "text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              Sell Surplus (Solar)
            </button>
          </div>

          <form onSubmit={handlePlaceOrder} className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#6E6E73] uppercase tracking-wider mb-1.5">
                Energy Quantity (Units)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-[#D8D8DE] rounded-xl px-4 py-2.5 text-[#1D1D1F] font-mono text-sm focus:outline-none focus:border-[#1D1D1F] focus:bg-white transition"
                  placeholder="e.g. 15"
                  required
                />
                <span className="absolute right-4 top-2.5 text-xs font-mono text-[#6E6E73]">units</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#6E6E73] uppercase tracking-wider mb-1.5">
                Price per Unit (ETH / unit)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full bg-[#F5F5F7] border border-[#D8D8DE] rounded-xl px-4 py-2.5 text-[#1D1D1F] font-mono text-sm focus:outline-none focus:border-[#1D1D1F] focus:bg-white transition"
                  placeholder="e.g. 1.2"
                  required
                />
                <span className="absolute right-4 top-2.5 text-xs font-mono text-[#6E6E73]">ETH</span>
              </div>
            </div>

            {/* Total Estimated Cost Box */}
            <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[#6E6E73]">
                <span>Estimated Value:</span>
                <span className="text-[#1D1D1F] font-bold text-sm tabular-nums">
                  {(parseFloat(amount || "0") * parseFloat(customPrice || "0")).toFixed(2)} ETH
                </span>
              </div>
              <div className="flex items-center justify-between text-[#6E6E73] text-[11px]">
                <span>Estimated Sepolia Gas:</span>
                <span className="text-[#27845B] tabular-nums font-semibold">~0.0024 ETH</span>
              </div>
              <div className="flex items-center justify-between text-[#6E6E73] text-[11px]">
                <span>Microgrid Escrow Fee:</span>
                <span className="text-[#5277D5] font-semibold">0% (P2P Zero Fee)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 rounded-xl text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-[#343438] active:scale-[0.99] transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isProcessing ? "Broadcasting to Sepolia..." : `Submit ${activeTab === "buy" ? "Buy" : "Sell"} Order`}
            </button>
          </form>

          {/* Active Status Progress */}
          {isProcessing && (
            <div className="mt-4 p-3.5 rounded-xl bg-[#F5F5F7] border border-[#D8D8DE] space-y-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
                <span>Transaction in Progress</span>
                <span className="font-mono text-[#6E6E73]">Step {txStep + 1} of {steps.length}</span>
              </div>
              <p className="text-xs text-[#6E6E73] font-mono">{steps[txStep]}</p>
            </div>
          )}

          {txSuccess && (
            <div className="mt-4 p-3.5 rounded-xl bg-[#27845B]/10 border border-[#27845B]/20 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#27845B] shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-[#1D1D1F]">Order Confirmed on Sepolia</div>
                <div className="text-[#6E6E73] font-mono text-[11px]">Tx confirmed • Mirrored to Supabase</div>
              </div>
            </div>
          )}

        </div>

        {/* Right Panel: Live Depth Order Book */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#1D1D1F]">Live Microgrid Market Depth</h3>
                <span className="text-xs text-[#6E6E73]">Real-time local neighborhood bids and asks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#27845B] animate-pulse" />
                <span className="text-xs font-mono text-[#27845B] font-semibold">MATCHING ACTIVE</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="uppercase text-[#6E6E73] bg-[#F5F5F7] border-b border-[#E5E5EA] text-[11px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-lg font-semibold">Side</th>
                    <th className="py-2.5 px-3 font-semibold">Node</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Energy</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Rate</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total ETH</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Dist</th>
                    <th className="py-2.5 px-3 rounded-r-lg text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBEF]">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#F5F5F7]/80 transition">
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          o.type === "sell" ? "bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20" : "bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20"
                        }`}>
                          {o.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#1D1D1F] font-sans font-medium text-xs">{o.seller}</td>
                      <td className="py-3 px-3 text-[#1D1D1F] font-semibold text-right tabular-nums">{o.amountKwh} units</td>
                      <td className="py-3 px-3 text-[#5277D5] font-semibold text-right tabular-nums">{o.pricePerKwh.toFixed(2)}</td>
                      <td className="py-3 px-3 text-[#1D1D1F] font-semibold text-right tabular-nums">{o.totalEth.toFixed(2)}</td>
                      <td className="py-3 px-3 text-[#6E6E73] text-right">{o.distance}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setAmount(o.amountKwh.toString());
                            setCustomPrice(o.pricePerKwh.toString());
                            setActiveTab(o.type === "sell" ? "buy" : "sell");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EBEBEF] text-[#1D1D1F] text-[11px] font-sans font-medium border border-[#D8D8DE] transition cursor-pointer shadow-xs"
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

          <div className="mt-5 pt-3.5 border-t border-[#EBEBEF] flex items-center justify-between text-xs text-[#6E6E73] flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#27845B]" />
              <span>Smart contracts verified on Sepolia</span>
            </div>
            <div className="font-mono text-[#5277D5]">Matching Latency: 42ms</div>
          </div>
        </div>

      </div>

    </section>
  );
}
