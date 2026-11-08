"use client";

import React, { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { 
  Zap, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  X,
  BatteryCharging,
  SunMedium
} from "lucide-react";

// Types for House Data
export interface HouseData {
  id: string;
  name: string;
  type: "prosumer" | "consumer";
  x: number;
  z: number;
  rotationY: number;
  solarKwh: number;
  usageKwh: number;
  surplusKwh: number;
  walletAddress: string;
  isOutage?: boolean;
}

// Exactly 12 Houses: 6 Prosumer (P1-P6 with Solar) + 6 Consumer (C1-C6 without Solar)
// Front Row (North): P1, C1, P2, C2, P3, C3 (facing South towards road: rotationY = 0)
// Back Row (South): C4, P4, C5, P5, C6, P6 (facing North towards road: rotationY = Math.PI)
export const NEIGHBORHOOD_HOUSES: HouseData[] = [
  // Front / North Row (z = -4.5, facing South towards road: rotationY = 0)
  { id: "P1", name: "Residence P1", type: "prosumer", x: -12.5, z: -4.5, rotationY: 0, solarKwh: 3.2, usageKwh: 0.8, surplusKwh: 2.4, walletAddress: "0x11A2...8F01" },
  { id: "C1", name: "Residence C1", type: "consumer", x: -7.5,  z: -4.5, rotationY: 0, solarKwh: 0.0, usageKwh: 1.2, surplusKwh: -1.2, walletAddress: "0x22B3...4E12", isOutage: false },
  { id: "P2", name: "Residence P2", type: "prosumer", x: -2.5,  z: -4.5, rotationY: 0, solarKwh: 2.8, usageKwh: 1.0, surplusKwh: 1.8, walletAddress: "0x33C4...9D23" },
  { id: "C2", name: "Residence C2", type: "consumer", x: 2.5,   z: -4.5, rotationY: 0, solarKwh: 0.0, usageKwh: 2.0, surplusKwh: -2.0, walletAddress: "0x55E6...1B45" },
  { id: "P3", name: "Residence P3 (Node Alpha)", type: "prosumer", x: 7.5, z: -4.5, rotationY: 0, solarKwh: 4.2, usageKwh: 1.1, surplusKwh: 3.1, walletAddress: "0x3C44...93BC" },
  { id: "C3", name: "Residence C3", type: "consumer", x: 12.5,  z: -4.5, rotationY: 0, solarKwh: 0.0, usageKwh: 1.5, surplusKwh: -1.5, walletAddress: "0x66F7...7A56" },

  // Back / South Row (z = 4.5, facing North towards road: rotationY = Math.PI)
  { id: "C4", name: "Residence C4", type: "consumer", x: -12.5, z: 4.5, rotationY: Math.PI, solarKwh: 0.0, usageKwh: 1.8, surplusKwh: -1.8, walletAddress: "0x77A8...3C67" },
  { id: "P4", name: "Residence P4", type: "prosumer", x: -7.5,  z: 4.5, rotationY: Math.PI, solarKwh: 3.6, usageKwh: 0.9, surplusKwh: 2.7, walletAddress: "0x88B9...2E78" },
  { id: "C5", name: "Residence C5", type: "consumer", x: -2.5,  z: 4.5, rotationY: Math.PI, solarKwh: 0.0, usageKwh: 1.0, surplusKwh: -1.0, walletAddress: "0x99C0...9F89" },
  { id: "P5", name: "Residence P5", type: "prosumer", x: 2.5,   z: 4.5, rotationY: Math.PI, solarKwh: 3.8, usageKwh: 0.8, surplusKwh: 3.0, walletAddress: "0xBBD2...6C01" },
  { id: "C6", name: "Residence C6 (Node Beta)", type: "consumer", x: 7.5, z: 4.5, rotationY: Math.PI, solarKwh: 0.0, usageKwh: 1.5, surplusKwh: -1.5, walletAddress: "0x71C7...976F", isOutage: true },
  { id: "P6", name: "Residence P6", type: "prosumer", x: 12.5,  z: 4.5, rotationY: Math.PI, solarKwh: 3.2, usageKwh: 0.7, surplusKwh: 2.5, walletAddress: "0xCCE3...8D12" },
];

// Preload house.glb
useGLTF.preload("/models/house.glb");

// Photovoltaic Solar Panel Module for Prosumer Roofs
function SolarPanelModule({ width = 0.45, length = 0.65 }: { width?: number; length?: number }) {
  return (
    <group>
      {/* Aluminum Mounting Rail */}
      <mesh position={[0, 0.008, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.03, 0.016, length + 0.03]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Dark Photovoltaic Silicon Cell */}
      <mesh position={[0, 0.018, 0]} castShadow>
        <boxGeometry args={[width, 0.012, length]} />
        <meshStandardMaterial 
          color="#1e293b" 
          roughness={0.2} 
          metalness={0.85}
          emissive="#1e3a5f"
          emissiveIntensity={0.2}
        />
      </mesh>
      {/* Anti-reflective Glass Finish Layer */}
      <mesh position={[0, 0.026, 0]}>
        <planeGeometry args={[width * 0.94, length * 0.94]} />
        <meshStandardMaterial 
          color="#38bdf8" 
          roughness={0.1} 
          metalness={0.9}
          emissive="#0284c7"
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}

// Rooftop Solar PV Installation Mounted Directly on house.glb Roof Slope
function HouseRooftopSolar({ isSelected }: { isSelected: boolean }) {
  return (
    <group position={[0, 0, 0]}>
      {/* Front / Primary Roof Slope (pitch sloping +X, rotZ ~ -60deg) */}
      <group position={[-0.38, 1.48, -0.05]} rotation={[0, 0, -1.05]}>
        <group position={[-0.22, 0, -0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[0.22, 0, -0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[-0.22, 0, 0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[0.22, 0, 0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
      </group>

      {/* Rear / Secondary Roof Slope (pitch sloping -X, rotZ ~ +60deg) */}
      <group position={[-1.22, 1.48, -0.05]} rotation={[0, 0, 1.05]}>
        <group position={[-0.22, 0, -0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[0.22, 0, -0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[-0.22, 0, 0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
        <group position={[0.22, 0, 0.38]}>
          <SolarPanelModule width={0.42} length={0.62} />
        </group>
      </group>

      {/* Solar Generation Active Glow Indicator */}
      <pointLight 
        position={[-0.8, 2.2, 0]} 
        intensity={isSelected ? 2.0 : 1.0} 
        distance={3.5} 
        color="#D99A22" 
      />
    </group>
  );
}

// 3D House Component rendering house.glb for all 12 houses with Minecraft Voxel base
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
  const { scene } = useGLTF("/models/house.glb");
  const isProsumer = house.type === "prosumer";

  // Deep clone GLTF scene hierarchy for each of the 12 independent house instances
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // House scaling & base alignment
  const scale = 0.28;
  const yOffset = 0.29; // aligns house flush on ground pad

  return (
    <group 
      position={[house.x, 0, house.z]} 
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
      {/* Voxel Cobblestone Foundation Pad */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.04, 3.4]} />
        <meshStandardMaterial color="#B0B2BA" roughness={0.8} />
      </mesh>

      {/* house.glb 3D Model Asset */}
      <group position={[0, yOffset, 0]} scale={[scale, scale, scale]}>
        <primitive object={clonedScene} />
      </group>

      {/* PROSUMERS (P1 to P6): Rooftop Solar PV Installation */}
      {/* CONSUMERS (C1 to C6): Standard clean roof */}
      {isProsumer && (
        <HouseRooftopSolar isSelected={isSelected} />
      )}

      {/* Selection / Hover Glow Ring */}
      {(isSelected || isHovered) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.75, 2.15, 32]} />
          <meshBasicMaterial 
            color={isSelected ? "#5277D5" : isProsumer ? "#D99A22" : "#D94F58"} 
            transparent 
            opacity={0.9} 
          />
        </mesh>
      )}

      {/* Floating Overhead Badge */}
      <Html position={[0, 2.5, 0]} center distanceFactor={24}>
        <div className={`px-2.5 py-1 rounded-full text-[11px] font-sans tracking-tight pointer-events-none transition-all flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md ${
          isSelected 
            ? "bg-[#1D1D1F] text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)] ring-2 ring-[#5277D5] font-semibold" 
            : "bg-white/90 text-[#1D1D1F] border border-[#D8D8DE] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isSelected 
              ? "bg-[#5277D5]" 
              : isProsumer 
              ? "bg-[#D99A22]" 
              : "bg-[#5277D5]"
          }`} />
          <span className="font-semibold">{house.id}</span>
          <span className={`font-mono text-[10px] ${
            isSelected 
              ? "text-zinc-300"
              : house.surplusKwh >= 0 
              ? "text-[#27845B]" 
              : "text-[#D94F58]"
          }`}>
            {house.surplusKwh >= 0 ? `+${house.surplusKwh.toFixed(1)}u` : `${house.surplusKwh.toFixed(1)}u`}
          </span>
        </div>
      </Html>
    </group>
  );
}

// =========================================================================
// MINECRAFT-STYLE VOXEL OBJECTS & VEGETATION
// =========================================================================

// Authentic Minecraft Voxel Tree (Oak, Spruce, Birch)
function MinecraftTree({ 
  x, 
  z, 
  y = 0, 
  type = "oak", 
  scale = 1.0 
}: { 
  x: number; 
  z: number; 
  y?: number; 
  type?: "oak" | "spruce" | "birch"; 
  scale?: number;
}) {
  return (
    <group position={[x, y, z]} scale={[scale, scale, scale]}>
      {type === "oak" && (
        <group>
          {/* Oak Trunk */}
          <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 2.2, 0.5]} />
            <meshStandardMaterial color="#553820" roughness={0.9} />
          </mesh>
          {/* Stepped Cubic Foliage */}
          <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.8, 2.2]} />
            <meshStandardMaterial color="#477E2A" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.65, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.8, 1.8]} />
            <meshStandardMaterial color="#528F32" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 0.6, 1.0]} />
            <meshStandardMaterial color="#5EA33A" roughness={0.8} />
          </mesh>
        </group>
      )}

      {type === "spruce" && (
        <group>
          {/* Dark Pine Trunk */}
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 3.2, 0.42]} />
            <meshStandardMaterial color="#362214" roughness={0.95} />
          </mesh>
          {/* Tapered Spruce Foliage Tiers */}
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 0.6, 2.4]} />
            <meshStandardMaterial color="#1E4D2A" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.6, 1.8]} />
            <meshStandardMaterial color="#255E34" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.6, 1.2]} />
            <meshStandardMaterial color="#2B6D3D" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.55, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.5, 0.6]} />
            <meshStandardMaterial color="#327A45" roughness={0.8} />
          </mesh>
        </group>
      )}

      {type === "birch" && (
        <group>
          {/* White Birch Trunk with Dark Notches */}
          <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.4, 2.5, 0.4]} />
            <meshStandardMaterial color="#EDE9E1" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.8, 0.205]}>
            <boxGeometry args={[0.24, 0.1, 0.02]} />
            <meshBasicMaterial color="#1E293B" />
          </mesh>
          <mesh position={[0.205, 1.5, 0]}>
            <boxGeometry args={[0.02, 0.12, 0.22]} />
            <meshBasicMaterial color="#1E293B" />
          </mesh>
          {/* Apple-Green Birch Foliage */}
          <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.0, 0.8, 2.0]} />
            <meshStandardMaterial color="#5E9E2A" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.75, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.7, 1.6]} />
            <meshStandardMaterial color="#6EAE34" roughness={0.8} />
          </mesh>
          <mesh position={[0, 3.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.5, 0.9]} />
            <meshStandardMaterial color="#7ABE3E" roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Minecraft Voxel Flowers (Poppies, Dandelions, Cornflowers)
function MinecraftFlowerCluster({ x, z, y = 0 }: { x: number; z: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      {/* Red Poppy */}
      <mesh position={[-0.2, 0.12, -0.15]}>
        <boxGeometry args={[0.06, 0.24, 0.06]} />
        <meshStandardMaterial color="#4A7C2C" />
      </mesh>
      <mesh position={[-0.2, 0.28, -0.15]}>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#E11D48" roughness={0.5} />
      </mesh>

      {/* Yellow Dandelion */}
      <mesh position={[0.2, 0.1, 0.1]}>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#4A7C2C" />
      </mesh>
      <mesh position={[0.2, 0.24, 0.1]}>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#FBBF24" roughness={0.5} />
      </mesh>

      {/* Blue Orchid */}
      <mesh position={[0.0, 0.14, 0.2]}>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshStandardMaterial color="#4A7C2C" />
      </mesh>
      <mesh position={[0.0, 0.32, 0.2]}>
        <boxGeometry args={[0.18, 0.18, 0.18]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.5} />
      </mesh>
    </group>
  );
}

// =========================================================================
// BOUNDED MINECRAFT VOXEL TERRAIN & NATURAL SURROUNDINGS
// =========================================================================

function MinecraftVoxelTerrain() {
  return (
    <group>
      {/* ----------------- 1. FINITE VOXEL BASE CHUNK SLAB (52 x 38) ----------------- */}
      {/* Bottom Bedrock / Deep Stone Layer (y = -1.1 to -2.4) */}
      <mesh position={[0, -1.75, 0]} receiveShadow>
        <boxGeometry args={[52, 1.3, 38]} />
        <meshStandardMaterial color="#48494F" roughness={0.95} />
      </mesh>

      {/* Intermediate Rich Dirt Layer (y = -0.3 to -1.1) */}
      <mesh position={[0, -0.7, 0]} receiveShadow>
        <boxGeometry args={[52.2, 0.8, 38.2]} />
        <meshStandardMaterial color="#6D4B2A" roughness={0.9} />
      </mesh>

      {/* Top Grass Ground Layer (y = 0.0 to -0.3) */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[52.4, 0.3, 38.4]} />
        <meshStandardMaterial color="#588B35" roughness={0.85} />
      </mesh>

      {/* Minecraft Stepped Chunk Perimeter Rim Blocks (creates authentic voxel edge) */}
      {[-26, 26].map((xRim, i) => (
        <group key={`xRim-${i}`}>
          {[-16, -10, -4, 2, 8, 14].map((zStep, idx) => (
            <mesh key={idx} position={[xRim > 0 ? xRim + 0.1 : xRim - 0.1, -0.15, zStep]} receiveShadow>
              <boxGeometry args={[0.4, 0.3, 2.5]} />
              <meshStandardMaterial color="#4F7D2F" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {[-19, 19].map((zRim, i) => (
        <group key={`zRim-${i}`}>
          {[-22, -15, -8, -1, 6, 13, 20].map((xStep, idx) => (
            <mesh key={idx} position={[xStep, -0.15, zRim > 0 ? zRim + 0.1 : zRim - 0.1]} receiveShadow>
              <boxGeometry args={[2.5, 0.3, 0.4]} />
              <meshStandardMaterial color="#4F7D2F" roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ----------------- 2. NATURAL ENCLOSING BOUNDARY HILLS / RIDGES ----------------- */}
      {/* North Natural Perimeter Hill Ridge (Tiers enclosing back of community) */}
      <mesh position={[0, 0.35, -15.0]} receiveShadow>
        <boxGeometry args={[51.6, 0.7, 6.5]} />
        <meshStandardMaterial color="#4E7D2E" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.95, -17.0]} receiveShadow>
        <boxGeometry args={[47.0, 0.6, 3.5]} />
        <meshStandardMaterial color="#467228" roughness={0.85} />
      </mesh>

      {/* South Natural Perimeter Hill Ridge (Tiers enclosing front of community) */}
      <mesh position={[0, 0.35, 15.0]} receiveShadow>
        <boxGeometry args={[51.6, 0.7, 6.5]} />
        <meshStandardMaterial color="#4E7D2E" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.95, 17.0]} receiveShadow>
        <boxGeometry args={[47.0, 0.6, 3.5]} />
        <meshStandardMaterial color="#467228" roughness={0.85} />
      </mesh>

      {/* West Natural Boundary Slope */}
      <mesh position={[-23.8, 0.35, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.7, 24.0]} />
        <meshStandardMaterial color="#4E7D2E" roughness={0.85} />
      </mesh>

      {/* East Natural Boundary Slope */}
      <mesh position={[23.8, 0.35, 0]} receiveShadow>
        <boxGeometry args={[4.2, 0.7, 24.0]} />
        <meshStandardMaterial color="#4E7D2E" roughness={0.85} />
      </mesh>
    </group>
  );
}

// =========================================================================
// ROAD, SIDEWALKS, PARCELS & STREET LIGHTS
// =========================================================================

function MinecraftRoadAndParcels() {
  return (
    <group>
      {/* Center Asphalt Road (Finite: x in [-23.5, 23.5], z in [-1.8, 1.8]) */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[47.0, 0.04, 3.6]} />
        <meshStandardMaterial color="#26262B" roughness={0.75} />
      </mesh>

      {/* Granite Curb Stones along North and South Road Edges */}
      <mesh position={[0, 0.05, -1.85]} receiveShadow>
        <boxGeometry args={[47.2, 0.08, 0.12]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.05, 1.85]} receiveShadow>
        <boxGeometry args={[47.2, 0.08, 0.12]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.6} />
      </mesh>

      {/* Dashed Road Centerline */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[41.0, 0.01, 0.16]} />
        <meshBasicMaterial color="#F8FAFC" />
      </mesh>

      {/* Pedestrian Zebra Crosswalks at West & East Intersections */}
      {[-16.0, 16.0].map((xCross, idx) => (
        <group key={`cross-${idx}`} position={[xCross, 0.045, 0]}>
          {[-1.3, -0.65, 0, 0.65, 1.3].map((zStripe, sIdx) => (
            <mesh key={sIdx} position={[0, 0, zStripe]}>
              <boxGeometry args={[1.5, 0.01, 0.35]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          ))}
        </group>
      ))}

      {/* North Sidewalk (Stone Slab Paver) */}
      <mesh position={[0, 0.03, -2.4]} receiveShadow>
        <boxGeometry args={[47.0, 0.05, 0.95]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.65} />
      </mesh>

      {/* South Sidewalk (Stone Slab Paver) */}
      <mesh position={[0, 0.03, 2.4]} receiveShadow>
        <boxGeometry args={[47.0, 0.05, 0.95]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.65} />
      </mesh>

      {/* 12 Individual Cobblestone Parcel Walkways from Sidewalk to Front Porch */}
      {NEIGHBORHOOD_HOUSES.map((house) => {
        const isNorth = house.z < 0;
        const walkZ = isNorth ? -3.65 : 3.65;
        return (
          <group key={`walk-${house.id}`}>
            {/* Stone Stepping Walkway */}
            <mesh position={[house.x, 0.03, walkZ]} receiveShadow>
              <boxGeometry args={[0.9, 0.03, 1.8]} />
              <meshStandardMaterial color="#94A3B8" roughness={0.8} />
            </mesh>
            {/* Front Garden Flower Clusters */}
            <MinecraftFlowerCluster x={house.x - 1.4} z={isNorth ? -3.2 : 3.2} />
            <MinecraftFlowerCluster x={house.x + 1.4} z={isNorth ? -3.2 : 3.2} />
          </group>
        );
      })}

      {/* Low Voxel Hedge Fences separating adjacent parcels */}
      {[-10.0, -5.0, 0.0, 5.0, 10.0].map((xSep, idx) => (
        <group key={`hedge-${idx}`}>
          {/* North Hedge */}
          <mesh position={[xSep, 0.22, -4.5]} receiveShadow castShadow>
            <boxGeometry args={[0.32, 0.44, 4.4]} />
            <meshStandardMaterial color="#356624" roughness={0.85} />
          </mesh>
          {/* South Hedge */}
          <mesh position={[xSep, 0.22, 4.5]} receiveShadow castShadow>
            <boxGeometry args={[0.32, 0.44, 4.4]} />
            <meshStandardMaterial color="#356624" roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Minecraft-Style Glowstone Street Lamps along Sidewalks */}
      {[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((xLamp, idx) => (
        <group key={`lamp-pair-${idx}`}>
          {/* North Lamp */}
          <group position={[xLamp, 0, -2.15]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.12, 2.2, 0.12]} />
              <meshStandardMaterial color="#423020" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.2, 0.15]}>
              <boxGeometry args={[0.1, 0.1, 0.35]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Glowstone Lantern Cube */}
            <mesh position={[0, 2.05, 0.28]}>
              <boxGeometry args={[0.3, 0.34, 0.3]} />
              <meshStandardMaterial 
                color="#FDE047" 
                emissive="#FACC15" 
                emissiveIntensity={1.6} 
                roughness={0.2} 
              />
            </mesh>
            <pointLight position={[0, 1.9, 0.3]} intensity={1.1} distance={6.0} color="#FEF08A" />
          </group>

          {/* South Lamp */}
          <group position={[xLamp, 0, 2.15]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[0.12, 2.2, 0.12]} />
              <meshStandardMaterial color="#423020" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2.2, -0.15]}>
              <boxGeometry args={[0.1, 0.1, 0.35]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Glowstone Lantern Cube */}
            <mesh position={[0, 2.05, -0.28]}>
              <boxGeometry args={[0.3, 0.34, 0.3]} />
              <meshStandardMaterial 
                color="#FDE047" 
                emissive="#FACC15" 
                emissiveIntensity={1.6} 
                roughness={0.2} 
              />
            </mesh>
            <pointLight position={[0, 1.9, -0.3]} intensity={1.1} distance={6.0} color="#FEF08A" />
          </group>
        </group>
      ))}

      {/* Green Smart-Meter / Distribution Utility Boxes at Plot Entrances */}
      {NEIGHBORHOOD_HOUSES.map((h) => (
        <group key={`util-${h.id}`} position={[h.x - 1.1, 0, h.z < 0 ? -2.7 : 2.7]}>
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.56, 0.42]} />
            <meshStandardMaterial color="#1E5328" roughness={0.7} />
          </mesh>
          {/* Status Telemetry LED */}
          <mesh position={[0, 0.44, h.z < 0 ? 0.22 : -0.22]}>
            <boxGeometry args={[0.1, 0.05, 0.02]} />
            <meshBasicMaterial color={h.isOutage ? "#EF4444" : "#22C55E"} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// =========================================================================
// COMMUNITY MICROGRID INFRASTRUCTURE (BESS SUBSTATION & SOLAR CARPORT)
// =========================================================================

function MicrogridCommunityInfrastructure() {
  return (
    <group>
      {/* ----------------- WEST END: COMMUNITY BESS & SUBSTATION ----------------- */}
      <group position={[-19.5, 0, 0]}>
        {/* Concrete Voxel Foundation Pad */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[6.8, 0.16, 8.4]} />
          <meshStandardMaterial color="#94A3B8" roughness={0.75} />
        </mesh>

        {/* BESS Battery Storage Unit 1 (Tesla Megapack Style) */}
        <group position={[0.2, 0.16, -2.1]}>
          <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 1.5, 1.3]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Glowing Status LED Bar */}
          <mesh position={[0, 1.35, 0.66]}>
            <boxGeometry args={[2.0, 0.06, 0.02]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
          {/* Battery Charge Level Indicator */}
          <mesh position={[-0.6, 0.9, 0.66]}>
            <boxGeometry args={[0.7, 0.15, 0.02]} />
            <meshBasicMaterial color="#22C55E" />
          </mesh>
        </group>

        {/* BESS Battery Storage Unit 2 */}
        <group position={[0.2, 0.16, 2.1]}>
          <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 1.5, 1.3]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.3} metalness={0.2} />
          </mesh>
          {/* Glowing Status LED Bar */}
          <mesh position={[0, 1.35, -0.66]}>
            <boxGeometry args={[2.0, 0.06, 0.02]} />
            <meshBasicMaterial color="#38BDF8" />
          </mesh>
          {/* Battery Charge Level Indicator */}
          <mesh position={[-0.6, 0.9, -0.66]}>
            <boxGeometry args={[0.7, 0.15, 0.02]} />
            <meshBasicMaterial color="#22C55E" />
          </mesh>
        </group>

        {/* High-Voltage Step-Up Transformer Station */}
        <group position={[-1.8, 0.16, 0]}>
          <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.7, 1.9, 1.6]} />
            <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Transformer Insulator Bushings on Top */}
          {[-0.45, 0, 0.45].map((zOff, i) => (
            <mesh key={i} position={[0, 2.05, zOff]} castShadow>
              <cylinderGeometry args={[0.07, 0.1, 0.35, 8]} />
              <meshStandardMaterial color="#B91C1C" roughness={0.3} />
            </mesh>
          ))}
          {/* High Voltage Warning Decal */}
          <mesh position={[0.86, 1.2, 0]}>
            <boxGeometry args={[0.02, 0.4, 0.5]} />
            <meshStandardMaterial color="#F59E0B" emissive="#D97706" emissiveIntensity={0.6} />
          </mesh>
        </group>

        {/* Substation Galvanized Safety Perimeter Fence */}
        <mesh position={[0, 0.45, -3.95]}>
          <boxGeometry args={[6.4, 0.7, 0.06]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.45, 3.95]}>
          <boxGeometry args={[6.4, 0.7, 0.06]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.4} />
        </mesh>
        <mesh position={[-3.2, 0.45, 0]}>
          <boxGeometry args={[0.06, 0.7, 7.8]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* Overhead BESS Telemetry Badge */}
        <Html position={[0, 3.2, 0]} center distanceFactor={28}>
          <div className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-tight pointer-events-none whitespace-nowrap backdrop-blur-md bg-white/90 text-[#1D1D1F] border border-[#CBD5E1] shadow-xs flex items-center gap-1.5">
            <BatteryCharging className="w-3 h-3 text-[#0284C7]" />
            <span className="font-semibold">Community BESS</span>
            <span className="text-[#0284C7] font-bold">250 kWh</span>
          </div>
        </Html>
      </group>

      {/* ----------------- EAST END: COMMUNITY SOLAR CARPORT & PARK ----------------- */}
      <group position={[19.5, 0, 0]}>
        {/* Paved Parking & Park Pad */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[6.8, 0.16, 8.4]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>

        {/* Solar Pergola Canopy Support Pillars */}
        <mesh position={[-2.2, 1.4, -2.4]} castShadow>
          <boxGeometry args={[0.2, 2.7, 0.2]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>
        <mesh position={[2.2, 1.4, -2.4]} castShadow>
          <boxGeometry args={[0.2, 2.7, 0.2]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>
        <mesh position={[-2.2, 1.4, 2.4]} castShadow>
          <boxGeometry args={[0.2, 2.7, 0.2]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>
        <mesh position={[2.2, 1.4, 2.4]} castShadow>
          <boxGeometry args={[0.2, 2.7, 0.2]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} />
        </mesh>

        {/* Elevated Tilted Solar Array Canopy */}
        <group position={[0, 2.85, 0]} rotation={[0.15, 0, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5.2, 0.12, 4.4]} />
            <meshStandardMaterial color="#0F172A" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Photovoltaic Cells Active Surface */}
          <mesh position={[0, 0.08, 0]}>
            <planeGeometry args={[4.9, 4.1]} />
            <meshStandardMaterial 
              color="#0284C7" 
              metalness={0.9} 
              roughness={0.15} 
              emissive="#0369A1" 
              emissiveIntensity={0.3} 
            />
          </mesh>
        </group>

        {/* Dual EV Fast Charging Stations */}
        {[-1.5, 1.5].map((zEv, idx) => (
          <group key={idx} position={[0, 0.16, zEv]}>
            <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.45, 1.3, 0.45]} />
              <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Bright Green EV Status Screen */}
            <mesh position={[0, 0.9, 0.23]}>
              <boxGeometry args={[0.25, 0.2, 0.02]} />
              <meshBasicMaterial color="#22C55E" />
            </mesh>
          </group>
        ))}

        {/* Wooden Park Benches */}
        <group position={[-2.4, 0.16, 0]}>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.6, 0.35, 1.4]} />
            <meshStandardMaterial color="#78350F" roughness={0.8} />
          </mesh>
        </group>

        {/* Overhead Solar Canopy Badge */}
        <Html position={[0, 3.6, 0]} center distanceFactor={28}>
          <div className="px-2.5 py-1 rounded-full text-[10px] font-mono tracking-tight pointer-events-none whitespace-nowrap backdrop-blur-md bg-white/90 text-[#1D1D1F] border border-[#CBD5E1] shadow-xs flex items-center gap-1.5">
            <SunMedium className="w-3 h-3 text-[#D99A22]" />
            <span className="font-semibold">Solar Carport</span>
            <span className="text-[#27845B] font-bold">18.5 kW</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

// =========================================================================
// MINECRAFT PERIMETER TREES & NATURAL FOLIAGE BARRIER
// =========================================================================

function MinecraftPerimeterForest() {
  const treeList = useMemo(() => [
    // North Perimeter Elevated Ridge Trees (Naturally enclosing North boundary)
    { x: -24.0, z: -14.5, y: 0.6, type: "spruce" as const, scale: 1.15 },
    { x: -20.5, z: -16.5, y: 1.0, type: "oak" as const,    scale: 1.1 },
    { x: -17.0, z: -14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: -14.0, z: -17.0, y: 1.2, type: "spruce" as const, scale: 1.25 },
    { x: -10.5, z: -14.5, y: 0.6, type: "oak" as const,    scale: 1.05 },
    { x: -7.5,  z: -16.5, y: 1.0, type: "spruce" as const, scale: 1.15 },
    { x: -4.5,  z: -14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: -1.5,  z: -17.0, y: 1.2, type: "oak" as const,    scale: 1.2 },
    { x: 1.5,   z: -14.5, y: 0.6, type: "spruce" as const, scale: 1.1 },
    { x: 5.0,   z: -17.0, y: 1.2, type: "oak" as const,    scale: 1.15 },
    { x: 8.5,   z: -14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: 12.0,  z: -16.5, y: 1.0, type: "spruce" as const, scale: 1.2 },
    { x: 15.5,  z: -14.5, y: 0.6, type: "oak" as const,    scale: 1.05 },
    { x: 18.5,  z: -17.0, y: 1.2, type: "birch" as const,  scale: 1.1 },
    { x: 21.5,  z: -14.5, y: 0.6, type: "spruce" as const, scale: 1.15 },
    { x: 24.5,  z: -16.5, y: 1.0, type: "oak" as const,    scale: 1.1 },

    // South Perimeter Elevated Ridge Trees (Naturally enclosing South boundary)
    { x: -24.0, z: 14.5, y: 0.6, type: "spruce" as const, scale: 1.15 },
    { x: -20.5, z: 16.5, y: 1.0, type: "oak" as const,    scale: 1.1 },
    { x: -17.0, z: 14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: -13.5, z: 17.0, y: 1.2, type: "spruce" as const, scale: 1.25 },
    { x: -10.0, z: 14.5, y: 0.6, type: "oak" as const,    scale: 1.05 },
    { x: -6.5,  z: 16.5, y: 1.0, type: "spruce" as const, scale: 1.15 },
    { x: -3.0,  z: 14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: 0.5,   z: 17.0, y: 1.2, type: "oak" as const,    scale: 1.2 },
    { x: 4.0,   z: 14.5, y: 0.6, type: "spruce" as const, scale: 1.1 },
    { x: 7.5,   z: 17.0, y: 1.2, type: "oak" as const,    scale: 1.15 },
    { x: 11.0,  z: 14.5, y: 0.6, type: "birch" as const,  scale: 1.0 },
    { x: 14.5,  z: 16.5, y: 1.0, type: "spruce" as const, scale: 1.2 },
    { x: 18.0,  z: 14.5, y: 0.6, type: "oak" as const,    scale: 1.05 },
    { x: 21.0,  z: 17.0, y: 1.2, type: "birch" as const,  scale: 1.1 },
    { x: 24.5,  z: 14.5, y: 0.6, type: "spruce" as const, scale: 1.15 },

    // West & East Perimeter Tree Barriers
    { x: -25.0, z: -7.0, y: 0.5, type: "oak" as const,    scale: 1.1 },
    { x: -25.2, z: 7.0,  y: 0.5, type: "spruce" as const, scale: 1.2 },
    { x: 25.0,  z: -7.0, y: 0.5, type: "birch" as const,  scale: 1.05 },
    { x: 25.2,  z: 7.0,  y: 0.5, type: "oak" as const,    scale: 1.1 },

    // Backyard Plot Corner Trees (Lush green framing behind each parcel)
    { x: -14.5, z: -7.0, y: 0, type: "birch" as const, scale: 0.8 },
    { x: -10.0, z: -7.2, y: 0, type: "oak" as const,   scale: 0.8 },
    { x: -5.0,  z: -7.0, y: 0, type: "birch" as const, scale: 0.8 },
    { x: 0.0,   z: -7.2, y: 0, type: "oak" as const,   scale: 0.8 },
    { x: 5.0,   z: -7.0, y: 0, type: "birch" as const, scale: 0.8 },
    { x: 10.0,  z: -7.2, y: 0, type: "oak" as const,   scale: 0.8 },
    { x: 14.5,  z: -7.0, y: 0, type: "birch" as const, scale: 0.8 },

    { x: -14.5, z: 7.0,  y: 0, type: "birch" as const, scale: 0.8 },
    { x: -10.0, z: 7.2,  y: 0, type: "oak" as const,   scale: 0.8 },
    { x: -5.0,  z: 7.0,  y: 0, type: "birch" as const, scale: 0.8 },
    { x: 0.0,   z: 7.2,  y: 0, type: "oak" as const,   scale: 0.8 },
    { x: 5.0,   z: 7.0,  y: 0, type: "birch" as const, scale: 0.8 },
    { x: 10.0,  z: 7.2,  y: 0, type: "oak" as const,   scale: 0.8 },
    { x: 14.5,  z: 7.0,  y: 0, type: "birch" as const, scale: 0.8 },
  ], []);

  return (
    <group>
      {treeList.map((t, idx) => (
        <MinecraftTree 
          key={idx} 
          x={t.x} 
          z={t.z} 
          y={t.y} 
          type={t.type} 
          scale={t.scale} 
        />
      ))}
    </group>
  );
}

// =========================================================================
// ENERGY CONDUIT & PARTICLES
// =========================================================================

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
      pos[i * 3] = (Math.random() - 0.5) * 36;
      pos[i * 3 + 1] = 0.12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return [pos];
  }, [count]);

  useFrame((_, delta) => {
    if (particlesRef.current) {
      const arr = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] += delta * 3.5;
        if (arr[i * 3] > 20) arr[i * 3] = -20;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Underground Microgrid Conduit Line */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 0.1]} />
        <meshBasicMaterial color="#5277D5" />
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
          color="#27845B"
          transparent
          opacity={0.85}
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
        <meshBasicMaterial color="#5277D5" />
        <pointLight intensity={3.0} distance={5.0} color="#27845B" />
      </mesh>
    </group>
  );
}

// =========================================================================
// CAMERA CONTROLLER WITH STRICT BOUNDARY CLAMPING
// =========================================================================

function CameraController({ 
  selectedHouse,
  controlsRef
}: { 
  selectedHouse: HouseData | null; 
  controlsRef: React.RefObject<any>;
}) {
  const isTransitioning = useRef(false);
  const prevSelectedId = useRef<string | null>(null);

  useEffect(() => {
    // Only transition camera when user clicks a different house or resets view
    if (selectedHouse?.id !== prevSelectedId.current) {
      isTransitioning.current = true;
      prevSelectedId.current = selectedHouse?.id || null;
    }
  }, [selectedHouse]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // STRICT WORLD BOUNDARY CLAMPING:
    // Clamp the OrbitControls look-at target strictly within the central community microgrid.
    // This strictly prevents panning the camera beyond the bounded playable diorama!
    controlsRef.current.target.x = THREE.MathUtils.clamp(controlsRef.current.target.x, -10.0, 10.0);
    controlsRef.current.target.y = THREE.MathUtils.clamp(controlsRef.current.target.y, 0.0, 2.0);
    controlsRef.current.target.z = THREE.MathUtils.clamp(controlsRef.current.target.z, -5.0, 5.0);

    if (isTransitioning.current) {
      if (selectedHouse) {
        // Zoom and focus smoothly on selected house
        const targetPos = new THREE.Vector3(
          selectedHouse.x + (selectedHouse.z > 0 ? 1.8 : -1.8),
          3.8,
          selectedHouse.z + (selectedHouse.z > 0 ? 6.2 : -6.2)
        );
        const targetLook = new THREE.Vector3(selectedHouse.x, 1.2, selectedHouse.z);

        state.camera.position.lerp(targetPos, delta * 4.0);
        controlsRef.current.target.lerp(targetLook, delta * 4.0);

        if (state.camera.position.distanceTo(targetPos) < 0.08) {
          isTransitioning.current = false;
        }
      } else {
        // Return smoothly to default cinematic aerial angle
        const defaultPos = new THREE.Vector3(0, 15, 23);
        const defaultLook = new THREE.Vector3(0, 0.5, 0);

        state.camera.position.lerp(defaultPos, delta * 3.0);
        controlsRef.current.target.lerp(defaultLook, delta * 3.0);

        if (state.camera.position.distanceTo(defaultPos) < 0.15) {
          isTransitioning.current = false;
        }
      }
      controlsRef.current.update();
    }
  });

  return null;
}

// =========================================================================
// MAIN INTERACTIVE EXPERIENCE COMPONENT
// =========================================================================

export default function NeighborhoodMicrogrid3D() {
  const [houses, setHouses] = useState<HouseData[]>(NEIGHBORHOOD_HOUSES);
  const [selectedHouse, setSelectedHouse] = useState<HouseData | null>(null);
  const [hoveredHouseId, setHoveredHouseId] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<{ from: string; to: string } | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);
  const controlsRef = useRef<any>(null);

  // Handle P2P Trade from selected house
  const handleInitiateTrade = () => {
    if (!selectedHouse) return;

    let targetHouse: HouseData;
    let sourceHouse: HouseData;

    if (selectedHouse.type === "prosumer") {
      sourceHouse = selectedHouse;
      targetHouse = houses.find((h) => h.type === "consumer" && h.isOutage) || houses[9]; // C6
    } else {
      targetHouse = selectedHouse;
      sourceHouse = houses.find((h) => h.type === "prosumer" && h.surplusKwh > 1.5) || houses[3]; // P3
    }

    setActiveTrade({ from: sourceHouse.id, to: targetHouse.id });
    setTradeSuccess(false);

    setTimeout(() => {
      setTradeSuccess(true);
      // Update local house stats
      setHouses((prev) =>
        prev.map((h) => {
          if (h.id === sourceHouse.id) {
            return { ...h, surplusKwh: Math.max(0, Number((h.surplusKwh - 1.5).toFixed(1))) };
          }
          if (h.id === targetHouse.id) {
            return { ...h, isOutage: false, usageKwh: Math.max(0, Number((h.usageKwh - 1.5).toFixed(1))), surplusKwh: Math.min(0, Number((h.surplusKwh + 1.5).toFixed(1))) };
          }
          return h;
        })
      );
    }, 2200);
  };

  return (
    <div className="relative w-full h-[92vh] bg-[#DCEAF6] overflow-hidden select-none cursor-grab active:cursor-grabbing">
      
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 15, 23], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        {/* Soft daylight sky color and atmospheric fog that seamlessly bounds the terrain */}
        <color attach="background" args={["#DCEAF6"]} />
        <fog attach="fog" args={["#DCEAF6", 30, 58]} />

        {/* Realistic Sun & Ambient Lighting */}
        <ambientLight intensity={1.6} color="#ffffff" />
        <hemisphereLight args={["#E0F2FE", "#5B8C3E", 1.2]} />
        <directionalLight 
          position={[20, 30, 18]} 
          intensity={2.4} 
          color="#FFFDF5" 
          castShadow 
          shadow-mapSize={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={70}
          shadow-camera-left={-28}
          shadow-camera-right={28}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
        />
        <directionalLight 
          position={[-18, 16, -18]} 
          intensity={0.8} 
          color="#BAE6FD" 
        />

        {/* Camera smooth transition controller with boundary clamping */}
        <CameraController selectedHouse={selectedHouse} controlsRef={controlsRef} />

        {/* 1. Minecraft Finite Voxel Terrain Foundation & Perimeter Hills */}
        <MinecraftVoxelTerrain />

        {/* 2. Road, Sidewalks, Household Parcels, Walkways & Street Lamps */}
        <MinecraftRoadAndParcels />

        {/* 3. Surrounding Microgrid Community Infrastructure (BESS Substation & Solar Carport) */}
        <MicrogridCommunityInfrastructure />

        {/* 4. Natural Enclosing Minecraft Tree Canopy Barrier */}
        <MinecraftPerimeterForest />

        {/* 5. The 12 Main Microgrid Houses using house.glb (6 Prosumers + 6 Consumers) */}
        <Suspense fallback={null}>
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
        </Suspense>

        {/* 6. Microgrid Underground Conduit & Active Trade Energy Beam */}
        <MicrogridEnergyFlow houses={houses} activeTrade={activeTrade} />

        {/* 7. Full 360-Degree OrbitControls with strict world boundary constraints */}
        <OrbitControls 
          ref={controlsRef}
          enableRotate={true}
          enableZoom={true}
          enablePan={true}
          enableDamping={true}
          dampingFactor={0.08}
          rotateSpeed={0.8}
          zoomSpeed={0.85}
          minDistance={7}
          maxDistance={27}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.18}
        />
      </Canvas>

      {/* ================= TOP COMMUNITY TELEMETRY HUD BAR ================= */}
      <div className="absolute top-5 left-4 right-4 sm:left-6 sm:right-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none z-20">
        <div className="pointer-events-auto bg-white/85 backdrop-blur-xl border border-[#CBD5E1] p-3 sm:px-5 sm:py-2.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-wrap items-center gap-3 sm:gap-6">
          <div>
            <div className="text-[10px] font-mono tracking-wider text-[#64748B] uppercase">
              Community Microgrid Topology
            </div>
            <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>12 Residential Nodes • Bounded Microgrid (1 Unit = 1 kWh)</span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#CBD5E1] hidden sm:block" />

          {/* Quick Metrics */}
          <div className="flex items-center gap-5 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#64748B] block">Generation</span>
              <span className="font-semibold text-[#D97706] tabular-nums">20.8 units</span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] block">Load</span>
              <span className="font-semibold text-[#1E293B] tabular-nums">14.3 units</span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] block">Net Surplus</span>
              <span className="font-semibold text-[#16A34A] tabular-nums">+6.5 units</span>
            </div>
            <div className="hidden lg:block">
              <span className="text-[10px] text-[#64748B] block">Self-Sufficiency</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">
                99.1%
              </span>
            </div>
          </div>
        </div>

        {selectedHouse && (
          <button
            onClick={() => {
              setSelectedHouse(null);
              setActiveTrade(null);
              setTradeSuccess(false);
            }}
            className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-[#1E293B] border border-[#CBD5E1] text-xs font-mono transition-all cursor-pointer shadow-sm hover:shadow"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>Reset View</span>
          </button>
        )}
      </div>

      {/* ================= ENHANCED NODE INFORMATION POPUP / CARD ================= */}
      {selectedHouse && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 w-80 sm:w-88 bg-white/92 border border-[#CBD5E1] rounded-2xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-3 mb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#1E293B] px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1]">
                  {selectedHouse.id}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  selectedHouse.type === "prosumer" 
                    ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                    : "bg-[#0284C7]/10 text-[#0284C7] border border-[#0284C7]/20"
                }`}>
                  {selectedHouse.type}
                </span>
              </div>
              <h3 className="text-base font-semibold text-[#1E293B] mt-1.5">
                {selectedHouse.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedHouse(null)}
              className="text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Three Key Energy Metrics in Units (1 UNIT = 1 kWh) */}
          <div className="space-y-2 text-xs font-mono mb-4 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Generated Energy</span>
              <span className="text-[#D97706] font-semibold tabular-nums">{selectedHouse.solarKwh.toFixed(1)} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Consumed Energy</span>
              <span className="text-[#1E293B] font-semibold tabular-nums">{selectedHouse.usageKwh.toFixed(1)} units</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-2 font-bold">
              <span className="text-[#1E293B]">Net Surplus</span>
              <span className={`tabular-nums ${selectedHouse.surplusKwh >= 0 ? "text-[#16A34A]" : "text-[#E11D48]"}`}>
                {selectedHouse.surplusKwh >= 0 ? `+${selectedHouse.surplusKwh.toFixed(1)}` : selectedHouse.surplusKwh.toFixed(1)} units
              </span>
            </div>
          </div>

          {/* Outage status alert if any */}
          {selectedHouse.isOutage && (
            <div className="mb-3.5 p-2.5 rounded-xl bg-[#E11D48]/10 border border-[#E11D48]/20 text-xs text-[#E11D48] flex items-center gap-2 font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Grid outage active (1.5 units deficit)</span>
            </div>
          )}

          {/* Wallet Address */}
          <div className="text-[11px] font-mono text-[#64748B] mb-4 flex items-center justify-between">
            <span>Node Address:</span>
            <span className="text-[#1E293B] bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
              {selectedHouse.walletAddress}
            </span>
          </div>

          {/* Action Trigger */}
          <button
            onClick={handleInitiateTrade}
            disabled={activeTrade !== null}
            className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] active:scale-[0.99] text-white font-medium text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>{activeTrade ? "Dispatching Electricity..." : "Trade Surplus Energy →"}</span>
          </button>

          {/* Trade status receipt */}
          {tradeSuccess && (
            <div className="mt-2.5 p-2 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/20 text-xs font-mono text-[#16A34A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>1.5 units dispatched via smart escrow</span>
            </div>
          )}
        </div>
      )}

      {/* ================= BOTTOM INTERACTION HELPER ================= */}
      <div className="absolute bottom-5 right-6 z-20 hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#CBD5E1] text-[11px] font-mono text-[#64748B] shadow-sm pointer-events-none">
        <span>Orbit: 360° Drag</span>
        <span className="text-[#CBD5E1]">•</span>
        <span>Zoom: Scroll (Bounded)</span>
        <span className="text-[#CBD5E1]">•</span>
        <span>Pan: Right-Click (Clamped)</span>
        <span className="text-[#CBD5E1]">•</span>
        <span className="text-[#0284C7] font-semibold">Click House to Inspect</span>
      </div>

    </div>
  );
}
