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