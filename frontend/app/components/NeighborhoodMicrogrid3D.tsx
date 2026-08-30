"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { 
  Zap, 
  Sun, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  Wallet
} from "lucide-react";

// Types for House Data
export interface HouseData {
  id: string;
  name: string;
  type: "prosumer" | "consumer";
  x: number;
  z: number;
  rotationY: number;
  roofType: "gabled" | "hipped" | "flat";
  height: number;
  width: number;
  depth: number;
  wallColor: string;
  roofColor: string;
  solarKwh: number;
  usageKwh: number;
  surplusKwh: number;
  walletAddress: string;
  isOutage?: boolean;
}

// 12 Neighborhood Houses (Prosumers = Cream Modern Solar Villas | Consumers = Red-Brick Terracotta Villas)
export const NEIGHBORHOOD_HOUSES: HouseData[] = [
  // North Row (z = -4.5)
  { id: "H01", name: "Residence 01", type: "prosumer", x: -12.5, z: -4.5, rotationY: 0, roofType: "gabled", height: 2.2, width: 2.8, depth: 2.6, wallColor: "#f8fafc", roofColor: "#334155", solarKwh: 12.4, usageKwh: 6.2, surplusKwh: 6.2, walletAddress: "0x11A2...8F01" },
  { id: "H02", name: "Residence 02", type: "consumer", x: -7.5, z: -4.5, rotationY: 0, roofType: "hipped", height: 2.0, width: 2.6, depth: 2.5, wallColor: "#991b1b", roofColor: "#1e293b", solarKwh: 0, usageKwh: 8.5, surplusKwh: -8.5, walletAddress: "0x22B3...4E12", isOutage: false },
  { id: "H03", name: "Residence 03", type: "prosumer", x: -2.5, z: -4.5, rotationY: 0, roofType: "gabled", height: 2.4, width: 3.0, depth: 2.7, wallColor: "#f8fafc", roofColor: "#1e293b", solarKwh: 16.8, usageKwh: 7.0, surplusKwh: 9.8, walletAddress: "0x33C4...9D23" },
  { id: "H04", name: "Residence 04 (Node Alpha)", type: "prosumer", x: 2.5, z: -4.5, rotationY: 0, roofType: "gabled", height: 2.3, width: 2.9, depth: 2.6, wallColor: "#f8fafc", roofColor: "#334155", solarKwh: 100.0, usageKwh: 70.0, surplusKwh: 30.0, walletAddress: "0x3C44...93BC" },
  { id: "H05", name: "Residence 05", type: "consumer", x: 7.5, z: -4.5, rotationY: 0, roofType: "hipped", height: 2.1, width: 2.7, depth: 2.5, wallColor: "#b91c1c", roofColor: "#1e293b", solarKwh: 0, usageKwh: 9.1, surplusKwh: -9.1, walletAddress: "0x55E6...1B45" },
  { id: "H06", name: "Residence 06", type: "prosumer", x: 12.5, z: -4.5, rotationY: 0, roofType: "flat", height: 2.2, width: 2.8, depth: 2.6, wallColor: "#f1f5f9", roofColor: "#1e293b", solarKwh: 14.2, usageKwh: 5.8, surplusKwh: 8.4, walletAddress: "0x66F7...7A56" },

  // South Row (z = 4.5)
  { id: "H07", name: "Residence 07", type: "consumer", x: -12.5, z: 4.5, rotationY: Math.PI, roofType: "hipped", height: 2.0, width: 2.6, depth: 2.5, wallColor: "#991b1b", roofColor: "#1e293b", solarKwh: 0, usageKwh: 11.2, surplusKwh: -11.2, walletAddress: "0x77A8...3C67" },
  { id: "H08", name: "Residence 08", type: "prosumer", x: -7.5, z: 4.5, rotationY: Math.PI, roofType: "gabled", height: 2.3, width: 2.9, depth: 2.6, wallColor: "#f8fafc", roofColor: "#1e293b", solarKwh: 18.5, usageKwh: 8.0, surplusKwh: 10.5, walletAddress: "0x88B9...2E78" },
  { id: "H09", name: "Residence 09", type: "consumer", x: -2.5, z: 4.5, rotationY: Math.PI, roofType: "flat", height: 2.1, width: 2.7, depth: 2.5, wallColor: "#b91c1c", roofColor: "#1e293b", solarKwh: 0, usageKwh: 7.8, surplusKwh: -7.8, walletAddress: "0x99C0...9F89" },
  { id: "H10", name: "Residence 10 (Node Beta)", type: "consumer", x: 2.5, z: 4.5, rotationY: Math.PI, roofType: "hipped", height: 2.2, width: 2.8, depth: 2.6, wallColor: "#991b1b", roofColor: "#1e293b", solarKwh: 0, usageKwh: 15.0, surplusKwh: -15.0, walletAddress: "0x71C7...976F", isOutage: true },
  { id: "H11", name: "Residence 11", type: "prosumer", x: 7.5, z: 4.5, rotationY: Math.PI, roofType: "gabled", height: 2.4, width: 3.0, depth: 2.7, wallColor: "#f8fafc", roofColor: "#1e293b", solarKwh: 21.0, usageKwh: 9.4, surplusKwh: 11.6, walletAddress: "0xBBD2...6C01" },
  { id: "H12", name: "Residence 12", type: "consumer", x: 12.5, z: 4.5, rotationY: Math.PI, roofType: "hipped", height: 2.0, width: 2.6, depth: 2.5, wallColor: "#b91c1c", roofColor: "#1e293b", solarKwh: 0, usageKwh: 10.4, surplusKwh: -10.4, walletAddress: "0xCCE3...8D12" },
];

// Single Procedural Architectural House
function House3D({ 
  house, 
  isSelected, 
  isHovered, 
  onSelect, 
  onHover
}: { 
  house: HouseData; 
  isSelected: boolean; 
  isHovered: boolean; 
  onSelect: () => void; 
  onHover: (hovered: boolean) => void;
}) {
  const isProsumer = house.type === "prosumer";

  return (
    <group 
      position={[house.x, house.height / 2, house.z]} 
      rotation={[0, house.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        onHover(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        onHover(false);
      }}
    >
      {/* House Base / Walls */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[house.width, house.height, house.depth]} />
        <meshStandardMaterial 
          color={isSelected ? "#a7f3d0" : isHovered ? "#ffffff" : house.wallColor}
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Front Door */}
      <mesh position={[0, -house.height / 2 + 0.55, house.depth / 2 + 0.02]}>
        <planeGeometry args={[0.65, 1.1]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>

      {/* Windows with Warm Golden Interior Light */}
      <group position={[0, 0.2, house.depth / 2 + 0.02]}>
        <mesh position={[-0.8, 0, 0]}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial 
            color={house.isOutage ? "#450a0a" : "#fef08a"} 
          />
        </mesh>
        <mesh position={[0.8, 0, 0]}>
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial 
            color={house.isOutage ? "#450a0a" : "#fef08a"} 
          />
        </mesh>
      </group>

      {/* Roof Architecture */}
      {house.roofType === "gabled" && (
        <mesh position={[0, house.height / 2 + 0.55, 0]} castShadow>
          <coneGeometry args={[house.width * 0.74, 1.1, 4]} />
          <meshStandardMaterial color={house.roofColor} roughness={0.5} />
        </mesh>
      )}

      {house.roofType === "hipped" && (
        <mesh position={[0, house.height / 2 + 0.42, 0]} castShadow>
          <coneGeometry args={[house.width * 0.7, 0.85, 4]} />
          <meshStandardMaterial color={house.roofColor} roughness={0.5} />
        </mesh>
      )}

      {house.roofType === "flat" && (
        <mesh position={[0, house.height / 2 + 0.08, 0]} castShadow>
          <boxGeometry args={[house.width + 0.15, 0.16, house.depth + 0.15]} />
          <meshStandardMaterial color={house.roofColor} roughness={0.4} />
        </mesh>
      )}

      {/* Rooftop Solar PV Panels on Prosumers */}
      {isProsumer && (
        <group position={[0, house.height / 2 + 0.65, 0.2]} rotation={[-0.35, 0, 0]}>
          {/* Panel Frame */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[house.width * 0.72, 0.05, 1.25]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Glossy Photovoltaic Blue Cells */}
          <mesh position={[0, 0.03, 0]}>
            <planeGeometry args={[house.width * 0.68, 1.15]} />
            <meshStandardMaterial 
              color="#0284c7"
              emissive={isSelected ? "#10b981" : "#0369a1"}
              emissiveIntensity={isSelected ? 0.9 : 0.4}
              roughness={0.1}
              metalness={0.8}
            />
          </mesh>
        </group>
      )}

      {/* Front Yard Grass & Concrete Walkway */}
      <mesh position={[0, -house.height / 2 + 0.01, house.depth / 2 + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[house.width + 0.4, 1.2]} />
        <meshStandardMaterial color="#166534" roughness={0.7} />
      </mesh>

      {/* Garden Tree */}
      <group position={[house.width / 2 + 0.35, -house.height / 2, house.depth / 2 + 0.5]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.09, 0.8]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <dodecahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial color="#15803d" roughness={0.6} />
        </mesh>
      </group>

      {/* Floating Tag */}
      {(isHovered || isSelected) && (
        <Html position={[0, house.height + 1.2, 0]} center distanceFactor={20}>
          <div className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-wider pointer-events-none shadow-xl transition-all ${
            isSelected 
              ? "bg-emerald-400 text-black ring-2 ring-emerald-500" 
              : "bg-zinc-900 text-white border border-zinc-700"
          }`}>
            {house.id} {isProsumer ? "• SOLAR PROSUMER" : house.isOutage ? "• OUTAGE" : "• CONSUMER"}
          </div>
        </Html>
      )}
    </group>
  );
}

// Street, Sidewalks, Street Lamps & Landscaping
function NeighborhoodEnvironment() {
  return (
    <group>
      {/* Ground Lawn Plane */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[46, 26]} />
        <meshStandardMaterial color="#14532d" roughness={0.8} />
      </mesh>

      {/* Center Asphalt Road */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[42, 4.2]} />
        <meshStandardMaterial color="#27272a" roughness={0.6} />
      </mesh>

      {/* Road Center Dashed Line */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 0.15]} />
        <meshBasicMaterial color="#e4e4e7" />
      </mesh>

      {/* North Concrete Sidewalk */}
      <mesh position={[0, 0.02, -2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 0.9]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.5} />
      </mesh>

      {/* South Concrete Sidewalk */}
      <mesh position={[0, 0.02, 2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 0.9]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.5} />
      </mesh>

      {/* Street Lamps along the sidewalk */}
      {[-10, -3.5, 3.5, 10].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0, -2.2]}>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 2.6]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          <mesh position={[0, 2.6, 0.25]}>
            <boxGeometry args={[0.16, 0.1, 0.4]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <pointLight 
            position={[0, 2.4, 0.25]} 
            intensity={1.8} 
            distance={8.0} 
            color="#fef08a" 
          />
        </group>
      ))}
    </group>
  );
}

// Microgrid Energy Flow Particles between Houses
function MicrogridEnergyFlow({ 
  houses, 
  activeTrade 
}: { 
  houses: HouseData[]; 
  activeTrade: { from: string; to: string } | null;
}) {
  const particlesRef = useRef<THREE.Points>(null!);
  const count = 90;

  const [positions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 1] = 0.12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return [pos];
  }, [count]);

  useFrame((_, delta) => {
    if (particlesRef.current) {
      const arr = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] += delta * 3.2;
        if (arr[i * 3] > 18) arr[i * 3] = -18;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Underground Microgrid Conduit Line */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 0.08]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>

      {/* Energy Flow Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          color="#34d399"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Active Trade Energy Beam */}
      {activeTrade && (
        <ActiveTradeBeam fromHouseId={activeTrade.from} toHouseId={activeTrade.to} houses={houses} />
      )}
    </group>
  );
}

// Active Trade Beam between two specific houses
function ActiveTradeBeam({ 
  fromHouseId, 
  toHouseId, 
  houses 
}: { 
  fromHouseId: string; 
  toHouseId: string; 
  houses: HouseData[]; 
}) {
  const fromHouse = houses.find((h) => h.id === fromHouseId) || houses[3];
  const toHouse = houses.find((h) => h.id === toHouseId) || houses[9];

  const beamProgress = useRef(0);
  const pulseRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    beamProgress.current = (beamProgress.current + delta * 1.8) % 1;
    if (pulseRef.current) {
      pulseRef.current.position.x = THREE.MathUtils.lerp(fromHouse.x, toHouse.x, beamProgress.current);
      pulseRef.current.position.z = THREE.MathUtils.lerp(fromHouse.z, toHouse.z, beamProgress.current);
      pulseRef.current.position.y = 0.5 + Math.sin(beamProgress.current * Math.PI) * 1.2;
    }
  });

  return (
    <group>
      {/* Glowing Energy Particle Packet */}
      <mesh ref={pulseRef} position={[fromHouse.x, 0.5, fromHouse.z]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshBasicMaterial color="#38bdf8" />
        <pointLight intensity={3.5} distance={5.0} color="#10b981" />
      </mesh>
    </group>
  );
}

// Camera Controller smoothly lerping position when a house is clicked
function CameraController({ 
  selectedHouse 
}: { 
  selectedHouse: HouseData | null; 
}) {
  useFrame((state, delta) => {
    if (selectedHouse) {
      // Zoom and focus on selected house
      const targetPos = new THREE.Vector3(
        selectedHouse.x + (selectedHouse.z > 0 ? 1.8 : -1.8),
        3.8,
        selectedHouse.z + (selectedHouse.z > 0 ? 6.2 : -6.2)
      );
      state.camera.position.lerp(targetPos, delta * 3.5);
      state.camera.lookAt(selectedHouse.x, 1.2, selectedHouse.z);
    } else {
      // Default cinematic aerial angle
      const defaultPos = new THREE.Vector3(0, 16, 22);
      state.camera.position.lerp(defaultPos, delta * 2.5);
      state.camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// Main Interactive Experience Component
export default function NeighborhoodMicrogrid3D() {
  const [houses, setHouses] = useState<HouseData[]>(NEIGHBORHOOD_HOUSES);
  const [selectedHouse, setSelectedHouse] = useState<HouseData | null>(null);
  const [hoveredHouseId, setHoveredHouseId] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<{ from: string; to: string } | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);

  // Handle P2P Trade from selected house
  const handleInitiateTrade = () => {
    if (!selectedHouse) return;

    let targetHouse: HouseData;
    let sourceHouse: HouseData;

    if (selectedHouse.type === "prosumer") {
      sourceHouse = selectedHouse;
      targetHouse = houses.find((h) => h.type === "consumer" && h.isOutage) || houses[9]; // H10
    } else {
      targetHouse = selectedHouse;
      sourceHouse = houses.find((h) => h.type === "prosumer" && h.surplusKwh > 5) || houses[3]; // H04
    }

    setActiveTrade({ from: sourceHouse.id, to: targetHouse.id });
    setTradeSuccess(false);

    setTimeout(() => {
      setTradeSuccess(true);
      // Update local house stats
      setHouses((prev) =>
        prev.map((h) => {
          if (h.id === sourceHouse.id) {
            return { ...h, surplusKwh: Math.max(0, h.surplusKwh - 4.4) };
          }
          if (h.id === targetHouse.id) {
            return { ...h, isOutage: false, usageKwh: Math.max(0, h.usageKwh - 4.4) };
          }
          return h;
        })
      );
    }, 2200);
  };

  return (
    <div className="relative w-full h-[92vh] bg-[#0f172a] overflow-hidden select-none">
      
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 16, 22], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#0f172a"]} />

        {/* Ambient & Natural Sunlight Lighting */}
        <ambientLight intensity={1.6} color="#e2e8f0" />
        <hemisphereLight args={["#38bdf8", "#1e293b", 1.2]} />
        <directionalLight 
          position={[16, 26, 16]} 
          intensity={2.2} 
          color="#ffffff" 
          castShadow 
          shadow-mapSize={2048}
        />
        <directionalLight 
          position={[-16, 18, -16]} 
          intensity={1.2} 
          color="#93c5fd" 
        />

        {/* Camera smooth lerp controller */}
        <CameraController selectedHouse={selectedHouse} />

        {/* Environment & Road */}
        <NeighborhoodEnvironment />

        {/* 12 Individual Houses */}
        {houses.map((house) => (
          <House3D
            key={house.id}
            house={house}
            isSelected={selectedHouse?.id === house.id}
            isHovered={hoveredHouseId === house.id}
            onSelect={() => setSelectedHouse(house)}
            onHover={(hovered) => setHoveredHouseId(hovered ? house.id : null)}
          />
        ))}

        {/* Energy Flow Conduit & Packets */}
        <MicrogridEnergyFlow houses={houses} activeTrade={activeTrade} />

        {/* User Orbit Controls when not locked */}
        <OrbitControls 
          enablePan={false}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={6}
          maxDistance={34}
        />
      </Canvas>

      {/* ================= MINIMAL TOP BAR ================= */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none z-20">
        <div className="space-y-0.5">
          <div className="text-[11px] font-mono tracking-widest text-zinc-300 uppercase font-semibold">
            RESIDENTIAL COMMUNITY MICROGRID
          </div>
          <div className="text-xs font-mono text-zinc-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>12 HOMES • 6 PROSUMERS • 6 CONSUMERS • GRID ONLINE</span>
          </div>
        </div>

        {selectedHouse && (
          <button
            onClick={() => {
              setSelectedHouse(null);
              setActiveTrade(null);
              setTradeSuccess(false);
            }}
            className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-mono transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Neighborhood View</span>
          </button>
        )}
      </div>

      {/* ================= MINIMAL ENGINEERING TELEMETRY DRAWER ================= */}
      {selectedHouse && (
        <div className="absolute bottom-8 left-8 z-20 w-80 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
            <div>
              <span className="text-xs font-mono text-zinc-400 block">{selectedHouse.id}</span>
              <h3 className="text-base font-bold text-white leading-none mt-0.5">
                {selectedHouse.name}
              </h3>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
              selectedHouse.type === "prosumer" 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
            }`}>
              {selectedHouse.type}
            </span>
          </div>

          {/* Metrics */}
          <div className="space-y-2 text-xs font-mono mb-4">
            <div className="flex justify-between text-zinc-300">
              <span>Rooftop Solar:</span>
              <span className="text-white font-bold">{selectedHouse.solarKwh} kWh</span>
            </div>
            <div className="flex justify-between text-zinc-300">
              <span>Consumption:</span>
              <span className="text-zinc-200">{selectedHouse.usageKwh} kWh</span>
            </div>
            <div className="flex justify-between border-t border-zinc-800/80 pt-1.5">
              <span className="text-zinc-300">Net Surplus:</span>
              <span className={`font-bold ${selectedHouse.surplusKwh >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                {selectedHouse.surplusKwh >= 0 ? `+${selectedHouse.surplusKwh}` : selectedHouse.surplusKwh} kWh
              </span>
            </div>
          </div>

          {/* Outage status alert if any */}
          {selectedHouse.isOutage && (
            <div className="mb-3 p-2 rounded-lg bg-red-950/60 border border-red-500/40 text-[11px] text-red-300 flex items-center gap-1.5 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>Main-grid outage active (15 kWh deficit)</span>
            </div>
          )}

          {/* Action Trigger */}
          <button
            onClick={handleInitiateTrade}
            disabled={activeTrade !== null}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            <span>{activeTrade ? "Dispatching Electricity..." : "Trade Surplus Energy →"}</span>
          </button>

          {/* Trade status receipt */}
          {tradeSuccess && (
            <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-[11px] font-mono text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>4.4 kWh successfully transferred on-chain</span>
            </div>
          )}
        </div>
      )}

      {/* ================= BOTTOM SCROLL INDICATOR ================= */}
      <div className="absolute bottom-6 right-8 z-20 flex items-center gap-2 text-xs font-mono text-zinc-300 pointer-events-none">
        <span>Explore Platform Below</span>
        <ChevronDown className="w-4 h-4 animate-bounce text-zinc-300" />
      </div>

    </div>
  );
}
