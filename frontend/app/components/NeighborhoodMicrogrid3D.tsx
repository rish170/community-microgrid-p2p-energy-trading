"use client";

import React, { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { 
  Zap, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  X,
  BatteryCharging,
  SunMedium,
  Activity,
  Radio,
  Copy,
  Check
} from "lucide-react";
import { HOUSES_CONFIG } from "../config/houses";
import { useMicrogridData, HouseLiveState } from "../hooks/useMicrogridData";

// Types for House Data (aliased to centralized HouseLiveState)
export type HouseData = HouseLiveState;

// Legacy export for backwards compatibility
export const NEIGHBORHOOD_HOUSES: HouseData[] = HOUSES_CONFIG.map((cfg) => {
  const isSolar = cfg.type === "prosumer";
  const solarKwh = isSolar ? (cfg.id === "P3" ? 4.2 : 3.2) : 0.0;
  const usageKwh = isSolar ? 1.0 : (cfg.id === "C6" ? 1.5 : 1.2);
  const netKwh = Number((usageKwh - solarKwh).toFixed(2));
  return {
    ...cfg,
    solarKwh,
    usageKwh,
    netKwh,
    surplusKwh: -netKwh,
    walletAddress: `0x${cfg.householdId.toString(16).padStart(4, "0")}...${cfg.householdId * 1111}`,
    powerState: "grid",
    batteryKwh: isSolar ? (cfg.initialBatteryKwh ?? 4.5) : 0,
    batteryCapacityKwh: isSolar ? (cfg.batteryCapacityKwh ?? 6.0) : 0,
    isOutage: cfg.id === "C6",
  };
});

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
function HouseRooftopSolar({ isSelected, isBlackout = false }: { isSelected: boolean; isBlackout?: boolean }) {
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

      {/* Solar Generation Active Glow Indicator (Off during blackout) */}
      {!isBlackout && (
        <pointLight 
          position={[-0.8, 2.2, 0]} 
          intensity={isSelected ? 2.0 : 1.0} 
          distance={3.5} 
          color="#D99A22" 
        />
      )}
    </group>
  );
}

// 3D House Component rendering house.glb for all 12 houses with Minecraft Voxel base
function House3D({ 
  house, 
  isSelected, 
  isHovered, 
  isLineCut = false,
  onSelect, 
  onHover
}: { 
  house: HouseData; 
  isSelected: boolean; 
  isHovered: boolean; 
  isLineCut?: boolean;
  onSelect: (isMulti: boolean) => void; 
  onHover: (hovered: boolean) => void;
}) {
  const { scene } = useGLTF("/models/house.glb");
  const isProsumer = house.type === "prosumer";
  const isLineCutActive = isLineCut || house.powerState === "line_cut";
  // Consumers without line enter blackout; prosumers run on islanded battery/solar
  const isBlackout = house.powerState === "blackout" || (!isProsumer && isLineCutActive) || (house.isOutage && !isProsumer);
  const isOnBattery = house.powerState === "battery" || (isProsumer && isLineCutActive);

  // Deep clone GLTF scene hierarchy and mesh materials for each independent house instance
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    return c;
  }, [scene]);

  // Dynamically update materials when house enters or exits blackout
  useEffect(() => {
    clonedScene.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (!mat) return;
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (isBlackout) {
            if (!stdMat.userData.originalColor) {
              stdMat.userData.originalColor = stdMat.color.clone();
              stdMat.userData.originalEmissive = stdMat.emissive ? stdMat.emissive.clone() : new THREE.Color(0, 0, 0);
              stdMat.userData.originalEmissiveIntensity = stdMat.emissiveIntensity || 0;
            }
            if (stdMat.name === "window") {
              stdMat.color.setHex(0x0f172a); // dark charcoal window during blackout
              if (stdMat.emissive) stdMat.emissive.setHex(0x000000);
              stdMat.emissiveIntensity = 0;
              stdMat.roughness = 0.95;
            } else {
              // Dim walls, roof, doors
              stdMat.color.copy(stdMat.userData.originalColor).multiplyScalar(0.42);
              if (stdMat.emissive) stdMat.emissive.setHex(0x000000);
              stdMat.emissiveIntensity = 0;
            }
          } else if (stdMat.userData.originalColor) {
            stdMat.color.copy(stdMat.userData.originalColor);
            if (stdMat.emissive && stdMat.userData.originalEmissive) {
              stdMat.emissive.copy(stdMat.userData.originalEmissive);
              stdMat.emissiveIntensity = stdMat.userData.originalEmissiveIntensity;
            }
          }
        });
      }
    });
  }, [clonedScene, isBlackout]);

  // House scaling & base alignment
  const scale = 0.28;
  const yOffset = 0.29; // aligns house flush on ground pad

  return (
    <group 
      position={[house.x, 0, house.z]} 
      rotation={[0, house.rotationY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
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
        <meshStandardMaterial 
          color={isBlackout ? "#332228" : isLineCutActive ? "#42281D" : "#B0B2BA"} 
          roughness={0.8} 
        />
      </mesh>

      {/* house.glb 3D Model Asset */}
      <group position={[0, yOffset, 0]} scale={[scale, scale, scale]}>
        <primitive object={clonedScene} />
      </group>

      {/* PROSUMERS (P1 to P6): Rooftop Solar PV Installation */}
      {/* CONSUMERS (C1 to C6): Standard clean roof */}
      {isProsumer && (
        <HouseRooftopSolar isSelected={isSelected} isBlackout={isBlackout} />
      )}

      {/* Blackout Emergency Beacon */}
      {isBlackout && (
        <pointLight 
          position={[0, 0.7, 0]} 
          intensity={0.8} 
          distance={2.8} 
          color="#E11D48" 
        />
      )}

      {/* Islanded Prosumer Battery Glow */}
      {isOnBattery && (
        <pointLight 
          position={[0, 1.4, 0]} 
          intensity={1.2} 
          distance={3.2} 
          color="#F59E0B" 
        />
      )}

      {/* Selection / Hover Glow Ring */}
      {(isSelected || isHovered) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.75, 2.15, 32]} />
          <meshBasicMaterial 
            color={
              isLineCutActive
                ? "#D97706"
                : isBlackout 
                ? "#E11D48" 
                : isOnBattery 
                ? "#F59E0B" 
                : isSelected 
                ? "#5277D5" 
                : isProsumer 
                ? "#D99A22" 
                : "#D94F58"
            } 
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
            : isLineCutActive
            ? "bg-[#1C1405]/95 text-white border-2 border-[#D97706] shadow-[0_4px_16px_rgba(217,119,6,0.35)]"
            : isBlackout
            ? "bg-[#1C0A0E]/95 text-white border-2 border-[#E11D48] shadow-[0_4px_16px_rgba(225,29,72,0.4)]"
            : isOnBattery
            ? "bg-[#1A1404]/95 text-[#FEF08A] border border-[#F59E0B]/60 shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
            : "bg-white/90 text-[#1D1D1F] border border-[#D8D8DE] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        }`}>
          <span className={`w-2.5 h-2.5 rounded-full ${
            isLineCutActive
              ? "bg-[#D97706] animate-pulse"
              : isBlackout
              ? "bg-[#E11D48] animate-ping"
              : isOnBattery
              ? "bg-[#F59E0B] animate-pulse"
              : isSelected 
              ? "bg-[#5277D5]" 
              : isProsumer 
              ? "bg-[#D99A22]" 
              : "bg-[#5277D5]"
          }`} />
          <span className="font-semibold flex items-center gap-1">
            <span className={isLineCutActive ? "text-[#FDE68A] font-bold" : isBlackout ? "text-[#FECDD3] font-bold" : ""}>{house.id}</span>
            <span className={`text-[9px] font-mono ${isLineCutActive ? "text-[#FCD34D]" : isBlackout ? "text-[#FDA4AF]" : isSelected ? "text-zinc-400" : "text-[#6E6E73]"}`}>
              #{house.householdId}
            </span>
          </span>

          {isLineCutActive ? (
            <span className="font-mono text-[10px] text-[#FDE68A] font-bold uppercase tracking-wider flex items-center gap-1 pl-1">
              <span>✂️ LINE CUT</span>
            </span>
          ) : isBlackout ? (
            <span className="font-mono text-[10px] text-[#FDA4AF] font-bold uppercase tracking-wider flex items-center gap-1 pl-1">
              <span>⚡ BLACKOUT</span>
            </span>
          ) : isOnBattery ? (
            <span className="font-mono text-[10px] text-[#FDE047] font-semibold flex items-center gap-0.5">
              <span>🔋 {house.batteryKwh.toFixed(1)} kWh</span>
            </span>
          ) : (
            <span className={`font-mono text-[10px] ${
              isSelected 
                ? "text-zinc-300"
                : house.surplusKwh >= 0 
                ? "text-[#27845B]" 
                : "text-[#D94F58]"
            }`}>
              {house.surplusKwh >= 0 ? `+${house.surplusKwh.toFixed(1)} kWh` : `${house.surplusKwh.toFixed(1)} kWh`}
            </span>
          )}
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

function MinecraftRoadAndParcels({ 
  houses = HOUSES_CONFIG as unknown as HouseData[], 
  isSocietyOutage = false 
}: { 
  houses?: HouseData[]; 
  isSocietyOutage?: boolean;
}) {
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
      {houses.map((house) => {
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
            {/* Glowstone Lantern Cube (Off during society outage) */}
            <mesh position={[0, 2.05, 0.28]}>
              <boxGeometry args={[0.3, 0.34, 0.3]} />
              <meshStandardMaterial 
                color={isSocietyOutage ? "#334155" : "#FDE047"} 
                emissive={isSocietyOutage ? "#000000" : "#FACC15"} 
                emissiveIntensity={isSocietyOutage ? 0 : 1.6} 
                roughness={isSocietyOutage ? 0.9 : 0.2} 
              />
            </mesh>
            <pointLight 
              position={[0, 1.9, 0.3]} 
              intensity={isSocietyOutage ? 0 : 1.1} 
              distance={6.0} 
              color="#FEF08A" 
            />
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
            {/* Glowstone Lantern Cube (Off during society outage) */}
            <mesh position={[0, 2.05, -0.28]}>
              <boxGeometry args={[0.3, 0.34, 0.3]} />
              <meshStandardMaterial 
                color={isSocietyOutage ? "#334155" : "#FDE047"} 
                emissive={isSocietyOutage ? "#000000" : "#FACC15"} 
                emissiveIntensity={isSocietyOutage ? 0 : 1.6} 
                roughness={isSocietyOutage ? 0.9 : 0.2} 
              />
            </mesh>
            <pointLight 
              position={[0, 1.9, -0.3]} 
              intensity={isSocietyOutage ? 0 : 1.1} 
              distance={6.0} 
              color="#FEF08A" 
            />
          </group>
        </group>
      ))}

      {/* Green Smart-Meter / Distribution Utility Boxes at Plot Entrances */}
      {houses.map((h) => (
        <group key={`util-${h.id}`} position={[h.x - 1.1, 0, h.z < 0 ? -2.7 : 2.7]}>
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.56, 0.42]} />
            <meshStandardMaterial color="#1E5328" roughness={0.7} />
          </mesh>
          {/* Status Telemetry LED */}
          <mesh position={[0, 0.44, h.z < 0 ? 0.22 : -0.22]}>
            <boxGeometry args={[0.1, 0.05, 0.02]} />
            <meshBasicMaterial 
              color={
                h.powerState === "blackout" || h.isOutage 
                  ? "#EF4444" 
                  : h.powerState === "battery" 
                  ? "#F59E0B" 
                  : "#22C55E"
              } 
            />
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
  activeTrade,
  cutLines = []
}: { 
  houses: HouseData[]; 
  activeTrade: { from: string; to: string } | null;
  cutLines?: number[];
}) {
  const particlesRef = useRef<THREE.Points>(null!);
  const count = 90;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Deterministic particle spread along the conduit line
      pos[i * 3] = ((i * 17) % 36) - 18;
      pos[i * 3 + 1] = 0.12;
      pos[i * 3 + 2] = (((i * 23) % 40) / 10) - 2;
    }
    return pos;
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
      {/* Underground Microgrid Conduit Main Line */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 0.1]} />
        <meshBasicMaterial color="#5277D5" />
      </mesh>

      {/* House Feeder Lines & Cut Line Severed Indicators */}
      {houses.map((h) => {
        const isCut = cutLines.includes(h.householdId) || h.powerState === "line_cut";
        const isNorth = h.z < 0;
        const branchZ = isNorth ? -1.6 : 1.6;
        const severZ = isNorth ? -2.2 : 2.2;

        return (
          <group key={`feeder-${h.id}`}>
            {!isCut ? (
              // Intact Feeder line connecting main conduit to house
              <mesh position={[h.x, 0.04, branchZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.08, 3.2]} />
                <meshBasicMaterial color="#5277D5" opacity={0.65} transparent />
              </mesh>
            ) : (
              // Severed Feeder Line with disconnected gap and glowing spark marker
              <group>
                <mesh position={[h.x, 0.04, isNorth ? -0.8 : 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.08, 1.4]} />
                  <meshBasicMaterial color="#94A3B8" opacity={0.4} transparent />
                </mesh>
                {/* Severed Line Spark Beacon */}
                <group position={[h.x, 0.12, severZ]}>
                  <mesh>
                    <boxGeometry args={[0.36, 0.08, 0.16]} />
                    <meshStandardMaterial color="#DC2626" emissive="#EF4444" emissiveIntensity={1.2} />
                  </mesh>
                  <pointLight intensity={1.8} distance={2.8} color="#F59E0B" />
                </group>
              </group>
            )}
          </group>
        );
      })}

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
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
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
  const { 
    houses, 
    isLiveConnected, 
    lastTickTime, 
    isSocietyOutage, 
    cutLines,
    energyRequests,
    autoAcceptEnabled,
    toggleAutoAcceptAction,
    createEnergyRequestAction,
    respondEnergyRequestAction,
    triggerSocietyOutage, 
    restoreSocietyGrid,
    cutLinesAction,
    restoreLinesAction
  } = useMicrogridData();
  const [selectedHouseIds, setSelectedHouseIds] = useState<string[]>([]);
  const [hoveredHouseId, setHoveredHouseId] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<{ from: string; to: string } | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Energy Request Modal state (M4)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [modalRequesterId, setModalRequesterId] = useState<number | null>(null);
  const [modalDurationHours, setModalDurationHours] = useState<number>(4.0);
  const [modalKwh, setModalKwh] = useState<string>("3.80");
  const [isEstimatingModal, setIsEstimatingModal] = useState<boolean>(false);
  const [isSubmittingModal, setIsSubmittingModal] = useState<boolean>(false);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Multi-selection handler: supports single-click, Shift+Click, Ctrl/Cmd+Click
  const handleHouseSelect = (houseId: string, isMulti: boolean) => {
    if (isMulti) {
      setSelectedHouseIds((prev) =>
        prev.includes(houseId) ? prev.filter((id) => id !== houseId) : [...prev, houseId]
      );
    } else {
      setSelectedHouseIds((prev) =>
        prev.length === 1 && prev[0] === houseId ? [] : [houseId]
      );
    }
  };

  // Derive selected houses and single selected house for focus
  const selectedHouses = useMemo(
    () => houses.filter((h) => selectedHouseIds.includes(h.id)),
    [houses, selectedHouseIds]
  );
  const selectedHouse = selectedHouses.length === 1 ? selectedHouses[0] : null;

  // Active incoming ping for currently selected prosumer
  const incomingPing = useMemo(() => {
    if (!selectedHouse || selectedHouse.type !== "prosumer") return null;
    return energyRequests.find(
      (r) => r.status === "pinged" && r.current_candidate_household_id === selectedHouse.householdId
    );
  }, [selectedHouse, energyRequests]);

  // Load estimated energy needed when request modal opens for a consumer
  useEffect(() => {
    if (!isRequestModalOpen || !modalRequesterId) return;
    let isCancelled = false;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
    async function loadEstimate() {
      setIsEstimatingModal(true);
      try {
        const res = await fetch(`${backendUrl}/api/backup/estimate?hours=${modalDurationHours}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && Array.isArray(json.needs)) {
            const need = json.needs.find((n: { household_id: number }) => n.household_id === modalRequesterId);
            if (need && need.need_kwh) {
              setModalKwh(need.need_kwh.toFixed(2));
            }
          }
        }
      } catch {
        if (!isCancelled) setModalKwh((0.95 * modalDurationHours).toFixed(2));
      } finally {
        if (!isCancelled) setIsEstimatingModal(false);
      }
    }
    loadEstimate();
    return () => {
      isCancelled = true;
    };
  }, [isRequestModalOpen, modalRequesterId, modalDurationHours]);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRequesterId) return;
    const kwh = parseFloat(modalKwh);
    if (!kwh || kwh <= 0) {
      setModalError("Please enter a valid energy amount in kWh");
      return;
    }
    setIsSubmittingModal(true);
    setModalError(null);
    const res = await createEnergyRequestAction({
      requesterHouseholdId: modalRequesterId,
      unitsKwh: kwh,
      durationHours: modalDurationHours,
      priceEth: 0.0001,
    });
    setIsSubmittingModal(false);
    if (res.success) {
      setModalSuccessMsg(`Dispatched emergency request for ${kwh} kWh to nearest prosumer!`);
      setTimeout(() => {
        setIsRequestModalOpen(false);
        setModalSuccessMsg(null);
      }, 2500);
    } else {
      setModalError(res.error || "Failed to submit request");
    }
  };

  // Trigger 3D Energy Beam animation whenever a request is settling or settled (M5)
  const lastSettledIdRef = useRef<string | null>(null);
  useEffect(() => {
    const latestSettled = energyRequests.find(
      (r) => (r.status === "settled" || r.status === "settling") && r.current_candidate_household_id
    );
    if (latestSettled && latestSettled.id !== lastSettledIdRef.current) {
      lastSettledIdRef.current = latestSettled.id;
      const seller = houses.find((h) => h.householdId === latestSettled.current_candidate_household_id);
      const buyer = houses.find((h) => h.householdId === latestSettled.requester_household_id);
      if (seller && buyer) {
        setActiveTrade({ from: seller.id, to: buyer.id });
        const timer = setTimeout(() => {
          setActiveTrade(null);
        }, 7000);
        return () => clearTimeout(timer);
      }
    }
  }, [energyRequests, houses]);

  const handleCopyAddress = (addr: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(addr);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 1800);
    }
  };

  // Community aggregated metrics derived from the 12 houses
  const totalGen = useMemo(
    () => Number(houses.reduce((acc, h) => acc + h.solarKwh, 0).toFixed(1)),
    [houses]
  );
  const totalLoad = useMemo(
    () => Number(houses.reduce((acc, h) => acc + h.usageKwh, 0).toFixed(1)),
    [houses]
  );
  const netSurplus = useMemo(
    () => Number((totalGen - totalLoad).toFixed(1)),
    [totalGen, totalLoad]
  );
  const selfSufficiency = useMemo(
    () => (totalLoad > 0 ? Math.min(100, Number(((totalGen / totalLoad) * 100).toFixed(1))) : 100),
    [totalGen, totalLoad]
  );

  // Handle P2P Trade from selected house
  const handleInitiateTrade = () => {
    if (!selectedHouse) return;

    let targetHouse: HouseData;
    let sourceHouse: HouseData;

    if (selectedHouse.type === "prosumer") {
      sourceHouse = selectedHouse;
      targetHouse = houses.find((h) => h.type === "consumer" && h.isOutage) || houses[11]; // C6
    } else {
      targetHouse = selectedHouse;
      sourceHouse = houses.find((h) => h.type === "prosumer" && h.surplusKwh > 1.5) || houses[5]; // P3
    }

    setActiveTrade({ from: sourceHouse.id, to: targetHouse.id });
    setTradeSuccess(false);

    setTimeout(() => {
      setTradeSuccess(true);
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

        {/* Realistic Sun & Ambient Lighting (Dims dynamically during society outage) */}
        <ambientLight intensity={isSocietyOutage ? 0.7 : 1.6} color={isSocietyOutage ? "#cbd5e1" : "#ffffff"} />
        <hemisphereLight args={["#E0F2FE", "#5B8C3E", isSocietyOutage ? 0.6 : 1.2]} />
        <directionalLight 
          position={[20, 30, 18]} 
          intensity={isSocietyOutage ? 1.0 : 2.4} 
          color={isSocietyOutage ? "#f1f5f9" : "#FFFDF5"} 
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
          intensity={isSocietyOutage ? 0.3 : 0.8} 
          color="#BAE6FD" 
        />

        {/* Camera smooth transition controller with boundary clamping */}
        <CameraController selectedHouse={selectedHouse} controlsRef={controlsRef} />

        {/* 1. Minecraft Finite Voxel Terrain Foundation & Perimeter Hills */}
        <MinecraftVoxelTerrain />

        {/* 2. Road, Sidewalks, Household Parcels, Walkways & Street Lamps */}
        <MinecraftRoadAndParcels houses={houses} isSocietyOutage={isSocietyOutage} />

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
              isSelected={selectedHouseIds.includes(house.id)}
              isHovered={hoveredHouseId === house.id}
              isLineCut={cutLines.includes(house.householdId) || house.powerState === "line_cut"}
              onSelect={(isMulti) => handleHouseSelect(house.id, isMulti)}
              onHover={(hovered) => setHoveredHouseId(hovered ? house.id : null)}
            />
          ))}
        </Suspense>

        {/* 6. Microgrid Underground Conduit & Active Trade Energy Beam */}
        <MicrogridEnergyFlow houses={houses} activeTrade={activeTrade} cutLines={cutLines} />

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

      {/* ================= ACTIVE SOCIETY OUTAGE EMERGENCY BANNER (M2) ================= */}
      {isSocietyOutage && (
        <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-[#991B1B] via-[#DC2626] to-[#991B1B] text-white px-4 sm:px-6 py-2 shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 font-sans">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
                ⚠️ SOCIETY GRID OUTAGE ACTIVE
              </span>
              <span className="text-xs text-red-100 hidden sm:inline">
                Utility 33kV feed offline. 6 Non-solar houses in Blackout, 6 solar prosumers islanded on BESS.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={restoreSocietyGrid}
              className="px-3 py-1 bg-white hover:bg-zinc-100 text-[#991B1B] font-mono text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Utility Grid</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TOP COMMUNITY TELEMETRY HUD BAR ================= */}
      <div className={`absolute ${isSocietyOutage ? "top-14" : "top-5"} left-4 right-4 sm:left-6 sm:right-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pointer-events-none z-20 transition-all duration-300`}>
        <div className="pointer-events-auto bg-white/85 backdrop-blur-xl border border-[#CBD5E1] p-3 sm:px-5 sm:py-2.5 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-wrap items-center gap-3 sm:gap-6">
          <div>
            <div className="text-[10px] font-mono tracking-wider text-[#64748B] uppercase">
              Community Microgrid Topology
            </div>
            <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? "bg-[#16A34A] animate-pulse" : "bg-[#D99A22]"}`} />
              <span>12 Residential Nodes • {isLiveConnected ? "Supabase Realtime Live" : "Microgrid Synchronous Baseline"}</span>
              {lastTickTime && (
                <span className="text-[10px] font-mono text-[#64748B] hidden md:inline">
                  [{new Date(lastTickTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}]
                </span>
              )}
            </div>
          </div>

          <div className="h-6 w-px bg-[#CBD5E1] hidden sm:block" />

          {/* Quick Metrics */}
          <div className="flex items-center gap-5 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#64748B] block">Generation</span>
              <span className="font-semibold text-[#D97706] tabular-nums">{totalGen} kWh</span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] block">Load</span>
              <span className="font-semibold text-[#1E293B] tabular-nums">{totalLoad} kWh</span>
            </div>
            <div>
              <span className="text-[10px] text-[#64748B] block">Net Balance</span>
              <span className={`font-semibold tabular-nums ${netSurplus >= 0 ? "text-[#16A34A]" : "text-[#E11D48]"}`}>
                {netSurplus >= 0 ? `+${netSurplus}` : netSurplus} kWh
              </span>
            </div>
            <div className="hidden lg:block">
              <span className="text-[10px] text-[#64748B] block">Self-Sufficiency</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">
                {selfSufficiency}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Prosumer Auto-Accept Quick Toggle Pill */}
          <button
            onClick={() => toggleAutoAcceptAction()}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:shadow active:scale-[0.98] ${
              autoAcceptEnabled
                ? "bg-[#27845B] hover:bg-[#1E6948] text-white border border-[#27845B]"
                : "bg-white/90 hover:bg-white text-[#64748B] border border-[#CBD5E1] hover:text-[#1E293B]"
            }`}
            title="Toggle whether prosumers automatically accept incoming requests after a 2-second delay"
          >
            <span className={`w-2 h-2 rounded-full ${autoAcceptEnabled ? "bg-white animate-pulse" : "bg-[#94A3B8]"}`} />
            <span>Auto-Accept: {autoAcceptEnabled ? "ON (2s)" : "OFF"}</span>
          </button>

          {/* Outage Simulation Toggle Button (M2) */}
          <button
            onClick={isSocietyOutage ? restoreSocietyGrid : triggerSocietyOutage}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm hover:shadow active:scale-[0.98] ${
              isSocietyOutage
                ? "bg-[#16A34A] hover:bg-[#15803D] text-white border border-[#16A34A]"
                : "bg-white/90 hover:bg-white text-[#DC2626] border border-[#DC2626]/30 hover:border-[#DC2626]"
            }`}
            title={isSocietyOutage ? "Restore utility grid connection for all houses" : "Simulate society-wide power substation failure"}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isSocietyOutage ? "Restore Grid" : "Simulate Outage"}</span>
          </button>

          {selectedHouseIds.length > 0 && (
            <button
              onClick={() => {
                setSelectedHouseIds([]);
                setActiveTrade(null);
                setTradeSuccess(false);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-[#1E293B] border border-[#CBD5E1] text-xs font-mono transition-all cursor-pointer shadow-sm hover:shadow"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Reset View ({selectedHouseIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= ENHANCED NODE INFORMATION POPUP / CARD (F2 & F4) ================= */}
      {selectedHouse && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 w-84 sm:w-92 bg-white/92 border border-[#CBD5E1] rounded-2xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-3 mb-3.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#1E293B] px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#CBD5E1]">
                  {selectedHouse.id}
                </span>
                <span className="text-[10px] font-mono text-[#64748B] px-1.5 py-0.5 rounded bg-white border border-[#CBD5E1]">
                  Ausgrid #{selectedHouse.householdId}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  selectedHouse.type === "prosumer" 
                    ? "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                    : "bg-[#0284C7]/10 text-[#0284C7] border border-[#0284C7]/20"
                }`}>
                  {selectedHouse.type}
                </span>

                {/* Status Chip (F2) */}
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  selectedHouse.powerState === "blackout" || selectedHouse.isOutage
                    ? "bg-[#E11D48]/10 text-[#E11D48] border border-[#E11D48]/20"
                    : selectedHouse.powerState === "line_cut"
                    ? "bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20"
                    : selectedHouse.powerState === "battery"
                    ? "bg-[#D99A22]/10 text-[#D99A22] border border-[#D99A22]/20"
                    : "bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedHouse.powerState === "blackout" || selectedHouse.isOutage
                      ? "bg-[#E11D48] animate-pulse"
                      : selectedHouse.powerState === "line_cut"
                      ? "bg-[#D97706]"
                      : selectedHouse.powerState === "battery"
                      ? "bg-[#D99A22]"
                      : "bg-[#16A34A]"
                  }`} />
                  {selectedHouse.powerState === "blackout" || selectedHouse.isOutage
                    ? "Blackout"
                    : selectedHouse.powerState === "line_cut"
                    ? "Line Cut"
                    : selectedHouse.powerState === "battery"
                    ? "On Battery"
                    : "Grid Connected"}
                </span>

                {selectedHouse.isShowcase && (
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#5277D5]/10 text-[#5277D5] border border-[#5277D5]/20">
                    Showcase
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-[#1E293B] mt-1.5">
                {selectedHouse.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedHouseIds([])}
              className="text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Battery Storage Gauge for Solar Prosumers (F2) */}
          {selectedHouse.type === "prosumer" && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <BatteryCharging className="w-3.5 h-3.5 text-[#D99A22]" />
                  <span>Battery Storage</span>
                </span>
                <span className="font-semibold text-[#1D1D1F] tabular-nums">
                  {selectedHouse.batteryKwh.toFixed(1)} / {selectedHouse.batteryCapacityKwh.toFixed(1)} kWh ({Math.round((selectedHouse.batteryKwh / (selectedHouse.batteryCapacityKwh || 6.0)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    (selectedHouse.batteryKwh / (selectedHouse.batteryCapacityKwh || 6.0)) <= 0.2
                      ? "bg-[#E11D48]"
                      : (selectedHouse.batteryKwh / (selectedHouse.batteryCapacityKwh || 6.0)) <= 0.5
                      ? "bg-[#D99A22]"
                      : "bg-[#16A34A]"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (selectedHouse.batteryKwh / (selectedHouse.batteryCapacityKwh || 6.0)) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Three Key Energy Metrics in Honest kWh (per 30-min tick) */}
          <div className="space-y-2 text-xs font-mono mb-3.5 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Generated Solar</span>
              <span className="text-[#D97706] font-semibold tabular-nums">{selectedHouse.solarKwh.toFixed(2)} kWh</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Consumed Load</span>
              <span className="text-[#1E293B] font-semibold tabular-nums">{selectedHouse.usageKwh.toFixed(2)} kWh</span>
            </div>
            <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-2 font-bold">
              <div className="flex items-center gap-1">
                <span className="text-[#1E293B]">Net Balance</span>
                <span className="text-[10px] text-[#94A3B8] font-normal" title="Energy per 30-minute simulation tick">(per 30m)</span>
              </div>
              <span className={`tabular-nums ${selectedHouse.surplusKwh >= 0 ? "text-[#16A34A]" : "text-[#E11D48]"}`}>
                {selectedHouse.surplusKwh >= 0 ? `+${selectedHouse.surplusKwh.toFixed(2)} kWh surplus` : `${selectedHouse.surplusKwh.toFixed(2)} kWh deficit`}
              </span>
            </div>
            {selectedHouse.predictedConsumptionKwh !== undefined && (
              <div className="flex justify-between items-center border-t border-[#E2E8F0] pt-1.5 text-[10px] text-[#64748B]">
                <span>Forecasted Need:</span>
                <span className="font-semibold text-[#5277D5]">
                  {selectedHouse.predictedConsumptionKwh.toFixed(2)} kWh
                </span>
              </div>
            )}
          </div>

          {/* Wallet Address with Copy Feedback */}
          <div className="text-[11px] font-mono text-[#64748B] mb-3.5 flex items-center justify-between bg-[#F8FAFC] px-2.5 py-1.5 rounded-xl border border-[#E2E8F0]">
            <span>Wallet Node:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#1E293B] font-semibold truncate max-w-[170px]" title={selectedHouse.walletAddress}>
                {selectedHouse.walletAddress.length > 14 
                  ? `${selectedHouse.walletAddress.slice(0, 6)}...${selectedHouse.walletAddress.slice(-4)}`
                  : selectedHouse.walletAddress}
              </span>
              <button
                onClick={() => handleCopyAddress(selectedHouse.walletAddress)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] rounded transition cursor-pointer"
                title="Copy full wallet address"
              >
                {copiedAddress ? <Check className="w-3.5 h-3.5 text-[#16A34A]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Line Isolation Status & Line Cut Control (F4) */}
          <div className="text-[11px] font-mono mb-3.5 flex items-center justify-between bg-[#F8FAFC] px-2.5 py-2 rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? "bg-[#D97706] animate-pulse" : "bg-[#16A34A]"}`} />
              <span className="text-[#64748B]">Line Connection:</span>
              <span className={`font-semibold ${cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? "text-[#D97706]" : "text-[#16A34A]"}`}>
                {cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? "Severed" : "Active (33kV)"}
              </span>
            </div>
            {cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? (
              <button
                onClick={() => restoreLinesAction([selectedHouse.householdId])}
                className="px-2 py-1 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Reconnect utility line"
              >
                <span>🔌 Reconnect</span>
              </button>
            ) : (
              <button
                onClick={() => cutLinesAction([selectedHouse.householdId])}
                className="px-2 py-1 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 active:scale-95"
                title="Simulate blown line / isolate house"
              >
                <span>✂️ Cut Line</span>
              </button>
            )}
          </div>

          {/* Incoming Candidate Prosumer Ping Alert (F7) */}
          {incomingPing && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[#D97706] font-bold mb-1">
                <Zap className="w-3.5 h-3.5 fill-[#D97706]" />
                <span>Incoming Emergency Demand</span>
              </div>
              <div className="text-[11px] text-[#64748B] mb-2.5">
                From <span className="font-bold text-[#1D1D1F]">{incomingPing.requester_code || `C-${incomingPing.requester_household_id}`}</span>: <span className="font-semibold text-[#1D1D1F]">{incomingPing.units_kwh} kWh</span> for <span className="font-semibold text-[#1D1D1F]">{incomingPing.total_price_eth} ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => respondEnergyRequestAction(incomingPing.id, "accept", selectedHouse.householdId)}
                  className="flex-1 py-1.5 rounded-lg bg-[#27845B] hover:bg-[#1E6948] text-white text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Accept Ping</span>
                </button>
                <button
                  onClick={() => respondEnergyRequestAction(incomingPing.id, "deny", selectedHouse.householdId)}
                  className="flex-1 py-1.5 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[10px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Deny</span>
                </button>
              </div>
            </div>
          )}

          {/* Context-Aware Action Triggers (F2 - Replaces misleading "Trade surplus energy" button) */}
          {selectedHouse.type === "consumer" ? (
            <button
              onClick={() => {
                setModalRequesterId(selectedHouse.householdId);
                setIsRequestModalOpen(true);
              }}
              className="w-full py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] active:scale-[0.99] text-white font-medium text-xs font-mono transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>
                {selectedHouse.powerState === "blackout" || selectedHouse.isOutage || selectedHouse.powerState === "line_cut"
                  ? "Request Emergency Energy Backup →"
                  : "Dispatch Energy Request →"}
              </span>
            </button>
          ) : selectedHouse.powerState === "battery" ? (
            <div className="w-full py-2 px-3 rounded-xl bg-[#D99A22]/10 border border-[#D99A22]/20 text-[#D99A22] text-xs font-mono flex items-center justify-center gap-2">
              <BatteryCharging className="w-4 h-4" />
              <span>Running on Solar &amp; Battery Backup</span>
            </div>
          ) : (
            <div className="w-full py-2 px-3 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/20 text-[#16A34A] text-xs font-mono flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Grid Synchronized • Ready to Supply</span>
            </div>
          )}

          {/* Trade status receipt */}
          {tradeSuccess && (
            <div className="mt-2.5 p-2 rounded-xl bg-[#16A34A]/10 border border-[#16A34A]/20 text-xs font-mono text-[#16A34A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>1.5 kWh dispatched via smart escrow</span>
            </div>
          )}
        </div>
      )}

      {/* ================= BATCH MULTI-SELECT LINE CONTROL DOCK (M3) ================= */}
      {selectedHouses.length > 1 && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 w-84 sm:w-96 bg-white/95 border border-[#CBD5E1] rounded-2xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5277D5] animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#1E293B]">
                {selectedHouses.length} Nodes Selected
              </span>
              <span className="text-[10px] font-mono text-[#64748B]">
                ({selectedHouses.map((h) => h.id).join(", ")})
              </span>
            </div>
            <button
              onClick={() => setSelectedHouseIds([])}
              className="text-[#64748B] hover:text-[#1E293B] p-1 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#64748B] mb-3.5 leading-relaxed font-sans">
            Batch microgrid isolation: Cut power lines to simulate blown line dropouts, or reconnect them to the main 33kV distribution feeder.
          </p>

          <div className="grid grid-cols-2 gap-2.5 font-mono">
            <button
              onClick={() => cutLinesAction(selectedHouses.map((h) => h.householdId))}
              className="py-2.5 px-3 rounded-xl bg-[#DC2626]/10 hover:bg-[#DC2626]/20 border border-[#DC2626]/30 text-[#DC2626] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <span>✂️ Cut Lines ({selectedHouses.length})</span>
            </button>
            <button
              onClick={() => restoreLinesAction(selectedHouses.map((h) => h.householdId))}
              className="py-2.5 px-3 rounded-xl bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <span>🔌 Restore Lines</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= BOTTOM INTERACTION HELPER ================= */}
      <div className="absolute bottom-5 right-6 z-20 hidden md:flex items-center gap-3 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-[#CBD5E1] text-[11px] font-mono text-[#64748B] shadow-sm pointer-events-none">
        <span>Orbit: 360° Drag</span>
        <span className="text-[#CBD5E1]">•</span>
        <span>Zoom: Scroll</span>
        <span className="text-[#CBD5E1]">•</span>
        <span>Shift/Ctrl+Click: Multi-Select</span>
        <span className="text-[#CBD5E1]">•</span>
        <span className="text-[#0284C7] font-semibold">Click: Inspect &amp; Cut Line</span>
      </div>

      {/* ================= 3D VIEWPORT ENERGY REQUEST MODAL (M4) ================= */}
      {isRequestModalOpen && modalRequesterId && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-[0_24px_48px_rgba(0,0,0,0.2)] max-w-sm w-full p-6 relative font-sans">
            <button
              onClick={() => setIsRequestModalOpen(false)}
              className="absolute top-5 right-5 text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3A7D5C] animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#3A7D5C]">
                Microgrid Dispatch
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-1">
              Request Energy Backup
            </h3>
            <p className="text-xs text-[#6E6E73] mb-4">
              Dispatches emergency demand to the nearest prosumer with surplus battery capacity.
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-3.5">
              {/* Requester House Display */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-xs font-mono">
                <span className="text-[#64748B]">Requester Node:</span>
                <span className="font-bold text-[#1D1D1F]">
                  Residence {HOUSES_CONFIG.find((h) => h.householdId === modalRequesterId)?.id} (Ausgrid #{modalRequesterId})
                </span>
              </div>

              {/* Duration Horizon */}
              <div>
                <label className="block text-[11px] font-mono text-[#64748B] mb-1">
                  Outage Horizon
                </label>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  {[2.0, 4.0, 8.0].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setModalDurationHours(h)}
                      className={`py-1.5 rounded-xl border font-semibold transition cursor-pointer ${
                        modalDurationHours === h
                          ? "bg-[#1D1D1F] text-white border-[#1D1D1F]"
                          : "bg-[#F8FAFC] text-[#64748B] border-[#D8D8DE] hover:bg-white"
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-mono text-[#64748B]">
                    Energy Required
                  </label>
                  {isEstimatingModal && (
                    <span className="text-[10px] font-mono text-[#3A7D5C] animate-pulse">
                      Estimating...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="50.0"
                    value={modalKwh}
                    onChange={(e) => setModalKwh(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-[#D8D8DE] bg-white text-xs font-mono text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#3A7D5C]/30 focus:border-[#3A7D5C]"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-[#94A3B8]">
                    kWh
                  </span>
                </div>
              </div>

              {/* Settlement Fee */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#64748B]">Fixed Settlement:</span>
                <span className="font-semibold text-[#1D1D1F]">0.000100 SepoliaETH</span>
              </div>

              {/* Auto-Accept Toggle Switch */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between text-[11px] font-mono">
                <div>
                  <span className="text-[#1D1D1F] font-semibold block">Prosumer Auto-Accept</span>
                  <span className="text-[10px] text-[#64748B]">Auto-accept ping after 2s network delay</span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAutoAcceptAction()}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                    autoAcceptEnabled
                      ? "bg-[#27845B]/10 text-[#27845B] border-[#27845B]/30 hover:bg-[#27845B]/20"
                      : "bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#1E293B]"
                  }`}
                >
                  {autoAcceptEnabled ? "ACTIVE (ON)" : "MANUAL (OFF)"}
                </button>
              </div>

              {modalError && (
                <div className="p-2 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-[#DC2626] text-xs font-mono">
                  {modalError}
                </div>
              )}

              {modalSuccessMsg && (
                <div className="p-2 rounded-xl bg-[#3A7D5C]/10 border border-[#3A7D5C]/20 text-[#27845B] text-xs font-mono flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{modalSuccessMsg}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-[#D8D8DE] text-[#64748B] hover:text-[#1D1D1F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingModal}
                  className="flex-1 py-2 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] text-white font-medium transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingModal ? (
                    <span>Pinging...</span>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-[#3A7D5C]" />
                      <span>Ping Prosumer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
