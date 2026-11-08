"use client";

import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Sun, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet, 
  RotateCcw, 
  Sparkles, 
  Plus, 
  Minus, 
  ExternalLink, 
  KeyRound, 
  Eye, 
  EyeOff, 
  UserCheck 
} from "lucide-react";
import { ethers } from "ethers";

export default function P2PTradingSimulator() {
  // Seller (You / Prosumer - Receives ETH)
  const [prosumerAddress, setProsumerAddress] = useState("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const [prosumerTotal, setProsumerTotal] = useState(100);
  const [prosumerRequired, setProsumerRequired] = useState(70);
  const [prosumerSurplus, setProsumerSurplus] = useState(30);
  const [prosumerEthBalance, setProsumerEthBalance] = useState<string>("0.0000");
  const [sellerConnected, setSellerConnected] = useState<boolean>(false);

  // Buyer (Teammate / Consumer - Pays ETH)
  const [consumerAddress, setConsumerAddress] = useState("0x71C7656EC7ab88b098defB751B7401B5f6d8976F");
  const [buyerPrivateKey, setBuyerPrivateKey] = useState<string>("");
  const [buyerConnected, setBuyerConnected] = useState<boolean>(false);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [consumerRequiredUnits, setConsumerRequiredUnits] = useState(15);
  const [consumerEthBalance, setConsumerEthBalance] = useState<string>("0.0000");
  const [isOutage, setIsOutage] = useState(true);

  // Trade parameters
  const [transferUnits, setTransferUnits] = useState<number>(15);
  const ethPerUnit = 0.2; // Fixed requirement: 0.2 ETH per unit
  const totalEthCost = Number((transferUnits * ethPerUnit).toFixed(4));

  // Execution states
  const [status, setStatus] = useState<"idle" | "requesting_metamask" | "executing" | "completed" | "error">("idle");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [txHash, setTxHash] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Query live Sepolia balance from backend
  const fetchBalance = async (address: string, setter: (val: string) => void) => {
    if (!address || !ethers.isAddress(address)) return;
    try {
      const res = await fetch(`http://localhost:5001/api/wallets/balance?address=${address}`);
      const data = await res.json();
      if (data.balanceEth) {
        setter(data.balanceEth);
      }
    } catch (e) {
      console.warn("Could not query backend balance, using default.", e);
    }
  };

  useEffect(() => {
    fetchBalance(prosumerAddress, setProsumerEthBalance);
    fetchBalance(consumerAddress, setConsumerEthBalance);

    // Auto-detect connected MetaMask on load
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      eth.request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setProsumerAddress(accounts[0]);
            setSellerConnected(true);
            fetchBalance(accounts[0], setProsumerEthBalance);
          }
        })
        .catch(() => {});

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setProsumerAddress(accounts[0]);
          setSellerConnected(true);
          fetchBalance(accounts[0], setProsumerEthBalance);
        } else {
          setSellerConnected(false);
          setBuyerConnected(false);
        }
      };

      eth.on?.("accountsChanged", handleAccountsChanged);
      return () => {
        eth.removeListener?.("accountsChanged", handleAccountsChanged);
      };
    }
  }, [prosumerAddress, consumerAddress]);

  // Connect Seller MetaMask
  const connectSellerMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          const acc = accounts[0];
          setProsumerAddress(acc);
          setSellerConnected(true);
          fetchBalance(acc, setProsumerEthBalance);
        }
      } catch (err: any) {
        if (err.code === -32002 || err.message?.includes("already pending")) {
          alert("MetaMask request is already pending in your browser extension tray. Please approve it.");
        } else {
          console.error("MetaMask connection error:", err);
        }
      }
    } else {
      alert("MetaMask is not installed. Please install the MetaMask extension to connect your wallet.");
    }
  };

  // Connect Buyer MetaMask
  const connectBuyerMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      try {
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          const acc = accounts[0];
          setConsumerAddress(acc);
          setBuyerConnected(true);
          fetchBalance(acc, setConsumerEthBalance);
        }
      } catch (err: any) {
        if (err.code === -32002 || err.message?.includes("already pending")) {
          alert("MetaMask request is already pending in your browser extension tray. Please approve it.");
        } else {
          console.error("MetaMask connection error:", err);
        }
      }
    } else {
      alert("MetaMask is not installed. Please install the MetaMask extension to connect your wallet.");
    }
  };

  // Increment & Decrement handlers
  const handleIncrement = () => {
    if (transferUnits < prosumerSurplus) {
      setTransferUnits((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (transferUnits > 1) {
      setTransferUnits((prev) => prev - 1);
    }
  };

  const steps = [
    { title: "Authorizing Buyer (Teammate) Wallet", desc: `Signing on-chain transfer of ${totalEthCost} SepoliaETH to Seller (${prosumerAddress.slice(0, 8)}...)` },
    { title: "Broadcasting to Sepolia Mempool", desc: "Transaction submitted to Ethereum Sepolia testnet nodes" },
    { title: "Smart Contract Escrow Match", desc: `${transferUnits} units Energy Tokens transferred to Buyer` },
    { title: "Backend API Sync", desc: "Express backend verifying receipt on-chain & mirroring to Supabase DB" },
    { title: "Outage Mitigated", desc: "Local microgrid relay closed, powering Buyer Node" }
  ];

  // Execute Trade Flow
  const handleExecuteTrade = async () => {
    if (status === "executing") return;
    setErrorMessage("");
    setStatus("executing");
    setCurrentStep(0);

    // If Buyer private key is provided, execute automated transfer via backend
    if (buyerPrivateKey.trim()) {
      try {
        const response = await fetch("http://localhost:5001/api/trade/execute-auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prosumerAddress,
            consumerAddress,
            buyerPrivateKey: buyerPrivateKey.trim(),
            units: transferUnits,
            ethPerUnit,
            totalEth: totalEthCost,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to execute automated trade");
        }

        setTxHash(data.txHash);
        runSuccessAnimation();
      } catch (err: any) {
        console.error("Trade execution error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to execute on-chain transfer from Teammate's wallet");
      }
    } else {
      // Direct MetaMask prompt for connected Buyer
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const eth = (window as any).ethereum;
          const provider = new ethers.BrowserProvider(eth);
          const network = await provider.getNetwork();

          if (network.chainId !== BigInt(11155111)) {
            try {
              await eth.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0xaa36a7" }],
              });
            } catch (e) {
              console.warn("Chain switch notice:", e);
            }
          }

          const signer = await provider.getSigner();
          const tx = await signer.sendTransaction({
            to: prosumerAddress,
            value: ethers.parseEther(totalEthCost.toString()),
          });

          setTxHash(tx.hash);

          // Log in backend
          fetch("http://localhost:5001/api/trade/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prosumerAddress,
              consumerAddress,
              units: transferUnits,
              ethPerUnit,
              totalEth: totalEthCost,
              txHash: tx.hash
            })
          }).catch(console.warn);

          runSuccessAnimation();
        } catch (err: any) {
          console.error("Direct MetaMask transaction error:", err);
          setStatus("error");
          setErrorMessage(err.message?.slice(0, 140) || "Transaction rejected in MetaMask");
        }
      } else {
        setStatus("error");
        setErrorMessage("Please enter the Teammate's Private Key or connect Buyer MetaMask to execute on-chain.");
      }
    }
  };

  const runSuccessAnimation = () => {
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx += 1;
      if (stepIdx < steps.length) {
        setCurrentStep(stepIdx);
      } else {
        clearInterval(interval);
        setProsumerSurplus((prev) => Math.max(0, prev - transferUnits));
        setConsumerRequiredUnits((prev) => Math.max(0, prev - transferUnits));
        setIsOutage(false);
        setStatus("completed");

        // Refresh live balances
        fetchBalance(prosumerAddress, setProsumerEthBalance);
        fetchBalance(consumerAddress, setConsumerEthBalance);
      }
    }, 700);
  };

  const handleReset = () => {
    setProsumerTotal(100);
    setProsumerRequired(70);
    setProsumerSurplus(30);
    setConsumerRequiredUnits(15);
    setTransferUnits(15);
    setIsOutage(true);
    setStatus("idle");
    setCurrentStep(0);
    setTxHash("");
    setErrorMessage("");
    fetchBalance(prosumerAddress, setProsumerEthBalance);
    fetchBalance(consumerAddress, setConsumerEthBalance);
  };

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      
      {/* Section Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-[#3A7D5C]/10 text-[#3A7D5C] border border-[#3A7D5C]/20 mb-3.5">
          <Sparkles className="w-3.5 h-3.5 text-[#3A7D5C]" />
          <span>Bilateral P2P Settlement Engine</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
          Direct Peer-to-Peer Energy Simulator
        </h2>
        <p className="text-[#6E6E73] max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Execute bilateral energy settlements directly between connected prosumer and consumer wallets on Ethereum Sepolia testnet with zero intermediary fees.
        </p>
      </div>

      {/* Main Interactive Stage */}
      <div className="relative bg-white rounded-3xl border border-[#D8D8DE] p-6 sm:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        
        <div className="relative z-10 flex flex-col items-center justify-between max-w-4xl mx-auto space-y-6">
          
          {/* ================= TOP: SELLER (YOU / PROSUMER - RECEIVES ETH) ================= */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-[#FBFBFC] border border-[#D8D8DE] hover:border-[#B0B0B8] transition-colors">
            
            {/* Prosumer Info Box */}
            <div className="flex-1 w-full space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#27845B]/10 text-[#27845B] border border-[#27845B]/20 uppercase tracking-wider">
                    Seller (Prosumer)
                  </span>
                  <span className="text-sm font-semibold text-[#1D1D1F]">Solar Prosumer Node Alpha</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#1D1D1F] font-mono bg-white px-3 py-1 rounded-lg border border-[#D8D8DE] shadow-xs">
                  <Wallet className="w-3.5 h-3.5 text-[#27845B]" />
                  <span>{prosumerEthBalance} SepoliaETH</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-[11px] font-medium uppercase text-[#6E6E73] tracking-wider">
                    Seller Wallet Address (Receives SepoliaETH)
                  </label>
                  <button
                    onClick={connectSellerMetaMask}
                    className="text-[11px] font-medium text-[#3A7D5C] hover:text-[#27845B] transition cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    {sellerConnected ? "MetaMask Connected ✓" : "Connect MetaMask"}
                  </button>
                </div>
                <input
                  type="text"
                  value={prosumerAddress}
                  onChange={(e) => setProsumerAddress(e.target.value)}
                  className="w-full text-xs font-mono text-[#1D1D1F] bg-white px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] focus:outline-none focus:border-[#3A7D5C] shadow-xs transition"
                  placeholder="0x..."
                />
              </div>

              {/* Energy Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-white border border-[#D8D8DE] text-center shadow-xs">
                  <span className="text-[10px] text-[#6E6E73] uppercase tracking-wider block font-medium">Solar Gen</span>
                  <span className="text-base font-semibold text-[#D99A22]">{prosumerTotal} <span className="text-xs text-[#6E6E73] font-normal">units</span></span>
                </div>
                <div className="p-3 rounded-xl bg-white border border-[#D8D8DE] text-center shadow-xs">
                  <span className="text-[10px] text-[#6E6E73] uppercase tracking-wider block font-medium">Self Load</span>
                  <span className="text-base font-semibold text-[#1D1D1F]">{prosumerRequired} <span className="text-xs text-[#6E6E73] font-normal">units</span></span>
                </div>
                <div className="p-3 rounded-xl bg-[#27845B]/10 border border-[#27845B]/20 text-center shadow-xs">
                  <span className="text-[10px] text-[#27845B] font-medium uppercase tracking-wider block">Net Surplus</span>
                  <span className="text-base font-bold text-[#27845B]">+{prosumerSurplus} <span className="text-xs text-[#27845B]/80 font-normal">units</span></span>
                </div>
              </div>
            </div>

            {/* Prosumer Building Architectural SVG */}
            <div className="relative flex flex-col items-center justify-center p-3 bg-[#F5F5F7] rounded-2xl border border-[#D8D8DE] w-44 h-44 shrink-0 shadow-inner">
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D99A22] animate-pulse" />
                <span className="text-[9px] text-[#D99A22] font-mono font-semibold">SOLAR ACTIVE</span>
              </div>
              
              <svg className="w-32 h-32 overflow-visible" viewBox="0 0 160 160" fill="none">
                <defs>
                  <linearGradient id="solarGlass" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                  <linearGradient id="warmLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>

                <circle cx="80" cy="80" r="70" fill="rgba(39,132,91,0.06)" />
                <rect x="62" y="24" width="10" height="18" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
                <rect x="60" y="22" width="14" height="3" fill="#64748b" />
                <polygon points="40,65 125,48 142,120 40,132" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.2" />
                <polygon points="26,62 58,58 58,135 26,135" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                <polygon points="20,62 82,28 148,46 75,76" fill="url(#roofGrad)" stroke="#334155" strokeWidth="1.5" />
                <polygon points="82,28 148,46 138,118 78,110" fill="#334155" opacity="0.9" />

                {/* Rooftop Solar PV */}
                <polygon points="34,58 78,34 135,48 88,70" fill="url(#solarGlass)" stroke="#38bdf8" strokeWidth="1.2" />
                <line x1="48" y1="52" x2="102" y2="64" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="62" y1="44" x2="118" y2="56" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="60" y1="40" x2="48" y2="64" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="82" y1="36" x2="70" y2="66" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="104" y1="42" x2="92" y2="68" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="122" y1="46" x2="110" y2="62" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <polygon points="38,56 60,44 75,54 50,65" fill="rgba(255,255,255,0.25)" />

                {/* Architectural Windows */}
                <rect x="31" y="70" width="10" height="22" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <rect x="43" y="70" width="10" height="22" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <rect x="31" y="104" width="10" height="24" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <rect x="43" y="104" width="10" height="24" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <rect x="68" y="72" width="28" height="16" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <rect x="68" y="98" width="28" height="22" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1.2" />
                <line x1="82" y1="72" x2="82" y2="88" stroke="#cbd5e1" strokeWidth="1" />
                <line x1="82" y1="98" x2="82" y2="120" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="110" y="70" width="24" height="24" rx="1" fill="url(#warmLight)" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="108" y="84" width="28" height="10" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="0.8" />
              </svg>
              
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#1D1D1F] font-mono">
                <Sun className="w-3.5 h-3.5 text-[#D99A22]" />
                <span>Rooftop PV (5.0 kWp)</span>
              </div>
            </div>

          </div>


          {/* ================= MIDDLE: FLOW & UNIT COUNTER CONTROLS ================= */}
          <div className="w-full flex flex-col items-center justify-center relative space-y-2">
            
            {/* Top Connector */}
            <div className="h-6 w-px bg-[#D8D8DE]" />

            {/* Trade Configuration Card */}
            <div className="z-20 w-full max-w-xl p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-[0_4px_16px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-5">
              
              {/* Unit Incrementer / Decrementer */}
              <div className="space-y-1.5 text-center sm:text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] block">
                  Energy Transfer Volume
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDecrement}
                    disabled={status === "executing" || transferUnits <= 1}
                    className="w-9 h-9 rounded-xl bg-[#F5F5F7] hover:bg-[#EBEBEF] disabled:opacity-30 text-[#1D1D1F] flex items-center justify-center border border-[#D8D8DE] transition cursor-pointer"
                    aria-label="Decrease units"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-bold text-[#1D1D1F] font-mono min-w-[70px] text-center">
                    {transferUnits} <span className="text-xs text-[#6E6E73] font-normal">units</span>
                  </span>
                  <button
                    onClick={handleIncrement}
                    disabled={status === "executing" || transferUnits >= prosumerSurplus}
                    className="w-9 h-9 rounded-xl bg-[#F5F5F7] hover:bg-[#EBEBEF] disabled:opacity-30 text-[#1D1D1F] flex items-center justify-center border border-[#D8D8DE] transition cursor-pointer"
                    aria-label="Increase units"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rate & Total ETH calculation */}
              <div className="p-3.5 rounded-xl bg-[#F5F5F7] border border-[#E5E5EA] text-right space-y-1 min-w-[190px]">
                <div className="text-[10px] text-[#6E6E73] uppercase font-mono tracking-wider">
                  Tariff: <strong className="text-[#27845B]">0.2 ETH / unit</strong>
                </div>
                <div className="text-xs text-[#6E6E73]">Consumer Pays Prosumer:</div>
                <div className="text-lg font-bold text-[#5277D5] font-mono">
                  {totalEthCost} <span className="text-xs text-[#6E6E73]">SepoliaETH</span>
                </div>
              </div>

            </div>

            {/* Bottom Connector */}
            <div className="h-6 w-px bg-[#D8D8DE]" />

          </div>


          {/* ================= BOTTOM: BUYER (TEAMMATE / CONSUMER - PAYS ETH) ================= */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-[#FBFBFC] border border-[#D8D8DE] hover:border-[#B0B0B8] transition-colors">
            
            {/* Consumer Info Box */}
            <div className="flex-1 w-full space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20">
                    Buyer (Consumer)
                  </span>
                  <span className="text-sm font-semibold text-[#1D1D1F]">Consumer Node Beta</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#1D1D1F] font-mono bg-white px-3 py-1 rounded-lg border border-[#D8D8DE] shadow-xs">
                  <Wallet className="w-3.5 h-3.5 text-[#5277D5]" />
                  <span>{consumerEthBalance} SepoliaETH</span>
                </div>
              </div>

              {/* Teammate Address & Connect Buyer MetaMask */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-[11px] font-medium uppercase text-[#6E6E73] tracking-wider">
                    Buyer Wallet Address (Sends SepoliaETH)
                  </label>
                  <button
                    onClick={connectBuyerMetaMask}
                    className="text-[11px] font-medium text-[#5277D5] hover:text-[#5277D5]/80 transition cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    {buyerConnected ? "Buyer Connected ✓" : "Connect Buyer MetaMask"}
                  </button>
                </div>
                <input
                  type="text"
                  value={consumerAddress}
                  onChange={(e) => setConsumerAddress(e.target.value)}
                  className="w-full text-xs font-mono text-[#1D1D1F] bg-white px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] focus:outline-none focus:border-[#5277D5] shadow-xs transition"
                  placeholder="0x..."
                />
              </div>

              {/* Teammate Private Key (for automatic backend signing) */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-[11px] font-medium uppercase text-[#8271B8] tracking-wider flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Buyer Signer Private Key (Automated Transfer)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-[#6E6E73] hover:text-[#1D1D1F] flex items-center gap-1 cursor-pointer transition"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={buyerPrivateKey}
                  onChange={(e) => setBuyerPrivateKey(e.target.value)}
                  className="w-full text-xs font-mono text-[#8271B8] bg-white px-3.5 py-2.5 rounded-xl border border-[#D8D8DE] focus:outline-none focus:border-[#8271B8] placeholder:text-[#94A3B8] shadow-xs transition"
                  placeholder="Paste Sepolia private key for instant backend execution..."
                />
                <span className="text-[10px] text-[#6E6E73] block font-mono">
                  Used by Express backend (/api/trade/execute-auto) to sign and dispatch {totalEthCost} SepoliaETH.
                </span>
              </div>

              {/* Status Banner */}
              <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                isOutage 
                  ? "bg-[#D94F58]/10 border-[#D94F58]/20 text-[#D94F58]" 
                  : "bg-[#27845B]/10 border-[#27845B]/20 text-[#27845B]"
              }`}>
                <div className="flex items-center gap-2.5">
                  {isOutage ? (
                    <AlertTriangle className="w-4 h-4 text-[#D94F58] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#27845B] shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide">
                      {isOutage ? "Deficit Detected — Energy Needed" : "Outage Mitigated via Solar P2P"}
                    </div>
                    <div className="text-[11px] opacity-80 font-mono">
                      {isOutage 
                        ? `Required: ${consumerRequiredUnits} units • Escrow cost: ${totalEthCost} ETH`
                        : `${transferUnits} units delivered from Solar Rooftop Alpha`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consumer Building Architectural SVG */}
            <div className="relative flex flex-col items-center justify-center p-3 rounded-2xl border border-[#D8D8DE] w-44 h-44 shrink-0 transition-colors bg-[#F5F5F7] shadow-inner">
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                <span className={`w-1.5 h-1.5 rounded-full ${isOutage ? "bg-[#D94F58] animate-pulse" : "bg-[#27845B]"}`} />
                <span className={`text-[9px] font-mono font-semibold ${isOutage ? "text-[#D94F58]" : "text-[#27845B]"}`}>
                  {isOutage ? "GRID OUTAGE" : "ONLINE (P2P)"}
                </span>
              </div>
              
              <svg className="w-32 h-32 overflow-visible" viewBox="0 0 160 160" fill="none">
                <defs>
                  <linearGradient id="brickGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#b91c1c" />
                    <stop offset="50%" stopColor="#991b1b" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </linearGradient>
                  <linearGradient id="consumerWindowLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isOutage ? "#fee2e2" : "#fef08a"} />
                    <stop offset="100%" stopColor={isOutage ? "#fecaca" : "#f59e0b"} />
                  </linearGradient>
                </defs>

                <polygon points="95,45 140,55 140,135 95,135" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                <polygon points="35,55 95,45 95,135 35,135" fill="url(#brickGrad)" stroke="#7f1d1d" strokeWidth="1.2" />
                <line x1="35" y1="70" x2="95" y2="60" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="85" x2="95" y2="75" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="100" x2="95" y2="90" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="115" x2="95" y2="105" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <rect x="20" y="75" width="16" height="60" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />
                <rect x="18" y="72" width="20" height="4" fill="#b91c1c" />
                <polygon points="30,55 65,30 100,55" fill="#475569" stroke="#334155" strokeWidth="1.5" />
                <polygon points="65,30 100,55 145,45 110,24" fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
                <polygon points="18,72 35,52 52,72" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
                <line x1="35" y1="52" x2="35" y2="72" stroke="#d97706" strokeWidth="1.2" />
                <polygon points="65,36 82,20 99,36" fill="#78350f" stroke="#451a03" strokeWidth="1" />
                <rect x="42" y="86" width="38" height="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="40" y="80" width="42" height="7" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="0.8" />
                <rect x="46" y="62" width="30" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#451a03" strokeWidth="1.2" />
                <rect x="52" y="96" width="24" height="26" rx="1" fill="url(#consumerWindowLight)" stroke="#451a03" strokeWidth="1.2" />
                <rect x="108" y="60" width="14" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#64748b" strokeWidth="1" />
                <rect x="108" y="98" width="14" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#64748b" strokeWidth="1" />
                <rect x="25" y="128" width="110" height="8" fill="#78350f" />
              </svg>
              
              <div className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium font-mono ${
                isOutage ? "text-[#D94F58]" : "text-[#27845B]"
              }`}>
                {isOutage ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#D94F58]" />
                    <span>Brick Residence Beta</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#27845B]" />
                    <span>Powered via P2P</span>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* ================= ACTION CONTROLS & STATUS LOG ================= */}
          <div className="w-full pt-4 flex flex-col items-center space-y-5">
            
            {status === "idle" && (
              <button
                onClick={handleExecuteTrade}
                className="group relative inline-flex items-center gap-3 px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#1D1D1F] hover:bg-[#343438] shadow-sm transition-all transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-[#D99A22]" />
                <span>Execute On-Chain P2P Trade ({transferUnits} units • {totalEthCost} SepoliaETH)</span>
              </button>
            )}

            {status === "requesting_metamask" && (
              <div className="p-5 rounded-2xl bg-white border border-[#D8D8DE] shadow-sm text-center space-y-2">
                <div className="text-sm font-semibold text-[#5277D5] flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" /> Please Confirm Transaction in MetaMask...
                </div>
                <div className="text-xs text-[#6E6E73] font-mono">
                  Transferring {totalEthCost} SepoliaETH from Buyer ({consumerAddress.slice(0, 8)}...) to Seller ({prosumerAddress.slice(0, 8)}...)
                </div>
              </div>
            )}

            {status === "executing" && (
              <div className="w-full max-w-xl space-y-3.5 p-6 rounded-2xl bg-white border border-[#D8D8DE] shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#3A7D5C] animate-ping" />
                    Executing On-Chain Settlement...
                  </span>
                  <span className="font-mono text-[#6E6E73]">Step {currentStep + 1} of {steps.length}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-[#EBEBEF] overflow-hidden">
                  <div 
                    className="h-full bg-[#3A7D5C] transition-all duration-500" 
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>

                <div className="bg-[#F5F5F7] p-3.5 rounded-xl border border-[#E5E5EA] font-mono text-xs text-[#1D1D1F] space-y-0.5">
                  <div className="text-[#3A7D5C] font-semibold">{steps[currentStep].title}</div>
                  <div className="text-[#6E6E73] text-[11px]">{steps[currentStep].desc}</div>
                </div>
              </div>
            )}

            {status === "completed" && (
              <div className="w-full max-w-xl space-y-4 p-6 rounded-2xl bg-white border border-[#D8D8DE] shadow-sm text-center">
                <div className="inline-flex p-3 rounded-full bg-[#27845B]/10 text-[#27845B] mb-1">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-lg font-semibold text-[#1D1D1F]">Trade Settled On-Chain</h4>
                <p className="text-[#6E6E73] text-xs sm:text-sm">
                  {transferUnits} units dispatched to Consumer Beta. {totalEthCost} SepoliaETH transferred to Prosumer Alpha.
                </p>

                <div className="bg-[#F5F5F7] p-4 rounded-xl border border-[#E5E5EA] font-mono text-xs text-left space-y-2">
                  <div className="text-[#6E6E73] text-[11px]">Transaction Receipt:</div>
                  <div className="text-[#27845B] break-all flex items-center justify-between gap-2">
                    <span className="truncate">{txHash}</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-white hover:bg-[#EBEBEF] text-[#27845B] border border-[#D8D8DE] rounded-lg shrink-0 transition"
                    >
                      <span>Etherscan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-[#6E6E73] text-[11px] pt-2 flex items-center justify-between border-t border-[#E5E5EA]">
                    <span>Status: <strong className="text-[#1D1D1F]">Confirmed &amp; Logged</strong></span>
                    <span className="text-[#5277D5]">0.2 ETH / unit</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-[#D8D8DE] shadow-xs transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#6E6E73]" />
                    <span>Reset Simulator</span>
                  </button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="w-full max-w-xl p-5 rounded-2xl bg-[#D94F58]/10 border border-[#D94F58]/20 text-center space-y-2.5">
                <div className="text-xs font-semibold text-[#D94F58] flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Transaction Failed
                </div>
                <p className="text-xs text-[#1D1D1F] font-mono">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] border border-[#D8D8DE] shadow-xs transition cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            )}

          </div>

        </div>

      </div>

    </section>
  );
}
