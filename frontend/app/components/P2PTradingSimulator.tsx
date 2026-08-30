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
    { title: "Smart Contract Escrow Match", desc: `${transferUnits} kWh Energy Tokens transferred to Buyer` },
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
      
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
          <Sparkles className="w-3.5 h-3.5" /> Direct Dual-Wallet P2P Trade
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4">
          Seller (You) <span className="text-emerald-400">↔</span> Buyer (Teammate)
        </h2>
        <p className="text-zinc-400 max-w-2xl mx-auto text-base sm:text-lg">
          Sell energy from your connected MetaMask wallet. The total ETH is automatically transferred from your teammate&apos;s wallet to yours on Sepolia.
        </p>
      </div>

      {/* Main Diagram Area */}
      <div className="relative bg-zinc-950/80 rounded-3xl border border-zinc-800/80 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        
        <div className="relative z-10 flex flex-col items-center justify-between max-w-4xl mx-auto space-y-8">
          
          {/* ================= TOP: SELLER (YOU / PROSUMER - RECEIVES ETH) ================= */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 hover:border-emerald-500/70 transition-all shadow-[0_0_25px_rgba(16,185,129,0.15)]">
            
            {/* Prosumer Info Box */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500 text-black uppercase">
                    SELLER (YOU)
                  </span>
                  <span className="text-sm font-semibold text-emerald-400">Solar Prosumer Node</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono bg-black/50 px-2.5 py-1 rounded-lg border border-zinc-800">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{prosumerEthBalance} SepoliaETH</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">
                    Your MetaMask Wallet Address (Receives Funds)
                  </label>
                  <button
                    onClick={connectSellerMetaMask}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    {sellerConnected ? "MetaMask Connected ✓" : "Connect My MetaMask"}
                  </button>
                </div>
                <input
                  type="text"
                  value={prosumerAddress}
                  onChange={(e) => setProsumerAddress(e.target.value)}
                  className="w-full text-xs font-mono text-emerald-400 bg-black/60 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-emerald-500"
                  placeholder="0x..."
                />
              </div>

              {/* Energy Stats Grid */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center">
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Total Gen</span>
                  <span className="text-base font-extrabold text-white">{prosumerTotal} <span className="text-xs text-zinc-500 font-normal">kWh</span></span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center">
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">Your Load</span>
                  <span className="text-base font-extrabold text-zinc-300">{prosumerRequired} <span className="text-xs text-zinc-500 font-normal">kWh</span></span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-center shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider block">Surplus to Sell</span>
                  <span className="text-base font-black text-emerald-400">{prosumerSurplus} <span className="text-xs text-emerald-500/80 font-normal">kWh</span></span>
                </div>
              </div>
            </div>

            {/* Prosumer Building Architectural SVG (Matching Photo 1) */}
            <div className="relative flex flex-col items-center justify-center p-3 bg-zinc-950/80 rounded-2xl border border-emerald-500/30 w-44 h-44 shrink-0 shadow-inner">
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[9px] text-emerald-400 font-mono font-bold">SOLAR ACTIVE</span>
              </div>
              
              <svg className="w-32 h-32 overflow-visible" viewBox="0 0 160 160" fill="none">
                <defs>
                  {/* Solar Panel Gradient */}
                  <linearGradient id="solarGlass" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="50%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#0284c7" />
                  </linearGradient>
                  {/* Roof Shadow */}
                  <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="100%" stopColor="#1e293b" />
                  </linearGradient>
                  {/* Window Glow */}
                  <linearGradient id="warmLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>

                {/* Sky/Atmosphere Glow */}
                <circle cx="80" cy="80" r="70" fill="rgba(16,185,129,0.06)" />

                {/* Chimney */}
                <rect x="62" y="24" width="10" height="18" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                <rect x="60" y="22" width="14" height="3" fill="#334155" />

                {/* Main House Cream Stucco Walls */}
                <polygon points="40,65 125,48 142,120 40,132" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />
                
                {/* Modern Dark Grey Cube Bump-out (as in reference Photo 1) */}
                <polygon points="26,62 58,58 58,135 26,135" fill="#475569" stroke="#334155" strokeWidth="1" />

                {/* Pitched Roof (Charcoal Tiles) */}
                <polygon points="20,62 82,28 148,46 75,76" fill="url(#roofGrad)" stroke="#0f172a" strokeWidth="1.5" />
                <polygon points="82,28 148,46 138,118 78,110" fill="#1e293b" opacity="0.9" />

                {/* ================= ROOFTOP SOLAR PV ARRAY (Photo 1) ================= */}
                <polygon points="34,58 78,34 135,48 88,70" fill="url(#solarGlass)" stroke="#38bdf8" strokeWidth="1.2" />
                
                {/* Solar Grid Wires & Photovoltaic Cells */}
                <line x1="48" y1="52" x2="102" y2="64" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="62" y1="44" x2="118" y2="56" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="60" y1="40" x2="48" y2="64" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="82" y1="36" x2="70" y2="66" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="104" y1="42" x2="92" y2="68" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                <line x1="122" y1="46" x2="110" y2="62" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />

                {/* Solar Glint Highlight */}
                <polygon points="38,56 60,44 75,54 50,65" fill="rgba(255,255,255,0.25)" />

                {/* Large Architectural Windows with Warm Golden Glow */}
                {/* Cube Windows */}
                <rect x="31" y="70" width="10" height="22" rx="1" fill="url(#warmLight)" stroke="#1e293b" strokeWidth="1.2" />
                <rect x="43" y="70" width="10" height="22" rx="1" fill="url(#warmLight)" stroke="#1e293b" strokeWidth="1.2" />
                
                {/* Lower Cube Window */}
                <rect x="31" y="104" width="10" height="24" rx="1" fill="url(#warmLight)" stroke="#1e293b" strokeWidth="1.2" />
                <rect x="43" y="104" width="10" height="24" rx="1" fill="url(#warmLight)" stroke="#1e293b" strokeWidth="1.2" />

                {/* Facade Picture Windows */}
                <rect x="68" y="72" width="28" height="16" rx="1" fill="url(#warmLight)" stroke="#334155" strokeWidth="1.2" />
                <rect x="68" y="98" width="28" height="22" rx="1" fill="url(#warmLight)" stroke="#334155" strokeWidth="1.2" />
                <line x1="82" y1="72" x2="82" y2="88" stroke="#334155" strokeWidth="1" />
                <line x1="82" y1="98" x2="82" y2="120" stroke="#334155" strokeWidth="1" />

                {/* Balcony with Glass Railing (Right side) */}
                <rect x="110" y="70" width="24" height="24" rx="1" fill="url(#warmLight)" stroke="#334155" strokeWidth="1" />
                <rect x="108" y="84" width="28" height="10" fill="rgba(56,189,248,0.25)" stroke="#38bdf8" strokeWidth="0.8" />
              </svg>
              
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-mono">
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Solar Rooftop Villa
              </div>
            </div>

          </div>


          {/* ================= MIDDLE: FLOW & UNIT COUNTER CONTROLS ================= */}
          <div className="w-full flex flex-col items-center justify-center my-0 relative space-y-3">
            
            {/* Top Flow Line */}
            <div className="h-10 w-1 flex flex-col items-center justify-center relative">
              <svg className="w-6 h-10 overflow-visible" viewBox="0 0 24 40">
                <line 
                  x1="12" y1="0" x2="12" y2="40" 
                  stroke={status === "executing" ? "#10b981" : "#38bdf8"} 
                  strokeWidth="3.5" 
                  strokeDasharray="6,6" 
                  className={status === "executing" ? "animate-energy-flow" : ""}
                />
              </svg>
            </div>

            {/* Smart Meter / Trade Configuration Card */}
            <div className="z-20 w-full max-w-xl p-5 rounded-2xl bg-zinc-900/95 border border-sky-500/40 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Unit Incrementer / Decrementer */}
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 block">
                  Energy to Sell (kWh)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDecrement}
                    disabled={status === "executing" || transferUnits <= 1}
                    className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white flex items-center justify-center border border-zinc-700 transition cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-2xl font-black text-white font-mono min-w-[60px] text-center">
                    {transferUnits} <span className="text-xs text-zinc-400 font-normal">kWh</span>
                  </span>
                  <button
                    onClick={handleIncrement}
                    disabled={status === "executing" || transferUnits >= prosumerSurplus}
                    className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white flex items-center justify-center border border-zinc-700 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rate & Total ETH calculation */}
              <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 text-right space-y-0.5 min-w-[170px]">
                <div className="text-[10px] text-zinc-400 uppercase font-mono">Fixed Tariff: <strong className="text-emerald-400">0.2 ETH / unit</strong></div>
                <div className="text-xs text-zinc-300">Teammate Pays You:</div>
                <div className="text-lg font-black text-sky-400 font-mono">
                  {totalEthCost} <span className="text-xs text-zinc-400">SepoliaETH</span>
                </div>
              </div>

            </div>

            {/* Bottom Flow Line */}
            <div className="h-10 w-1 flex flex-col items-center justify-center relative">
              <svg className="w-6 h-10 overflow-visible" viewBox="0 0 24 40">
                <line 
                  x1="12" y1="0" x2="12" y2="40" 
                  stroke={status === "executing" ? "#10b981" : "#38bdf8"} 
                  strokeWidth="3.5" 
                  strokeDasharray="6,6" 
                  className={status === "executing" ? "animate-energy-flow" : ""}
                />
              </svg>
            </div>

          </div>


          {/* ================= BOTTOM: BUYER (TEAMMATE / CONSUMER - PAYS ETH) ================= */}
          <div className={`w-full flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-zinc-900/90 border transition-all ${
            isOutage 
              ? "border-red-500/40 hover:border-red-500/70 outage-glow" 
              : "border-sky-500/40 hover:border-sky-500/70 shadow-[0_0_35px_rgba(56,189,248,0.25)]"
          }`}>
            
            {/* Consumer Info Box */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                    isOutage ? "bg-red-500 text-white" : "bg-sky-400 text-black"
                  }`}>
                    BUYER (TEAMMATE)
                  </span>
                  <span className="text-sm font-semibold text-zinc-300">Consumer Node</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono bg-black/50 px-2.5 py-1 rounded-lg border border-zinc-800">
                  <Wallet className="w-3.5 h-3.5 text-sky-400" />
                  <span>{consumerEthBalance} SepoliaETH</span>
                </div>
              </div>

              {/* Teammate Address & Connect Buyer MetaMask Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase text-zinc-400 tracking-wider">
                    Teammate&apos;s Buyer Wallet Address (Pays ETH)
                  </label>
                  <button
                    onClick={connectBuyerMetaMask}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer flex items-center gap-1"
                  >
                    <UserCheck className="w-3 h-3" />
                    {buyerConnected ? "Buyer Connected ✓" : "Connect Buyer MetaMask"}
                  </button>
                </div>
                <input
                  type="text"
                  value={consumerAddress}
                  onChange={(e) => setConsumerAddress(e.target.value)}
                  className="w-full text-xs font-mono text-sky-400 bg-black/60 px-3 py-2 rounded-lg border border-zinc-800 focus:outline-none focus:border-sky-500"
                  placeholder="0x..."
                />
              </div>

              {/* Teammate Private Key (for automatic backend signing) */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    Teammate&apos;s Private Key / Signer Key (for automatic payment)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <input
                  type={showKey ? "text" : "password"}
                  value={buyerPrivateKey}
                  onChange={(e) => setBuyerPrivateKey(e.target.value)}
                  className="w-full text-xs font-mono text-amber-300 bg-black/60 px-3 py-2 rounded-lg border border-amber-500/30 focus:outline-none focus:border-amber-400 placeholder:text-zinc-600"
                  placeholder="Enter teammate's private key to auto-transfer ETH from their wallet..."
                />
                <span className="text-[10px] text-zinc-400 block font-mono">
                  Used by Express backend to sign and send {totalEthCost} SepoliaETH to your wallet.
                </span>
              </div>

              {/* Status Flashcard */}
              <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                isOutage 
                  ? "bg-red-950/40 border-red-500/30 text-red-300" 
                  : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              }`}>
                <div className="flex items-center gap-2.5">
                  {isOutage ? (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase">
                      {isOutage ? "Power Outage Active (Teammate Demands Energy)" : "Power Outage Fully Mitigated via Solar P2P"}
                    </div>
                    <div className="text-[11px] opacity-80">
                      {isOutage 
                        ? `Deficit: ${consumerRequiredUnits} units • Auto-paying you ${totalEthCost} ETH @ 0.2 ETH/unit`
                        : `${transferUnits} kWh dispatched directly from your Solar Rooftop`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consumer Building Architectural SVG (Matching Photo 2 - Red Brick Villa, No Solar) */}
            <div className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border w-44 h-44 shrink-0 transition-colors shadow-inner ${
              isOutage 
                ? "bg-zinc-950/90 border-red-500/40" 
                : "bg-zinc-950/90 border-sky-500/40"
            }`}>
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                <span className={`w-2 h-2 rounded-full ${isOutage ? "bg-red-500 animate-ping" : "bg-emerald-400"}`} />
                <span className={`text-[9px] font-mono font-bold ${isOutage ? "text-red-400" : "text-emerald-400"}`}>
                  {isOutage ? "GRID OUTAGE" : "ONLINE (P2P)"}
                </span>
              </div>
              
              <svg className="w-32 h-32 overflow-visible" viewBox="0 0 160 160" fill="none">
                <defs>
                  {/* Red Brick Gradient */}
                  <linearGradient id="brickGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#b91c1c" />
                    <stop offset="50%" stopColor="#991b1b" />
                    <stop offset="100%" stopColor="#7f1d1d" />
                  </linearGradient>
                  {/* Timber Truss Color */}
                  <linearGradient id="timberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#92400e" />
                    <stop offset="100%" stopColor="#78350f" />
                  </linearGradient>
                  {/* Consumer Window Color (Dim/Red during Outage, Warm Gold when powered) */}
                  <linearGradient id="consumerWindowLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isOutage ? "#450a0a" : "#fef08a"} />
                    <stop offset="100%" stopColor={isOutage ? "#1f0404" : "#f59e0b"} />
                  </linearGradient>
                </defs>

                {/* Back / Side Cream Walls */}
                <polygon points="95,45 140,55 140,135 95,135" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />

                {/* Front Main Red-Brick Tower Facade (Photo 2) */}
                <polygon points="35,55 95,45 95,135 35,135" fill="url(#brickGrad)" stroke="#7f1d1d" strokeWidth="1.2" />

                {/* Brick Texture Lines */}
                <line x1="35" y1="70" x2="95" y2="60" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="85" x2="95" y2="75" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="100" x2="95" y2="90" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />
                <line x1="35" y1="115" x2="95" y2="105" stroke="#7f1d1d" strokeWidth="0.6" strokeDasharray="3,3" opacity="0.6" />

                {/* Left Brick Pillar Porch (Photo 2) */}
                <rect x="20" y="75" width="16" height="60" fill="#991b1b" stroke="#7f1d1d" strokeWidth="1" />
                <rect x="18" y="72" width="20" height="4" fill="#b91c1c" />

                {/* Multi-Tiered Slate Gabled Roofs with Overhangs (Photo 2 - No Solar) */}
                {/* Main Roof Tier */}
                <polygon points="30,55 65,30 100,55" fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
                <polygon points="65,30 100,55 145,45 110,24" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

                {/* Wooden Truss Triangular Overhang (Photo 2) */}
                <polygon points="18,72 35,52 52,72" fill="#78350f" stroke="#451a03" strokeWidth="1.2" />
                {/* Truss Struts */}
                <line x1="35" y1="52" x2="35" y2="72" stroke="#d97706" strokeWidth="1.2" />
                <line x1="26" y1="62" x2="44" y2="62" stroke="#d97706" strokeWidth="1" />
                <line x1="22" y1="72" x2="35" y2="62" stroke="#d97706" strokeWidth="1" />
                <line x1="48" y1="72" x2="35" y2="62" stroke="#d97706" strokeWidth="1" />

                {/* Upper Triangular Gable Attic Feature (Photo 2) */}
                <polygon points="65,36 82,20 99,36" fill="#78350f" stroke="#451a03" strokeWidth="1" />
                <line x1="82" y1="20" x2="82" y2="36" stroke="#d97706" strokeWidth="1" />

                {/* Center Balcony with Glass Railing (Photo 2) */}
                <rect x="42" y="86" width="38" height="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                <rect x="40" y="80" width="42" height="7" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="0.8" />

                {/* Large Wooden Grid Picture Windows */}
                {/* Upper Floor Balcony French Doors */}
                <rect x="46" y="62" width="30" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#451a03" strokeWidth="1.2" />
                <line x1="61" y1="62" x2="61" y2="86" stroke="#451a03" strokeWidth="1" />
                <line x1="46" y1="74" x2="76" y2="74" stroke="#451a03" strokeWidth="1" />

                {/* Ground Floor Windows */}
                <rect x="52" y="96" width="24" height="26" rx="1" fill="url(#consumerWindowLight)" stroke="#451a03" strokeWidth="1.2" />
                <line x1="64" y1="96" x2="64" y2="122" stroke="#451a03" strokeWidth="1" />
                <line x1="52" y1="108" x2="76" y2="108" stroke="#451a03" strokeWidth="1" />

                {/* Right Side Wall Windows */}
                <rect x="108" y="60" width="14" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#64748b" strokeWidth="1" />
                <rect x="108" y="98" width="14" height="24" rx="1" fill="url(#consumerWindowLight)" stroke="#64748b" strokeWidth="1" />

                {/* Landscaping / Shrub Planter Box at base */}
                <rect x="25" y="128" width="110" height="8" fill="#78350f" />
                <circle cx="35" cy="126" r="5" fill="#15803d" />
                <circle cx="48" cy="125" r="6" fill="#166534" />
                <circle cx="85" cy="126" r="5" fill="#15803d" />
                <circle cx="102" cy="125" r="6" fill="#166534" />
              </svg>
              
              <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold font-mono ${
                isOutage ? "text-red-400" : "text-sky-400"
              }`}>
                {isOutage ? (
                  <>
                    <Zap className="w-3.5 h-3.5 text-red-500 line-through" /> Brick Villa (Outage)
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-emerald-400" /> Powered via Solar Bridge
                  </>
                )}
              </div>
            </div>

          </div>

          {/* ================= ACTION CONTROLS & STATUS LOG ================= */}
          <div className="w-full pt-4 flex flex-col items-center space-y-6">
            
            {status === "idle" && (
              <button
                onClick={handleExecuteTrade}
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold text-black bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 hover:from-emerald-300 hover:to-sky-300 shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] transform hover:-translate-y-0.5 transition-all active:scale-95 cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-black group-hover:scale-110 transition-transform" />
                <span>Execute On-Chain Trade (Sell {transferUnits} kWh & Receive {totalEthCost} SepoliaETH)</span>
              </button>
            )}

            {status === "requesting_metamask" && (
              <div className="p-4 rounded-2xl bg-sky-950/60 border border-sky-500/50 text-center space-y-2 animate-pulse">
                <div className="text-sm font-bold text-sky-400 flex items-center justify-center gap-2">
                  <Wallet className="w-4 h-4" /> Please Confirm Transaction in MetaMask Popup...
                </div>
                <div className="text-xs text-zinc-300 font-mono">
                  Transferring {totalEthCost} SepoliaETH from Buyer ({consumerAddress.slice(0, 8)}...) to Seller ({prosumerAddress.slice(0, 8)}...)
                </div>
              </div>
            )}

            {status === "executing" && (
              <div className="w-full max-w-xl space-y-4 p-5 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 animate-pulse-glow">
                <div className="flex items-center justify-between text-sm font-semibold text-emerald-400">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    Executing On-Chain Transfer (Teammate &rarr; You)...
                  </span>
                  <span>Step {currentStep + 1} of {steps.length}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-500" 
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>

                <div className="text-left bg-black/50 p-3 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
                  <div className="text-emerald-400 font-bold">{steps[currentStep].title}</div>
                  <div className="text-zinc-400">{steps[currentStep].desc}</div>
                </div>
              </div>
            )}

            {status === "completed" && (
              <div className="w-full max-w-xl space-y-4 p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center">
                <div className="inline-flex p-3 rounded-full bg-emerald-500/20 text-emerald-400 mb-1">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-white">Trade Executed & Settled On-Chain!</h4>
                <p className="text-zinc-300 text-xs sm:text-sm">
                  {transferUnits} kWh was transferred to your Teammate. 
                  {totalEthCost} SepoliaETH was successfully transferred from Teammate&apos;s wallet to your wallet!
                </p>

                <div className="bg-black/60 p-3 rounded-xl border border-zinc-800 font-mono text-xs text-left space-y-1.5">
                  <div className="text-zinc-400">Sepolia Transaction Hash:</div>
                  <div className="text-emerald-400 break-all flex items-center justify-between">
                    <span className="truncate mr-2">{txHash}</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded shrink-0 transition"
                    >
                      <span>View on Etherscan</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-zinc-400 text-[11px] pt-1 flex items-center justify-between border-t border-zinc-800">
                    <span>Backend Status: <strong>Confirmed &amp; Logged</strong></span>
                    <span className="text-sky-400">Rate: 0.2 ETH/kWh</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset &amp; Sell Again
                  </button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="w-full max-w-xl p-4 rounded-2xl bg-red-950/60 border border-red-500/50 text-center space-y-3">
                <div className="text-sm font-bold text-red-400 flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Transaction Error
                </div>
                <p className="text-xs text-zinc-300 font-mono">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white"
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
