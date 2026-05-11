"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  PerspectiveCamera,
} from "@react-three/drei";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Undertone } from "@/lib/solana";

/**
 * Parametric 3D twin model.
 *
 * Built from primitives (capsules + sphere head) composed into a stylized
 * humanoid. Every dimension drives off twin measurements; skin material color
 * comes from the Monk skin-tone scale tinted by undertone.
 *
 * No facial features (privacy by design). Stylized, not photoreal — the
 * uncanny-valley risk is sidestepped by leaning into a fashion-illustration
 * aesthetic with smooth materials and clean lighting.
 *
 * Performance: pure primitives, no mesh files, no animation rigs. Renders
 * fluidly on integrated GPUs. Camera orbits via OrbitControls.
 */

interface ModelTwin {
  heightCm: number;
  weightKg?: number;
  chestCm: number;
  waistCm: number;
  hipCm: number;
  inseamCm: number;
  shoulderCm: number;
  undertone: Undertone;
  skinTone: number; // 1..10
}

const MONK_SCALE = [
  "#F6E0CB", "#E5C8A8", "#D9AC83", "#C99366", "#B07C53",
  "#946845", "#7A5538", "#5F412A", "#42301F", "#2A1E14",
];

const UNDERTONE_TINT: Record<Undertone, [number, number, number]> = {
  [Undertone.Cool]: [0.92, 0.96, 1.05],   // slight blue lift
  [Undertone.Warm]: [1.08, 1.0, 0.9],     // slight gold lift
  [Undertone.Neutral]: [1.0, 1.0, 1.0],
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function skinHex(tone: number): string {
  return MONK_SCALE[clamp(Math.round(tone) - 1, 0, 9)];
}

function applyTint(hex: string, tint: [number, number, number]): THREE.Color {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * tint[0]);
  c.g = Math.min(1, c.g * tint[1]);
  c.b = Math.min(1, c.b * tint[2]);
  return c;
}

/** Convert circumference (cm) → radius for a roughly elliptical cross-section. */
function circToRadius(cm: number): number {
  // We render torso/limb cross-sections as rounded shapes. Approximate radius
  // = circumference / (2π * 0.85) — accounting for non-circular cross-sections.
  return cm / (2 * Math.PI * 0.85) / 100; // result in meters (Three.js units)
}

interface FigureProps {
  twin: ModelTwin;
}

function Figure({ twin }: FigureProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Convert measurements to scene units (1 unit ≈ 1 meter).
  const heightM = twin.heightCm / 100;
  const inseamM = twin.inseamCm / 100;

  // Body proportions — derived from common fashion croquis ratios but driven by user data.
  const headRadius = heightM / 18; // 9-head proportions: head = total/9 → radius = total/18
  const headDiameter = headRadius * 2;
  const neckHeight = headDiameter * 0.35;
  const torsoTop = inseamM; // hip line
  const totalTorsoHeight = heightM - inseamM - headDiameter - neckHeight;
  const shoulderY = torsoTop + totalTorsoHeight;
  const bustY = torsoTop + totalTorsoHeight * 0.7;
  const waistY = torsoTop + totalTorsoHeight * 0.35;

  const shoulderHalfWidth = (twin.shoulderCm / 2) / 100;
  const chestRadius = circToRadius(twin.chestCm);
  const waistRadius = circToRadius(twin.waistCm);
  const hipRadius = circToRadius(twin.hipCm);
  const armRadius = chestRadius * 0.16;
  const legRadiusTop = hipRadius * 0.55;
  const legRadiusBottom = hipRadius * 0.28;

  // Skin material with undertone tint
  const baseSkin = skinHex(twin.skinTone);
  const tintedColor = applyTint(baseSkin, UNDERTONE_TINT[twin.undertone]);

  // Subtle idle rotation for a "live" feel without being distracting
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.15) * 0.08;
    }
  });

  // Center the figure vertically around y=0 so the camera framing is symmetric.
  // Origin = mid-torso. Figure occupies y in [-heightM/2, +heightM/2].
  const yOffset = -heightM / 2;

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      {/* Head */}
      <mesh position={[0, heightM - headRadius, 0]} castShadow>
        <sphereGeometry args={[headRadius, 32, 32]} />
        <meshStandardMaterial
          color={tintedColor}
          roughness={0.65}
          metalness={0.05}
        />
      </mesh>

      {/* Neck — small cylinder */}
      <mesh
        position={[0, heightM - headDiameter - neckHeight / 2, 0]}
        castShadow
      >
        <cylinderGeometry
          args={[headRadius * 0.55, headRadius * 0.65, neckHeight, 16]}
        />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>

      {/* Torso — chest section (capsule-like via cylinder + spheres at ends) */}
      <mesh position={[0, (shoulderY + bustY) / 2, 0]} castShadow>
        <cylinderGeometry
          args={[
            chestRadius,
            chestRadius * 1.02,
            shoulderY - bustY,
            32,
            1,
          ]}
        />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>

      {/* Torso — waist section (bust → waist taper) */}
      <mesh position={[0, (bustY + waistY) / 2, 0]} castShadow>
        <cylinderGeometry
          args={[chestRadius * 1.02, waistRadius, bustY - waistY, 32, 1]}
        />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>

      {/* Torso — hip section (waist → hip flare) */}
      <mesh position={[0, (waistY + torsoTop) / 2, 0]} castShadow>
        <cylinderGeometry
          args={[waistRadius, hipRadius, waistY - torsoTop, 32, 1]}
        />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>

      {/* Shoulders — small spheres at the top corners of the torso */}
      <mesh position={[shoulderHalfWidth * 0.85, shoulderY, 0]} castShadow>
        <sphereGeometry args={[chestRadius * 0.25, 24, 24]} />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>
      <mesh position={[-shoulderHalfWidth * 0.85, shoulderY, 0]} castShadow>
        <sphereGeometry args={[chestRadius * 0.25, 24, 24]} />
        <meshStandardMaterial color={tintedColor} roughness={0.6} />
      </mesh>

      {/* Arms — left + right, hanging at sides */}
      {[-1, 1].map((side) => (
        <group key={`arm-${side}`}>
          {/* Upper arm */}
          <mesh
            position={[side * shoulderHalfWidth * 0.95, shoulderY - 0.18, 0]}
            castShadow
          >
            <cylinderGeometry args={[armRadius, armRadius * 0.85, 0.34, 16]} />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
          {/* Forearm */}
          <mesh
            position={[side * shoulderHalfWidth * 0.95, shoulderY - 0.5, 0]}
            castShadow
          >
            <cylinderGeometry args={[armRadius * 0.85, armRadius * 0.7, 0.32, 16]} />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
          {/* Hand stub */}
          <mesh
            position={[side * shoulderHalfWidth * 0.95, shoulderY - 0.68, 0]}
            castShadow
          >
            <sphereGeometry args={[armRadius * 0.78, 16, 16]} />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Legs — left + right, tapered hip→ankle */}
      {[-1, 1].map((side) => (
        <group key={`leg-${side}`}>
          {/* Upper leg / thigh */}
          <mesh
            position={[side * (hipRadius * 0.5), torsoTop / 2 + 0.02, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[legRadiusTop, legRadiusTop * 0.85, torsoTop * 0.5, 24]}
            />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
          {/* Lower leg / calf */}
          <mesh
            position={[side * (hipRadius * 0.5), torsoTop * 0.18, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[legRadiusTop * 0.85, legRadiusBottom, torsoTop * 0.45, 24]}
            />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
          {/* Foot */}
          <mesh
            position={[side * (hipRadius * 0.5), 0.02, 0.04]}
            castShadow
          >
            <boxGeometry args={[legRadiusBottom * 1.6, 0.04, 0.16]} />
            <meshStandardMaterial color={tintedColor} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Compute the camera distance that frames a figure of `heightM` with a small
 * margin, given the canvas aspect ratio. Both the height and width constraints
 * are checked — the wider one wins so nothing clips at extreme aspect ratios.
 */
function fitDistance(heightM: number, aspect: number, fovDeg: number): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  const margin = 1.22; // 22% extra room around the figure
  const figureWidthM = 0.65; // approximate widest point (shoulders / hips with arms)

  // Vertical fit
  const distH = (heightM * margin) / (2 * Math.tan(fovRad / 2));
  // Horizontal fit — perspective camera horizontal fov derived from vertical fov + aspect
  const distW =
    (figureWidthM * margin) / (2 * aspect * Math.tan(fovRad / 2));

  return Math.max(distH, distW, 2.2); // floor at 2.2 so we never get unreasonably close
}

/**
 * Auto-fit camera. Watches the canvas aspect ratio and the figure height; whenever
 * either changes, it tweens the camera distance to the optimum framing. After the
 * tween, the user is free to scroll-zoom — OrbitControls takes over.
 *
 * The component lives inside the Canvas so it has access to `useThree()`.
 */
function AutoFitCamera({
  heightM,
  controlsRef,
  resetSignal,
}: {
  heightM: number;
  controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
  /** Increment to force a re-fit (e.g., when user clicks "Reset view"). */
  resetSignal: number;
}) {
  const { camera, size } = useThree();
  const targetDistance = useRef<number>(0);
  // Tweening flag — true while we're actively easing toward target. Goes
  // false once we're within 0.5% so OrbitControls user input takes over.
  const fitting = useRef<boolean>(true);

  // Recompute target whenever inputs change. Re-arm the tween so the camera
  // smoothly moves to the new fit even if the user had zoomed manually.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    targetDistance.current = fitDistance(heightM, aspect, camera.fov);
    fitting.current = true;
    if (controlsRef.current) {
      controlsRef.current.minDistance = targetDistance.current * 0.55;
      controlsRef.current.maxDistance = targetDistance.current * 2.4;
    }
  }, [camera, size.width, size.height, heightM, controlsRef, resetSignal]);

  // Tween only while the fit-flag is on. Once close enough, we release the
  // camera back to the user.
  useFrame(() => {
    if (!fitting.current || !targetDistance.current) return;
    const currentDist = camera.position.length();
    const delta = targetDistance.current - currentDist;
    if (Math.abs(delta) < targetDistance.current * 0.005) {
      // Snap to target, stop tweening
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(targetDistance.current));
      fitting.current = false;
      if (controlsRef.current) controlsRef.current.update();
      return;
    }
    const dir = camera.position.clone().normalize();
    const next = currentDist + delta * 0.12;
    camera.position.copy(dir.multiplyScalar(next));
    camera.lookAt(0, 0, 0);
    if (controlsRef.current) controlsRef.current.update();
  });

  return null;
}

interface TwinModel3DProps {
  twin: ModelTwin;
  className?: string;
  /** Allow user to rotate / zoom (default true). Disable for static screenshots. */
  interactive?: boolean;
}

export default function TwinModel3D({
  twin,
  className,
  interactive = true,
}: TwinModel3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const heightM = twin.heightCm / 100;

  // Initial camera distance — used as the seed `position` so the first frame
  // is already in the right ballpark before AutoFit's tween polishes it.
  const initialDistance = useMemo(() => {
    return fitDistance(heightM, 4 / 5, 38);
  }, [heightM]);

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 280 }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 0, initialDistance]}
          fov={38}
        />

        {/* Three-point lighting — no env-map dependency, no CDN fetch */}
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[3, 5, 4]}
          intensity={1.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#a8c5ff" />
        <directionalLight position={[0, -1, 3]} intensity={0.35} color="#fff5d6" />
        <hemisphereLight args={["#fff2dc", "#3a2a1a", 0.4]} />

        <Figure twin={twin} />

        <ContactShadows
          position={[0, -twin.heightCm / 200, 0]}
          opacity={0.45}
          scale={4}
          blur={2.4}
          far={4}
        />

        {interactive && (
          <OrbitControls
            ref={controlsRef}
            target={[0, 0, 0]}
            enablePan={false}
            enableZoom
            enableDamping
            dampingFactor={0.08}
            zoomSpeed={0.7}
            rotateSpeed={0.7}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={(Math.PI * 3) / 4}
          />
        )}

        {/* Auto-frame the figure on mount + on size/height change. After the
            tween settles, OrbitControls owns the camera until measurements
            change again. */}
        <AutoFitCamera
          heightM={heightM}
          controlsRef={controlsRef}
          resetSignal={0}
        />
      </Canvas>
    </div>
  );
}

export { type ModelTwin };
