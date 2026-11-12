import { ethers } from "ethers";

// The 9 dummy-wallet houses (excluding real-wallet houses: 212, 18, 26)
const DUMMY_HOUSEHOLD_IDS = [282, 33, 55, 244, 112, 48, 90, 117, 141];

for (const householdId of DUMMY_HOUSEHOLD_IDS) {
  const hash = ethers.id("microgrid-demo-house-" + householdId);
  const address = ethers.getAddress(ethers.dataSlice(hash, 12));
  console.log(`${householdId}: ${address}`);
}
