"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fromReal, UNITS_PER_M, type World } from "./geo";
import { DORMS_M } from "./dorms";
import { groundY } from "./terrain";
import { dormPlanting } from "./dormLand";
import { thinForLite } from "./plants";
import { colored, jitter, palmGeometry, PlantInstances } from "./vegetation";

/*
 * The student residences and the dining halls: Lingyun (LY1–LY9 and the hall LY3), Block D (D1–D5) and Canteen D6.
 *
 * Footprints are the OpenStreetMap outlines in dorms.ts (real metres), put into the world with fromReal. What they
 * look like comes from the official XMUM Accommodation Photobook and the aerial photos the team supplied:
 *  - LY: cross-plan towers, about 20 storeys. A brick-red podium of five storeys, white shafts with slim windows
 *    and balconies in tidy grids, stepping down from the core to the wings. The core and two wings carry a
 *    terracotta hip roof on an open red frame.
 *  - D: seven storeys, white concrete bands and red brick bays with black balcony rails, tile eaves, taller brick
 *    stair cores.
 *  - LY3 / D6: low halls under big terracotta hip roofs, open red pillars below and a glazed storey above.
 * Everything is modelled in metres, in a frame whose axes are the world's (x north, z east) about the building's
 * centre, then scaled by UNITS_PER_M and merged into one mesh per material (about eight draw calls in all).
 */

type P2 = [number, number]; // (north, east) in metres from the building's centre = world (x, z) before scaling
const FLOOR = 3.0;

// ── tiny geometry kit ────────────────────────────────────────────────────

function signedArea(pts: P2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a / 2;
}

/** Vertical walls round `pts` from y0 to y1, UVs in metres / tile size so a repeating facade texture tiles by the metre. */
function walls(pts: P2[], y0: number, y1: number, tileW: number, tileH: number, uShift = 0) {
  const flip = signedArea(pts) > 0;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  let run = uShift;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    const [nx, nz] = flip ? [dz / len, -dx / len] : [-dz / len, dx / len];
    const u0 = run / tileW;
    const u1 = (run + len) / tileW;
    const v0 = y0 / tileH;
    const v1 = y1 / tileH;
    run += len;
    const a = [x1, y0, z1], b = [x2, y0, z2], c = [x2, y1, z2], d = [x1, y1, z1];
    const ua = [u0, v0], ub = [u1, v0], uc = [u1, v1], ud = [u0, v1];
    const tri = flip ? [[a, c, b], [a, d, c]] : [[a, b, c], [a, c, d]];
    const tuv = flip ? [[ua, uc, ub], [ua, ud, uc]] : [[ua, ub, uc], [ua, uc, ud]];
    for (let t = 0; t < 2; t++) {
      for (let k = 0; k < 3; k++) {
        pos.push(...tri[t][k]);
        nor.push(nx, 0, nz);
        uv.push(...tuv[t][k]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** A flat horizontal cap over `pts` at height y, facing up. */
function cap(pts: P2[], y: number) {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5); // plain colour
  return g;
}

const scaleAbout = (pts: P2[], c: P2, k: number): P2[] => pts.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);

/** The corners of a rectangle `hx` x `hz` (half sizes) centred at (cx, cz) and turned by `rot` about +Y. */
function rect(cx: number, cz: number, hx: number, hz: number, rot: number): P2[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  return ([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]] as P2[]).map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c]);
}

/** A hip roof over a turned rectangle: eaves at y, a ridge `h` up. `top` = how much of the plan is left at the top (0 = point). */
function hipRoof(cx: number, cz: number, hx: number, hz: number, rot: number, y: number, h: number, over: number, top: number) {
  const base = rect(cx, cz, hx + over, hz + over, rot);
  const peak = rect(cx, cz, hx * top, hz * top, rot);
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a))).normalize();
    for (const p of [a, b, c, a, c, d]) { pos.push(...p); nor.push(n.x, n.y, n.z); uv.push(0.5, 0.5); }
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    // base is walked so the quads face outwards; check the sign once and flip if the plan runs the other way
    const a = [base[i][0], y, base[i][1]], b = [base[j][0], y, base[j][1]], c = [peak[j][0], y + h, peak[j][1]], d = [peak[i][0], y + h, peak[i][1]];
    const mid = new THREE.Vector3((a[0] + c[0]) / 2 - cx, 0, (a[2] + c[2]) / 2 - cz);
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
    if (n.dot(mid) >= 0) quad(a, b, c, d);
    else quad(b, a, d, c);
  }
  // flat top
  const t = peak.map(([x, z]) => [x, y + h, z]);
  for (const p of [t[0], t[2], t[1], t[0], t[3], t[2]]) { pos.push(...p); nor.push(0, 1, 0); uv.push(0.5, 0.5); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** A plain box from y0 to y1 over a turned rectangle, as an open-topped wall set plus a cap (so facades can tile). */
function prism(cx: number, cz: number, hx: number, hz: number, rot: number, y0: number, y1: number, tileW: number, tileH: number) {
  const pts = rect(cx, cz, hx, hz, rot);
  return { sides: walls(pts, y0, y1, tileW, tileH), top: cap(pts, y1) };
}

function box(cx: number, cz: number, sx: number, sy: number, sz: number, y0: number, rot = 0) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
  g.rotateY(rot);
  g.translate(cx, y0 + sy / 2, cz);
  return g;
}

// ── facade textures (drawn at runtime like the rest of the scene) ─────────

const cv = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};
const tex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
};
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

type Cell = (ctx: CanvasRenderingContext2D, ectx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: boolean, bx: number, fy: number) => void;

/** `bays` x `floors` cells in one tile; each cell is drawn by `cell`, which also paints the emissive (lit window) map. */
function facade(seed: number, bays: number, floors: number, px: number, bg: string, cell: Cell) {
  const [c, ctx] = cv(bays * px, floors * px);
  const [e, ectx] = cv(bays * px, floors * px);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ectx.fillStyle = "#000";
  ectx.fillRect(0, 0, c.width, c.height);
  const r = rng(seed);
  for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) cell(ctx, ectx, b * px, f * px, px, px, r() < 0.1, b, f);
  return { map: tex(c), emissiveMap: tex(e) };
}

const GLASS = "#34414e";
const lit = (ectx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, on: boolean) => {
  if (!on) return;
  ectx.fillStyle = Math.random() < 0.7 ? "#ffc875" : "#fff0c8";
  ectx.fillRect(x, y, w, h);
};

/** LY shaft (photobook, Lingyun): white walls, slim tall windows with a small balcony slab, a blank panel now and then. */
const lyShaft = (seed: number) =>
  facade(seed, 4, 4, 96, "#f2efe8", (ctx, ectx, x, y, w, h, on, b, f) => {
    ctx.fillStyle = "#dcd7cc"; // balcony slab at the floor line
    ctx.fillRect(x, y + h - 9, w, 9);
    if ((b + f) % 5 === 3) return; // blank white panel
    const wx = x + w * 0.34, ww = w * 0.32, wy = y + h * 0.16, wh = h * 0.62;
    ctx.fillStyle = GLASS;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = "#bfb9ad";
    ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    ctx.fillStyle = "#2c2c30"; // balcony rail
    ctx.fillRect(wx - 5, y + h - 22, ww + 10, 4);
    lit(ectx, wx + 1, wy + 1, ww - 2, wh - 2, on);
  });

/** The brick podium under the towers: red brick, white floor bands, wider windows. */
const lyPodium = (seed: number) =>
  facade(seed, 4, 5, 96, "#a9472b", (ctx, ectx, x, y, w, h, on) => {
    ctx.fillStyle = "rgba(255,232,205,0.22)";
    for (let k = 0; k < h; k += 8) ctx.fillRect(x, y + k, w, 1);
    ctx.fillStyle = "#efe9de";
    ctx.fillRect(x, y + h - 8, w, 8);
    const wx = x + w * 0.22, ww = w * 0.56, wy = y + h * 0.2, wh = h * 0.5;
    ctx.fillStyle = "#efe9de";
    ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    ctx.fillStyle = GLASS;
    ctx.fillRect(wx, wy, ww, wh);
    lit(ectx, wx + 1, wy + 1, ww - 2, wh - 2, on);
  });

/** Block D (photobook): white slabs per floor, red brick bays between them with a dark window and a black balcony rail. */
const dBlock = (seed: number) =>
  facade(seed, 3, 3, 112, "#f0ece3", (ctx, ectx, x, y, w, h, on, b) => {
    ctx.fillStyle = "#b5502f"; // brick bay
    ctx.fillRect(x + w * 0.1, y + h * 0.36, w * 0.8, h * 0.56);
    ctx.fillStyle = "rgba(255,232,205,0.18)";
    for (let k = 0; k < h * 0.56; k += 7) ctx.fillRect(x + w * 0.1, y + h * 0.36 + k, w * 0.8, 1);
    const wx = x + w * 0.22 + (b % 2) * 6, ww = w * 0.4, wy = y + h * 0.44, wh = h * 0.34;
    ctx.fillStyle = GLASS;
    ctx.fillRect(wx, wy, ww, wh);
    lit(ectx, wx + 1, wy + 1, ww - 2, wh - 2, on);
    ctx.fillStyle = "#1d1d20"; // railing
    ctx.fillRect(x + w * 0.08, y + h * 0.78, w * 0.84, 5);
    ctx.fillStyle = "#6f6a62"; // air-con unit
    ctx.fillRect(x + w * 0.66, y + h * 0.58, w * 0.16, h * 0.14);
  });

/** Glazed upper storey of the halls: dark glass between slim mullions. */
const glazed = (seed: number) =>
  facade(seed, 6, 1, 64, "#2c3a42", (ctx, ectx, x, y, w, h, on) => {
    ctx.fillStyle = "#4a5f69";
    ctx.fillRect(x + w - 3, y, 3, h);
    ctx.fillStyle = "#6f8f93";
    ctx.fillRect(x + 4, y + 4, w - 10, h * 0.22);
    lit(ectx, x + 4, y + 8, w - 10, h - 16, on);
  });

/** The halls' open ground floor: red pillars carry dark glass set back behind them (the pillars are separate boxes). */
const hallBase = (seed: number) =>
  facade(seed, 6, 1, 64, "#2a2d33", (ctx, ectx, x, y, w, h, on) => {
    ctx.fillStyle = "#3b4650";
    ctx.fillRect(x + 4, y + 6, w - 8, h - 12);
    lit(ectx, x + 6, y + 10, w - 12, h - 20, on);
  });

// ── the buildings ────────────────────────────────────────────────────────

const RED = "#b3262a";
const TILE = "#c4502b";

type Parts = Record<"shaft" | "podium" | "dwall" | "glass" | "base" | "cream" | "white" | "tile" | "red" | "roofTop" | "green" | "brick" | "dark" | "lantern", THREE.BufferGeometry[]>;
const newParts = (): Parts => ({ shaft: [], podium: [], dwall: [], glass: [], base: [], cream: [], white: [], tile: [], red: [], roofTop: [], green: [], brick: [], dark: [], lantern: [] });

type Layout = { name: string; kind: "ly" | "d" | "hall" | "round"; pts: P2[]; centre: World; centreEN: [number, number]; height: number };

/** Put an outline (real E,N metres) into the building's own frame: (north, east) metres from its centre. */
function localOutline(outline: readonly (readonly number[])[]) {
  let e = 0, n = 0;
  for (const [pe, pn] of outline) { e += pe; n += pn; }
  e /= outline.length;
  n /= outline.length;
  const pts = outline.map(([pe, pn]) => [pn - n, pe - e] as P2);
  return { pts, c: [e, n] as [number, number] };
}

function crossArms(pts: P2[]) {
  // the cross's own axes: the direction of its longest edge
  let best = 0, beta = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    const l = Math.hypot(x2 - x1, z2 - z1);
    if (l > best) { best = l; beta = Math.atan2(z2 - z1, x2 - x1); }
  }
  const c = Math.cos(beta), s = Math.sin(beta);
  const proj = pts.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
  const ext = (k: 0 | 1) => Math.max(...proj.map((p) => Math.abs(p[k]))) ;
  const A = Math.abs(signedArea(pts));
  const L = (ext(0) + ext(1)); // both half-extents
  const sum = 2 * L;
  const w = Math.max(8, (sum - Math.sqrt(Math.max(0, sum * sum - 4 * A))) / 2);
  return { rot: -beta, hx: ext(0), hz: ext(1), w };
}

function buildLY(parts: Parts, pts: P2[]) {
  const podH = 5 * FLOOR;
  const baseH = 15 * FLOOR;
  const { rot, hx, hz, w: w0 } = crossArms(pts);
  const w = Math.min(0.5 * (hx + hz), Math.max(w0 * 1.25, 0.42 * (hx + hz))); // crown wings are the footprint's arms, a touch fuller
  const c0: P2 = [0, 0];
  parts.podium.push(walls(pts, 0, podH, 12.8, 15));
  parts.shaft.push(walls(pts, podH, baseH, 12.8, 12));
  parts.white.push(cap(pts, baseH));
  // string course between podium and shaft
  parts.white.push(walls(scaleAbout(pts, c0, 1.012), podH - 0.4, podH + 0.5, 4, 4));
  // stepped crown: wing ends (turned axis) rise 3 floors, the core 6
  const wingTop = baseH + 3 * FLOOR;
  const coreTop = baseH + 6 * FLOOR;
  const arm = (cx: number, cz: number, h1: number, h2: number, roof: number) => {
    const pr = prism(cx, cz, w / 2 - 0.2, w / 2 - 0.2, rot, h1, h2, 12.8, 12);
    parts.shaft.push(pr.sides);
    parts.white.push(pr.top);
    if (roof) crown(parts, cx, cz, w / 2 - 0.2, rot, h2, roof);
  };
  const ax = Math.max(0, hx - w / 2), az = Math.max(0, hz - w / 2);
  const toLocal = (u: number, v: number): P2 => [u * Math.cos(-rot) - v * Math.sin(-rot), u * Math.sin(-rot) + v * Math.cos(-rot)];
  const [ex, ez] = toLocal(ax, 0);
  arm(ex, ez, baseH, wingTop, 0.8);
  arm(-ex, -ez, baseH, wingTop, 0.8);
  const [fx, fz] = toLocal(0, az);
  arm(fx, fz, baseH, baseH + 1.5 * FLOOR, 0);
  arm(-fx, -fz, baseH, baseH + 1.5 * FLOOR, 0);
  arm(0, 0, baseH, coreTop, 1);
}

/** An open red frame under a terracotta hip roof (the Lingyun crown). */
function crown(parts: Parts, cx: number, cz: number, half: number, rot: number, y: number, scale: number) {
  const h = half * 0.92;
  const fh = 4.4 * scale;
  const c = Math.cos(rot), s = Math.sin(rot);
  const at = (x: number, z: number): [number, number] => [cx + x * c + z * s, cz - x * s + z * c];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [px, pz] = at(sx * h, sz * h);
    parts.red.push(box(px, pz, 0.7, fh, 0.7, y, rot));
  }
  // a belt beam and a darker frieze under the eaves
  const ring = rect(cx, cz, h, h, rot);
  parts.red.push(walls(ring, y + fh * 0.42, y + fh * 0.5, 4, 4));
  parts.red.push(walls(ring, y + fh - 0.9, y + fh, 4, 4));
  parts.tile.push(hipRoof(cx, cz, half, half, rot, y + fh, 3.6 * scale + 1.2, 3.4, 0.14));
  // the small lantern on the ridge
  parts.red.push(box(cx, cz, 1.4, 1.6, 1.4, y + fh + 3.6 * scale + 1.2, rot));
}

function buildD(parts: Parts, pts: P2[]) {
  const H = 7 * FLOOR;
  const c0: P2 = [0, 0];
  parts.dwall.push(walls(pts, 0, H, 10.8, 9));
  // tile eaves: a band that reaches a little past the walls, then the dark roof
  parts.tile.push(walls(scaleAbout(pts, c0, 1.014), H - 0.2, H + 1.3, 4, 4));
  parts.roofTop.push(cap(scaleAbout(pts, c0, 1.014), H + 1.3));
  parts.white.push(walls(scaleAbout(pts, c0, 1.008), 0, 0.5, 4, 4));
  // brick stair cores stand clear of the roof, on the footprint's reflex corners
  const { rot, hx, w } = crossArms(pts);
  for (const k of [-1, 1]) {
    const u = k * Math.max(0, hx * 0.52);
    const cx = u * Math.cos(-rot), cz = u * Math.sin(-rot);
    const pr = prism(cx, cz, 3.6, 3.6, rot, H + 1.3, H + 1.3 + 4.2, 6, 6);
    parts.brick.push(pr.sides);
    parts.roofTop.push(pr.top);
  }
  void w;
}

/** One place for every building's height (metres), so labels, pins and the fly-to camera agree with the models. */
export const DORM_H = { ly: 21 * FLOOR + 9, d: 7 * FLOOR + 5, cafeteria: 27, round: 27 } as const;
export function dormHeight(name: string): number {
  if (name === "LY3") return DORM_H.cafeteria;
  if (name === "Canteen D6") return DORM_H.round;
  return name.startsWith("D") ? DORM_H.d : DORM_H.ly;
}

/** A thin beam between two points (a hip rib, an upswept eave corner). */
function beam(a: [number, number, number], b: [number, number, number], t: number) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const g = new THREE.BoxGeometry(t, t, len);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb.clone().sub(va).normalize()));
  const m = va.clone().add(vb).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/** Slanted band between two scaled copies of a ring (the cones and drums of a round roof). */
function band(ring: P2[], k1: number, y1: number, k2: number, y2: number, center: P2 = [0, 0]) {
  const a = scaleAbout(ring, center, k1), b = scaleAbout(ring, center, k2);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const p = [[a[i][0], y1, a[i][1]], [a[j][0], y1, a[j][1]], [b[j][0], y2, b[j][1]], [b[i][0], y2, b[i][1]]];
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...p[1]), new THREE.Vector3(...p[0])).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...p[2]), new THREE.Vector3(...p[0]))).normalize();
    const mid = new THREE.Vector3((p[0][0] + p[2][0]) / 2 - center[0], 0, (p[0][2] + p[2][2]) / 2 - center[1]);
    const order = n.dot(mid) >= 0 ? [0, 1, 2, 0, 2, 3] : [1, 0, 3, 1, 3, 2];
    const nn = n.dot(mid) >= 0 ? n : n.clone().negate();
    for (const k of order) { pos.push(...p[k]); nor.push(nn.x, nn.y, nn.z); uv.push(0.5, 0.5); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const lanternBall = (x: number, y: number, z: number, r = 0.45) => {
  const g = new THREE.IcosahedronGeometry(r, 0);
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
  g.translate(x, y, z);
  return g;
};

/** An outdoor table with a parasol, for the cafeterias' terraces. */
function parasolTable(parts: Parts, x: number, z: number, bucket: "tile" | "white" | "red") {
  parts.cream.push(box(x, z, 1.5, 0.12, 1.5, 0.78));
  parts.dark.push(box(x, z, 0.14, 2.4, 0.14, 0));
  const cone = new THREE.ConeGeometry(2.1, 0.9, 8);
  const uv = cone.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.5);
  cone.translate(x, 2.85, z);
  parts[bucket].push(cone.toNonIndexed());
}

/** LY3, the Lingyun cafeteria: an open pillared ground floor, a glazed upper floor with a planted terrace, a tiered
 *  terracotta hip roof with upswept corners, a glazed lantern on top, red lanterns along the eaves and a parasol terrace. */
function buildCafeteria(parts: Parts, pts: P2[]) {
  const c0: P2 = [0, 0];
  const base = 6.4, upper = 4.4;
  const eave = base + 0.5 + upper;
  const { rot, hx, hz } = crossArms(pts);
  parts.cream.push(walls(scaleAbout(pts, c0, 1.03), 0, 0.5, 4, 4)); // plinth
  parts.base.push(walls(scaleAbout(pts, c0, 0.9), 0.5, base, 9.6, 6));
  // red pillars round the open ground floor
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    const cnt = Math.max(1, Math.round(Math.hypot(x2 - x1, z2 - z1) / 6.2));
    for (let k = 0; k < cnt; k++) parts.red.push(box(x1 + ((x2 - x1) * k) / cnt, z1 + ((z2 - z1) * k) / cnt, 0.9, base, 0.9, 0));
  }
  parts.cream.push(walls(pts, base - 0.6, base + 0.5, 4, 4)); // the floor slab edge
  parts.red.push(walls(scaleAbout(pts, c0, 1.004), base - 0.9, base - 0.55, 4, 4));
  parts.glass.push(walls(scaleAbout(pts, c0, 0.96), base + 0.5, eave, 9.6, 4.4));
  parts.green.push(walls(pts, base + 0.5, base + 1.4, 4, 4)); // planter terrace
  // the entrance canopy on the lake-facing (southern) side, and parasols in front of it
  let best = { x: Infinity, mx: 0, mz: 0, ang: 0, len: 0 };
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len > 20 && (x1 + x2) / 2 < best.x) best = { x: (x1 + x2) / 2, mx: (x1 + x2) / 2, mz: (z1 + z2) / 2, ang: Math.atan2(z2 - z1, x2 - x1), len };
  }
  const nx = -1, nz = 0; // the southern edge faces −x (south); the canopy is built square to the world axes
  const cx = best.mx + nx * 3.2, cz = best.mz + nz * 3.2;
  parts.cream.push(box(cx, cz, 5.5, 0.5, 14, base - 0.4));
  parts.red.push(box(cx, cz, 5.5, 0.22, 14.6, base + 0.05));
  for (const dz of [-6.5, 6.5]) parts.red.push(box(cx + nx * 2.2, cz + dz, 0.6, base - 0.4, 0.6, 0));
  for (let i = 0; i < 9; i++) {
    const row = i % 3, col = Math.floor(i / 3);
    parasolTable(parts, best.mx - 9.5 - row * 5.2, best.mz - 8 + col * 8, (["tile", "white", "red"] as const)[(row + col) % 3]);
  }
  // the roof: a wide terracotta hip with a darker rib along each hip and upswept corners
  const rise = 7.2, over = 3.0, top = 0.36;
  const rx = hx * 0.98, rz = hz * 0.98;
  parts.tile.push(hipRoof(0, 0, rx, rz, rot, eave, rise, over, top));
  const corner = (sx: number, sz: number, k: number, y: number): [number, number, number] => {
    const c = Math.cos(rot), s = Math.sin(rot);
    const lx = sx * k * rx, lz = sz * k * rz;
    return [lx * c + lz * s, y, -lx * s + lz * c];
  };
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lo = corner(sx, sz, 1 + over / Math.max(rx, rz), eave);
    parts.red.push(beam(lo, corner(sx, sz, top, eave + rise), 0.45)); // hip rib
    const tip = corner(sx, sz, 1 + (over + 1.7) / Math.max(rx, rz), eave + 1.5);
    parts.red.push(beam(lo, tip, 0.55)); // the corner turns up
    parts.lantern.push(lanternBall(tip[0], tip[1] - 1.1, tip[2], 0.55));
  }
  parts.red.push(walls(rect(0, 0, rx + over, rz + over, rot), eave - 0.5, eave + 0.2, 4, 4)); // fascia
  // red lanterns hung under the eaves, every few metres
  const ring = rect(0, 0, rx + over - 0.6, rz + over - 0.6, rot);
  for (let i = 0; i < 4; i++) {
    const a = ring[i], b = ring[(i + 1) % 4];
    const cnt = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 5.5);
    for (let k = 1; k < cnt; k++) parts.lantern.push(lanternBall(a[0] + ((b[0] - a[0]) * k) / cnt, eave - 1.0, a[1] + ((b[1] - a[1]) * k) / cnt));
  }
  // the glazed lantern on the ridge, under its own small hip roof
  const top0 = eave + rise;
  const lh = rect(0, 0, rx * top * 0.8, rz * top * 0.8, rot);
  parts.glass.push(walls(lh, top0, top0 + 3.8, 9.6, 3.8));
  parts.cream.push(cap(lh, top0 + 3.8));
  parts.tile.push(hipRoof(0, 0, rx * top * 0.8, rz * top * 0.8, rot, top0 + 3.8, 3.2, 1.3, 0.16));
  parts.red.push(box(0, 0, 1.1, 2.6, 1.1, top0 + 7.0, rot));
}

/** Canteen D6: round plan. Pillar ring, glazed band, a double-eaved cone roof with a drum and spire, terrace planters. */
function buildRound(parts: Parts, pts: P2[]) {
  const c0: P2 = [0, 0];
  const base = 6.0, glassTop = 10.6;
  parts.cream.push(walls(scaleAbout(pts, c0, 1.04), 0, 0.5, 4, 4));
  parts.base.push(walls(scaleAbout(pts, c0, 0.88), 0.5, base, 9.6, 6));
  for (const [x, z] of scaleAbout(pts, c0, 0.97)) parts.red.push(box(x, z, 0.9, base, 0.9, 0));
  parts.cream.push(walls(pts, base - 0.5, base + 0.5, 4, 4));
  parts.glass.push(walls(scaleAbout(pts, c0, 0.94), base + 0.5, glassTop, 9.6, 4.1));
  parts.green.push(walls(scaleAbout(pts, c0, 1.34), 0, 1.0, 4, 4)); // planter wall round the terrace
  parts.red.push(walls(scaleAbout(pts, c0, 1.13), glassTop - 0.6, glassTop - 0.1, 4, 4));
  // lower roof, a drum of glass above it, then the upper cone with a spire
  parts.tile.push(band(pts, 1.13, glassTop - 0.3, 0.62, glassTop + 4.4));
  parts.glass.push(walls(scaleAbout(pts, c0, 0.6), glassTop + 4.4, glassTop + 7.6, 9.6, 3.2));
  parts.red.push(band(pts, 0.74, glassTop + 7.5, 0.7, glassTop + 8.0));
  parts.tile.push(band(pts, 0.74, glassTop + 7.6, 0.06, glassTop + 14.4));
  parts.red.push(box(0, 0, 0.6, 5.5, 0.6, glassTop + 14.2));
  for (const [x, z] of scaleAbout(pts, c0, 1.1)) parts.lantern.push(lanternBall(x, glassTop - 1.3, z, 0.5));
  for (let i = 0; i < pts.length; i += 2) {
    const [x, z] = scaleAbout(pts, c0, 1.12)[i];
    parasolTable(parts, x * 1.12, z * 1.12, (["tile", "white", "red"] as const)[i % 3]);
  }
}

function useDormParts() {
  return useMemo(() => {
    const parts = newParts();
    const perBuilding: { parts: Parts; centre: World; y: number; name: string; height: number }[] = [];
    for (const [name, d] of Object.entries(DORMS_M)) {
      const { pts, c } = localOutline(d.outline);
      const bp = newParts();
      let height = 0;
      height = dormHeight(name);
      if (name.startsWith("LY") && name !== "LY3") buildLY(bp, pts);
      else if (name === "LY3") buildCafeteria(bp, pts);
      else if (name.startsWith("D") && name !== "Canteen D6") buildD(bp, pts);
      else buildRound(bp, pts);
      const centre = fromReal(c[0], c[1]);
      perBuilding.push({ parts: bp, centre, y: groundY(centre[0], centre[1]), name, height });
    }
    for (const b of perBuilding) {
      const m = new THREE.Matrix4().makeTranslation(b.centre[0], b.y, b.centre[1]).multiply(new THREE.Matrix4().makeScale(UNITS_PER_M, UNITS_PER_M, UNITS_PER_M));
      for (const key of Object.keys(b.parts) as (keyof Parts)[]) {
        for (const g of b.parts[key]) {
          const gg = (g.index ? g.toNonIndexed() : g).clone();
          for (const a of Object.keys(gg.attributes)) if (!["position", "normal", "uv"].includes(a)) gg.deleteAttribute(a);
          gg.applyMatrix4(m);
          parts[key].push(gg);
        }
      }
    }
    const merged = Object.fromEntries((Object.keys(parts) as (keyof Parts)[]).map((k) => [k, parts[k].length ? mergeGeometries(parts[k]) : null])) as Record<keyof Parts, THREE.BufferGeometry | null>;
    return { merged };
  }, []);
}

export function Dorms({ glow, lite = false }: { glow: number; lite?: boolean }) {
  const { merged } = useDormParts();
  const mats = useMemo(() => {
    const lit = (maps: { map: THREE.Texture; emissiveMap: THREE.Texture }) => new THREE.MeshStandardMaterial({ ...maps, roughness: 0.85, emissive: new THREE.Color("#ffffff") });
    return {
      shaft: lit(lyShaft(11)),
      podium: lit(lyPodium(12)),
      dwall: lit(dBlock(13)),
      glass: lit(glazed(14)),
      base: lit(hallBase(15)),
      cream: new THREE.MeshStandardMaterial({ color: "#efe6d4", roughness: 0.85 }),
      white: new THREE.MeshStandardMaterial({ color: "#f1eee7", roughness: 0.85 }),
      tile: new THREE.MeshStandardMaterial({ color: TILE, roughness: 0.6, flatShading: true }),
      red: new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6 }),
      roofTop: new THREE.MeshStandardMaterial({ color: "#8a4a36", roughness: 0.8 }),
      green: new THREE.MeshStandardMaterial({ color: "#5c8a47", roughness: 0.9 }),
      brick: new THREE.MeshStandardMaterial({ color: "#a9472b", roughness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2b2d33", roughness: 0.9 }),
      lantern: new THREE.MeshStandardMaterial({ color: "#d92b2b", emissive: new THREE.Color("#ff5a2a"), roughness: 0.5 }),
    } satisfies Record<keyof Parts, THREE.Material>;
  }, []);
  for (const k of ["shaft", "podium", "dwall", "glass", "base"] as const) (mats[k] as THREE.MeshStandardMaterial).emissiveIntensity = glow * 0.55; // a few quiet windows, not a lit-up wall
  mats.lantern.emissiveIntensity = 0.25 + glow * 0.9;
  return (
    <group>
      {(Object.keys(mats) as (keyof Parts)[]).map((k) =>
        merged[k] ? <mesh key={k} geometry={merged[k]!} material={mats[k]} castShadow={!lite || k === "tile"} receiveShadow /> : null,
      )}
      <DormGardens lite={lite} />
    </group>
  );
}

/** The park's tree shapes with fewer faces (detail 0 blobs): the dorm land holds hundreds, seen from further away. */
function lowTree(kind: "rain" | "trumpet") {
  const trunk = colored(new THREE.CylinderGeometry(kind === "rain" ? 0.14 : 0.1, kind === "rain" ? 0.22 : 0.16, 1.45, 5).translate(0, 0.72, 0), kind === "rain" ? "#6b4a2f" : "#6e5241");
  const blob = (r: number, x: number, y: number, z: number, sy: number, color: string) =>
    colored(jitter(new THREE.IcosahedronGeometry(r, 0).toNonIndexed().scale(1.25, sy, 1.25).translate(x, y, z), 0.14), color);
  return mergeGeometries(
    kind === "rain"
      ? [trunk, blob(1, 0, 1.95, 0, 0.64, "#3f8f3b"), blob(0.72, 0.62, 1.75, 0.3, 0.7, "#357f34"), blob(0.66, -0.6, 1.85, -0.4, 0.7, "#2f7530")]
      : [trunk, blob(0.95, 0, 2.05, 0, 0.78, "#ec8fbf"), blob(0.6, 0.55, 1.85, 0.3, 0.8, "#f4b3d2"), blob(0.55, -0.5, 1.9, -0.35, 0.8, "#5f9a45")],
  )!;
}

/** Trees, palms and flowers round the residences: one instanced mesh per kind, shared look with the park's planting. */
function DormGardens({ lite }: { lite: boolean }) {
  const { trees, bushes } = useMemo(() => dormPlanting(), []);
  const list = useMemo(() => (lite ? thinForLite(trees) : trees), [lite, trees]);
  const broad = useMemo(() => list.filter((t) => t.kind === "broad"), [list]);
  const palms = useMemo(() => list.filter((t) => t.kind === "palm").filter((_, i) => i % 2 === 0), [list]); // palms are the costly shape: half of them
  const trumpets = useMemo(() => list.filter((t) => t.kind === "trumpet"), [list]);
  const rain = useMemo(() => lowTree("rain"), []);
  const palm = useMemo(() => palmGeometry("palm"), []);
  const trumpet = useMemo(() => lowTree("trumpet"), []);
  const bushGeo = useMemo(() => jitter(new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed().scale(1, 0.75, 1).translate(0, 0.3, 0), 0.1), []);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const flowers = useMemo(() => (lite ? bushes.filter((_, i) => i % 2 === 0) : bushes), [lite, bushes]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    flowers.forEach((b, i) => {
      m.makeScale(b.s, b.s, b.s).setPosition(b.x, groundY(b.x, b.z), b.z);
      bushRef.current!.setMatrixAt(i, m);
      bushRef.current!.setColorAt(i, c.set(b.color));
    });
    bushRef.current!.instanceMatrix.needsUpdate = true;
    if (bushRef.current!.instanceColor) bushRef.current!.instanceColor.needsUpdate = true;
  }, [flowers]);
  return (
    <>
      <PlantInstances items={broad} geometry={rain} castShadow={false} />
      <PlantInstances items={palms} geometry={palm} castShadow={false} />
      <PlantInstances items={trumpets} geometry={trumpet} castShadow={false} />
      <instancedMesh ref={bushRef} args={[bushGeo, undefined, flowers.length]} receiveShadow>
        <meshStandardMaterial flatShading roughness={0.85} />
      </instancedMesh>
    </>
  );
}

/** Labels for the scene's place names (added to LABELS in CampusScene). */
export function dormLabels() {
  const out: { name: string; pos: World; y: number; minor: boolean }[] = [];
  for (const [name, d] of Object.entries(DORMS_M)) {
    const { c } = localOutline(d.outline);
    const centre = fromReal(c[0], c[1]);
    const h = dormHeight(name);
    out.push({ name: name === "Canteen D6" ? "Canteen" : name, pos: centre, y: h * UNITS_PER_M + 1.5, minor: true });
  }
  return out;
}
