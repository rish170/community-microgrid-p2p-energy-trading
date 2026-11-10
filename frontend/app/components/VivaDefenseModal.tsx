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
      title: "Smart Contract Settlement & Option B Architecture",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      question: "How does Trading.sol ensure atomic settlement on Sepolia without ERC-20 token deadlocks?",
      answer: `Trading.sol implements Option B direct test ETH settlement. When a prosumer accepts an energy request, 0.000100 SepoliaETH is transferred directly from the buyer to the seller, atomically emitting the on-chain TradeExecuted event with trade parameters (kWh, price, timestamp).
      
Key architectural safeguards:
1. Low Gas & Zero Token Friction: Eliminates synthetic token wrapping, staking, or secondary liquidity pools, ensuring microgrid trades settle in under 1 block.
2. Direct Wallet Delivery: Uses call{value: msg.value}("") to guarantee atomic value transfer directly into the prosumer's MetaMask wallet.
3. Decoupled Physical Settlement: The backend verifies prosumer battery reserves and physical line connection before authorizing on-chain execution.`
    },
    {
      title: "Direct ETH vs ERC-20 Tokenomics Trade-Off",
      icon: <Cpu className="w-4 h-4 text-sky-400" />,
      question: "Why was direct ETH micro-settlement chosen over an ERC-20 utility token (Option B vs Option A)?",
      answer: `While ERC-20 tokens are common in academic whitepapers, in live microgrids they introduce severe operational friction:
      
1. Gas Overhead: ERC-20 requires double transactions (Approve + TransferFrom), doubling gas costs and block confirmation delay.
2. Liquidity Dependency: In small residential communities (12 houses), a proprietary token has zero external purchasing power, requiring continuous synthetic market-making.
3. Native Currency Efficiency: Settling in native ETH (0.0001 ETH per trade) gives prosumers immediately spendable network value with zero friction.`
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
      question: "Explain the data flow from physical IoT meters to the blockchain and Supabase Realtime.",
      answer: `The system follows an event-driven decoupled architecture:
      
1. IoT Replay & ML Engine: Replays real Ausgrid half-hour telemetry and outputs XGBoost 24-hour load and solar forecasts.
2. Nearest-Prosumer Matching: When a consumer blackouts or isolates, the backend sorts eligible prosumers by 3D Euclidean distance and battery SoC, managing 30s timeouts.
3. Sepolia Settlement Engine: Transacts 0.0001 ETH directly to the prosumer wallet and pushes event records into Supabase trades and energy_requests tables.
4. Supabase Realtime WebSocket Push: Streams changes immediately to the 3D WebGL diorama and dashboard without polling.`
    }
  ];

  return (
    <>
      {/* Defense CTA Banner */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-[#D8D8DE]">
        <div className="p-7 sm:p-8 rounded-3xl bg-white border border-[#D8D8DE] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#8271B8]/10 text-[#8271B8] border border-[#8271B8]/20">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Academic Defense &amp; Architecture Hub</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F]">
              Prepared for Academic &amp; Technical Defense
            </h3>
            <p className="text-[#6E6E73] text-xs sm:text-sm max-w-xl leading-relaxed">
              Examine detailed justifications for Option B direct test ETH settlement, nearest-prosumer matching, IEEE 2030.7 standard compliance, and decoupled Supabase Realtime architecture.
            </p>
          </div>

          <button
            onClick={() => setIsOpen(true)}
            className="px-6 py-3 rounded-xl text-xs font-medium text-white bg-[#1D1D1F] hover:bg-[#343438] active:scale-[0.99] shadow-sm transition transform hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            Open Viva &amp; Defense Guide
          </button>
        </div>
      </section>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EBEBEF] pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#F5F5F7] text-[#1D1D1F] border border-[#D8D8DE]">
                  <GraduationCap className="w-5 h-5 text-[#8271B8]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1D1D1F]">Viva Prep &amp; Architecture Defense Guide</h3>
                  <span className="text-xs text-[#6E6E73]">Key answers for academic evaluators and technical defense</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-[#F5F5F7] text-[#6E6E73] hover:text-[#1D1D1F] border border-[#D8D8DE] transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
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
                    className={`w-full p-3 rounded-xl text-left text-xs transition cursor-pointer ${
                      selectedTopic === idx
                        ? "bg-[#F5F5F7] text-[#1D1D1F] border border-[#D8D8DE] shadow-xs font-semibold"
                        : "bg-white text-[#6E6E73] hover:text-[#1D1D1F] border border-transparent font-medium"
                    } flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {t.icon}
                      <span className="truncate">{t.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40 ml-2" />
                  </button>
                ))}
              </div>

              {/* Right Content View */}
              <div className="md:col-span-8 bg-[#FBFBFC] rounded-2xl border border-[#EBEBEF] p-6 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#27845B] uppercase tracking-wider">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Evaluation Question</span>
                </div>
                <h4 className="text-base font-semibold text-[#1D1D1F] leading-snug">
                  {topics[selectedTopic].question}
                </h4>

                <div className="border-t border-[#EBEBEF] pt-4">
                  <div className="text-xs font-semibold text-[#5277D5] uppercase tracking-wider mb-2">
                    Technical Defense Justification
                  </div>
                  <div className="text-xs sm:text-sm text-[#1D1D1F] leading-relaxed whitespace-pre-line font-sans space-y-2">
                    {topics[selectedTopic].answer}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-[#EBEBEF] flex items-center justify-between text-xs text-[#6E6E73]">
              <span>IEEE 2030.7 &amp; Smart Contract Verification</span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] font-medium border border-[#D8D8DE] shadow-xs transition cursor-pointer"
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
