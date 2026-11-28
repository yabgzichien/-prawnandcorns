"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { centroid, levelOutline, type Interior, type Pt, type Space, type SpaceKind } from "@/lib/data/interiors";
import { FLOOR, SELECTED } from "./colors";
import { labelText } from "./labels";
import { furnish, outerWalls, railing, roomWalls, stairSteps, WALL_H, type Part, type Piece, type Wall } from "./layout";

// The inside of one building, one floor at a time, at true metre scale. Loaded only when "View inside" is opened.

/** Draw order on the floor, so overlapping tints never flicker: walkways lowest, rooms on top. */
const LAYER: Record<SpaceKind, number> = {
  courtyard: 0, corridor: 1, hall: 1, entrance: 2, atrium: 2, library: 3, food: 3, feature: 4, stairs: 4, service: 3, porch: 2,
  classroom: 5, study: 5, office: 5, lab: 5, shop: 5,
};
const PART: Record<Part, string> = {
  desk: "#c08a52",
  chair: "#2f7f86",
  shelf: "#a87a4c",
  counter: "#b6452e",
  table: "#c9995f",
  round: "#d2a25f",
  pillar: "#f4f1ea",
  seat: "#7b2b2b",
  step: "#ddd7cb",
};

type Palette = { bg: string; slab: string; wall: string; outer: string; rail: string; floor: (k: SpaceKind) => string; part: (p: Part) => string };

function palette(dark: boolean): Palette {
  const night = new THREE.Color("#16211b");
  const mix = (hex: string, k: number) => `#${new THREE.Color(hex).lerp(night, k).getHexString()}`;
  return dark
    ? { bg: "#0b130f", slab: "#2c3630", wall: "#cfd3cc", outer: "#8d978f", rail: "#9fb3a6", floor: (k) => mix(FLOOR[k], 0.5), part: (p) => mix(PART[p], 0.25) }
    : { bg: "#eef4ea", slab: "#ddd6c8", wall: "#fbfaf6", outer: "#e9e2d2", rail: "#7d8a84", floor: (k) => FLOOR[k], part: (p) => PART[p] };
}

/** An outline in the building's frame as a THREE.Shape lying in x and -z (it is turned flat later). */
function toShape(points: Pt[], holes: Pt[][] = []): THREE.Shape {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  return shape;
}

const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2);

function wallGeometry(walls: Wall[], y: number): THREE.BufferGeometry | null {
  const parts = walls
    .filter((w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 0.02)
    .map((w) => {
      const [dx, dz] = [w.b[0] - w.a[0], w.b[1] - w.a[1]];
      const g = new THREE.BoxGeometry(Math.hypot(dx, dz) + w.t, w.h, w.t);
      g.rotateY(-Math.atan2(dz, dx));
      g.translate((w.a[0] + w.b[0]) / 2, y + w.h / 2, (w.a[1] + w.b[1]) / 2);
      return g;
    });
  return parts.length ? mergeGeometries(parts) : null;
}

const noRaycast = () => {};

/** One kind of furniture on the floor, drawn as one instanced mesh. */
function Pieces({ pieces, color, y, round }: { pieces: Piece[]; color: string; y: number; round?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    pieces.forEach((p, i) => {
      q.setFromEuler(e.set(0, p.rot ?? 0, 0));
      m.compose(new THREE.Vector3(p.x, y + (p.y ?? 0) + p.h / 2, p.z), q, new THREE.Vector3(p.w, p.h, p.d));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pieces, y]);
  if (!pieces.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pieces.length]} raycast={noRaycast}>
      {round ? <cylinderGeometry args={[0.5, 0.5, 1, 20]} /> : <boxGeometry />}
      <meshStandardMaterial color={color} roughness={0.75} />
    </instancedMesh>
  );
}

function SpaceFloor({ space, y, color, onSelect, onHover }: { space: Space; y: number; color: string; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const geo = useMemo(() => flat(new THREE.ShapeGeometry(toShape(space.shape, space.holes))), [space]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh
      geometry={geo}
      position-y={y + 0.02 + LAYER[space.kind] * 0.006}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return; // a drag that ended here, not a tap
        e.stopPropagation();
        onSelect(space.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(space.id);
      }}
      onPointerOut={() => onHover(null)}
      receiveShadow
    >
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}


/** A label over the floor: where it floats, its text, and whether it belongs to a room (or an area). */
export type LabelItem = { id: string; text: string; at: THREE.Vector3; room: boolean; front?: boolean };

/** The current floor's labels: areas and rooms worth naming, plus FRONT on the ground before the building. */
function labelItems(interior: Interior, level: number): LabelItem[] {
  const y = level * interior.storey;
  const items: LabelItem[] = interior.levels[level].spaces
    .filter((s) => !s.minor && s.kind !== "corridor")
    .map((s) => {
      const [x, z] = centroid(s.shape);
      return { id: s.id, text: labelText(s), at: new THREE.Vector3(x, y + (s.walled ? WALL_H + 0.4 : 1.2), z), room: !!s.walled };
    });
  const front = Math.max(...levelOutline(interior, level).map((p) => p[1])) + 3;
  items.push({ id: "front", text: "Front", at: new THREE.Vector3(0, y + 0.2, front), room: false, front: true });
  return items;
}

/**
 * Moves the label layer's elements (plain HTML over the canvas, one layer for all of them) to their places on screen
 * after every frame, and shows rooms' labels when the floor has few rooms, when you come close, or when selected.
 */
function Projector({ items, els, selected, showRooms }: { items: LabelItem[]; els: { current: (HTMLDivElement | null)[] }; selected: string | null; showRooms: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [items, selected, showRooms, invalidate]);
  const v = useMemo(() => new THREE.Vector3(), []);
  const crowded = items.filter((i) => i.room).length > 16;
  useFrame(({ camera, size }) => {
    items.forEach((it, k) => {
      const el = els.current[k];
      if (!el) return;
      v.copy(it.at).project(camera);
      const behind = v.z > 1;
      const near = camera.position.distanceTo(it.at) < 46;
      const show = !behind && (it.front || it.id === selected || (showRooms && (!it.room || !crowded || near)));
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -50%)`;
      const o = show ? "1" : "0";
      if (el.style.opacity !== o) el.style.opacity = o;
    });
  });
  return null;
}

type FloorProps = {
  interior: Interior;
  level: number;
  selected: string | null;
  hovered: string | null;
  colors: Palette;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

const Floor = memo(function Floor({ interior, level, selected, hovered, colors, onSelect, onHover }: FloorProps) {
  const lv = interior.levels[level];
  const y = level * interior.storey;
  const geo = useMemo(() => {
    const slab = flat(new THREE.ExtrudeGeometry(toShape(levelOutline(interior, level), lv.holes), { depth: 0.3, bevelEnabled: false })).translate(0, y - 0.3, 0);
    const walls = wallGeometry(lv.spaces.flatMap(roomWalls), y);
    const outer = wallGeometry(outerWalls(levelOutline(interior, level)), y);
    const rails = wallGeometry(lv.holes.flatMap(railing), y);
    const furniture = new Map<Part, Piece[]>();
    for (const s of lv.spaces) {
      const pieces = s.kind === "stairs" ? stairSteps(s) : furnish(s);
      for (const p of pieces) furniture.set(p.part, [...(furniture.get(p.part) ?? []), p]);
    }
    return { slab, walls, outer, rails, furniture };
  }, [interior, level, lv, y]);
  useEffect(
    () => () => {
      for (const g of [geo.slab, geo.walls, geo.outer, geo.rails]) g?.dispose();
    },
    [geo],
  );
  const tint = (s: Space) => {
    const base = new THREE.Color(colors.floor(s.kind));
    if (s.id === selected) return SELECTED;
    if (s.id === hovered) return `#${base.lerp(new THREE.Color("#ffffff"), 0.35).getHexString()}`;
    return colors.floor(s.kind);
  };
  return (
    <group>
      <mesh geometry={geo.slab} raycast={noRaycast} receiveShadow>
        <meshStandardMaterial color={colors.slab} roughness={0.9} />
      </mesh>
      {lv.spaces.map((s) => (
        <SpaceFloor key={s.id} space={s} y={y} color={tint(s)} onSelect={onSelect} onHover={onHover} />
      ))}
      {geo.walls && (
        <mesh geometry={geo.walls} raycast={noRaycast} castShadow>
          <meshStandardMaterial color={colors.wall} roughness={0.7} />
        </mesh>
      )}
      {geo.outer && (
        <mesh geometry={geo.outer} raycast={noRaycast}>
          <meshStandardMaterial color={colors.outer} roughness={0.8} />
        </mesh>
      )}
      {geo.rails && (
        <mesh geometry={geo.rails} raycast={noRaycast}>
          <meshStandardMaterial color={colors.rail} roughness={0.4} metalness={0.3} transparent opacity={0.75} />
        </mesh>
      )}
      {[...geo.furniture].map(([part, pieces]) => (
        <Pieces key={`${part}-${pieces.length}`} pieces={pieces} color={colors.part(part)} y={y} round={part === "round"} />
      ))}
    </group>
  );
});

/** The floors below the one on screen, as faint plates, so the building reads as a stack. */
function Ghosts({ interior, level, color }: { interior: Interior; level: number; color: string }) {
  const geos = useMemo(
    () =>
      interior.levels.slice(0, level).map((lv, i) =>
        flat(new THREE.ExtrudeGeometry(toShape(levelOutline(interior, i), lv.holes), { depth: 0.2, bevelEnabled: false })).translate(0, i * interior.storey - 0.2, 0),
      ),
    [interior, level],
  );
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} raycast={noRaycast}>
          <meshStandardMaterial color={color} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** Where the camera looks next. `keep` holds on to where the view has been panned and only changes the height (a floor change). */
export type Focus = { x: number; y: number; z: number; dist?: number; keep?: boolean; key: string };

/** Glides the camera to a new floor or room, keeping the angle you were looking from. Grabbing the view stops it. */
function Rig({ focus, reduced }: { focus: Focus; reduced: boolean }) {
  const { camera, invalidate } = useThree();
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const anim = useRef<{ t: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromC: THREE.Vector3; toC: THREE.Vector3 } | null>(null);
  useEffect(() => {
    if (!controls) return;
    const toT = focus.keep ? new THREE.Vector3(controls.target.x, focus.y, controls.target.z) : new THREE.Vector3(focus.x, focus.y, focus.z);
    const offset = camera.position.clone().sub(controls.target);
    if (focus.dist) offset.setLength(focus.dist);
    anim.current = { t: reduced ? 1 : 0, fromT: controls.target.clone(), toT, fromC: camera.position.clone(), toC: toT.clone().add(offset) };
    const stop = () => (anim.current = null);
    controls.addEventListener("start", stop);
    invalidate();
    return () => controls.removeEventListener("start", stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.key, controls]);
  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.75);
    const k = 1 - Math.pow(1 - a.t, 3);
    controls.target.lerpVectors(a.fromT, a.toT, k);
    camera.position.lerpVectors(a.fromC, a.toC, k);
    controls.update();
    invalidate();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** The direction the start view looks from: front left and above. */
const START_DIR = new THREE.Vector3(0.55, 1.05, 1.1).normalize();

/**
 * Sets the start view once, far enough back for the whole floor to fit the part of the canvas the controls leave free (a
 * narrow canvas needs more room). A `target` prop on the controls would snap back on every re-render instead.
 */
function StartView({ interior, level, inset }: { interior: Interior; level: number; inset: { left: number; top: number } }) {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const { camera, size } = useThree();
  const done = useRef(false);
  useEffect(() => {
    if (!controls || done.current) return;
    done.current = true;
    const free = { w: Math.max(1, size.width - inset.left), h: Math.max(1, size.height - inset.top) };
    const d = startDistance(interior, free.w / free.h, level) * (size.height / free.h);
    const y = level * interior.storey;
    const [cx, cz] = viewMiddle(interior, level);
    controls.target.set(cx, y, cz);
    camera.position.set(cx + START_DIR.x * d, y + START_DIR.y * d, cz + START_DIR.z * d);
    controls.update();
    // the start view is set once per building (the canvas remounts for another one)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls]);
  return null;
}

/**
 * Moves the middle of the picture to the middle of the free part of the canvas, so whatever the camera looks at (the
 * building, a chosen room) and turns round is not under the controls laid over the top and left. Clicks and labels
 * follow, as both go through the same projection.
 */
function ViewCentre({ inset }: { inset: { left: number; top: number } }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.setViewOffset(size.width, size.height, -inset.left / 2, -inset.top / 2, size.width, size.height);
    invalidate();
    return () => cam.clearViewOffset();
  }, [camera, size.width, size.height, inset.left, inset.top, invalidate]);
  return null;
}

export type InteriorSceneProps = {
  interior: Interior;
  level: number;
  selected: string | null;
  focus: Focus;
  dark: boolean;
  labels: boolean;
  onSelect: (id: string) => void;
  onFail?: (e: Error) => void;
  /** Pixels at the top of the view covered by other controls, where labels are hidden. */
  clipTop?: number;
  /** Pixels on the left and top covered by controls: the start view centres the building in the rest. */
  inset?: { left: number; top: number };
};

const NO_INSET = { left: 0, top: 0 };

/** What the camera looks at: the building's middle, or the middle of a floor that has its own outline. */
export function viewMiddle(interior: Interior, level: number): [number, number] {
  const own = interior.levels[level]?.footprint;
  if (!own) return [0, 0];
  const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;
  return [mid(own.map((p) => p[0])), mid(own.map((p) => p[1]))];
}

/** How far the camera starts from the building: enough to see the whole floor in a canvas of this width to height. */
export function startDistance(interior: Interior, aspect = 1.6, level = 0): number {
  const [cx, cz] = viewMiddle(interior, level);
  const ext = Math.max(...levelOutline(interior, level).map(([x, z]) => Math.max(Math.abs(x - cx), Math.abs(z - cz))));
  return ext * Math.max(2.4, 4.2 / Math.max(0.3, aspect));
}

export default function InteriorScene({ interior, level, selected, focus, dark, labels, onSelect, onFail, clipTop = 0, inset = NO_INSET }: InteriorSceneProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const colors = useMemo(() => palette(dark), [dark]);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const fail = useRef(onFail);
  useEffect(() => {
    fail.current = onFail;
  }, [onFail]);
  const items = useMemo(() => labelItems(interior, level), [interior, level]);
  const els = useRef<(HTMLDivElement | null)[]>([]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <Canvas
      key={interior.place}
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.5, far: 1200, position: [0, 200, 200] }}
      style={{ background: colors.bg, cursor: hovered ? "pointer" : "grab", touchAction: "none" }}
      gl={(defaults) => {
        try {
          return new THREE.WebGLRenderer({ ...defaults, antialias: true });
        } catch (e) {
          fail.current?.(e instanceof Error ? e : new Error(String(e)));
          throw e;
        }
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <hemisphereLight args={["#ffffff", dark ? "#26332b" : "#cfc6b4", dark ? 1.0 : 1.4]} />
      <directionalLight position={[30, 60, 40]} intensity={dark ? 1.1 : 1.6} />
      <directionalLight position={[-40, 30, -20]} intensity={0.4} />
      <Ghosts interior={interior} level={level} color={colors.slab} />
      <Floor
        interior={interior}
        level={level}
        selected={selected}
        hovered={hovered}
        colors={colors}
        onSelect={onSelect}
        onHover={setHovered}
      />
      <StartView interior={interior} level={level} inset={inset} />
      <ViewCentre inset={inset} />
      <OrbitControls
        makeDefault
        enableDamping
        minDistance={6}
        maxDistance={startDistance(interior, 0.5) * 1.2}
        maxPolarAngle={1.32}
        screenSpacePanning={false}
      />
      <Rig focus={focus} reduced={reduced} />
      <Projector items={items} els={els} selected={selected} showRooms={labels} />
    </Canvas>
      {/* labels stop at clipTop so they never show between the controls laid over the top of the view */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", clipPath: clipTop ? `inset(${clipTop}px 0 0 0)` : undefined }}>
        {items.map((it, k) => {
          const on = it.id === selected;
          return (
            <div
              key={it.id}
              ref={(el) => {
                els.current[k] = el;
              }}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                opacity: 0,
                transform: "translate(-9999px, -9999px)",
                whiteSpace: "nowrap",
                fontFamily: "system-ui, sans-serif",
                fontSize: it.room ? 11 : 10,
                fontWeight: it.room || it.front ? 700 : 600,
                letterSpacing: it.front ? 0.4 : undefined,
                textTransform: it.front ? "uppercase" : undefined,
                color: on || it.front ? "#ffffff" : it.room ? "#16211b" : "#3f4a43",
                background: on ? "#2f7d43" : it.front ? "rgba(22,33,27,0.72)" : it.room ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.72)",
                border: `1px solid ${on ? "#2f7d43" : "rgba(22,33,27,0.18)"}`,
                borderRadius: 999,
                padding: it.room ? "2px 7px" : "1px 6px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                transition: "opacity 0.2s",
                zIndex: on ? 2 : 1,
              }}
            >
              {it.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
