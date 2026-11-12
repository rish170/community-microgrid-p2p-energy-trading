"use client";

import React, { useState, useRef, useMemo, useEffect, Suspense, memo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  Check,
  ExternalLink,
  RefreshCw,
  Gamepad2
} from "lucide-react";
import { HOUSES_CONFIG } from "../config/houses";
import { useMicrogridData, HouseLiveState } from "../hooks/useMicrogridData";
import { playShiftHaptic } from "../utils/gamepadVibration";

// Suppress Three.js r183 upstream deprecation warnings for R3F 9.x internals
if (typeof window !== "undefined") {
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("THREE.Clock: This module has been deprecated") ||
       args[0].includes("PCFSoftShadowMap has been deprecated"))
    ) {
      return;
    }
    origWarn.apply(console, args);
  };
}

// Gamepad Status HUD Type
export interface GamepadHudState {
  connected: boolean;
  id: string;
  activeDirection: "UP" | "DOWN" | "LEFT" | "RIGHT" | null;
  lastActiveTime: number;
}

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
    isOutage: false,
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
      {/* Photovoltaic Silicon Cell */}
      <mesh position={[0, 0.018, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.012, length]} />
        <meshStandardMaterial 
          color="#0F172A" 
          roughness={0.25} 
          metalness={0.8}
          emissive="#1E3A8A"
          emissiveIntensity={0.2}
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

// Solid colonial porch stairs that connect porch down to the ground/walkway without mid-air floating gaps (Images 1-3)
function HouseFrontStairs() {
  const steps = [
    { y: 0.38, z: 0.98, depth: 0.12 },
    { y: 0.29, z: 1.08, depth: 0.12 },
    { y: 0.20, z: 1.18, depth: 0.12 },
    { y: 0.11, z: 1.28, depth: 0.12 },
    { y: 0.035, z: 1.38, depth: 0.14 },
  ];

  return (
    <group position={[0, 0, 0]}>
      {/* Solid Staircase White Side Stringers */}
      <mesh position={[-0.37, 0.21, 1.18]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 0.44, 0.52]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
      <mesh position={[0.37, 0.21, 1.18]} castShadow receiveShadow>
        <boxGeometry args={[0.04, 0.44, 0.52]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>

      {/* Solid Step Risers & Handsome Wooden Treads Touching Ground */}
      {steps.map((st, idx) => (
        <group key={idx}>
          {/* White Riser & Foundation Block extending solidly to ground */}
          <mesh position={[0, st.y / 2, st.z]} receiveShadow castShadow>
            <boxGeometry args={[0.70, st.y, st.depth]} />
            <meshStandardMaterial color="#F1F5F9" roughness={0.5} />
          </mesh>
          {/* Solid Wooden Tread Plank */}
          <mesh position={[0, st.y + 0.012, st.z]} receiveShadow castShadow>
            <boxGeometry args={[0.74, 0.024, st.depth + 0.02]} />
            <meshStandardMaterial color="#B58D57" roughness={0.65} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// 3D House Component rendering house.glb for all 12 houses with Minecraft Voxel base
function House3D({ 
  house, 
  isSelected, 
  isHovered, 
  isLineCut = false,
  showBadge = true,
  onSelect, 
  onHover
}: { 
  house: HouseData; 
  isSelected: boolean; 
  isHovered: boolean; 
  isLineCut?: boolean;
  showBadge?: boolean;
  onSelect: (isMulti: boolean) => void; 
  onHover: (hovered: boolean) => void;
}) {
  const { scene } = useGLTF("/models/house.glb");
  const isProsumer = house.type === "prosumer";
  const isLineCutActive = isLineCut || house.powerState === "line_cut";
  // Consumers without line enter blackout; prosumers run on islanded battery/solar
  const isBlackout = (!isProsumer && house.powerState !== "grid") || house.powerState === "blackout" || (!isProsumer && isLineCutActive) || (house.isOutage && !isProsumer);
  const isOnBattery = isProsumer && (house.powerState === "battery" || isLineCutActive);

  // Deep clone GLTF scene hierarchy and mesh materials for each independent house instance
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Lower the house parcel grass mesh so it sits on the ground without cutting flowers or postboxes (Request 8)
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mesh.name === "Object_2" || mesh.name === "Object_0" || (mat && (mat as THREE.Material).name === "Material.013")) {
          mesh.geometry = mesh.geometry.clone();
          mesh.geometry.translate(0, 0, -2.56); // World Y translates directly from 0.3093 down to 0.0044 flush on ground
        }

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
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <group 
      position={[house.x, 0, house.z]} 
      rotation={[0, house.rotationY, 0]}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (pointerDownPos.current) {
          const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
          if (dist > 5) {
            // User was dragging or orbiting the 3D scene, not clicking to select
            return;
          }
        }
        onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
      }}
    >
      {/* Invisible Single-Mesh Collider for Jitter-Free Hover & Click Hit Testing */}
      <mesh
        position={[0, 1.4, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "auto";
          onHover(false);
        }}
      >
        <boxGeometry args={[3.8, 2.8, 3.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

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

      {/* Solid Front Porch Steps Ground-Touchdown (Images 1-3) */}
      <HouseFrontStairs />

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

      {/* Floating Overhead Badge: Clean Light Theme (P6 | +3.6 kWh) */}
      {showBadge && (
        <Html position={[0, 2.5, 0]} center distanceFactor={24} zIndexRange={[1, 10]}>
          <div className={`px-2.5 py-1.5 rounded-full text-xs font-sans tracking-tight pointer-events-none transition-all flex items-center gap-2 whitespace-nowrap backdrop-blur-md leading-none select-none ${
            isLineCutActive
              ? "bg-[#1C1405]/95 text-white border-2 border-[#D97706] shadow-[0_4px_16px_rgba(217,119,6,0.35)]"
              : isBlackout
              ? "bg-[#1C0A0E]/95 text-white border-2 border-[#E11D48] shadow-[0_4px_16px_rgba(225,29,72,0.4)]"
              : isOnBattery
              ? "bg-[#1A1404]/95 text-[#FEF08A] border-2 border-[#F59E0B] shadow-[0_4px_16px_rgba(245,158,11,0.3)]"
              : isSelected 
              ? "bg-white/95 text-[#1D1D1F] border border-[#5277D5] shadow-[0_4px_16px_rgba(82,119,213,0.25)] ring-2 ring-[#5277D5] font-semibold"
              : "bg-white/90 text-[#1D1D1F] border border-[#D8D8DE] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          }`}>
            <span className={`font-semibold text-xs leading-none ${
              isLineCutActive 
                ? "text-[#FDE68A]" 
                : isBlackout 
                ? "text-[#FECDD3]" 
                : isOnBattery 
                ? "text-[#FEF08A]" 
                : "text-[#1D1D1F]"
            }`}>
              {house.id}
            </span>

            {/* Crisp vertical separator bar: perfectly middle-aligned and darker */}
            <span 
              className={`w-[1.5px] h-3 rounded-full shrink-0 ${
                isLineCutActive 
                  ? "bg-[#FDE68A]/60" 
                  : isBlackout 
                  ? "bg-[#FECDD3]/60" 
                  : isOnBattery 
                  ? "bg-[#FEF08A]/60" 
                  : "bg-[#475569]"
              }`} 
              aria-hidden="true"
            />

            {isLineCutActive ? (
              <span className="font-mono text-xs leading-none text-[#FDE68A] font-bold uppercase tracking-wider">
                Line Cut
              </span>
            ) : isBlackout ? (
              <span className="font-mono text-xs leading-none text-[#FDA4AF] font-bold uppercase tracking-wider">
                Blackout
              </span>
            ) : isOnBattery ? (
              <span className="font-mono text-xs leading-none text-[#FDE047] font-semibold tabular-nums">
                {house.batteryKwh.toFixed(1)} kWh
              </span>
            ) : (
              <span className={`font-mono text-xs leading-none tabular-nums font-medium ${
                house.surplusKwh >= 0 
                  ? "text-[#16A34A]" 
                  : "text-[#DC2626]"
              }`}>
                {house.surplusKwh >= 0 ? `+${house.surplusKwh.toFixed(1)} kWh` : `${house.surplusKwh.toFixed(1)} kWh`}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// =========================================================================
// MINECRAFT-STYLE VOXEL OBJECTS & VEGETATION
// =========================================================================

// Authentic Minecraft Voxel Tree (Oak, Spruce, Birch)
const MinecraftTree = memo(function MinecraftTree({ 
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
});

// Minecraft Voxel Flowers (Poppies, Dandelions, Cornflowers)
const MinecraftFlowerCluster = memo(function MinecraftFlowerCluster({ x, z, y = 0 }: { x: number; z: number; y?: number }) {
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
});

// =========================================================================
// BOUNDED MINECRAFT VOXEL TERRAIN & NATURAL SURROUNDINGS
// =========================================================================

const MinecraftVoxelTerrain = memo(function MinecraftVoxelTerrain() {
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
});

// =========================================================================
// ROAD, SIDEWALKS, PARCELS & STREET LIGHTS
// =========================================================================

const MinecraftRoadAndParcels = memo(function MinecraftRoadAndParcels({ 
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

      {/* Minecraft-Style Glowstone Street Lamps along Sidewalks at Parcel Divisions (Request 9) */}
      {[-15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0].map((xLamp, idx) => (
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
});

// =========================================================================
// COMMUNITY MICROGRID INFRASTRUCTURE (BESS SUBSTATION & SOLAR CARPORT)
// =========================================================================

const MicrogridCommunityInfrastructure = memo(function MicrogridCommunityInfrastructure() {
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
          {/* Canopy Mounting Frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5.2, 0.12, 4.4]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Photovoltaic Solar Modules Surface (Flush on deck, no perpendicular standing layer) */}
          <mesh position={[0, 0.065, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.95, 0.02, 4.15]} />
            <meshStandardMaterial 
              color="#0F172A" 
              metalness={0.85} 
              roughness={0.2} 
              emissive="#1E3A8A" 
              emissiveIntensity={0.22} 
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
});

// =========================================================================
// MINECRAFT PERIMETER TREES & NATURAL FOLIAGE BARRIER
// =========================================================================

const MinecraftPerimeterForest = memo(function MinecraftPerimeterForest() {
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
});

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
// CAMERA CONTROLLER WITH FRONT VIEW FOCUS & INTERACTION STABILITY (Requests 6 & 7)
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
  const transitionProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3(0, 15, 23));
  const startTarget = useRef(new THREE.Vector3(0, 0.5, 0));

  // Stop camera transition immediately when the user rotates, drags, or zooms (Request 6)
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handleInteractionStart = () => {
      isTransitioning.current = false;
    };
    controls.addEventListener("start", handleInteractionStart);
    return () => {
      controls.removeEventListener("start", handleInteractionStart);
    };
  }, [controlsRef]);

  useEffect(() => {
    // Only transition camera when user selects a different house or resets view
    if (selectedHouse?.id !== prevSelectedId.current) {
      isTransitioning.current = true;
      transitionProgress.current = 0;
      prevSelectedId.current = selectedHouse?.id || null;
      if (controlsRef.current) {
        startPos.current.copy(controlsRef.current.object.position);
        startTarget.current.copy(controlsRef.current.target);
      }
    }
  }, [selectedHouse, controlsRef]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;

    // EXPANDED BOUNDARY CLAMPING: Accommodates corner houses (x = ±12.5) without twitching/jitter (Request 6)
    controlsRef.current.target.x = THREE.MathUtils.clamp(controlsRef.current.target.x, -18.0, 18.0);
    controlsRef.current.target.y = THREE.MathUtils.clamp(controlsRef.current.target.y, 0.0, 4.0);
    controlsRef.current.target.z = THREE.MathUtils.clamp(controlsRef.current.target.z, -8.0, 8.0);

    if (isTransitioning.current) {
      // Smooth cubic ease out progression
      transitionProgress.current = Math.min(1, transitionProgress.current + delta * 2.2);
      const t = 1 - Math.pow(1 - transitionProgress.current, 3);

      if (selectedHouse) {
        // FRONT VIEW: Look at the house from the central road (street side facing the front porch) (Request 7)
        // North row (z < 0): front porch faces +Z (road), camera placed at z = selectedHouse.z + 5.2
        // South row (z > 0): front porch faces -Z (road), camera placed at z = selectedHouse.z - 5.2
        const isSouthRow = selectedHouse.z > 0;
        const cameraZ = isSouthRow ? selectedHouse.z - 5.2 : selectedHouse.z + 5.2;
        const destPos = new THREE.Vector3(selectedHouse.x, 2.4, cameraZ);
        const destLook = new THREE.Vector3(selectedHouse.x, 1.2, selectedHouse.z);

        controlsRef.current.target.lerpVectors(startTarget.current, destLook, t);

        const currentPos = new THREE.Vector3().lerpVectors(startPos.current, destPos, t);
        // For South row houses: if moving from behind (+Z) to front (-Z), swing the camera around the side
        // in an arc so it NEVER passes through the roof zenith or triggers top view gimbal clamping
        if (isSouthRow && startPos.current.z > selectedHouse.z) {
          const arcSide = selectedHouse.x >= 0 ? -1 : 1;
          const arc = Math.sin(t * Math.PI) * 4.5 * arcSide;
          currentPos.x += arc;
        }

        state.camera.position.copy(currentPos);

        if (transitionProgress.current >= 1 || state.camera.position.distanceTo(destPos) < 0.08) {
          isTransitioning.current = false;
        }
      } else {
        // Return smoothly to default cinematic aerial angle
        const destPos = new THREE.Vector3(0, 15, 23);
        const destLook = new THREE.Vector3(0, 0.5, 0);

        controlsRef.current.target.lerpVectors(startTarget.current, destLook, t);
        state.camera.position.lerpVectors(startPos.current, destPos, t);

        if (transitionProgress.current >= 1 || state.camera.position.distanceTo(destPos) < 0.1) {
          isTransitioning.current = false;
        }
      }
      controlsRef.current.update();
    }
  });

  return null;
}

// Fixed parcel coordinates for each of the 12 houses
const HOUSE_COORDS: Record<string, [number, number, number]> = {
  C1: [-12.5, 0, -4.5],
  P1: [-7.5, 0, -4.5],
  C2: [-2.5, 0, -4.5],
  P2: [2.5, 0, -4.5],
  C3: [7.5, 0, -4.5],
  P3: [12.5, 0, -4.5],

  P4: [-12.5, 0, 4.5],
  C4: [-7.5, 0, 4.5],
  P5: [-2.5, 0, 4.5],
  C5: [2.5, 0, 4.5],
  P6: [7.5, 0, 4.5],
  C6: [12.5, 0, 4.5],
};

// Grid layout mappings for the two parallel rows:
// North row (z = -4.5): C1, P1, C2, P2, C3, P3 (columns 0 to 5)
// South row (z = +4.5): P4, C4, P5, C5, P6, C6 (columns 0 to 5)
const ROW_NORTH = ["C1", "P1", "C2", "P2", "C3", "P3"];
const ROW_SOUTH = ["P4", "C4", "P5", "C5", "P6", "C6"];

const HOUSE_GRID_MAP: Record<string, { row: "NORTH" | "SOUTH"; col: number }> = {
  C1: { row: "NORTH", col: 0 },
  P1: { row: "NORTH", col: 1 },
  C2: { row: "NORTH", col: 2 },
  P2: { row: "NORTH", col: 3 },
  C3: { row: "NORTH", col: 4 },
  P3: { row: "NORTH", col: 5 },

  P4: { row: "SOUTH", col: 0 },
  C4: { row: "SOUTH", col: 1 },
  P5: { row: "SOUTH", col: 2 },
  C5: { row: "SOUTH", col: 3 },
  P6: { row: "SOUTH", col: 4 },
  C6: { row: "SOUTH", col: 5 },
};

// Pre-allocated projection scratch vectors to eliminate GC latency
const _projWest = new THREE.Vector3();
const _projEast = new THREE.Vector3();
const _projNorth = new THREE.Vector3();
const _projSouth = new THREE.Vector3();

/**
 * Computes the neighbor house in the given D-pad direction.
 * - Horizontal street orientation:
 *   LEFT / RIGHT moves along the SAME ROW with cyclic wrapping (never gets stuck at dead ends).
 *   UP / DOWN moves ACROSS THE STREET to the paired opposite house.
 * - Vertical street orientation:
 *   UP / DOWN moves along the SAME ROW with cyclic wrapping.
 *   LEFT / RIGHT moves ACROSS THE STREET to the paired opposite house.
 */
function computeCameraRelativeNeighbor(
  currentId: string,
  dirName: "UP" | "DOWN" | "LEFT" | "RIGHT",
  camera: THREE.Camera
): string {
  camera.updateMatrixWorld();

  const cur = HOUSE_GRID_MAP[currentId];
  if (!cur) return "C1";

  // Project street axis (from West col 0 at x=-12.5 to East col 5 at x=12.5)
  _projWest.set(-12.5, 0, 0).project(camera);
  _projEast.set(12.5, 0, 0).project(camera);
  const streetScreenX = _projEast.x - _projWest.x;
  const streetScreenY = _projEast.y - _projWest.y;

  // Project across-street axis at current column X (from North z=-4.5 to South z=4.5)
  const colX = -12.5 + cur.col * 5.0;
  _projNorth.set(colX, 0, -4.5).project(camera);
  _projSouth.set(colX, 0, 4.5).project(camera);
  const crossScreenX = _projSouth.x - _projNorth.x;
  const crossScreenY = _projSouth.y - _projNorth.y;

  // Determine whether street spans primarily horizontal or vertical on screen
  const isStreetHorizontal = Math.abs(streetScreenX) >= Math.abs(streetScreenY);

  if (isStreetHorizontal) {
    if (dirName === "LEFT" || dirName === "RIGHT") {
      // Move within the same row along the street with cyclic wrap-around (no dead ends)
      const colStep = (dirName === "RIGHT" ? 1 : -1) * (streetScreenX >= 0 ? 1 : -1);
      const nextCol = (cur.col + colStep + 6) % 6;
      const rowList = cur.row === "NORTH" ? ROW_NORTH : ROW_SOUTH;
      return rowList[nextCol];
    } else {
      // UP / DOWN moves across the street to the opposite row
      const wantSouth = dirName === "UP" ? (crossScreenY > 0) : (crossScreenY < 0);
      let targetRow: "NORTH" | "SOUTH" = wantSouth ? "SOUTH" : "NORTH";
      // If already on the target row, cross to opposite row so every press navigates
      if (targetRow === cur.row) {
        targetRow = cur.row === "NORTH" ? "SOUTH" : "NORTH";
      }
      const targetRowList = targetRow === "NORTH" ? ROW_NORTH : ROW_SOUTH;
      return targetRowList[cur.col];
    }
  } else {
    // Vertical Street (Looking down street lengthwise)
    if (dirName === "UP" || dirName === "DOWN") {
      const colStep = (dirName === "UP" ? 1 : -1) * (streetScreenY >= 0 ? 1 : -1);
      const nextCol = (cur.col + colStep + 6) % 6;
      const rowList = cur.row === "NORTH" ? ROW_NORTH : ROW_SOUTH;
      return rowList[nextCol];
    } else {
      // LEFT / RIGHT moves across the street to the opposite row
      const wantSouth = dirName === "RIGHT" ? (crossScreenX > 0) : (crossScreenX < 0);
      let targetRow: "NORTH" | "SOUTH" = wantSouth ? "SOUTH" : "NORTH";
      if (targetRow === cur.row) {
        targetRow = cur.row === "NORTH" ? "SOUTH" : "NORTH";
      }
      const targetRowList = targetRow === "NORTH" ? ROW_NORTH : ROW_SOUTH;
      return targetRowList[cur.col];
    }
  }
}

// Dedicated 3D Controller Focus Ring with 0ms direct-ref position updates
function ControllerFocusRing({
  ringRef,
  focusedId,
  selectedId,
}: {
  ringRef: React.RefObject<THREE.Group | null>;
  focusedId: string | null;
  selectedId: string | null;
}) {
  const outerMeshRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    if (outerMeshRef.current) {
      const t = state.clock.getElapsedTime();
      const s = 1.0 + 0.04 * Math.sin(t * 8);
      outerMeshRef.current.scale.set(s, s, 1);
    }
  });

  const targetCoords = focusedId ? HOUSE_COORDS[focusedId] : null;
  const isVisible = Boolean(targetCoords && focusedId !== selectedId);
  const isProsumer = focusedId ? focusedId.startsWith("P") : false;

  return (
    <group
      ref={ringRef}
      position={targetCoords ? [targetCoords[0], 0.06, targetCoords[2]] : [0, -100, 0]}
      visible={isVisible}
    >
      {/* Outer Pulse Ring */}
      <mesh ref={outerMeshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.75, 2.18, 36]} />
        <meshBasicMaterial
          color={isProsumer ? "#F59E0B" : "#EF4444"}
          transparent
          opacity={0.88}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Inner Crisp White Accent Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.58, 1.72, 36]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface GamepadSpatialNavigatorProps {
  houses: HouseLiveState[];
  controllerFocusedId: string | null;
  selectedHouse: HouseLiveState | null;
  cutLines: number[];
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  focusRingRef: React.RefObject<THREE.Group | null>;
  onFocusChange: (houseId: string) => void;
  onSelectHouse: (houseId: string) => void;
  onResetView: () => void;
  onToggleCutLine: (house: HouseLiveState) => void;
  onRequestBackup: (house: HouseLiveState) => void;
  onControllerStateChange: React.Dispatch<React.SetStateAction<GamepadHudState>>;
}

function GamepadSpatialNavigator({
  houses,
  controllerFocusedId,
  selectedHouse,
  cutLines,
  controlsRef,
  focusRingRef,
  onFocusChange,
  onSelectHouse,
  onResetView,
  onToggleCutLine,
  onRequestBackup,
  onControllerStateChange,
}: GamepadSpatialNavigatorProps) {
  const { camera } = useThree();
  const prevButtonStates = useRef({
    UP: false,
    DOWN: false,
    LEFT: false,
    RIGHT: false,
  });
  const buttonHoldTimes = useRef({
    UP: 0,
    DOWN: 0,
    LEFT: 0,
    RIGHT: 0,
  });
  const prevActionButtons = useRef({
    cross: false,
    circle: false,
    triangle: false,
  });
  const prevDirectionRef = useRef<string | null>(null);
  const hasControllerRef = useRef(false);
  const focusedIdRef = useRef<string | null>(controllerFocusedId);
  focusedIdRef.current = controllerFocusedId;
  const selectedHouseRef = useRef<HouseLiveState | null>(selectedHouse);
  selectedHouseRef.current = selectedHouse;

  // Listen to Gamepad connection events
  useEffect(() => {
    const handleConnected = (e: GamepadEvent) => {
      hasControllerRef.current = true;
      onControllerStateChange((prev) => ({
        ...prev,
        connected: true,
        id: e.gamepad.id || "DualShock 4 Wireless Controller",
        lastActiveTime: Date.now(),
      }));
    };

    const handleDisconnected = (e: GamepadEvent) => {
      hasControllerRef.current = false;
      onControllerStateChange((prev) => ({
        ...prev,
        connected: false,
        activeDirection: null,
        lastActiveTime: Date.now(),
      }));
    };

    window.addEventListener("gamepadconnected", handleConnected);
    window.addEventListener("gamepaddisconnected", handleDisconnected);

    return () => {
      window.removeEventListener("gamepadconnected", handleConnected);
      window.removeEventListener("gamepaddisconnected", handleDisconnected);
    };
  }, [onControllerStateChange]);

  // Gamepad Polling Loop via Three.js useFrame (60/120fps)
  useFrame((state, delta) => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    let gp: Gamepad | null = null;
    for (let i = 0; i < gamepads.length; i++) {
      const g = gamepads[i];
      if (g && g.connected && (g.buttons.length >= 12 || g.axes.length >= 4)) {
        gp = g;
        break;
      }
    }

    if (!gp) {
      if (hasControllerRef.current) {
        hasControllerRef.current = false;
        onControllerStateChange((prev) => ({
          ...prev,
          connected: false,
          activeDirection: null,
        }));
      }
      return;
    }

    if (!hasControllerRef.current) {
      hasControllerRef.current = true;
      onControllerStateChange((prev) => ({
        ...prev,
        connected: true,
        id: gp?.id || "DualShock 4 Wireless Controller",
      }));
    }

    // =========================================================================
    // 1. STRICT D-PAD FOCUS NAVIGATION (Instant response, zero lag, no sticks/arrows)
    // =========================================================================
    // DualShock 4 D-pad mapping: buttons[12]=Up, [13]=Down, [14]=Left, [15]=Right
    const btnUp = Boolean(gp.buttons[12]?.pressed || (gp.buttons[12]?.value ?? 0) > 0.3);
    const btnDown = Boolean(gp.buttons[13]?.pressed || (gp.buttons[13]?.value ?? 0) > 0.3);
    const btnLeft = Boolean(gp.buttons[14]?.pressed || (gp.buttons[14]?.value ?? 0) > 0.3);
    const btnRight = Boolean(gp.buttons[15]?.pressed || (gp.buttons[15]?.value ?? 0) > 0.3);

    // Optional POV Hat switch on axes[9] fallback if driver uses hat switch for D-pad
    let hatUp = false, hatDown = false, hatLeft = false, hatRight = false;
    if (gp.axes.length > 9) {
      const hat = Number(gp.axes[9]?.toFixed(2));
      if (hat >= -1.05 && hat <= -0.95) hatUp = true;
      else if (hat >= -0.75 && hat <= -0.65) { hatUp = true; hatRight = true; }
      else if (hat >= -0.45 && hat <= -0.35) hatRight = true;
      else if (hat >= -0.18 && hat <= -0.10) { hatDown = true; hatRight = true; }
      else if (hat >= 0.10 && hat <= 0.18) hatDown = true;
      else if (hat >= 0.38 && hat <= 0.46) { hatDown = true; hatLeft = true; }
      else if (hat >= 0.68 && hat <= 0.75) hatLeft = true;
      else if (hat >= 0.98 && hat <= 1.05) { hatUp = true; hatLeft = true; }
    }

    const isUp = btnUp || hatUp;
    const isDown = btnDown || hatDown;
    const isLeft = btnLeft || hatLeft;
    const isRight = btnRight || hatRight;

    const now = performance.now();
    const dirs: ("UP" | "DOWN" | "LEFT" | "RIGHT")[] = ["UP", "DOWN", "LEFT", "RIGHT"];
    const currentStates = {
      UP: isUp,
      DOWN: isDown,
      LEFT: isLeft,
      RIGHT: isRight,
    };

    let triggeredDir: "UP" | "DOWN" | "LEFT" | "RIGHT" | null = null;

    for (const d of dirs) {
      const isPressed = currentStates[d];
      const wasPressed = prevButtonStates.current[d];

      if (isPressed && !wasPressed) {
        // Immediate, instant trigger with 0ms delay on press
        triggeredDir = d;
        buttonHoldTimes.current[d] = now;
        break;
      } else if (isPressed && wasPressed) {
        const holdDuration = now - buttonHoldTimes.current[d];
        // Snappy initial repeat threshold (200ms), followed by rapid 70ms repeat
        if (holdDuration > 200) {
          triggeredDir = d;
          buttonHoldTimes.current[d] = now - 130;
          break;
        }
      } else if (!isPressed && wasPressed) {
        buttonHoldTimes.current[d] = 0;
      }
    }

    prevButtonStates.current = currentStates;

    if (triggeredDir) {
      const current = focusedIdRef.current;
      const nextId = current ? computeCameraRelativeNeighbor(current, triggeredDir, camera) : "C1";

      if (nextId) {
        focusedIdRef.current = nextId;
        const coords = HOUSE_COORDS[nextId];
        // Direct 0ms in-frame scene repositioning (bypasses React render pipeline delay)
        if (coords && focusRingRef.current) {
          focusRingRef.current.position.set(coords[0], 0.06, coords[2]);
          focusRingRef.current.visible = true;
        }
        onFocusChange(nextId);
        playShiftHaptic();
      }

      if (prevDirectionRef.current !== triggeredDir) {
        prevDirectionRef.current = triggeredDir;
        onControllerStateChange((prev) => ({
          ...prev,
          connected: true,
          id: gp?.id || "DualShock 4 Wireless Controller",
          activeDirection: triggeredDir,
          lastActiveTime: Date.now(),
        }));
      }
    } else {
      if (prevDirectionRef.current !== null && !isUp && !isDown && !isLeft && !isRight) {
        prevDirectionRef.current = null;
        onControllerStateChange((prev) => ({ ...prev, activeDirection: null }));
      }
    }

    // =========================================================================
    // 2. ACTION BUTTONS: X (Cross / btn 0), Circle (btn 1), Triangle (btn 3)
    // =========================================================================
    const btnCross = Boolean(gp.buttons[0]?.pressed || (gp.buttons[0]?.value ?? 0) > 0.5);
    const btnCircle = Boolean(gp.buttons[1]?.pressed || (gp.buttons[1]?.value ?? 0) > 0.5);
    const btnTriangle = Boolean(gp.buttons[3]?.pressed || (gp.buttons[3]?.value ?? 0) > 0.5);

    // 2A. X Button (Cross):
    // - If no house is open: opens the currently focused house (or C1)
    // - If a house is open: toggles cut line (cuts if active, restores if cut)
    if (btnCross && !prevActionButtons.current.cross) {
      const currentSelected = selectedHouseRef.current;
      if (!currentSelected) {
        const targetId = focusedIdRef.current || "C1";
        focusedIdRef.current = targetId;
        const coords = HOUSE_COORDS[targetId];
        if (coords && focusRingRef.current) {
          focusRingRef.current.position.set(coords[0], 0.06, coords[2]);
          focusRingRef.current.visible = true;
        }
        onFocusChange(targetId);
        onSelectHouse(targetId);
      } else {
        onToggleCutLine(currentSelected);
      }
    }

    // 2B. Circle Button: Goes back to the complete simulation view (reset)
    if (btnCircle && !prevActionButtons.current.circle) {
      onResetView();
    }

    // 2C. Triangle Button: Triggers "Request Energy Backup" button when house is cut off
    if (btnTriangle && !prevActionButtons.current.triangle) {
      const currentSelected = selectedHouseRef.current;
      if (currentSelected) {
        onRequestBackup(currentSelected);
      }
    }

    prevActionButtons.current = {
      cross: btnCross,
      circle: btnCircle,
      triangle: btnTriangle,
    };

    // =========================================================================
    // 3. JOYSTICK NAVIGATION: Left Stick (Pan/Move) & Right Stick (Orbit/Rotate)
    // =========================================================================
    const controls = controlsRef.current;
    if (controls) {
      const DEADZONE = 0.12;

      // 3A. Left Stick (Axes 0 & 1): Scene movement / Pan (equivalent to right mouse drag)
      const leftX = gp.axes[0] ?? 0;
      const leftY = gp.axes[1] ?? 0;
      const leftDist = Math.hypot(leftX, leftY);

      if (leftDist > DEADZONE) {
        // Cancel any active automated camera lerp transition
        controls.dispatchEvent({ type: "start", target: controls });

        const factor = (leftDist - DEADZONE) / (1 - DEADZONE);
        const normX = (leftX / leftDist) * factor;
        const normY = (leftY / leftDist) * factor;

        const panSpeed = 16.0 * Math.min(delta, 0.1);
        const rightVector = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const upVector = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

        const panOffset = new THREE.Vector3();
        panOffset.addScaledVector(rightVector, normX * panSpeed);
        panOffset.addScaledVector(upVector, -normY * panSpeed);

        controls.target.add(panOffset);
        camera.position.add(panOffset);

        // Keep target within microgrid scene bounds
        controls.target.x = THREE.MathUtils.clamp(controls.target.x, -22.0, 22.0);
        controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.0, 4.0);
        controls.target.z = THREE.MathUtils.clamp(controls.target.z, -10.0, 10.0);

        controls.update();
      }

      // 3B. Right Stick (Axes 2 & 3): Rotate view / Orbit (equivalent to left mouse drag)
      let rightX = gp.axes[2] ?? 0;
      let rightY = gp.axes[3] ?? 0;
      // Fallback for drivers that map right stick to axes[4] / axes[5]
      if (Math.abs(rightX) < 0.01 && Math.abs(rightY) < 0.01 && gp.axes.length > 5) {
        if (Math.abs(gp.axes[4] ?? 0) > 0.1 || Math.abs(gp.axes[5] ?? 0) > 0.1) {
          rightX = gp.axes[4] ?? 0;
          rightY = gp.axes[5] ?? 0;
        }
      }

      const rightDist = Math.hypot(rightX, rightY);
      if (rightDist > DEADZONE) {
        // Cancel any active automated camera lerp transition
        controls.dispatchEvent({ type: "start", target: controls });

        const factor = (rightDist - DEADZONE) / (1 - DEADZONE);
        const normX = (rightX / rightDist) * factor;
        const normY = (rightY / rightDist) * factor;

        const rotSpeed = 2.4 * Math.min(delta, 0.1);
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        // Horizontal orbit (azimuth)
        spherical.theta -= normX * rotSpeed;

        // Vertical orbit (polar angle / elevation)
        spherical.phi += normY * rotSpeed;
        const minPhi = controls.minPolarAngle || (Math.PI / 8);
        const maxPhi = controls.maxPolarAngle || (Math.PI / 2.18);
        spherical.phi = THREE.MathUtils.clamp(spherical.phi, minPhi, maxPhi);
        spherical.makeSafe();

        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);

        controls.update();
      }
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
    resetMicrogridAction,
    cutLinesAction,
    restoreLinesAction
  } = useMicrogridData();
  const [selectedHouseIds, setSelectedHouseIds] = useState<string[]>([]);
  const [hoveredHouseId, setHoveredHouseId] = useState<string | null>(null);
  const [controllerFocusedId, setControllerFocusedId] = useState<string | null>(null);
  const [gamepadState, setGamepadState] = useState<GamepadHudState>({
    connected: false,
    id: "",
    activeDirection: null,
    lastActiveTime: 0,
  });
  const [activeTrade, setActiveTrade] = useState<{ from: string; to: string } | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<boolean>(false);
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const focusRingRef = useRef<THREE.Group | null>(null);

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
      // Keep house focused; do not toggle off and reset view on drag release or re-click
      setSelectedHouseIds([houseId]);
    }
  };

  // Derive selected houses and single selected house for focus
  const selectedHouses = useMemo(
    () => houses.filter((h) => selectedHouseIds.includes(h.id)),
    [houses, selectedHouseIds]
  );
  const selectedHouse = selectedHouses.length === 1 ? selectedHouses[0] : null;

  // Active incoming energy request that this prosumer can accept
  const incomingPing = useMemo(() => {
    if (!selectedHouse || selectedHouse.type !== "prosumer") return null;
    // 1. Direct priority candidate match
    const directPing = energyRequests.find(
      (r) => (r.status === "pinged" || r.status === "open") && r.current_candidate_household_id === selectedHouse.householdId
    );
    if (directPing) return directPing;

    // 2. Any active open or pinged emergency request looking for energy in the microgrid
    const openRequest = energyRequests.find(
      (r) => r.status === "pinged" || r.status === "open"
    );
    return openRequest || null;
  }, [selectedHouse, energyRequests]);

  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [settledReceipt, setSettledReceipt] = useState<{
    requestId: string;
    txHash: string;
    etherscanUrl: string;
    kwh: number;
    prosumerCode: string;
    consumerCode: string;
  } | null>(null);

  const handleProsumerAccept = async (requestId: string, prosumerHouseholdId: number) => {
    setIsAccepting(true);
    try {
      const res = await respondEnergyRequestAction(requestId, "accept", prosumerHouseholdId);
      if (res && res.success) {
        const req = res.request || energyRequests.find((r) => r.id === requestId);
        const buyerId = req?.requester_household_id;
        const buyer = houses.find((h) => h.householdId === buyerId);
        const seller = houses.find((h) => h.householdId === prosumerHouseholdId);

        const txHash = res.txHash || req?.tx_hash || "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const etherscanUrl = res.etherscanUrl || `https://sepolia.etherscan.io/tx/${txHash}`;

        if (seller && buyer) {
          // Immediately illuminate 3D energy transfer beam!
          setActiveTrade({ from: seller.id, to: buyer.id });
          setTimeout(() => setActiveTrade(null), 8000);
        }

        setSettledReceipt({
          requestId,
          txHash,
          etherscanUrl,
          kwh: req?.units_kwh || 15.0,
          prosumerCode: seller?.id || `P-${prosumerHouseholdId}`,
          consumerCode: buyer?.id || `C-${buyerId}`,
        });

        setTradeSuccess(true);
        setTimeout(() => setTradeSuccess(false), 5000);
      }
    } catch (err) {
      console.error("Prosumer accept error:", err);
    } finally {
      setIsAccepting(false);
    }
  };

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
    if (energyRequests.length === 0) {
      setActiveTrade(null);
      lastSettledIdRef.current = null;
      return;
    }
    const latestSettled = energyRequests.find(
      (r) => (r.status === "settled" || r.status === "settling") && r.current_candidate_household_id
    );
    if (!latestSettled) {
      setActiveTrade(null);
      return;
    }
    if (latestSettled.id !== lastSettledIdRef.current) {
      lastSettledIdRef.current = latestSettled.id;
      // Only animate if settled within the last 15 seconds
      const settledAgeMs = latestSettled.updated_at 
        ? Math.abs(Date.now() - new Date(latestSettled.updated_at).getTime())
        : 0;
      if (settledAgeMs < 15000) {
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

    setTimeout(() => {
      setActiveTrade(null);
    }, 6000);
  };

  // Smooth scroll-to-zoom and zoom-to-page-scroll transition (Request 5 & Smoothness fix)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!controlsRef.current) return;
    const camera = controlsRef.current.object;
    const target = controlsRef.current.target;
    const distance = camera.position.distanceTo(target);

    // If scrolling DOWN (deltaY > 0)
    if (e.deltaY > 0) {
      // Once zoomed out near max distance, disable 3D zoom so browser natively scrolls page with hardware acceleration
      if (distance >= 37.2) {
        controlsRef.current.enableZoom = false;
      }
    } else if (e.deltaY < 0) {
      // If scrolling UP (deltaY < 0) while page is at the top, re-enable 3D zoom
      if (window.scrollY <= 2) {
        controlsRef.current.enableZoom = true;
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (controlsRef.current) {
        // While scrolled down the page, disable 3D zoom so scrolling up smoothly navigates page
        if (window.scrollY > 2) {
          controlsRef.current.enableZoom = false;
        } else {
          controlsRef.current.enableZoom = true;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div 
      onWheel={handleWheel}
      className="relative w-full h-[92vh] bg-[#DCEAF6] overflow-hidden select-none cursor-grab active:cursor-grabbing"
    >
      
      {/* 3D WebGL Canvas */}
      <Canvas
        shadows="percentage"
        camera={{ position: [0, 15, 23], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        {/* Soft daylight sky color and atmospheric fog that seamlessly bounds the terrain */}
        <color attach="background" args={["#DCEAF6"]} />
        <fog attach="fog" args={["#DCEAF6", 30, 58]} />

        {/* Gamepad Spatial Controller Navigator (DualShock PS4) */}
        <GamepadSpatialNavigator
          houses={houses}
          controllerFocusedId={controllerFocusedId}
          selectedHouse={selectedHouse}
          cutLines={cutLines}
          controlsRef={controlsRef}
          focusRingRef={focusRingRef}
          onFocusChange={(newId) => setControllerFocusedId(newId)}
          onSelectHouse={(houseId) => handleHouseSelect(houseId, false)}
          onResetView={() => {
            setSelectedHouseIds([]);
            setIsRequestModalOpen(false);
            setActiveTrade(null);
            setTradeSuccess(false);
            setSettledReceipt(null);
          }}
          onToggleCutLine={(house) => {
            const hid = house.householdId;
            const isCut = cutLines.includes(hid) || house.powerState === "line_cut";
            if (isCut) {
              restoreLinesAction([hid]);
            } else {
              cutLinesAction([hid]);
            }
          }}
          onRequestBackup={(house) => {
            const isCutOrOutage = house.powerState === "line_cut" || house.powerState === "blackout" || house.isOutage || cutLines.includes(house.householdId);
            if (house.type === "consumer" && isCutOrOutage) {
              setModalRequesterId(house.householdId);
              setIsRequestModalOpen(true);
            }
          }}
          onControllerStateChange={setGamepadState}
        />

        {/* Dedicated 0ms instant 3D Controller Focus Ring */}
        <ControllerFocusRing 
          ringRef={focusRingRef} 
          focusedId={controllerFocusedId} 
          selectedId={selectedHouse?.id || null} 
        />

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
              isHovered={hoveredHouseId === house.id && !gamepadState.connected}
              isLineCut={cutLines.includes(house.householdId) || house.powerState === "line_cut"}
              showBadge={!isRequestModalOpen && (selectedHouseIds.length !== 1 || selectedHouseIds.includes(house.id))}
              onSelect={(isMulti) => handleHouseSelect(house.id, isMulti)}
              onHover={(hovered) => {
                setHoveredHouseId(hovered ? house.id : null);
                if (hovered && !gamepadState.connected) {
                  setControllerFocusedId(house.id);
                }
              }}
            />
          ))}
        </Suspense>

        {/* 6. Microgrid Underground Conduit & Active Trade Energy Beam (Preserved in code, hidden from 3D scene) */}
        {/* <MicrogridEnergyFlow houses={houses} activeTrade={activeTrade} cutLines={cutLines} /> */}

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
          minDistance={6}
          maxDistance={38}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.18}
        />
      </Canvas>

      {/* ================= TOP COMMUNITY TELEMETRY HUD BAR ================= */}
      <div className="absolute top-5 left-4 right-4 sm:left-6 sm:right-6 flex items-center justify-between pointer-events-none z-20">
        {/* Quick Metrics (Cleaned: Generation, Load, Net Balance, Self-Sufficiency - Request 3) */}
        <div className="pointer-events-auto bg-white/90 backdrop-blur-xl border border-[#CBD5E1] px-4 py-2 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex items-center gap-5 text-xs font-mono">
          <div>
            <span className="text-[10px] text-[#64748B] block">Generation</span>
            <span className="font-semibold text-[#16A34A] tabular-nums">{totalGen} kWh</span>
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
          <div className="hidden sm:block">
            <span className="text-[10px] text-[#64748B] block">Self-Sufficiency</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20">
              {selfSufficiency}%
            </span>
          </div>
        </div>

        {/* Action Controls & Gamepad Status Indicator */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* DualShock 4 Controller Status HUD */}
          <div 
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all backdrop-blur-xl ${
              gamepadState.connected
                ? "bg-[#0F172A]/90 text-white border-blue-500/50 shadow-[0_4px_16px_rgba(59,130,246,0.25)]"
                : "bg-white/90 text-[#64748B] border-[#CBD5E1]"
            }`}
            title={gamepadState.connected ? `Connected: ${gamepadState.id} (D-Pad: Focus, ✕: Open/Cut, ○: Reset, △: Backup, Joysticks: Pan/Rotate)` : "Connect your PS4 DualShock controller and press any D-pad button"}
          >
            <Gamepad2 className={`w-4 h-4 ${gamepadState.connected ? "text-blue-400" : "text-[#94A3B8]"}`} />
            {gamepadState.connected ? (
              <div className="flex items-center gap-2">
                <span className="text-blue-300 font-semibold hidden md:inline">PS4</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {controllerFocusedId ? (
                  <span className="px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-200 font-bold border border-blue-400/30">
                    Focus: {controllerFocusedId}
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">Press D-Pad</span>
                )}
                <div className="flex items-center gap-0.5 text-[10px] font-mono select-none">
                  <span className={`px-1 rounded ${gamepadState.activeDirection === "UP" ? "bg-cyan-400 text-black font-bold" : "text-slate-500"}`}>▲</span>
                  <span className={`px-1 rounded ${gamepadState.activeDirection === "DOWN" ? "bg-cyan-400 text-black font-bold" : "text-slate-500"}`}>▼</span>
                  <span className={`px-1 rounded ${gamepadState.activeDirection === "LEFT" ? "bg-cyan-400 text-black font-bold" : "text-slate-500"}`}>◀</span>
                  <span className={`px-1 rounded ${gamepadState.activeDirection === "RIGHT" ? "bg-cyan-400 text-black font-bold" : "text-slate-500"}`}>▶</span>
                </div>
                <div className="hidden xl:flex items-center gap-2 border-l border-slate-700 pl-2 text-[10px]">
                  <span className="text-slate-400">✕ <span className="text-slate-300">{selectedHouse ? "Cut Line" : "Open"}</span></span>
                  <span className="text-slate-400">○ <span className="text-slate-300">Reset</span></span>
                  <span className="text-slate-400">△ <span className="text-slate-300">Backup</span></span>
                  <span className="text-slate-500">| L-Stick Pan • R-Stick Orbit</span>
                </div>
              </div>
            ) : (
              <span className="text-[11px] text-[#64748B] hidden sm:inline">PS4 Controller: Press D-Pad</span>
            )}
          </div>

          {selectedHouseIds.length > 0 && (
            <button
              onClick={() => {
                setSelectedHouseIds([]);
                setActiveTrade(null);
                setTradeSuccess(false);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/90 hover:bg-white text-[#1E293B] border border-[#CBD5E1] text-xs font-mono transition-all cursor-pointer shadow-sm hover:shadow active:scale-98"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Reset View ({selectedHouseIds.length})</span>
              {gamepadState.connected && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 text-[10px] font-bold border border-rose-500/20">
                  ○ Circle
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ================= ENHANCED NODE INFORMATION POPUP / CARD (F2 & F4) ================= */}
      {selectedHouse && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 w-84 sm:w-92 bg-white/92 border border-[#CBD5E1] rounded-2xl p-5 shadow-[0_16px_36px_rgba(0,0,0,0.08)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 font-sans">
          
          {/* Header Row: Heading on Left, Status Tag Right-Aligned (no dot), plus Close Button */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-[#1E293B]">
              {selectedHouse.name}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                selectedHouse.powerState === "blackout" || selectedHouse.isOutage || (selectedHouse.type === "consumer" && selectedHouse.powerState !== "grid")
                  ? "bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20"
                  : selectedHouse.powerState === "line_cut"
                  ? "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/20"
                  : selectedHouse.powerState === "battery"
                  ? "bg-[#D99A22]/10 text-[#D99A22] border-[#D99A22]/20"
                  : "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20"
              }`}>
                {selectedHouse.powerState === "blackout" || selectedHouse.isOutage || (selectedHouse.type === "consumer" && selectedHouse.powerState !== "grid")
                  ? "Blackout"
                  : selectedHouse.powerState === "line_cut"
                  ? "Line Cut"
                  : selectedHouse.powerState === "battery"
                  ? "On Battery"
                  : "Grid Connected"}
              </span>
              <button
                onClick={() => setSelectedHouseIds([])}
                className="text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Consumer Divider vs Prosumer Battery Storage Bar */}
          {selectedHouse.type === "consumer" ? (
            <hr className="border-t border-[#E2E8F0] my-3.5" />
          ) : (
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

          {/* Line Isolation Status & Line Cut Control (F4) */}
          <div className="text-[11px] font-mono mb-3.5 flex items-center justify-between bg-[#F8FAFC] px-3 py-2.5 rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#64748B]">Line Connection:</span>
              <span className={`font-semibold ${cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? "text-[#D97706]" : "text-[#16A34A]"}`}>
                {cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? "Severed" : "Active (33kV)"}
              </span>
            </div>
            {cutLines.includes(selectedHouse.householdId) || selectedHouse.powerState === "line_cut" ? (
              <button
                onClick={() => restoreLinesAction([selectedHouse.householdId])}
                className="px-2.5 py-1 rounded-lg bg-[#16A34A]/10 hover:bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 text-[10px] font-bold transition cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                title="Reconnect utility line (or press X on controller)"
              >
                <span>Reconnect</span>
                {gamepadState.connected && (
                  <span className="px-1 rounded bg-[#16A34A]/20 text-[#16A34A] font-mono text-[9px]">✕</span>
                )}
              </button>
            ) : (
              <button
                onClick={() => cutLinesAction([selectedHouse.householdId])}
                className="px-2.5 py-1 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[10px] font-bold transition cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                title="Simulate blown line / isolate house (or press X on controller)"
              >
                <span>Cut Line</span>
                {gamepadState.connected && (
                  <span className="px-1 rounded bg-[#DC2626]/20 text-[#DC2626] font-mono text-[9px]">✕</span>
                )}
              </button>
            )}
          </div>

          {/* Incoming Candidate Prosumer Ping Alert (F7) */}
          {incomingPing && !settledReceipt && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 font-mono text-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-[#D97706] font-bold">
                  <Zap className="w-3.5 h-3.5 fill-[#D97706]" />
                  <span>
                    {incomingPing.current_candidate_household_id === selectedHouse.householdId
                      ? "Direct Emergency Request"
                      : "Emergency Demand in Microgrid"}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D97706]/15 text-[#D97706] font-semibold">
                  Manual Accept
                </span>
              </div>
              <div className="text-[11px] text-[#64748B] mb-2.5">
                From <span className="font-bold text-[#1D1D1F]">{incomingPing.requester_code || `House #${incomingPing.requester_household_id}`}</span>:{" "}
                <span className="font-semibold text-[#1D1D1F]">{incomingPing.units_kwh} kWh</span> for{" "}
                <span className="font-semibold text-[#1D1D1F]">{incomingPing.total_price_eth} ETH</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={isAccepting}
                  onClick={() => handleProsumerAccept(incomingPing.id, selectedHouse.householdId)}
                  className="flex-1 py-2 rounded-lg bg-[#27845B] hover:bg-[#1E6948] disabled:opacity-50 text-white text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  {isAccepting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Settling on Sepolia...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept &amp; Dispatch</span>
                    </>
                  )}
                </button>
                <button
                  disabled={isAccepting}
                  onClick={() => respondEnergyRequestAction(incomingPing.id, "deny", selectedHouse.householdId)}
                  className="px-3 py-2 rounded-lg bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#DC2626] border border-[#DC2626]/30 text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Deny</span>
                </button>
              </div>
            </div>
          )}

          {/* Settled On-Chain Trade Receipt */}
          {settledReceipt && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#27845B]/10 border border-[#27845B]/30 text-xs font-mono text-[#1D1D1F] space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[#27845B] font-bold">
                  <CheckCircle2 className="w-4 h-4 text-[#27845B]" />
                  <span>Energy Dispatched &amp; Settled</span>
                </div>
                <button
                  onClick={() => setSettledReceipt(null)}
                  className="text-[#64748B] hover:text-[#1D1D1F] text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[11px] text-[#64748B]">
                {settledReceipt.prosumerCode} dispatched <span className="font-semibold text-[#1D1D1F]">{settledReceipt.kwh} kWh</span> to {settledReceipt.consumerCode}
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-[#27845B]/20">
                <span className="text-[#64748B] font-mono">
                  Tx: {settledReceipt.txHash.slice(0, 10)}...{settledReceipt.txHash.slice(-6)}
                </span>
                <a
                  href={settledReceipt.etherscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5277D5] hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Sepolia Etherscan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Context-Aware Action Triggers */}
          {selectedHouse.type === "consumer" ? (
            (selectedHouse.powerState === "blackout" || selectedHouse.isOutage || selectedHouse.powerState === "line_cut") ? (
              <button
                onClick={() => {
                  setModalRequesterId(selectedHouse.householdId);
                  setIsRequestModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-[#1D1D1F] hover:bg-[#343438] active:scale-[0.99] text-white font-medium text-xs font-mono transition-all flex items-center justify-between px-4 cursor-pointer shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Request Energy Backup</span>
                </div>
                {gamepadState.connected && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                    △ Triangle
                  </span>
                )}
              </button>
            ) : null
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
              <span>Cut Lines ({selectedHouses.length})</span>
            </button>
            <button
              onClick={() => restoreLinesAction(selectedHouses.map((h) => h.householdId))}
              className="py-2.5 px-3 rounded-xl bg-[#16A34A]/10 hover:bg-[#16A34A]/20 border border-[#16A34A]/30 text-[#16A34A] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.98]"
            >
              <span>Restore Lines</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= 3D VIEWPORT ENERGY REQUEST MODAL (M4) ================= */}
      {isRequestModalOpen && modalRequesterId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-[0_24px_48px_rgba(0,0,0,0.25)] max-w-sm w-full p-6 relative font-sans">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Request Energy Backup
              </h3>
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="text-[#64748B] hover:text-[#1E293B] p-1.5 rounded-lg hover:bg-[#F1F5F9] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
