// The grounds of the residences and dining halls: paths and roads (the real OpenStreetMap lines), stone aprons round the
// buildings, the LY3 forecourt with its XMUM lettering, flower beds, and where the trees, flowers and lamps go.
// Painted into the ground texture (no runtime cost) and planted as instanced meshes (a few draw calls).
// Geometry is in real metres (east, north) until the very end, so it lines up with the OSM outlines.

import { GEO } from "@/lib/data/campus-geo";
import { DORMS_M } from "./dorms";
import { LAKE_M } from "./campusData";
import { COLORS, DORM_LAND, fromReal, inPolygon, UNITS_PER_M, type World } from "./geo";
import type { Plant, Lamp, Bush } from "./plants";

type EN = [number, number];
const U = UNITS_PER_M;

// ── small planar helpers (metres) ──
function inRing(ring: readonly (readonly number[])[], e: number, n: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ei, ni] = ring[i];
    const [ej, nj] = ring[j];
    if (ni > n !== nj > n && e < ((ej - ei) * (n - ni)) / (nj - ni) + ei) inside = !inside;
  }
  return inside;
}
function segDist(e: number, n: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((e - a[0]) * dx + (n - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(e - (a[0] + dx * t), n - (a[1] + dy * t));
}
const lineDist = (e: number, n: number, line: readonly (readonly number[])[]) => {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segDist(e, n, line[i - 1], line[i]));
  return d;
};
const ringDist = (e: number, n: number, ring: readonly (readonly number[])[]) =>
  inRing(ring, e, n) ? 0 : lineDist(e, n, [...ring, ring[0]]);
const centroid = (ring: readonly (readonly number[])[]): EN => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
const grow = (ring: readonly (readonly number[])[], k: number): EN[] => {
  const [ce, cn] = centroid(ring);
  return ring.map(([e, n]) => [ce + (e - ce) * k, cn + (n - cn) * k]);
};
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

// ── what is in the dorm area ──
const inArea = (l: readonly (readonly number[])[]) => l.filter((p) => p[1] > 290 && p[0] > -600).length >= l.length * 0.6;
export const DORM_ROADS: EN[][] = (GEO.roads as unknown as EN[][]).filter(inArea);
export const DORM_PATHS: EN[][] = (GEO.paths as unknown as EN[][]).filter(inArea);

type Building = { name: string; ring: EN[]; c: EN };
export const DORM_BUILDINGS: Building[] = Object.entries(DORMS_M).map(([name, d]) => ({ name, ring: d.outline as unknown as EN[], c: centroid(d.outline) }));

/** LY3's forecourt, from its southern (lake-facing) edge: a stone apron with parking bays, then the XMUM plaza. */
function southEdge(ring: EN[]) {
  let best = { score: Infinity, a: ring[0], b: ring[1] };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 20) continue;
    const score = (a[1] + b[1]) / 2; // the edge with the lowest north is the one facing the lake
    if (score < best.score) best = { score, a, b };
  }
  // west → east
  return best.a[0] <= best.b[0] ? { a: best.a, b: best.b } : { a: best.b, b: best.a };
}
const ly3 = DORM_BUILDINGS.find((b) => b.name === "LY3")!;
const edge = southEdge(ly3.ring);
const edx = edge.b[0] - edge.a[0], edn = edge.b[1] - edge.a[1];
const elen = Math.hypot(edx, edn);
const along: EN = [edx / elen, edn / elen];
// outward normal = the perpendicular that points south (lower north)
const nrm: EN = along[0] > 0 ? [along[1], -along[0]] : [-along[1], along[0]];
const outward: EN = nrm[1] <= 0 ? nrm : [-nrm[0], -nrm[1]];
const at = (s: number, d: number): EN => [edge.a[0] + along[0] * s + outward[0] * d, edge.a[1] + along[1] * s + outward[1] * d];

/** Rectangles on the ground, as real-metre corner rings: the car-park apron and the XMUM plaza. */
export const LY3_APRON: EN[] = [at(-8, 0.5), at(elen + 8, 0.5), at(elen + 8, 12), at(-8, 12)];
export const XMUM_PLAZA = { ring: [at(elen / 2 - 24, 14), at(elen / 2 + 24, 14), at(elen / 2 + 24, 30), at(elen / 2 - 24, 30)] as EN[], centre: at(elen / 2, 22), along, outward };

const keepClear: { ring: EN[]; pad: number }[] = [
  ...DORM_BUILDINGS.map((b) => ({ ring: b.ring, pad: 4.5 })),
  { ring: LY3_APRON, pad: 1 },
  { ring: XMUM_PLAZA.ring, pad: 2 },
];
const lakeRing = LAKE_M as unknown as EN[];

function blocked(e: number, n: number, pathPad: number) {
  for (const k of keepClear) if (ringDist(e, n, k.ring) < k.pad) return true;
  if (ringDist(e, n, lakeRing) < 5) return true;
  for (const r of DORM_ROADS) if (lineDist(e, n, r) < 3.5 + pathPad) return true;
  for (const p of DORM_PATHS) if (lineDist(e, n, p) < 1.6 + pathPad) return true;
  const [x, z] = fromReal(e, n);
  return !inPolygon(DORM_LAND, x, z);
}

// ── painted into the ground texture ──
export function drawDormGrounds(ctx: CanvasRenderingContext2D) {
  const r = rng(77);
  const pts = (ring: readonly (readonly number[])[]) => ring.map(([e, n]) => fromReal(e, n));
  const trace = (w: World[], close = false) => {
    ctx.beginPath();
    w.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    if (close) ctx.closePath();
  };
  const fill = (ring: readonly (readonly number[])[], color: string) => { trace(pts(ring), true); ctx.fillStyle = color; ctx.fill(); };
  const line = (l: readonly (readonly number[])[], widthM: number, color: string) => {
    trace(pts(l));
    ctx.lineWidth = widthM * U;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  // roads: a kerb, then asphalt; paths: terracotta paving like the park walks
  for (const l of DORM_ROADS) line(l, 7, COLORS.kerb);
  for (const l of DORM_ROADS) line(l, 6, COLORS.road);
  for (const l of DORM_PATHS) line(l, 3, "#c98369");
  for (const l of DORM_PATHS) line(l, 2.6, COLORS.path);

  // dark lawn under and round every building, so they sit in their grounds
  for (const b of DORM_BUILDINGS) fill(grow(b.ring, 1.5), "rgba(46,84,36,0.35)");
  // stone aprons
  for (const b of DORM_BUILDINGS) {
    const round = b.name === "Canteen D6";
    fill(grow(b.ring, round ? 1.3 : 1.14), round ? "#d9cdb4" : "#c8bfae");
    fill(grow(b.ring, round ? 1.16 : 1.06), "#b4ab9a");
  }
  // paths from every building out to the nearest path or road, so no door opens onto lawn
  for (const b of DORM_BUILDINGS) {
    let best: EN | null = null, bd = Infinity;
    for (const l of [...DORM_PATHS, ...DORM_ROADS]) for (let i = 1; i < l.length; i++) {
      const a = l[i - 1], c = l[i];
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const p: EN = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const d = Math.hypot(p[0] - b.c[0], p[1] - b.c[1]);
        if (d < bd) { bd = d; best = p; }
      }
    }
    if (best && bd < 120) line([b.c, best], 2.8, COLORS.path);
  }

  // LY3: the car-park apron, then the brick plaza with XMUM in green
  fill(LY3_APRON, "#8d8a8f");
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 0.16 * U * 3;
  for (let s = -6; s <= elen + 6; s += 3.6) {
    const p1 = at(s, 2), p2 = at(s - 1.2, 10.5);
    trace(pts([p1, p2]));
    ctx.stroke();
  }
  fill(grow(XMUM_PLAZA.ring, 1.08), "#d8c3a4");
  fill(XMUM_PLAZA.ring, "#c98f6e");
  {
    const [cx, cz] = fromReal(...XMUM_PLAZA.centre);
    const e2 = fromReal(XMUM_PLAZA.centre[0] + along[0] * 10, XMUM_PLAZA.centre[1] + along[1] * 10);
    const theta = Math.atan2(e2[1] - cz, e2[0] - cx); // reading direction: west → east, seen from the lake
    ctx.save();
    ctx.translate(cx, cz);
    ctx.rotate(theta);
    ctx.fillStyle = "#4c8f3c";
    ctx.strokeStyle = "#356b2b";
    ctx.lineWidth = 0.35 * U;
    ctx.font = `900 ${12 * U}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("XMUM", 0, 0);
    ctx.fillText("XMUM", 0, 0);
    ctx.restore();
  }

  // flower beds: coloured speckle in a ring round each tower's apron
  const bloom = ["#ef4f9b", "#ff8a3d", "#f7d046", "#f4f1ea", "#d81b7a", "#c77dff"];
  for (const b of DORM_BUILDINGS) {
    if (b.name === "LY3" || b.name === "Canteen D6") continue;
    const ring = grow(b.ring, 1.3);
    trace(pts(ring), true);
    ctx.lineWidth = 2.4 * U;
    ctx.strokeStyle = "rgba(40,92,40,0.55)";
    ctx.stroke();
    for (let i = 0; i < 150; i++) {
      const a = ring[Math.floor(r() * ring.length)], c = ring[Math.floor(r() * ring.length)];
      const t = r();
      const [x, z] = fromReal(a[0] + (c[0] - a[0]) * t + (r() - 0.5) * 3, a[1] + (c[1] - a[1]) * t + (r() - 0.5) * 3);
      ctx.fillStyle = bloom[Math.floor(r() * bloom.length)];
      ctx.beginPath();
      ctx.arc(x, z, (0.35 + r() * 0.35) * U, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── planted as instanced meshes ──
const BLOOMS = ["#d81b7a", "#ef4f9b", "#ff8a3d", "#f7d046", "#f4f1ea", "#c2185b"];
export type DormPlanting = { trees: Plant[]; bushes: Bush[]; lamps: Lamp[] };
let cache: DormPlanting | null = null;

export function dormPlanting(): DormPlanting {
  if (cache) return cache;
  const r = rng(131);
  const trees: Plant[] = [];
  const bushes: Bush[] = [];
  const lamps: Lamp[] = [];
  const taken: EN[] = [];
  const free = (e: number, n: number, d: number) => taken.every((t) => Math.hypot(t[0] - e, t[1] - n) >= d);
  const tree = (e: number, n: number, kind?: Plant["kind"], gap = 5) => {
    if (blocked(e, n, 0) || !free(e, n, gap)) return;
    const [x, z] = fromReal(e, n);
    const k = kind ?? (r() < 0.15 ? "trumpet" : r() < 0.3 ? "palm" : "broad");
    trees.push({ x, z, s: k === "palm" ? 0.42 + r() * 0.1 : 0.5 + r() * 0.18, rot: r() * Math.PI * 2, kind: k });
    taken.push([e, n]);
  };
  const lamp = (e: number, n: number) => {
    if (blocked(e, n, -2) || lamps.some((l) => { const [lx, lz] = fromReal(e, n); return Math.hypot(l.x - lx, l.z - lz) < 9 * U; })) return;
    const [x, z] = fromReal(e, n);
    lamps.push({ x, z, s: 0.3 });
  };
  const bush = (e: number, n: number, s = 0.26) => {
    if (blocked(e, n, -1)) return;
    const [x, z] = fromReal(e, n);
    bushes.push({ x, z, s: s + r() * 0.1, color: BLOOMS[Math.floor(r() * BLOOMS.length)] });
  };

  // the real trees OSM has on this land first
  for (const t of GEO.trees as unknown as EN[]) if (t[1] > 290 && t[0] > -600) tree(t[0], t[1]);
  // shade trees and flowers along every path and road, both sides, staggered
  const stroll = (l: EN[], gap: number, fn: (e: number, n: number, ne: number, nn: number, i: number) => void) => {
    let i = 0;
    for (let k = 1; k < l.length; k++) {
      const [ax, ay] = l[k - 1], [bx, by] = l[k];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      const ux = (bx - ax) / len, uy = (by - ay) / len;
      for (let s = gap / 2; s < len; s += gap, i++) fn(ax + ux * s, ay + uy * s, -uy, ux, i);
    }
  };
  for (const l of DORM_ROADS) stroll(l, 11, (e, n, ne, nn, i) => {
    const side = i % 2 ? 1 : -1;
    tree(e + ne * side * 7, n + nn * side * 7, undefined, 6);
    if (i % 3 === 0) lamp(e - ne * side * 5.2, n - nn * side * 5.2);
  });
  for (const l of DORM_PATHS) stroll(l, 7, (e, n, ne, nn, i) => {
    const side = i % 2 ? 1 : -1;
    tree(e + ne * side * 5, n + nn * side * 5, undefined, 5.5);
    bush(e + ne * -side * 2.6, n + nn * -side * 2.6);
    if (i % 4 === 0) lamp(e + ne * side * 3, n + nn * side * 3);
  });
  // flower clusters and a few palms ringing each tower, the hall and the canteen
  for (const b of DORM_BUILDINGS) {
    const ring = grow(b.ring, b.name === "Canteen D6" ? 1.38 : b.name === "LY3" ? 1.22 : 1.3);
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length];
      for (let t = 0.2; t < 1; t += 0.4) {
        const e = p[0] + (q[0] - p[0]) * t, n = p[1] + (q[1] - p[1]) * t;
        for (let k = 0; k < 3; k++) bush(e + (r() - 0.5) * 3, n + (r() - 0.5) * 3, 0.24);
      }
      if (i % 3 === 0 && (b.name === "LY3" || b.name === "Canteen D6")) tree(p[0], p[1], "palm", 7);
    });
  }
  // the XMUM plaza: a row of palms and low flowers along its lake side
  for (let s = elen / 2 - 28; s <= elen / 2 + 28; s += 8) {
    const [e, n] = at(s, 33.5);
    tree(e, n, "palm", 6);
    for (let k = 0; k < 2; k++) bush(e + (r() - 0.5) * 4, n + (r() - 0.5) * 2, 0.22);
  }
  // loose clumps of trees on the open lawn
  const lawn = DORM_BUILDINGS.map((b) => b.c);
  for (let i = 0; i < 260; i++) {
    const c = lawn[Math.floor(r() * lawn.length)];
    tree(c[0] + (r() - 0.5) * 120, c[1] + (r() - 0.5) * 90, undefined, 7.5);
  }
  cache = { trees, bushes, lamps };
  return cache;
}

/** Appended to the park's lamps (plants.ts) so they share its night glow and light pools. */
export const dormLamps = () => dormPlanting().lamps;
