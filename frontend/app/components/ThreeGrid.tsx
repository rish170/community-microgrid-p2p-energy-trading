"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere } from "@react-three/drei";
import * as THREE from "three";

function GridNodes() {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 120;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorA = new THREE.Color("#10b981"); // Solar emerald
    const colorB = new THREE.Color("#38bdf8"); // Energy cyan
    const colorC = new THREE.Color("#f59e0b"); // Solar amber

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      pos[i3] = (Math.random() - 0.5) * 16;
      pos[i3 + 1] = (Math.random() - 0.5) * 10;
      pos[i3 + 2] = (Math.random() - 0.5) * 10;

      const mixed = Math.random() > 0.5 ? (Math.random() > 0.5 ? colorA : colorB) : colorC;
      col[i3] = mixed.r;
      col[i3 + 1] = mixed.g;
      col[i3 + 2] = mixed.b;
    }
    return [pos, col];
  }, [count]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.08;
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.16}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Main Glowing Microgrid Core Orb */}
      <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
        <Sphere args={[1.2, 32, 32]} position={[0, 0, 0]}>
          <meshStandardMaterial
            color="#10b981"
            emissive="#059669"
            emissiveIntensity={1.5}
            wireframe
            transparent
            opacity={0.35}
          />
        </Sphere>
        <Sphere args={[0.7, 16, 16]} position={[0, 0, 0]}>
          <meshBasicMaterial color="#38bdf8" wireframe />
        </Sphere>
      </Float>
    </group>
  );
}

export default function ThreeGrid() {
  return (
    <div className="w-full h-full absolute inset-0 -z-10 pointer-events-none opacity-60 dark:opacity-75">
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#38bdf8" />
        <pointLight position={[-10, -10, -10]} intensity={1.2} color="#10b981" />
        <GridNodes />
      </Canvas>
    </div>
  );
}
