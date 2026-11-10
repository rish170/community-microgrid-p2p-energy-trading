// Single source of truth for the 12 live community microgrid houses.
// Exactly 12 Ausgrid houses: 6 Solar (Prosumers) + 6 Non-Solar (Consumers).
// Arranged along a central road: North row (z = -4.5) and South row (z = 4.5), alternating Consumer and Prosumer.

export interface HouseConfig {
  index: number;
  id: string; // e.g. "C1", "P1", "C2", "P2", "C3", "P3", "P4", "C4", "P5", "C5", "P6", "C6"
  householdId: number; // Official Ausgrid household ID
  name: string;
  type: "prosumer" | "consumer";
  x: number;
  z: number;
  rotationY: number;
  isShowcase?: boolean; // Highlighted for real MetaMask transactions (P3, C1, C2)
  initialBatteryKwh?: number;
  batteryCapacityKwh?: number;
}

export const HOUSES_CONFIG: HouseConfig[] = [
  // Front / North Row (z = -4.5, facing South: rotationY = 0)
  {
    index: 0,
    id: "C1",
    householdId: 18,
    name: "Residence C1",
    type: "consumer",
    x: -12.5,
    z: -4.5,
    rotationY: 0,
    isShowcase: true, // Showcase Consumer 1
  },
  {
    index: 1,
    id: "P1",
    householdId: 282,
    name: "Residence P1",
    type: "prosumer",
    x: -7.5,
    z: -4.5,
    rotationY: 0,
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },
  {
    index: 2,
    id: "C2",
    householdId: 26,
    name: "Residence C2",
    type: "consumer",
    x: -2.5,
    z: -4.5,
    rotationY: 0,
    isShowcase: true, // Showcase Consumer 2
  },
  {
    index: 3,
    id: "P2",
    householdId: 33,
    name: "Residence P2",
    type: "prosumer",
    x: 2.5,
    z: -4.5,
    rotationY: 0,
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },
  {
    index: 4,
    id: "C3",
    householdId: 48,
    name: "Residence C3",
    type: "consumer",
    x: 7.5,
    z: -4.5,
    rotationY: 0,
  },
  {
    index: 5,
    id: "P3",
    householdId: 212,
    name: "Residence P3 (Node Alpha)",
    type: "prosumer",
    x: 12.5,
    z: -4.5,
    rotationY: 0,
    isShowcase: true, // Showcase Prosumer (Real MetaMask)
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },

  // Back / South Row (z = 4.5, facing North: rotationY = Math.PI)
  {
    index: 6,
    id: "P4",
    householdId: 55,
    name: "Residence P4",
    type: "prosumer",
    x: -12.5,
    z: 4.5,
    rotationY: Math.PI,
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },
  {
    index: 7,
    id: "C4",
    householdId: 90,
    name: "Residence C4",
    type: "consumer",
    x: -7.5,
    z: 4.5,
    rotationY: Math.PI,
  },
  {
    index: 8,
    id: "P5",
    householdId: 244,
    name: "Residence P5",
    type: "prosumer",
    x: -2.5,
    z: 4.5,
    rotationY: Math.PI,
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },
  {
    index: 9,
    id: "C5",
    householdId: 117,
    name: "Residence C5",
    type: "consumer",
    x: 2.5,
    z: 4.5,
    rotationY: Math.PI,
  },
  {
    index: 10,
    id: "P6",
    householdId: 112,
    name: "Residence P6",
    type: "prosumer",
    x: 7.5,
    z: 4.5,
    rotationY: Math.PI,
    initialBatteryKwh: 4.5,
    batteryCapacityKwh: 6.0,
  },
  {
    index: 11,
    id: "C6",
    householdId: 141,
    name: "Residence C6 (Node Beta)",
    type: "consumer",
    x: 12.5,
    z: 4.5,
    rotationY: Math.PI,
  },
];

export const SOLAR_HOUSEHOLD_IDS = [282, 33, 212, 55, 244, 112];
export const CONSUMER_HOUSEHOLD_IDS = [18, 26, 48, 90, 117, 141];
export const ALL_LIVE_HOUSEHOLD_IDS = HOUSES_CONFIG.map((h) => h.householdId);

export function getHouseByHouseholdId(householdId: number): HouseConfig | undefined {
  return HOUSES_CONFIG.find((h) => h.householdId === householdId);
}

export function getHouseById(id: string): HouseConfig | undefined {
  return HOUSES_CONFIG.find((h) => h.id === id);
}

// 3D Euclidean distance on the scene ground plane (X and Z)
export function get3DDistance(houseA: HouseConfig, houseB: HouseConfig): number {
  const dx = houseA.x - houseB.x;
  const dz = houseA.z - houseB.z;
  return Math.sqrt(dx * dx + dz * dz);
}
