"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { animate } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import CampusScene, { type CameraView } from "@/components/map3d/CampusScene";
import { fromReal, UNITS_PER_M } from "@/components/map3d/geo";
import type { Mode } from "@/components/map3d/atmosphere";
import { dormHeight } from "@/components/map3d/dorms3d";
import { PLACES, placeCenter, placeRadius, type Place } from "@/lib/data/campus";

/** Where a place stands in the 3D world: the same real-metre coordinates as the 2D map, through the scene's own projection. */
export function placeWorld(p: Place): [number, number] {
  const [e, n] = placeCenter(p);
  return fromReal(e, n);
}
const radiusWorld = (p: Place) => Math.max(placeRadius(p), 14) * UNITS_PER_M;

/** Rough heights (metres) so the camera backs off far enough from tall buildings. */
export function heightM(p: Place): number {
  if (/^LY\d$/.test(p.id) || /^D\d$/.test(p.id)) return dormHeight(p.id);
  if (p.id === "CANTEEN") return dormHeight("Canteen D6");
  if (p.kind === "teaching") return 38;
  return 10;
}
const cameraDistance = (p: Place) => Math.max(radiusWorld(p) * 3.4, heightM(p) * UNITS_PER_M * 3.2 + 24);

/** A camera view that looks at a place from the south-east, like the orientation map's own presets. `az` turns it (degrees). */
export function viewFor(p: Place, scale = 1, az = 0): CameraView {
  const [x, z] = placeWorld(p);
  const d = cameraDistance(p) * scale;
  const a = Math.atan2(0.7, 0.55) + (az * Math.PI) / 180;
  const h = heightM(p) * UNITS_PER_M * 0.4;
  return { position: [x + d * 0.85 * Math.cos(a), d * 0.62 + h, z + d * 0.85 * Math.sin(a)], target: [x, h, z] };
}

/**
 * The scene's own start views, shifted so the campus sits in the part of the screen the floating panel leaves free:
 * left of the side panel on desktop, above the bottom card on phones.
 */
export function defaultView(desktop: boolean): CameraView {
  if (desktop) {
    const k = 22; // along the screen's right vector, which moves the campus left
    return { position: [118 + 0.707 * k, 104, 118 - 0.707 * k], target: [0.707 * k, 0, -0.707 * k] };
  }
  const k = 38; // toward the camera, which moves the campus up
  const t: [number, number, number] = [-14 + 0.707 * k, 0, -10 + 0.707 * k];
  return { position: [t[0] + 190, 230, t[2] + 190], target: t };
}

export type Pin3D = { id: string; place: string; label: string; tone: "accent" | "green" };

/** Flies the camera to `target` whenever `nonce` changes. Interruptible: grabbing the map stops the move. */
function Flyer({ target, nonce, rightInset }: { target: Place | null; nonce: number; rightInset: number }) {
  const { camera, controls, invalidate, size } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: MapControlsImpl | null; invalidate: () => void; size: { width: number } };
  const last = useRef(nonce);
  useEffect(() => {
    if (!controls || !target || nonce === last.current) return;
    last.current = nonce;
    const [x, z] = placeWorld(target);
    const dist = cameraDistance(target);
    const lookH = heightM(target) * UNITS_PER_M * 0.4;
    const to = new THREE.Vector3(x, lookH, z);
    // keep the viewing direction, but never look flatter than ~55° from the ground
    const dir = camera.position.clone().sub(controls.target).normalize();
    dir.y = Math.max(dir.y, 0.7);
    dir.normalize();
    // slide the target sideways so the place sits in the free part of the screen, not under the side panel
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    right.y = 0; right.normalize();
    to.addScaledVector(right, (rightInset / Math.max(size.width, 1)) * dist * 0.9);
    const fromT = controls.target.clone();
    const fromP = camera.position.clone();
    const toP = to.clone().addScaledVector(dir, dist);
    const stop = () => anim.stop();
    const anim = animate(0, 1, {
      type: "spring", bounce: 0, duration: 1.1,
      onUpdate: (k) => {
        controls.target.lerpVectors(fromT, to, k);
        camera.position.lerpVectors(fromP, toP, k);
        controls.update();
        invalidate();
      },
    });
    controls.addEventListener("start", stop);
    return () => { controls.removeEventListener("start", stop); anim.stop(); };
  }, [nonce, target, controls, camera, invalidate, rightInset, size.width]);
  return null;
}

/** `?debug=1`: draw calls, triangles and fps per frame, counted across all passes (post-processing included). */
function DebugStats() {
  const { gl } = useThree();
  const el = useRef<HTMLDivElement | null>(null);
  const acc = useRef({ t: 0, n: 0 });
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    Object.assign(gl.info, { autoReset: false }); // three.js renderer setting
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:99;font:600 11px ui-monospace,monospace;background:rgba(0,0,0,.75);color:#9f9;padding:4px 8px;border-radius:6px;pointer-events:none;white-space:pre";
    document.body.appendChild(d);
    el.current = d;
    return () => { d.remove(); Object.assign(gl.info, { autoReset: true }); };
  }, [gl]);
  // read last frame's totals, then clear (never use a positive priority: that stops r3f rendering the scene itself)
  const last = useRef({ calls: 0, triangles: 0 });
  useFrame(({ invalidate }, dt) => {
    if (!el.current) return;
    invalidate();
    const { calls, triangles } = gl.info.render;
    if (calls > 0) last.current = { calls, triangles };
    gl.info.reset();
    acc.current.t += dt; acc.current.n += 1;
    if (acc.current.t > 0.5) {
      el.current.textContent = `calls ${last.current.calls}  tris ${(last.current.triangles / 1000).toFixed(0)}k  fps ${(acc.current.n / acc.current.t).toFixed(0)}  geo ${gl.info.memory.geometries}  tex ${gl.info.memory.textures}`;
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

/** Invisible columns over each place so a tap on the building selects it. */
function HitAreas({ onSelect }: { onSelect: (id: string) => void }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);
  return (
    <group>
      {PLACES.map((p) => {
        const [x, z] = placeWorld(p);
        const r = radiusWorld(p) * 0.85;
        return (
          <mesh key={p.id} position={[x, 5, z]} material={mat} onClick={(e) => { e.stopPropagation(); onSelect(p.id); }} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
            <cylinderGeometry args={[r, r, 12, 12]} />
          </mesh>
        );
      })}
    </group>
  );
}

function SelectionRing({ place }: { place: Place }) {
  const ref = useRef<THREE.Mesh>(null);
  const [x, z] = placeWorld(place);
  const r = radiusWorld(place) * 1.05;
  useFrame(({ clock, invalidate }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.04;
    ref.current.scale.set(s, s, s);
    invalidate();
  });
  return (
    <mesh ref={ref} position={[x, 0.5, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.5, 48]} />
      <meshBasicMaterial color="#4da3ff" transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

/** A pin drawn as a screen-sized sprite (no DOM overlay), so it tears down cleanly with the scene. */
function pinTexture(label: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.strokeStyle = "#fff";
  g.lineWidth = 7;
  g.lineJoin = "round";
  g.beginPath(); // the tail
  g.moveTo(44, 96); g.lineTo(64, 152); g.lineTo(84, 96); g.closePath();
  g.stroke(); g.fill();
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke(); g.fill();
  g.fillStyle = "#fff";
  g.font = "800 46px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label.slice(0, 3), 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function PinMarker({ pin, p }: { pin: Pin3D; p: Place }) {
  const [x, z] = placeWorld(p);
  const color = pin.tone === "green" ? "#2fbf5f" : "#2f8cff";
  const h = (p.kind === "teaching" || p.kind === "residence" ? heightM(p) : 8) * UNITS_PER_M + 0.6;
  const map = useMemo(() => pinTexture(pin.label, color), [pin.label, color]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <sprite position={[x, h, z]} scale={[0.034, 0.0425, 1]} center={new THREE.Vector2(0.5, 0)} renderOrder={20}>
      <spriteMaterial map={map} sizeAttenuation={false} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

export default function Campus3D({ mode, labels, selected, pins, flyNonce, rightInset, onSelect, onFail, initialView, intro, paused }: {
  mode: Mode; labels: boolean; selected: string | null; pins: Pin3D[]; flyNonce: number; rightInset: number;
  onSelect: (id: string) => void; onFail: (e: Error) => void; initialView?: CameraView; intro: boolean; paused: boolean;
}) {
  const place = selected ? PLACES.find((p) => p.id === selected) ?? null : null;
  const placeById = useMemo(() => Object.fromEntries(PLACES.map((p) => [p.id, p])), []);
  return (
    <CampusScene className="absolute inset-0" mode={mode} labels={labels} camera={initialView} intro={intro} paused={paused} onFail={onFail}>
      <HitAreas onSelect={onSelect} />
      {place && <SelectionRing place={place} />}
      {pins.map((pin) => <PinMarker key={pin.id} pin={pin} p={placeById[pin.place]} />)}
      <DebugStats />
      <Flyer target={place} nonce={flyNonce} rightInset={rightInset} />
    </CampusScene>
  );
}
