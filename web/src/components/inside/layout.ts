import { centroid, edgeDistance, inside, type Pt, type Space } from "../../lib/data/interiors.ts";

/**
 * What the interior viewer draws in each space, worked out without three.js so it can be tested: wall runs with
 * their door gaps, and simple furniture (boxes and cylinders). Metres, in the building's frame.
 */

/** Wall height inside (cut away below the ceiling so you can see in), the outside walls' height, and thickness. */
export const WALL_H = 2.6;
export const OUTER_H = 1.1;
export const WALL_T = 0.12;
export const DOOR_W = 1.3;

export type Wall = { a: Pt; b: Pt; h: number; t: number };

/** The inward unit normal of edge a->b of a convex outline (toward `c`, its middle). */
function inward(a: Pt, b: Pt, c: Pt): Pt {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const len = Math.hypot(dx, dz) || 1;
  let [nx, nz] = [-dz / len, dx / len];
  if ((c[0] - a[0]) * nx + (c[1] - a[1]) * nz < 0) [nx, nz] = [-nx, -nz];
  return [nx, nz];
}

/**
 * Each walled space's walls, set just inside its outline so two rooms side by side get one wall each (no flicker
 * where they meet). The door leaves a gap; an open-fronted room has no wall on its door side.
 */
export function roomWalls(space: Space): Wall[] {
  if (!space.walled) return [];
  const c = centroid(space.shape);
  const out: Wall[] = [];
  const n = space.shape.length;
  for (let i = 0; i < n; i++) {
    const a = space.shape[i];
    const b = space.shape[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.05) continue;
    const [nx, nz] = inward(a, b, c);
    const off = WALL_T / 2;
    const A: Pt = [a[0] + nx * off, a[1] + nz * off];
    const B: Pt = [b[0] + nx * off, b[1] + nz * off];
    const doorHere = space.door && edgeDistance([a, b], space.door) < 0.05;
    if (doorHere && space.openFront) continue;
    if (doorHere && space.door) {
      const t = ((space.door[0] - a[0]) * (b[0] - a[0]) + (space.door[1] - a[1]) * (b[1] - a[1])) / (len * len);
      const g = Math.min(DOOR_W / 2 / len, 0.45);
      const at = (k: number): Pt => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
      if (t - g > 0.02) out.push({ a: A, b: at(t - g), h: WALL_H, t: WALL_T });
      if (t + g < 0.98) out.push({ a: at(t + g), b: B, h: WALL_H, t: WALL_T });
      continue;
    }
    out.push({ a: A, b: B, h: WALL_H, t: WALL_T });
  }
  return out;
}

/** The building's outside walls, low enough to look over. */
export function outerWalls(footprint: Pt[]): Wall[] {
  const c = centroid(footprint);
  return footprint.map((a, i) => {
    const b = footprint[(i + 1) % footprint.length];
    const [nx, nz] = inward(a, b, c);
    return { a: [a[0] + nx * 0.15, a[1] + nz * 0.15] as Pt, b: [b[0] + nx * 0.15, b[1] + nz * 0.15] as Pt, h: OUTER_H, t: 0.3 };
  });
}

export type Part = "desk" | "chair" | "shelf" | "counter" | "table" | "round" | "pillar" | "seat" | "step";

/** A box (or, for "round", a cylinder `w` across) standing on the floor, `y` above it. */
export type Piece = { part: Part; x: number; z: number; w: number; d: number; h: number; y?: number; rot?: number };

/** Whether a w x d box at (x, z) sits inside the outline, at least `margin` from every edge and clear of holes. */
function fits(space: Space, x: number, z: number, w: number, d: number, margin: number): boolean {
  const corners: Pt[] = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  for (const p of corners) {
    if (!inside(space.shape, p) || edgeDistance(space.shape, p) < margin) return false;
    for (const h of space.holes ?? []) if (inside(h, p, margin)) return false;
  }
  return true;
}

function bounds(p: Pt[]) {
  const xs = p.map((q) => q[0]);
  const zs = p.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** A grid of `cell` sized steps over the space, centred, keeping what fits. */
function grid(space: Space, sx: number, sz: number, w: number, d: number, margin: number, each: (x: number, z: number) => Piece[], max = 400): Piece[] {
  const b = bounds(space.shape);
  const nx = Math.max(1, Math.floor((b.x1 - b.x0) / sx));
  const nz = Math.max(1, Math.floor((b.z1 - b.z0) / sz));
  const ox = (b.x0 + b.x1) / 2 - ((nx - 1) * sx) / 2;
  const oz = (b.z0 + b.z1) / 2 - ((nz - 1) * sz) / 2;
  const out: Piece[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const [x, z] = [ox + i * sx, oz + j * sz];
      if (fits(space, x, z, w, d, margin)) out.push(...each(x, z));
      if (out.length > max) return out;
    }
  }
  return out;
}

/** The edge the door is on, as a direction along it and the inward normal. */
function doorEdge(space: Space): { along: Pt; inn: Pt; len: number } | null {
  if (!space.door) return null;
  const c = centroid(space.shape);
  for (let i = 0; i < space.shape.length; i++) {
    const a = space.shape[i];
    const b = space.shape[(i + 1) % space.shape.length];
    if (edgeDistance([a, b], space.door) < 0.05) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return { along: [(b[0] - a[0]) / len, (b[1] - a[1]) / len], inn: inward(a, b, c), len };
    }
  }
  return null;
}

/** Furniture for one space. */
export function furnish(space: Space): Piece[] {
  const [cx, cz] = centroid(space.shape);
  switch (space.furniture) {
    case "desks":
      return grid(space, 1.9, 1.5, 1.3, 1.1, 0.8, (x, z) => [
        { part: "desk", x, z: z - 0.2, w: 1.2, d: 0.5, h: 0.75 },
        { part: "chair", x, z: z + 0.35, w: 0.45, d: 0.45, h: 0.45 },
      ]);
    case "desk":
      return [
        { part: "desk", x: cx, z: cz - 0.2, w: 1.2, d: 0.6, h: 0.75 },
        { part: "chair", x: cx - 0.3, z: cz + 0.4, w: 0.45, d: 0.45, h: 0.45 },
        { part: "chair", x: cx + 0.3, z: cz + 0.4, w: 0.45, d: 0.45, h: 0.45 },
      ];
    case "round":
      return [
        { part: "round", x: cx, z: cz, w: 1.3, d: 1.3, h: 0.75 },
        ...[0, 1, 2, 3].map((k): Piece => ({ part: "chair", x: cx + Math.cos((k * Math.PI) / 2) * 1.05, z: cz + Math.sin((k * Math.PI) / 2) * 1.05, w: 0.45, d: 0.45, h: 0.45 })),
      ];
    case "tables":
      return grid(space, 3.6, 3.2, 2.2, 2.2, 0.9, (x, z) => [
        { part: "table", x, z, w: 1.8, d: 0.9, h: 0.75 },
        { part: "chair", x: x - 0.45, z: z - 0.75, w: 0.45, d: 0.45, h: 0.45 },
        { part: "chair", x: x + 0.45, z: z - 0.75, w: 0.45, d: 0.45, h: 0.45 },
        { part: "chair", x: x - 0.45, z: z + 0.75, w: 0.45, d: 0.45, h: 0.45 },
        { part: "chair", x: x + 0.45, z: z + 0.75, w: 0.45, d: 0.45, h: 0.45 },
      ], 300);
    case "dining":
      return grid(space, 3.4, 2.9, 2.2, 2.0, 0.8, (x, z) => [
        { part: "table", x, z, w: 2.0, d: 0.85, h: 0.75 },
        { part: "chair", x: x - 0.5, z: z - 0.7, w: 0.42, d: 0.42, h: 0.45 },
        { part: "chair", x: x + 0.5, z: z - 0.7, w: 0.42, d: 0.42, h: 0.45 },
        { part: "chair", x: x - 0.5, z: z + 0.7, w: 0.42, d: 0.42, h: 0.45 },
        { part: "chair", x: x + 0.5, z: z + 0.7, w: 0.42, d: 0.42, h: 0.45 },
      ], 500);
    case "shelves":
      return grid(space, 4.6, 2.2, 4.2, 0.5, 0.7, (x, z) => [{ part: "shelf", x, z, w: 4.0, d: 0.45, h: 2.0 }], 200);
    case "seats":
      return grid(space, 0.62, 1.0, 0.5, 0.5, 1.2, (x, z) => [{ part: "seat", x, z, w: 0.5, d: 0.5, h: 0.85 }], 300);
    case "pillars":
      return grid(space, 7.5, 7.5, 0.7, 0.7, 1.5, (x, z) => [{ part: "pillar", x, z, w: 0.7, d: 0.7, h: WALL_H + 0.8 }]);
    case "counter": {
      const e = doorEdge(space);
      if (!e || !space.door) return [{ part: "counter", x: cx, z: cz, w: 2.4, d: 0.6, h: 1.05 }];
      const len = Math.min(e.len * 0.75, 6);
      const rot = -Math.atan2(e.along[1], e.along[0]);
      const at = (k: number): [number, number] => [space.door![0] + e.inn[0] * k, space.door![1] + e.inn[1] * k];
      // the counter just inside the open front, a shelf along the back wall (twice the door-to-middle depth in)
      const depth = 2 * ((cx - space.door[0]) * e.inn[0] + (cz - space.door[1]) * e.inn[1]);
      const [fx, fz] = at(0.9);
      const [bx, bz] = at(Math.max(1.8, depth - 0.6));
      return [
        { part: "counter", x: fx, z: fz, w: len, d: 0.6, h: 1.05, rot },
        { part: "shelf", x: bx, z: bz, w: len * 0.9, d: 0.45, h: 1.8, rot },
      ];
    }
    default:
      return [];
  }
}

/** Steps up a stairway, along its longer side, as solid blocks. */
export function stairSteps(space: Space): Piece[] {
  const b = bounds(space.shape);
  const [w, d] = [b.x1 - b.x0, b.z1 - b.z0];
  const alongX = w > d;
  const run = alongX ? w : d;
  const n = Math.max(4, Math.floor(run / 0.32));
  const step = run / n;
  const rise = WALL_H / n;
  return Array.from({ length: n }, (_, k): Piece => {
    const h = rise * (k + 1);
    return alongX
      ? { part: "step", x: b.x0 + step * (k + 0.5), z: (b.z0 + b.z1) / 2, w: step, d: d - 0.2, h }
      : { part: "step", x: (b.x0 + b.x1) / 2, z: b.z0 + step * (k + 0.5), w: w - 0.2, d: step, h };
  });
}

/** Posts round an opening in the floor (a courtyard, an atrium), as a railing. */
export function railing(hole: Pt[]): Wall[] {
  return hole.map((a, i) => ({ a, b: hole[(i + 1) % hole.length], h: 1.05, t: 0.06 }));
}
