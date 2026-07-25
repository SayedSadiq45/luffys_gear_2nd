import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { luffyLayout } from '../lib/luffyLayout';
import { FALL_START, LAND, fallT, impactT } from '../lib/timeline';
import { clamp, lerp, smoothstep, easeInQuad } from '../lib/math';

// Textured PBR hat (base colour + normal + metallic/roughness straps). Served
// from /public, so no CDN fetch can stall the Suspense boundary.
const MODEL_URL = '/models/luffys_straw_hat/scene.gltf';

function StrawHat({ progressRef }) {
  const { scene } = useGLTF(MODEL_URL);
  const { size } = useThree();
  const group = useRef();
  const rimRef = useRef();
  const burstRef = useRef();
  const lastGlow = useRef(-1);

  // Clone so we own the transforms. We also measure + recentre the model once,
  // and cache the mesh list, so the per-frame loop never has to traverse the
  // whole tree (that traversal is a big part of what made this feel laggy).
  const { model, meshes, width } = useMemo(() => {
    const root = scene.clone(true);
    const meshList = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshList.push(o);
      if (o.material) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color('#ff3a1f');
        o.material.emissiveIntensity = 0;
        // Textures decode a touch nicer with mipmaps + anisotropy.
        if (o.material.map) o.material.map.anisotropy = 4;
      }
    });

    // Recentre on the geometric middle so it rotates/floats about its own
    // centre, and measure the width for scale-to-viewport below.
    const box = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    const dims = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(dims);
    root.position.sub(center);

    return { model: root, meshes: meshList, width: dims.x || 1 };
  }, [scene]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;

    const p = progressRef.current;
    const t = fallT(p);
    const ip = impactT(p);
    const et = state.clock.elapsedTime;

    // --- where the hat has to end up --------------------------------------
    // Luffy's head, as a fraction of the viewport. luffyLayout() is the shared
    // source of truth, so the 3D hat and the 2D artwork can't drift apart.
    const L = luffyLayout(size.width, size.height);
    const headFx = L.backX / size.width; // 0..1 across — lands on his back
    const headFy = L.backY / size.height; // 0..1 down

    // Screen-space path: start high and off to one side, land on his back.
    const startFx = headFx - 0.17;
    const startFy = 0.1;

    // Gravity easing on the vertical, gentler drift on the horizontal, so the
    // path reads as an arc through space rather than a straight drop.
    const fx = lerp(startFx, headFx, smoothstep(0, 1, t));
    const fy = lerp(startFy, headFy, easeInQuad(t));

    // Travels from far to near — this is what sells the perspective.
    const z = lerp(-3.2, 0, smoothstep(0, 1, t));

    // Project the screen fraction into world space *at the hat's own depth*.
    // Doing this per-frame (rather than using viewport.*, which is only valid at
    // z=0) is what keeps the hat landing exactly on his head while z is moving.
    const camZ = state.camera.position.z;
    const dist = camZ - z;
    const visH = 2 * Math.tan((state.camera.fov * Math.PI) / 360) * dist;
    const visW = visH * (size.width / size.height);

    g.position.z = z;
    g.position.x = (fx - 0.5) * visW;
    g.position.y = (0.5 - fy) * visH;

    // --- idle float --------------------------------------------------------
    // Before the fall, the hat hangs in the air and breathes: a slow vertical
    // bob and a lazy sideways sway. Weighted out the instant the fall begins
    // (idleW), so it can never disturb the exact landing.
    const idleW = 1 - smoothstep(0, 0.12, t);
    g.position.y += Math.sin(et * 0.9) * visH * 0.02 * idleW;
    g.position.x += Math.sin(et * 0.6 + 1.3) * visW * 0.012 * idleW;

    // Settle: a tiny bounce as it seats onto his head.
    const seat = Math.sin(clamp(ip / 0.12) * Math.PI) * (1 - ip);
    g.position.y += seat * visH * 0.012;

    // --- rotation ----------------------------------------------------------
    // Driven by progress (reversible). The idle spin uses the clock but is
    // weighted out the moment the fall starts, so the fall itself stays exact.
    const idle = et * 0.3 * idleW;

    // Resting pose once it settles on his back: tilted well forward so the brim
    // lies flat along the slope of his arched back rather than sitting upright.
    const restX = -1.0;
    const restY = 0.15;
    const restZ = 0.22;
    const settle = smoothstep(0.86, 1, t);

    const spinY = idle + t * Math.PI * 3.2;
    // A soft tilt oscillation while idling reads as "floating" rather than rigid.
    const idleTilt = Math.sin(et * 0.8) * 0.12 * idleW;
    const wobbleX = -0.35 + Math.sin(t * Math.PI * 4.0) * 0.4 + idleTilt;
    const wobbleZ = Math.sin(t * Math.PI * 3.0 + 0.8) * 0.5 + Math.cos(et * 0.7) * 0.1 * idleW;

    g.rotation.x = lerp(wobbleX, restX, settle);
    g.rotation.y = lerp(spinY, restY, settle);
    g.rotation.z = lerp(wobbleZ, restZ, settle);

    // --- scale -------------------------------------------------------------
    // Sized off the head so it stays right at any viewport. A straw hat reads
    // ~2.2x the width of the head. Converting through visH (which already
    // accounts for the hat's depth) means the apparent on-screen size is exactly
    // targetPx * apparent, regardless of how far away it currently is.
    const targetPx = L.headW * 2.2;
    const apparent = lerp(0.6, 1, smoothstep(0, 1, t));
    const s = (targetPx * apparent * (visH / size.height)) / width;
    g.scale.setScalar(s);

    // --- impact glow -------------------------------------------------------
    // Gear Second heat bleeding into the straw at the moment of landing. Only
    // written to the materials when it actually changes — no full-tree traversal
    // every frame.
    const glow = Math.max(0, 1 - ip * 2.4) * (t > 0.99 ? 1 : 0);
    const emissive = glow * 0.85;
    if (emissive !== lastGlow.current) {
      for (let i = 0; i < meshes.length; i++) {
        const m = meshes[i].material;
        if (m) m.emissiveIntensity = emissive;
      }
      lastGlow.current = emissive;
    }
    if (burstRef.current) {
      burstRef.current.intensity = glow * 26;
      burstRef.current.position.set(g.position.x, g.position.y, 0.9);
    }
    if (rimRef.current) {
      rimRef.current.intensity = 2.4 + glow * 6;
    }
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model} />
      </group>
      {/* Kept outside the hat group: these are positioned in world space and
          must not inherit the hat's rotation/scale. */}
      <pointLight ref={burstRef} color="#ff4d24" distance={14} intensity={0} />
      <pointLight ref={rimRef} color="#ff7a3d" position={[2, 1.5, -2]} intensity={2.4} />
    </>
  );
}

function Rig({ progressRef }) {
  const { camera } = useThree();
  useFrame(() => {
    const p = progressRef.current;
    // Very slight dolly-in through the fall for a cinematic push.
    camera.position.z = lerp(6.4, 5.6, smoothstep(FALL_START, LAND, p));
    camera.updateProjectionMatrix();
  });
  return null;
}

export default function Scene3D({ progressRef }) {
  return (
    <div className="scene3d">
      <Canvas
        // Capped at 1.5x: 2x quadruples the fragment work on high-DPI screens
        // for almost no visible gain here, and was a major source of the lag.
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 42, position: [0, 0, 6.4], near: 0.1, far: 100 }}
      >
        {/* Lit by hand rather than with drei's <Environment preset>: that fetches
            an HDR from a CDN, and if the request fails it suspends this whole
            boundary forever and the hat never mounts. Everything here is local. */}
        <ambientLight intensity={0.55} />
        {/* warm key */}
        <directionalLight position={[3, 5, 4]} intensity={2.4} color="#fff2e2" />
        {/* cool fill so the straw doesn't go muddy against the dark sky */}
        <directionalLight position={[-4, 1, -3]} intensity={1.1} color="#5b7cff" />
        {/* back rim, picks out the brim edge */}
        <directionalLight position={[0, -2, -5]} intensity={1.6} color="#ffb066" />

        <Suspense fallback={null}>
          <StrawHat progressRef={progressRef} />
        </Suspense>
        <Rig progressRef={progressRef} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
