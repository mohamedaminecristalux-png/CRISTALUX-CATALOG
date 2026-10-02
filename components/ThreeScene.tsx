"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

const GOLD = new THREE.Color("#e8c07d");
const SILVER = new THREE.Color("#ffffff");

// history control points sampled along the cursor path -> resampled into a smooth render curve
const HISTORY_CAPACITY = 40;
const MOVE_THRESHOLD = 0.03;
const TUBULAR_SEGMENTS = 80;
const RADIAL_SEGMENTS = 10;
// the cursor end stays fine, the trailing end carries the liquid's volume
const HEAD_RADIUS = 0.032;
const TAIL_RADIUS = 0.26;

// t: 0 = tail (oldest), 1 = head (newest, at the cursor)
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const bodyTaper = (t: number) => Math.pow(smoothstep(t), 0.75);
const radiusAt = (t: number) => HEAD_RADIUS + (TAIL_RADIUS - HEAD_RADIUS) * bodyTaper(1 - t);

function buildTubeIndices(tubularSegments: number, radialSegments: number) {
  const indices: number[] = [];
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j;
      const b = a + 1;
      const c = a + (radialSegments + 1);
      const d = c + 1;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }
  return indices;
}

// small crystal flecks scattered across the tail end of the liquid, embedded in its surface
// but drifting and twinkling independently so they read as alive rather than glued on
type TailCrystal = {
  t: number;
  angle: number;
  radialMul: number;
  scale: number;
  spin: number;
  phase: number;
  driftSpeed: number;
  driftPhase: number;
  driftAmount: number;
  twinkleSpeed: number;
  twinklePhase: number;
};

const TAIL_CRYSTAL_COUNT = 24;
const TAIL_CRYSTAL_SPAN = 0.4;

function makeTailCrystals(): TailCrystal[] {
  return new Array(TAIL_CRYSTAL_COUNT).fill(null).map((_, i) => ({
    t: (i / TAIL_CRYSTAL_COUNT) * TAIL_CRYSTAL_SPAN + Math.random() * 0.015,
    angle: Math.random() * Math.PI * 2,
    radialMul: 1.02 + Math.random() * 0.5,
    scale: 0.026 + Math.random() * 0.028,
    spin: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    driftSpeed: 0.5 + Math.random() * 1.1,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmount: 0.04 + Math.random() * 0.08,
    twinkleSpeed: 1.2 + Math.random() * 2,
    twinklePhase: Math.random() * Math.PI * 2,
  }));
}

const SPARKLE_COUNT = 90;
const dummy = new THREE.Object3D();

type Sparkle = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  life: number;
  scale: number;
};

function usePointerNdc() {
  const ndcRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      ndcRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      ndcRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("pointermove", handleMove);
    return () => window.removeEventListener("pointermove", handleMove);
  }, []);
  return ndcRef;
}

function LiquidCrystalTrail({ pulseRef }: { pulseRef: React.MutableRefObject<number> }) {
  const ndcRef = usePointerNdc();
  const headRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const tubeMaterialRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const instRef = useRef<THREE.InstancedMesh>(null);
  const tailCrystalsRef = useRef<THREE.InstancedMesh>(null);
  const tailCrystals = useRef<TailCrystal[]>(makeTailCrystals());

  const worldTarget = useRef(new THREE.Vector3());
  const clock = useRef(0);
  const history = useRef<THREE.Vector3[]>([]);

  // these three.js objects are mutated every frame (geometry buffers rewritten in place, curve
  // control points reassigned) - held in refs rather than useMemo so that imperative mutation is
  // the expected, sanctioned way to use them, matching the r3f "update in useFrame" idiom.
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  if (curveRef.current === null) {
    curveRef.current = new THREE.CatmullRomCurve3([], false, "catmullrom", 0.5);
  }
  const curve = curveRef.current;

  const spawnAccumulator = useRef(0);
  const nextSparkle = useRef(0);
  const sparkles = useRef<Sparkle[]>(
    new Array(SPARKLE_COUNT).fill(null).map(() => ({
      position: new THREE.Vector3(0, 0, -1000),
      velocity: new THREE.Vector3(),
      age: 999,
      life: 1,
      scale: 1,
    }))
  );

  const tubeDataRef = useRef<{
    geometry: THREE.BufferGeometry;
    positions: Float32Array;
    normalsArr: Float32Array;
  } | null>(null);
  if (tubeDataRef.current === null) {
    const geo = new THREE.BufferGeometry();
    const vertCount = (TUBULAR_SEGMENTS + 1) * (RADIAL_SEGMENTS + 1);
    const positions = new Float32Array(vertCount * 3);
    const normalsArr = new Float32Array(vertCount * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normalsArr, 3));
    geo.setIndex(buildTubeIndices(TUBULAR_SEGMENTS, RADIAL_SEGMENTS));
    tubeDataRef.current = { geometry: geo, positions, normalsArr };
  }
  const tubeMeshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (tubeMeshRef.current && tubeDataRef.current) {
      tubeMeshRef.current.geometry = tubeDataRef.current.geometry;
    }
  }, []);

  useFrame((state, rawDelta) => {
    const { geometry, positions, normalsArr } = tubeDataRef.current!;
    const delta = Math.min(rawDelta, 0.05);
    clock.current += delta;
    const { camera } = state;
    const distance = camera.position.z;
    const perspective = camera as THREE.PerspectiveCamera;
    const vFov = (perspective.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * perspective.aspect;
    worldTarget.current.set(ndcRef.current.x * width * 0.5, ndcRef.current.y * height * 0.5, 0);

    headRef.current?.position.lerp(worldTarget.current, Math.min(delta * 6, 1));

    const hist = history.current;
    const headPos = headRef.current?.position;
    if (headPos) {
      if (hist.length === 0) {
        for (let i = 0; i < HISTORY_CAPACITY; i++) {
          hist.push(headPos.clone().add(new THREE.Vector3(0, i * 0.0006, 0)));
        }
      } else {
        const last = hist[hist.length - 1];
        if (last.distanceToSquared(headPos) > MOVE_THRESHOLD * MOVE_THRESHOLD) {
          const wobbleX = Math.sin(clock.current * 2.3) * 0.06;
          const wobbleY = Math.cos(clock.current * 1.9 + 0.4) * 0.06;
          hist.shift();
          hist.push(headPos.clone().add(new THREE.Vector3(wobbleX, wobbleY, 0)));
        } else {
          last.copy(headPos);
        }
      }
    }

    // guard against zero-length curve segments (degenerate tangents) when the cursor is idle
    for (let i = 1; i < hist.length; i++) {
      if (hist[i].distanceToSquared(hist[i - 1]) < 1e-8) {
        hist[i].x += 1e-4;
        hist[i].y += 1e-4 * i;
      }
    }

    if (hist.length > 1) {
      curve.points = hist;
      const framePts = curve.getPoints(TUBULAR_SEGMENTS);
      const frenet = curve.computeFrenetFrames(TUBULAR_SEGMENTS, false);

      for (let i = 0; i <= TUBULAR_SEGMENTS; i++) {
        const t = i / TUBULAR_SEGMENTS;
        const radius = radiusAt(t);
        const center = framePts[i];
        const normal = frenet.normals[i];
        const binormal = frenet.binormals[i];

        for (let j = 0; j <= RADIAL_SEGMENTS; j++) {
          const angle = (j / RADIAL_SEGMENTS) * Math.PI * 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const rx = normal.x * cos * radius + binormal.x * sin * radius;
          const ry = normal.y * cos * radius + binormal.y * sin * radius;
          const rz = normal.z * cos * radius + binormal.z * sin * radius;

          const idx = (i * (RADIAL_SEGMENTS + 1) + j) * 3;
          positions[idx] = center.x + rx;
          positions[idx + 1] = center.y + ry;
          positions[idx + 2] = center.z + rz;

          const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
          normalsArr[idx] = rx / len;
          normalsArr[idx + 1] = ry / len;
          normalsArr[idx + 2] = rz / len;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;

      if (tailCrystalsRef.current) {
        const crystals = tailCrystals.current;
        for (let k = 0; k < crystals.length; k++) {
          const c = crystals[k];
          const idx = Math.min(Math.round(c.t * TUBULAR_SEGMENTS), TUBULAR_SEGMENTS);
          const center = framePts[idx];
          const normal = frenet.normals[idx];
          const binormal = frenet.binormals[idx];
          const drift = Math.sin(clock.current * c.driftSpeed + c.driftPhase) * c.driftAmount;
          const r = radiusAt(c.t) * c.radialMul + drift;
          const cos = Math.cos(c.angle);
          const sin = Math.sin(c.angle);

          dummy.position.set(
            center.x + normal.x * cos * r + binormal.x * sin * r,
            center.y + normal.y * cos * r + binormal.y * sin * r,
            center.z + normal.z * cos * r + binormal.z * sin * r
          );
          dummy.rotation.set(clock.current * c.spin + c.phase, clock.current * c.spin * 0.6, c.phase);
          const twinkle = 0.55 + 0.45 * Math.sin(clock.current * c.twinkleSpeed + c.twinklePhase);
          dummy.scale.setScalar(c.scale * twinkle);
          dummy.updateMatrix();
          tailCrystalsRef.current.setMatrixAt(k, dummy.matrix);
        }
        tailCrystalsRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    pulseRef.current = THREE.MathUtils.lerp(pulseRef.current, 0, delta * 1.4);

    if (lightRef.current) {
      lightRef.current.intensity = 4.5 + pulseRef.current * 12;
    }
    if (tubeMaterialRef.current) {
      tubeMaterialRef.current.emissiveIntensity = 0.15 + pulseRef.current * 1.2;
    }

    spawnAccumulator.current += delta;
    const spawnInterval = pulseRef.current > 0.3 ? 0.012 : 0.035;
    if (headRef.current && spawnAccumulator.current > spawnInterval) {
      spawnAccumulator.current = 0;
      const p = sparkles.current[nextSparkle.current];
      p.position.copy(headRef.current.position);
      p.position.x += (Math.random() - 0.5) * 0.35;
      p.position.y += (Math.random() - 0.5) * 0.35;
      p.position.z += (Math.random() - 0.5) * 0.35;
      p.velocity.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.35 + 0.1,
        (Math.random() - 0.5) * 0.5
      );
      p.age = 0;
      p.life = 1.1 + Math.random() * 0.9;
      p.scale = 0.5 + Math.random() * 0.9;
      nextSparkle.current = (nextSparkle.current + 1) % SPARKLE_COUNT;
    }

    if (instRef.current) {
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const p = sparkles.current[i];
        p.age += delta;
        const t = Math.min(p.age / p.life, 1);
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= delta * 0.15;

        const fade = 1 - t;
        const scale = t < 1 ? p.scale * fade * 0.2 : 0;

        dummy.position.copy(p.position);
        dummy.rotation.set(p.age * 1.3, p.age * 1.7, 0);
        dummy.scale.setScalar(Math.max(scale, 0.0001));
        dummy.updateMatrix();
        instRef.current.setMatrixAt(i, dummy.matrix);

        const mix = 0.35 + pulseRef.current * 0.55;
        const c = GOLD.clone().lerp(SILVER, mix).multiplyScalar(fade);
        instRef.current.setColorAt(i, c);
      }
      instRef.current.instanceMatrix.needsUpdate = true;
      if (instRef.current.instanceColor) instRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      {/* a real, unadorned light - it exists to illuminate the liquid and crystals, not to be looked at */}
      <group ref={headRef}>
        <pointLight ref={lightRef} color="#f2d9a6" intensity={4.5} distance={15} decay={2} />
      </group>

      {/* viscous liquid-glass body */}
      <mesh ref={tubeMeshRef} frustumCulled={false}>
        <meshPhysicalMaterial
          ref={tubeMaterialRef}
          color="#e2b56e"
          metalness={0.9}
          roughness={0.16}
          envMapIntensity={2.6}
          emissive="#a8792f"
          emissiveIntensity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* fine crystal flecks scattered through the tail, sharing the liquid's own material tone */}
      <instancedMesh
        ref={tailCrystalsRef}
        args={[undefined, undefined, TAIL_CRYSTAL_COUNT]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial
          color="#e9c48a"
          metalness={0.3}
          roughness={0.1}
          transmission={0.55}
          thickness={0.4}
          ior={2.2}
          clearcoat={1}
          clearcoatRoughness={0.06}
          emissive="#c99a4f"
          emissiveIntensity={0.2}
        />
      </instancedMesh>

      <instancedMesh
        ref={instRef}
        args={[undefined, undefined, SPARKLE_COUNT]}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </instancedMesh>

      <Environment resolution={256} frames={1} background={false}>
        <Lightformer
          form="rect"
          color="#fff6e0"
          intensity={6}
          scale={[10, 4, 1]}
          position={[4, 5, 5]}
        />
        <Lightformer
          form="rect"
          color="#ffffff"
          intensity={4}
          scale={[8, 3, 1]}
          position={[-5, -3, 4]}
        />
        <Lightformer
          form="rect"
          color="#f2d9a6"
          intensity={4}
          scale={[8, 3, 1]}
          position={[0, -4, 6]}
        />
        <Lightformer form="ring" color="#e8c07d" intensity={3} scale={6} position={[0, 0, -7]} />
        <Lightformer
          form="rect"
          color="#ffe9bf"
          intensity={3}
          scale={[6, 6, 1]}
          position={[6, 0, -2]}
        />
      </Environment>
    </>
  );
}

export default function ThreeScene() {
  const pulseRef = useRef(0);
  const [ready, setReady] = useState(false);

  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);

  return (
    <Canvas
      camera={{ position: [0, 0, 11], fov: 50 }}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
      onCreated={() => setReady(true)}
      onClick={() => {
        pulseRef.current = 1;
      }}
      style={{ opacity: ready ? 1 : 0, transition: "opacity 1.6s ease" }}
    >
      <color attach="background" args={["#080808"]} />
      <fog attach="fog" args={["#080808", 9, 22]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[-6, -3, -4]} color="#8a95a3" intensity={0.35} />
      <LiquidCrystalTrail pulseRef={pulseRef} />
    </Canvas>
  );
}
