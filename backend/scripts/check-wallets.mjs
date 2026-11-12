import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from backend, data-api, or repo root
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../../data-api/.env") });
dotenv.config({ path: resolve(__dirname, "../../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log("\n[INFO] Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  console.log("Provide them via environment variables or in backend/.env or data-api/.env.");
  process.exit(0);
}

const HOUSEHOLD_LABELS = {
  282: "P1",
  33:  "P2",
  212: "P3",
  55:  "P4",
  244: "P5",
  112: "P6",
  18:  "C1",
  26:  "C2",
  48:  "C3",
  90:  "C4",
  117: "C5",
  141: "C6",
};

const REAL_WALLET_IDS = new Set([212, 18, 26]);

async function checkWallets() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("\n================================================================================");
  console.log("LIVE MICROGRID HOUSEHOLDS - WALLET & ZONE AUDIT");
  console.log("================================================================================");

  const { data: rows, error } = await supabase
    .from("households")
    .select("household_id, role, zone_id, wallet_address, in_live_sim")
    .eq("in_live_sim", true)
    .order("household_id", { ascending: true });

  if (error) {
    console.error(`[FAIL] Error querying 'households' table: ${error.message}`);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.warn("[WARN] No households found with in_live_sim = true.");
    process.exit(0);
  }

  let hasDummyError = false;
  let realPendingCount = 0;

  const tableHeaders = [
    { key: "id", title: "ID", width: 4 },
    { key: "label", title: "Label", width: 6 },
    { key: "role", title: "Role", width: 9 },
    { key: "zone", title: "Zone", width: 5 },
    { key: "address", title: "Wallet Address", width: 44 },
    { key: "status", title: "Status", width: 23 },
  ];

  const headerStr = tableHeaders.map(h => h.title.padEnd(h.width)).join(" | ");
  const sepStr = tableHeaders.map(h => "-".repeat(h.width)).join("-+-");

  console.log(headerStr);
  console.log(sepStr);

  for (const r of rows) {
    const hid = r.household_id;
    const label = HOUSEHOLD_LABELS[hid] || "N/A";
    const role = r.role || "unknown";
    const zone = r.zone_id !== null && r.zone_id !== undefined ? String(r.zone_id) : "NULL";
    const addr = r.wallet_address || "(empty)";
    const isReal = REAL_WALLET_IDS.has(hid);

    const isValid = addr !== "(empty)" && ethers.isAddress(addr);

    let status = "";
    if (isReal) {
      if (isValid) {
        status = "REAL-WALLET (VALID)";
      } else {
        status = "REAL-WALLET (PENDING)";
        realPendingCount++;
      }
    } else {
      if (isValid) {
        status = "VALID";
      } else {
        status = "INVALID (DUMMY FAIL)";
        hasDummyError = true;
      }
    }

    const rowStr = [
      String(hid).padEnd(4),
      label.padEnd(6),
      role.padEnd(9),
      zone.padEnd(5),
      addr.padEnd(44),
      status.padEnd(23),
    ].join(" | ");

    console.log(rowStr);
  }

  console.log("================================================================================\n");

  if (realPendingCount > 0) {
    console.log(`[NOTICE] ${realPendingCount} real-wallet showcase house(s) are pending manual address assignment.`);
    console.log("         (This is expected until you run the real-wallet template update).\n");
  }

  if (hasDummyError) {
    console.error("[RESULT] AUDIT FAILED: One or more dummy houses have invalid or unchecksummed addresses.\n");
    process.exitCode = 1;
  } else {
    console.log("[RESULT] AUDIT PASSED: All dummy wallet addresses are structurally valid EIP-55 hashes.\n");
    process.exitCode = 0;
  }
}

checkWallets().catch((err) => {
  console.error("[FATAL]", err);
  process.exitCode = 1;
});
