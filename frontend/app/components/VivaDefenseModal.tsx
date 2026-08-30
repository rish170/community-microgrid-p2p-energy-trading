"use client";

import React, { useState } from "react";
import { 
  GraduationCap, 
  HelpCircle, 
  ChevronRight, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Cpu, 
  Sparkles,
  X
} from "lucide-react";

export default function VivaDefenseModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<number>(0);

  const topics = [
    {
      title: "Smart Contract Safety & Escrow Architecture",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      question: "How does Trading.sol ensure that a prosumer cannot double-spend energy or fail to deliver after receiving funds?",
      answer: `Trading.sol implements an atomic escrow pattern. When a consumer initiates a trade, their ETH payment is locked into the smart contract while validating that the seller holds an active ERC-20 EnergyToken balance (1 ENG = 1 kWh).
      
Key architectural safeguards:
1. Reentrancy Protection: OpenZeppelin ERC-20 standard transfer routines prevent reentrancy attacks during ETH transfers.
2. Atomic Unit Settlement: Energy tokens are transferred from the seller to the buyer, and payment is released to the seller within the single transaction block.
3. Access Control: Minting privileges for EnergyToken are restricted to the verified Microgrid IoT Oracle (Ownable pattern).`
    },
    {
      title: "Tokenomics: 1 Token = 1 kWh Design Justification",
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
      question: "Why use an ERC-20 token for energy representation rather than direct raw database entries or NFTs?",
      answer: `ERC-20 standardizes unit-level fungibility and decimal precision (10^18), which is critical for fractional energy trading (e.g., 0.25 kWh consumed by a single appliance).
      
Advantages of ERC-20:
- Seamless Composability: Enables automated liquidity pools, future DeFi collateralization of clean energy credits, and sub-second multi-peer settlement.
- Deflationary Burn Mechanism: When physical energy is consumed from the microgrid battery, the burn(kWh) method burns tokens permanently, maintaining physical-to-digital equilibrium.`
    },
    {
      title: "Regulatory & Grid Policy (FERC 2222 / IEEE 2030.7)",
      icon: <Scale className="w-4 h-4 text-amber-400" />,
      question: "How does this P2P trading model align with modern microgrid regulations and utility interconnection rules?",
      answer: `The platform adheres directly to standard microgrid frameworks:
      
1. FERC Order 2222: Allows distributed energy resource (DER) aggregators to participate in wholesale electricity markets. Our microgrid acts as a virtual power plant (VPP).
2. IEEE 2030.7 Microgrid Control Standard: Supports seamless grid-tied and islanded operation. During main-grid outages, the localized smart meters disconnect the substation breaker and engage autonomous P2P load balancing.
3. Localized Tariffs: Reduces transmission congestion fees by keeping electrons inside the neighborhood distribution transformer zone.`
    },
    {
      title: "3-Way Data Architecture (Next.js + Express + Supabase)",
      icon: <FileText className="w-4 h-4 text-purple-400" />,
      question: "Explain the data flow from physical IoT meters to the blockchain and Power BI.",
      answer: `The system follows an event-driven decoupled architecture:
      
1. IoT / Data-API: Smart meters emit generation and load telemetry every second.
2. Hardhat / Sepolia: When orders are matched, transactions execute on-chain and emit 'TradeExecuted' events.
3. Express Backend Listener: Catches 'TradeExecuted' events via Ethers.js websocket provider and mirrors confirmed transactions into Supabase.
4. Realtime Frontend & Power BI: Supabase Realtime pushes live rows to the Next.js UI, while Power BI aggregates daily carbon offset and tariff savings metrics.`
    }
  ];

  return (
    <>
      {/* Floating CTA Banner / Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-zinc-800/80">
        <div className="p-8 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-zinc-950 to-sky-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <GraduationCap className="w-3.5 h-3.5" /> Week 16: Viva & Project Defense Hub
            </div>
            <h3 className="text-2xl font-extrabold text-white">
              Prepared for Academic & Technical Defense
            </h3>
            <p className="text-zinc-400 text-sm max-w-xl">
              Access comprehensive answers on smart contract security, ERC-20 tokenomics, IEEE 2030.7 standards, and end-to-end architecture.
            </p>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="px-6 py-3.5 rounded-2xl text-sm font-bold text-black bg-gradient-to-r from-emerald-400 to-sky-400 hover:from-emerald-300 hover:to-sky-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition transform hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            Open Viva & Defense Guide
          </button>
        </div>
      </section>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 shadow-2xl flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Viva Prep & Architecture Defense Guide</h3>
                  <span className="text-xs text-zinc-400">Essential answers for project presentation & viva examiners</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Topic Selector + Content */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto pr-1">
              
              {/* Left Menu */}
              <div className="md:col-span-4 space-y-2">
                {topics.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTopic(idx)}
                    className={`w-full p-3.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      selectedTopic === idx
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 shadow-sm"
                        : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {t.icon}
                      <span className="truncate">{t.title}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>

              {/* Right Content View */}
              <div className="md:col-span-8 bg-zinc-900/40 rounded-2xl border border-zinc-800/80 p-6 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <HelpCircle className="w-4 h-4" /> Viva Question
                </div>
                <h4 className="text-base font-bold text-white leading-snug">
                  {topics[selectedTopic].question}
                </h4>

                <div className="border-t border-zinc-800 pt-4">
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2">
                    Comprehensive Technical Answer
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line font-sans space-y-2">
                    {topics[selectedTopic].answer}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>Ready for Final Viva & Evaluation</span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition cursor-pointer"
              >
                Close Guide
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
