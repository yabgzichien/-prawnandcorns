import { courtyardArcs, GABLE_PLAN } from "./a-block-plan.ts";
import { aBlockPlannedUpper } from "./a-block-upper.ts";
import { A1_GROUND } from "./a1-ground.ts";
import { A5_UPPER } from "./a5-upper.ts";
import { aBlockPlannedGround } from "./a-block-ground.ts";
import { GEO } from "./campus-geo.ts";
import { LIBRARY_ROOMS, type LibraryRoom, type Wing } from "../library/rooms.ts";

/**
 * Building interiors for the "View inside" 3D viewer: every level of A1 to A5, D6 and LY3, as rooms and areas in
 * metres. APPROXIMATE: positions are worked out from the XMUM virtual tour (vt.xmu.edu.my: its scene list, how its
 * scenes link to each other and its descriptions), the official campus map (September 2025), the OpenStreetMap
 * footprints and the team's note that A1, A2, A4 and A5 have ground floor classrooms 01 to 12, three in each corner.
 * A1, A2, A4 and A5 are the exception: every floor is traced from the evacuation plans posted there (a1-ground.ts,
 * a-block-ground.ts, a-block-upper.ts, a5-upper.ts).
 * Nothing here is a surveyed floor plan, and the viewer says so.
 *
 * Each building has its own frame, in metres from its middle: +x to the right and +z toward the front, as you stand
 * outside the front door looking at it. For A3, D6 and LY3 the front is the south side, so +x is east and -z north.
 */

export type Pt = [number, number];

export type SpaceKind =
  | "classroom"
  | "study"
  | "office"
  | "lab"
  | "library"
  | "food"
  | "shop"
  | "hall"
  | "corridor"
  | "courtyard"
  | "stairs"
  | "entrance"
  | "atrium"
  | "feature"
  | "service"
  | "porch";

/** What the viewer furnishes a space with (simple shapes only). */
export type Furniture = "desks" | "desk" | "round" | "tables" | "dining" | "shelves" | "counter" | "seats" | "pillars" | "none";

export type Corner = "front-left" | "back-left" | "back-right" | "front-right";

export type Space = {
  /** Unique within its building. Rooms use their room code. */
  id: string;
  /** The number people use, e.g. A1-G03 or N201. */
  code?: string;
  name: string;
  /** Shorter text for the label on the floor, where the name is too long for the room. */
  label?: string;
  kind: SpaceKind;
  /** Outline, metres, in the building's frame. Walled spaces are convex. */
  shape: Pt[];
  holes?: Pt[][];
  /** A room with walls (and a door), rather than an open area. */
  walled?: boolean;
  /** No wall on the door side (the library's open-fronted study rooms, food stalls). */
  openFront?: boolean;
  /** A point on one of the outline's edges where the door is. */
  door?: Pt;
  furniture?: Furniture;
  corner?: Corner;
  wing?: Wing;
  seats?: number;
  detail?: string;
  /** Its number or place follows a pattern, not a source. */
  assumed?: boolean;
  /** Getting-around space (a hall, walkway, stairs): no label and not in the room list, but still tappable. */
  minor?: boolean;
};

export type Level = {
  id: string;
  /** "Ground floor", "Level 2" */
  label: string;
  /** For the floor picker: "G", "2" */
  short: string;
  /** What the level is, in a few words. */
  title?: string;
  spaces: Space[];
  /** Openings in the floor slab: an open courtyard, an atrium. */
  holes: Pt[][];
  note?: string;
  /** This floor's own outline, where it differs from the building's. */
  footprint?: Pt[];
};

/** The outline drawn for one floor. */
export const levelOutline = (interior: Interior, level: number): Pt[] => interior.levels[level]?.footprint ?? interior.footprint;

export type Interior = {
  place: string;
  name: string;
  footprint: Pt[];
  /** Floor to floor, metres. */
  storey: number;
  levels: Level[];
  /** What the +z side faces. */
  front: string;
  summary: string;
  sources: string[];
};

/** The virtual tour and map the layouts were read from. */
export const TOUR_URL = "https://vt.xmu.edu.my/";
const SRC_TOUR = "XMUM virtual tour (vt.xmu.edu.my)";
const SRC_MAP = "XMUM campus map, September 2025";
const SRC_TEAM = "Team note: A block ground floor classrooms 01 to 12";
const SRC_OSM = "OpenStreetMap building outlines";

/** OSM outlines are traced from roofs: the walls stand about this far inside. */
const EAVES_M = 1;

// ── Shapes ──────────────────────────────────────────────────────────────────

export const rect = (x0: number, z0: number, x1: number, z1: number): Pt[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

export function ellipse(cx: number, cz: number, rx: number, rz: number, n = 40): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return [cx + rx * Math.cos(t), cz + rz * Math.sin(t)] as Pt;
  });
}

/** A ring sector round (cx, cz) from radius r0 to r1, angles a0 to a1 (radians, 0 along +x, turning toward +z). */
function sector(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, n = 6): Pt[] {
  const at = (r: number, a: number): Pt => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  const outer = Array.from({ length: n + 1 }, (_, i) => at(r1, a0 + ((a1 - a0) * i) / n));
  const inner = Array.from({ length: n + 1 }, (_, i) => at(r0, a1 - ((a1 - a0) * i) / n));
  return [...outer, ...inner];
}

const round2 = (p: Pt): Pt => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];

/** `n` equal rooms side by side along x (z0 to z1 deep). */
function rowX(x0: number, x1: number, z0: number, z1: number, n: number): Pt[][] {
  const w = (x1 - x0) / n;
  return Array.from({ length: n }, (_, i) => rect(x0 + i * w, z0, x0 + (i + 1) * w, z1));
}
/** `n` equal rooms one behind another along z. */
function rowZ(x0: number, x1: number, z0: number, z1: number, n: number): Pt[][] {
  const d = (z1 - z0) / n;
  return Array.from({ length: n }, (_, i) => rect(x0, z0 + i * d, x1, z0 + (i + 1) * d));
}

export function polygonArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i];
    const [x1, z1] = p[(i + 1) % p.length];
    a += x0 * z1 - x1 * z0;
  }
  return Math.abs(a) / 2;
}

export function centroid(p: Pt[]): Pt {
  let [cx, cz, a] = [0, 0, 0];
  for (let i = 0; i < p.length; i++) {
    const [x0, z0] = p[i];
    const [x1, z1] = p[(i + 1) % p.length];
    const f = x0 * z1 - x1 * z0;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  return [cx / (3 * a), cz / (3 * a)];
}

/** Whether `p` lies inside polygon `poly` (or within `tol` metres of its edge). */
export function inside(poly: Pt[], p: Pt, tol = 0): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) hit = !hit;
  }
  if (hit || tol <= 0) return hit;
  return edgeDistance(poly, p) <= tol;
}

/** Distance from `p` to the nearest edge of `poly`. */
export function edgeDistance(poly: Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz));
  }
  return best;
}

// ── A1, A2, A4, A5 ─────────────────────────────────────────────────────────

const A_STOREY = 4.2;
/** A1, A2, A4 and A5 have six levels in the campus data: the ground floor and levels 1 to 5. */
const A_LEVELS = 6;
/** The walkway between the rooms and the open courtyard (metres). */
const A_WALKWAY_M = 3;
/** The arm rooms' depth from the outside wall, and the corner room's size, as shares of the half width. */
const A_ARM_DEPTH = 0.33;
const A_CORNER_SIZE = 0.43;

/**
 * Corners in numbering order: G01 is beside the front entrance on its left, and the numbers go clockwise seen from
 * above (front-left, back-left, back-right, front-right), three per corner. Change this one table if the real order
 * differs.
 */
export const A_CORNER_ORDER: { corner: Corner; sx: 1 | -1; sz: 1 | -1 }[] = [
  { corner: "front-left", sx: -1, sz: 1 },
  { corner: "back-left", sx: -1, sz: -1 },
  { corner: "back-right", sx: 1, sz: -1 },
  { corner: "front-right", sx: 1, sz: 1 },
];

export const CORNER_LABEL: Record<Corner, string> = {
  "front-left": "front left",
  "back-left": "back left",
  "back-right": "back right",
  "front-right": "front right",
};

function osmRing(name: string): Pt[] {
  const b = GEO.buildings.find((x) => x.name === name);
  if (!b) throw new Error(`No OSM outline for ${name}`);
  return b.ring.map(([e, n]) => [e, n] as Pt);
}

/** An OSM rectangle's two side lengths (metres): along its first edge, and the next. */
function osmSides(name: string): [number, number] {
  const r = osmRing(name);
  return [Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1])];
}

/** The A block's walls' half width (metres): drawn square, like the 3D exterior, from OSM's average side. */
export function aBlockHalf(name: string): number {
  const [a, b] = osmSides(name);
  return (a + b) / 4 - EAVES_M;
}

/** The blocks drawn from their posted plans. The demo timetable's rooms (such as A1-210, A2-203, A4-105 and A5-L1) and A4's event venues stay. */
const PLANNED: Record<string, { summary: string; levels: () => Level[] }> = {
  A1: { summary: "Computer rooms, classrooms, offices and an auditorium.", levels: () => [A1_GROUND, ...aBlockPlannedUpper("A1", { 2: ["01", "02", "03", "10"] })] },
  A4: { summary: "Lecture halls, classrooms and offices.", levels: () => [aBlockPlannedGround("A4"), ...aBlockPlannedUpper("A4", { 1: ["01", "02", "03", "05"] })] },
  A5: { summary: "Lecture halls, computing and science labs, and offices.", levels: () => [aBlockPlannedGround("A5"), ...A5_UPPER] },
  A2: { summary: "Lecture halls, classrooms and offices.", levels: () => [aBlockPlannedGround("A2"), ...aBlockPlannedUpper("A2", { 3: ["01", "02", "03", "05"] })] },
};

function aBlock(place: string, entrances: { front: string; back: string; left: string; right: string }): Interior {
  const s = aBlockHalf(place);
  const R = GABLE_PLAN.ridge * s;
  const m = GABLE_PLAN.point * s;
  const Rc = R - A_WALKWAY_M;
  const da = A_ARM_DEPTH * s;
  const dc = A_CORNER_SIZE * s;
  const courtyard = courtyardArcs(s, R, m)
    .flat()
    .map((p) => round2([p.x, p.z]));
  const footprint = rect(-s, -s, s, s);

  const arc = (r: number, t0: number, t1: number, n = 8): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = t0 + ((t1 - t0) * i) / n;
      return [r * Math.cos(t), r * Math.sin(t)] as Pt;
    });
  const reach = (r: number, b: number) => Math.sqrt(r * r - b * b);
  // In a corner's own terms: a along the front or back wall from the corner, b along the side wall.
  const armA: Pt[] = [[dc, 0], ...arc(Rc, 0, Math.asin(da / Rc)), [dc, da]];
  const armB: Pt[] = armA.map(([a, b]) => [b, a] as Pt).reverse();
  const cornerRoom: Pt[] = rect(0, 0, dc, dc);
  const hall: Pt[] = [
    [dc, da],
    ...arc(Rc, Math.asin(da / Rc), Math.PI / 2 - Math.asin(da / Rc)),
    [da, dc],
    [dc, dc],
  ];
  // the stairs in each corner's hall, as long as fits inside the walkway's curve
  const sw = 2.8;
  const s0 = dc + 0.6;
  const sLen = Math.min(5, reach(Rc - 0.6, s0 + sw) - s0);
  const stairs: Pt[] = rect(s0, s0, s0 + sw, s0 + sLen);
  const walk: Pt[] = [...arc(R, 0, Math.PI / 2, 16), ...arc(Rc, Math.PI / 2, 0, 16)];

  const levels: Level[] = Array.from({ length: A_LEVELS }, (_, li) => {
    const prefix = li === 0 ? "G" : String(li);
    const spaces: Space[] = [];
    let n = 0;
    A_CORNER_ORDER.forEach(({ corner, sx, sz }, ci) => {
      const to = ([a, b]: Pt): Pt => round2([sx * (s - a), sz * (s - b)]);
      const map = (p: Pt[]) => p.map(to);
      // clockwise from above: corners 0 and 2 go along the front or back wall first, 1 and 3 along a side first
      const order = ci % 2 === 0 ? (["a", "c", "b"] as const) : (["b", "c", "a"] as const);
      for (const part of order) {
        n += 1;
        const num = String(n).padStart(2, "0");
        const code = `${place}-${prefix}${num}`;
        const shape = part === "a" ? armA : part === "b" ? armB : cornerRoom;
        const door: Pt =
          part === "a"
            ? [(dc + reach(Rc, da)) / 2, da]
            : part === "b"
              ? [da, (dc + reach(Rc, da)) / 2]
              : [dc, (da + dc) / 2];
        spaces.push({
          id: code,
          code,
          name: li === 0 ? `Classroom ${prefix}${num}` : `Room ${prefix}${num}`,
          kind: "classroom",
          shape: map(shape),
          walled: true,
          door: to(door),
          furniture: "desks",
          corner,
          assumed: li > 0,
          detail:
            li === 0
              ? `Ground floor, ${CORNER_LABEL[corner]} corner. Numbers 01 to 12 run three to a corner.`
              : `Level ${li}, ${CORNER_LABEL[corner]} corner. Numbered like the ground floor; not confirmed.`,
        });
      }
      spaces.push({
        id: `${place}-${prefix}-hall-${corner}`,
        name: `Corner hall, ${CORNER_LABEL[corner]}`,
        kind: "hall",
        shape: map(hall),
        holes: [map(stairs)],
        corner,
        furniture: "none",
        minor: true,
      });
      spaces.push({
        id: `${place}-${prefix}-stairs-${corner}`,
        name: `Stairs, ${CORNER_LABEL[corner]}`,
        kind: "stairs",
        shape: map(stairs),
        corner,
        assumed: true,
        minor: true,
        detail: "Stairs drawn in each corner hall. Their exact place is not confirmed.",
      });
      spaces.push({
        id: `${place}-${prefix}-walk-${corner}`,
        name: `Courtyard walkway, ${CORNER_LABEL[corner]}`,
        kind: "corridor",
        shape: map(walk),
        corner,
        minor: true,
      });
    });
    // the passages through the middle of each side, behind the gables
    const g = s - R;
    const sides: { id: string; shape: Pt[]; door: string }[] = [
      { id: "front", shape: rect(-g, s - m, g, s), door: entrances.front },
      { id: "back", shape: rect(-g, -s, g, -(s - m)), door: entrances.back },
      { id: "left", shape: rect(-s, -g, -(s - m), g), door: entrances.left },
      { id: "right", shape: rect(s - m, -g, s, g), door: entrances.right },
    ];
    for (const side of sides) {
      spaces.push({
        id: `${place}-${prefix}-${side.id}`,
        name: li === 0 ? side.door : `Walkway, ${side.id} side`,
        kind: li === 0 && side.door.endsWith("entrance") ? "entrance" : "corridor",
        shape: side.shape,
        minor: li > 0 || !side.door.endsWith("entrance"),
      });
    }
    if (li === 0) {
      spaces.push({
        id: `${place}-G-courtyard`,
        name: "Open courtyard",
        kind: "courtyard",
        shape: courtyard,
        detail: "Open to the sky. The walkways round it link the four corners.",
      });
    }
    return {
      id: prefix,
      label: li === 0 ? "Ground floor" : `Level ${li}`,
      short: prefix,
      title: li === 0 ? "12 classrooms, three per corner" : "Teaching rooms",
      spaces,
      holes: li === 0 ? [] : [courtyard],
      note:
        li === 0
          ? "Classrooms G01 to G12, three in each corner round the open courtyard. G01 starts beside the front entrance on the left; the order round the corners is not confirmed."
          : "Upper floors are drawn like the ground floor and numbered the same way. Not confirmed yet.",
    };
  });

  // A1 and A2 have a posted plan for every floor, so those replace the generic ones
  const planned = PLANNED[place];
  if (planned) levels.splice(0, levels.length, ...planned.levels());

  return {
    place,
    name: `Block ${place}`,
    footprint,
    storey: A_STOREY,
    levels,
    front: "the lawn and the Tan Kah Kee statue",
    summary: planned ? planned.summary : "Lecture halls, tutorial rooms and labs round an open, star-shaped courtyard.",
    sources: planned ? [`Fire evacuation plan posted in Block ${place}`, SRC_MAP, SRC_OSM] : [SRC_TEAM, SRC_MAP, SRC_OSM],
  };
}

// ── A3 (and the library) ────────────────────────────────────────────────────

const A3_STOREY = 4.5;
/** The library's oval atrium, in the middle of A3 (tour: Learning Commons 2F looks up through it). */
const ATRIUM = ellipse(0, 0, 9, 6.5, 40);

/** A3's four stair and lift cores, in the corners. */
function a3Cores(prefix: string, hx: number, hz: number): Space[] {
  const w = 6;
  const d = 8;
  return ([[-1, -1, "north-west"], [1, -1, "north-east"], [1, 1, "south-east"], [-1, 1, "south-west"]] as const).map(
    ([sx, sz, name]) => ({
      id: `A3-${prefix}-core-${name}`,
      name: `Stairs and lifts, ${name}`,
      kind: "stairs" as const,
      shape: sx < 0
        ? sz < 0 ? rect(-hx + 0.8, -hz + 0.8, -hx + 0.8 + w, -hz + 0.8 + d) : rect(-hx + 0.8, hz - 0.8 - d, -hx + 0.8 + w, hz - 0.8)
        : sz < 0 ? rect(hx - 0.8 - w, -hz + 0.8, hx - 0.8, -hz + 0.8 + d) : rect(hx - 0.8 - w, hz - 0.8 - d, hx - 0.8, hz - 0.8),
      assumed: true,
      minor: true,
      detail: "Stairs and lifts drawn in each corner. Their exact place is not confirmed.",
    }),
  );
}

const area = (id: string, name: string, kind: SpaceKind, shape: Pt[], furniture: Furniture, detail?: string, holes?: Pt[][]): Space => ({
  id,
  name,
  kind,
  shape,
  furniture,
  detail,
  holes,
  minor: kind === "stairs" || undefined,
});

const room = (
  id: string,
  name: string,
  kind: SpaceKind,
  shape: Pt[],
  door: Pt,
  furniture: Furniture,
  more: Partial<Space> = {},
): Space => ({ id, code: more.code, name, kind, shape, walled: true, door, furniture, ...more });

function libraryRoom(r: LibraryRoom, shape: Pt[], door: Pt): Space {
  const kind: SpaceKind = "study";
  const furniture: Furniture = r.category === "group" ? "round" : r.category === "success" ? "tables" : "desk";
  return {
    id: r.id,
    code: r.id,
    name: r.name,
    kind,
    shape,
    walled: true,
    openFront: r.category === "study",
    door,
    furniture,
    wing: r.wing,
    seats: r.capacity,
    detail:
      r.category === "silent"
        ? "Enclosed room for up to 2 people. Book it in Library rooms."
        : r.category === "study"
          ? "Open-fronted study space for up to 2 people. Book it in Library rooms."
          : r.category === "group"
            ? "Closed room with a round table for up to 4 people. Book it in Library rooms."
            : `Closed meeting room for ${r.capacity === 10 ? "5 to 10" : "up to 4"} people. Book it in Library rooms.`,
  };
}

function a3(): Interior {
  const [len, wid] = osmSides("A3");
  const hx = len / 2 - EAVES_M;
  const hz = wid / 2 - EAVES_M;
  const lib = (level: 2 | 3, wing: Wing) => LIBRARY_ROOMS.filter((r) => r.level === level && r.wing === wing);

  const G: Level = {
    id: "G",
    label: "Ground floor",
    short: "G",
    title: "Lobby, offices and café",
    holes: [],
    note: "From the campus map: the Student Recruitment Office (G01) and ZUS Coffee. The rest of this floor is not mapped yet.",
    spaces: [
      area("A3-G-lobby", "Main lobby", "entrance", rect(-8, hz - 12, 8, hz), "none", "Front entrance, facing the statue."),
      room("A3-G-recruitment", "Student Recruitment Office", "office", rect(8, hz - 12, 22, hz), [8, hz - 6], "desks", {
        code: "G01",
        detail: "Room G01 on the campus map.",
      }),
      room("A3-G-zus", "ZUS Coffee", "food", rect(-22, hz - 12, -8, hz), [-8, hz - 6], "dining", { detail: "Café on the ground floor, from the campus map." }),
      area("A3-G-common", "A3 Common Space", "hall", rect(-20, -12, 20, 14), "tables", "Open seating on the ground floor (virtual tour)."),
      area("A3-G-north", "North entrance", "entrance", rect(-8, -hz, 8, -hz + 10), "none", "Toward the lake."),
      ...a3Cores("G", hx, hz),
    ],
  };

  const L1: Level = {
    id: "1",
    label: "Level 1",
    short: "1",
    title: "Library: Innovation Space",
    holes: [],
    note: "The library's first floor, the Innovation Space (virtual tour). Areas are placed by how the tour's scenes link, so treat positions as approximate.",
    spaces: [
      area("A3-1-entrance", "Library main entrance", "entrance", rect(-5, -hz, 5, -hz + 5), "none", "Library entrance, from the lake side walk."),
      area("A3-1-north", "Innovation Space, north", "library", rect(-14, -hz + 5, 14, -14), "tables"),
      room("A3-103", "IT Office", "office", rect(-28, -hz, -16, -hz + 10), [-16, -hz + 5], "desks", {
        code: "A3-103",
        detail: "Room 103 (campus map and tour). IT help for students and staff, Monday to Friday, 8:30 AM to 5:30 PM.",
      }),
      area("A3-1-printing", "Printing Service Area", "library", rect(14, -hz + 5, 24, -17), "counter"),
      area("A3-1-fnb", "Food and Beverage Area", "food", rect(-26, -20, -15, -10), "dining"),
      room("A3-1-instruction", "Instruction Room", "classroom", rect(-hx, -20, -27, -6), [-27, -13], "desks"),
      room("A3-1-cinema", "Mini Cinema", "lab", rect(-hx, -4, -25, 12), [-25, 4], "seats", { detail: "Screenings and educational movie events (tour)." }),
      area("A3-1-central", "Innovation Space, central", "library", rect(-12, -10, 12, 8), "tables"),
      area("A3-1-east", "Innovation Space, east", "library", rect(14, -12, 25, 6), "tables"),
      area("A3-1-digital", "Digital Resource Area", "library", rect(8, 10, 24, 21), "desks", "Computers and e-resources."),
      area("A3-1-display", "Work Display Area", "feature", rect(-8, 12, 6, 21), "none"),
      room("A3-1-maker", "Makerspace", "lab", rect(26, 8, hx, 20), [26, 14], "tables", { detail: "Hands-on workspace for making and inventing (tour)." }),
      room("A3-1-robotic", "Robotic Lab", "lab", rect(26, -8, hx, 4), [26, -2], "tables"),
      area("A3-1-stairs", "Stairs to Learning Commons, Level 2", "stairs", rect(16, 23, 22, 30), "none"),
      ...a3Cores("1", hx, hz),
    ],
  };

  const groupSplit = (rooms: LibraryRoom[], x0: number, x1: number, z0: number, z1: number, doorX: number) =>
    rowZ(x0, x1, z0, z1, rooms.length).map((shape, i) => libraryRoom(rooms[i], shape, [doorX, (shape[0][1] + shape[2][1]) / 2]));
  const east2 = lib(2, "East");
  const west2 = lib(2, "West");
  const silent = lib(2, "North");
  const study = lib(2, "South");

  const L2: Level = {
    id: "2",
    label: "Level 2",
    short: "2",
    title: "Library: Learning Commons",
    holes: [],
    note: "Learning Commons (virtual tour). Silent study rooms along the north side, open study rooms along the south, group rooms in the four corners, and the circulation counter under the oval atrium.",
    spaces: [
      ...rowX(-22, 22, -hz, -hz + 5, silent.length).map((shape, i) => libraryRoom(silent[i], shape, [(shape[0][0] + shape[1][0]) / 2, -hz + 5])),
      ...rowX(-22, 22, hz - 5, hz, study.length).map((shape, i) => libraryRoom(study[i], shape, [(shape[0][0] + shape[1][0]) / 2, hz - 5])),
      ...groupSplit(east2.slice(0, 3), 22, 30, -24, -12, 22),
      ...groupSplit(east2.slice(3), 22, 30, 12, 24, 22),
      ...groupSplit(west2.slice(0, 3), -30, -22, -24, -12, -22),
      ...groupSplit(west2.slice(3), -30, -22, 12, 24, -22),
      area("A3-2-reserve-1", "Course Reserve Zone 1", "library", rect(-22, -hz + 6, -10, -15), "shelves", "Core textbooks for every programme."),
      area("A3-2-western", "Western Book Area", "library", rect(-10, -hz + 6, 10, -15), "shelves"),
      area("A3-2-reserve-2", "Course Reserve Zone 2", "library", rect(10, -hz + 6, 22, -15), "shelves", "Core textbooks for every programme."),
      area("A3-2-counter", "Circulation Counter", "feature", rect(-6, -13.5, 6, -10.5), "counter", "Borrow, renew and return books. Monday to Friday 9 AM to 10 PM, weekends 9 AM to 5 PM."),
      area("A3-2-atrium", "Atrium", "atrium", ATRIUM, "none", "The oval atrium rises through the floors above."),
      area("A3-2-commons-west", "Learning Commons, west", "library", rect(-21, -9, -10, 9), "tables"),
      area("A3-2-commons-east", "Learning Commons, east", "library", rect(10, -9, 21, 9), "tables"),
      area("A3-2-chinese", "Chinese Book Area", "library", rect(-22, 15, -8, hz - 6), "shelves"),
      room("A3-2-tkk", "Tan Kah Kee Study", "feature", rect(-6, 15.5, 6, hz - 6), [0, 15.5], "shelves", {
        detail: "A memorial study for Tan Kah Kee, about 124 square metres, opened in November 2023 (tour).",
      }),
      area("A3-2-chinese-western", "Chinese and Western Book Area", "library", rect(8, 15, 22, hz - 6), "shelves"),
      area("A3-2-corridor-east", "Grand Reading Corridor, east", "library", rect(30.5, -22, hx, 22), "tables", "Long reading hall along the east windows, with the Wall of Knowledge.", [rect(hx - 4.6, -16, hx - 0.6, -8)]),
      area("A3-2-corridor-west", "Grand Reading Corridor, west", "library", rect(-hx, -22, -30.5, 22), "tables", "Long reading hall along the west windows, with the Digital Wall.", [rect(-hx + 0.6, 8, -hx + 4.6, 16)]),
      area("A3-2-stairs-west", "Stairs to Level 3, west", "stairs", rect(-hx + 0.6, 8, -hx + 4.6, 16), "none"),
      area("A3-2-stairs-east", "Stairs to Level 3, east", "stairs", rect(hx - 4.6, -16, hx - 0.6, -8), "none"),
      ...a3Cores("2", hx, hz),
    ],
  };

  const success = lib(3, "West");
  const L3: Level = {
    id: "3",
    label: "Level 3",
    short: "3",
    title: "Library: Learning Commons",
    holes: [ATRIUM],
    note: "Learning Commons, Level 3 (virtual tour): Student Success rooms in the west wing, the info counter and collections round the open atrium.",
    spaces: [
      libraryRoom(success[0], rect(-30, -14, -22, -6), [-22, -10]),
      libraryRoom(success[1], rect(-30, -6, -22, 2), [-22, -2]),
      libraryRoom(success[2], rect(-30, 2, -22, 14), [-22, 8]),
      area("A3-3-corridor-west", "Reading Corridor, west", "library", rect(-hx, -22, -30.5, 22), "tables", undefined, [rect(-hx + 0.6, 8, -hx + 4.6, 16)]),
      area("A3-3-sea", "Southeast Asia Corner", "library", rect(-22, -hz + 6, -8, -15), "shelves"),
      area("A3-3-info", "Info Counter", "feature", rect(-8, -hz + 6, 8, -15), "counter"),
      area("A3-3-science", "Science Zone", "library", rect(8, -hz + 6, 22, -15), "shelves"),
      area("A3-3-central", "Learning Commons, central", "library", rect(-16, -12, 16, 12), "none", "Seating round the open atrium.", [ATRIUM]),
      area("A3-3-medical", "Medical Collection Area", "library", rect(18, -12, 29, 6), "shelves"),
      area("A3-3-study", "Study Area", "library", rect(18, 8, 29, 22), "tables"),
      area("A3-3-reading", "Reading Area", "library", rect(-8, 14, 14, 25), "tables"),
      area("A3-3-technology", "Technology Collection Area", "library", rect(-22, 14, -10, 25), "shelves"),
      area("A3-3-stairs-west", "Stairs to Level 2, west", "stairs", rect(-hx + 0.6, 8, -hx + 4.6, 16), "none"),
      area("A3-3-stairs-east", "Stairs to Level 2, east", "stairs", rect(hx - 4.6, -16, hx - 0.6, -8), "none"),
      ...a3Cores("3", hx, hz),
    ],
  };

  const office = (code: string, name: string, shape: Pt[], door: Pt, detail: string) =>
    room(`A3-${code}`, name, "office", shape, door, "desks", { code: `A3-${code}`, detail });
  const plain = (n: number): Level => ({
    id: String(n),
    label: `Level ${n}`,
    short: String(n),
    title: "Not mapped yet",
    holes: [ATRIUM],
    note: "No source lists the rooms on this level yet. Only the atrium and the stairs are drawn.",
    spaces: [...a3Cores(String(n), hx, hz)],
  });
  const L7: Level = {
    id: "7",
    label: "Level 7",
    short: "7",
    title: "University offices",
    holes: [ATRIUM],
    note: "Offices from the campus map. Their room numbers are real; where each sits on the floor is approximate.",
    spaces: [
      office("702", "Degree Academic Affairs Office", rect(-30, -hz + 1, -14, -18), [-22, -18], "Room 702 on the campus map."),
      office("706", "Research and Postgraduate Centre, Innovation and Entrepreneurship Centre", rect(14, -hz + 1, 30, -18), [22, -18], "Room 706 on the campus map."),
      office("709", "Admissions Office, Global Engagement and Partnerships Office", rect(14, 18, 30, hz - 1), [22, 18], "Room 709 on the campus map."),
      office("711", "Finance Office", rect(-30, 18, -14, hz - 1), [-22, 18], "Room 711 on the campus map."),
      ...a3Cores("7", hx, hz),
    ],
  };
  const L8: Level = {
    id: "8",
    label: "Level 8",
    short: "8",
    title: "Meeting rooms",
    holes: [ATRIUM],
    note: "Meeting and conference rooms from the virtual tour. Their numbers are real; where each sits is approximate.",
    spaces: [
      room("A3-824", "Meeting Room", "office", rect(14, -hz + 1, 28, -18), [21, -18], "tables", { code: "A3-824", detail: "A3-824 in the virtual tour." }),
      room("A3-827", "Conference Room", "office", rect(-28, -hz + 1, -10, -16), [-19, -16], "tables", { code: "A3-827", detail: "A3-827 in the virtual tour." }),
      ...a3Cores("8", hx, hz),
    ],
  };

  return {
    place: "A3",
    name: "Block A3",
    footprint: rect(-hx, -hz, hx, hz),
    storey: A3_STOREY,
    levels: [G, L1, L2, L3, plain(4), plain(5), plain(6), L7, L8],
    front: "the Tan Kah Kee statue (south)",
    summary: "The People's Great Hall: the library on levels 1 to 3 round an oval atrium, offices higher up.",
    sources: [SRC_TOUR, SRC_MAP, SRC_OSM],
  };
}

// ── D6 and LY3 ─────────────────────────────────────────────────────────────

/** An OSM outline in the viewer's frame: metres from its middle, +x east, +z south. */
function localRing(name: string): Pt[] {
  const r = osmRing(name);
  const [ce, cn] = centroid(r);
  return r.map(([e, n]) => round2([e - ce, -(n - cn)]));
}

/** `n` food stalls round the north side of a round hall: ring sectors from radius r0 to r1. */
function stallArc(prefix: string, n: number, r0: number, r1: number, from: number, to: number, label: (i: number) => string): Space[] {
  const step = (to - from) / n;
  return Array.from({ length: n }, (_, i) => {
    const a0 = from + i * step + 0.01;
    const a1 = from + (i + 1) * step - 0.01;
    const am = (a0 + a1) / 2;
    return {
      id: `${prefix}-stall-${i + 1}`,
      name: label(i),
      kind: "food" as const,
      // one straight edge each way (a trapezoid), so the stall stays convex
      shape: sector(0, 0, r0, r1, a0, a1, 1).map(round2),
      walled: true,
      openFront: true,
      door: round2([r0 * Math.cos((a1 - a0) / 2) * Math.cos(am), r0 * Math.cos((a1 - a0) / 2) * Math.sin(am)]),
      furniture: "counter" as const,
    };
  });
}

function d6(): Interior {
  const footprint = localRing("Canteen D6");
  // the round hall: as far as the outline allows all round, less a margin
  const rIn = edgeDistance(footprint, [0, 0]) - 1.5;
  const storey = 5;
  const north = [-Math.PI + 0.35, -0.35] as const; // the north half of the ring (-z is north)
  const stairs = (prefix: string): Space[] => [
    area(`D6-${prefix}-stairs-w`, "Stairs, west", "stairs", rect(-rIn + 3, -3, -rIn + 7, 4), "none"),
    area(`D6-${prefix}-stairs-e`, "Stairs, east", "stairs", rect(rIn - 7, -3, rIn - 3, 4), "none"),
  ];
  const dining = (prefix: string, holes: Pt[][] = []) =>
    area(`D6-${prefix}-dining`, "Dining hall", "food", ellipse(0, 3, rIn - 9, rIn - 12, 36).map(round2), "dining", "Air-conditioned seating.", holes);
  const level = (id: string, label: string, stalls: number, cuisine: string, extra: Space[]): Level => ({
    id,
    label,
    short: id,
    title: `${stalls} food stalls`,
    holes: [],
    note: `${cuisine} (virtual tour). Stalls are numbered here round the hall, not by their real lot numbers.`,
    spaces: [
      ...stallArc(`D6-${id}`, stalls, rIn - 6, rIn, north[0], north[1], (i) => `Stall ${i + 1}`),
      dining(id),
      ...stairs(id),
      ...extra,
    ],
  });
  return {
    place: "CANTEEN",
    name: "D6 Cafeteria",
    footprint,
    storey,
    levels: [
      level("G", "Ground floor", 4, "Asian and Thai food, drinks, snacks and desserts", [
        room("D6-G-store", "Convenience store", "shop", sector(0, 0, rIn - 7, rIn, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45, 1).map(round2), round2([0, (rIn - 7) * Math.cos(0.45)]), "shelves", {
          detail: "The cafeteria's convenience store (tour: 17 lots including a convenience store). Its floor is assumed.",
          assumed: true,
        }),
      ]),
      level("1", "Level 1", 5, "Mixed rice, nasi lemak, chicken rice, Chinese mala, herbal tea and Chinese Muslim noodles", []),
      level("2", "Level 2", 7, "Malaysian, Western, Chinese and Middle Eastern food", []),
    ],
    front: "the south (the hostels of Zone D are round it)",
    summary: "Three-level cafeteria in the middle of Zone D: 17 lots including a convenience store.",
    sources: [SRC_TOUR, SRC_MAP, SRC_OSM],
  };
}

function ly3(): Interior {
  const [len, wid] = osmSides("LY3");
  const hx = len / 2 - EAVES_M;
  const hz = wid / 2 - EAVES_M;
  const storey = 5;
  const stairs = (prefix: string): Space[] => [
    area(`LY3-${prefix}-stairs-w`, "Stairs, west", "stairs", rect(-hx + 1, -4, -hx + 5, 4), "none"),
    area(`LY3-${prefix}-stairs-e`, "Stairs, east", "stairs", rect(hx - 5, -4, hx - 1, 4), "none"),
  ];
  const stalls = rowX(-hx + 3, hx - 3, -hz, -hz + 7, 9).map((shape, i): Space => ({
    id: `LY3-1-stall-${i + 1}`,
    name: `Stall ${i + 1}`,
    kind: "food",
    shape,
    walled: true,
    openFront: true,
    door: [(shape[0][0] + shape[1][0]) / 2, -hz + 7],
    furniture: "counter",
  }));
  return {
    place: "LY3",
    name: "LY3 Cafeteria",
    footprint: rect(-hx, -hz, hx, hz),
    storey,
    levels: [
      {
        id: "G",
        label: "Ground floor",
        short: "G",
        title: "Unmanned mart, open pillared floor",
        holes: [],
        note: "The ground floor is open between pillars, with the unmanned mart (virtual tour). A walkway links LY3 to Musical Island.",
        spaces: [
          room("LY3-G-mart", "Unmanned Mart", "shop", rect(-12, -hz, 12, -hz + 12), [0, -hz + 12], "shelves", { detail: "Self-service mart on the ground floor (tour)." }),
          area("LY3-G-pillars", "Open pillared hall", "hall", rect(-hx + 6, -hz + 14, hx - 6, hz - 8), "pillars", "Covered open space between pillars."),
          area("LY3-G-link", "Walkway to Musical Island", "entrance", rect(-6, hz - 8, 6, hz), "none", "Toward the lake and Musical Island."),
          ...stairs("G"),
        ],
      },
      {
        id: "1",
        label: "Level 1",
        short: "1",
        title: "Cafeteria, 9 stalls",
        holes: [],
        note: "The dining hall (campus map: Level 1), with 9 stalls serving Chinese, Malaysian and Western food and Muslim-friendly options (tour). Stalls are numbered here, not by their real lot numbers.",
        spaces: [
          ...stalls,
          area("LY3-1-dining", "Dining hall", "food", rect(-hx + 6, -hz + 9, hx - 6, hz - 2), "dining", "Breakfast, lunch and dinner."),
          ...stairs("1"),
        ],
      },
    ],
    front: "the south (toward the lake)",
    summary: "Cafeteria for Zone LY: a 9-stall dining hall over an open ground floor with an unmanned mart.",
    sources: [SRC_TOUR, SRC_MAP, SRC_OSM],
  };
}

// ── Lookups ────────────────────────────────────────────────────────────────

export const INTERIORS: Interior[] = [
  aBlock("A1", { front: "Front entrance", back: "Back entrance", left: "Side passage, left", right: "Side passage, right" }),
  aBlock("A2", { front: "Front entrance", back: "Back entrance", left: "Side passage, left", right: "Side passage, right" }),
  a3(),
  aBlock("A4", { front: "Front entrance", back: "Back entrance", left: "Side passage, left", right: "Side passage, right" }),
  aBlock("A5", { front: "Front entrance", back: "Back entrance", left: "Side passage, left", right: "East entrance" }),
  d6(),
  ly3(),
];

export const INTERIOR_BY_PLACE: Record<string, Interior> = Object.fromEntries(INTERIORS.map((i) => [i.place, i]));

export const hasInterior = (place: string | null | undefined): boolean => !!place && place in INTERIOR_BY_PLACE;

export type SpaceHit = { interior: Interior; level: number; space: Space };

/** Finds a room by its code (A1-G03, N201, A3-103) or a space by its id, optionally only in one building. */
export function findSpace(codeOrId: string, place?: string): SpaceHit | null {
  const want = codeOrId.trim().toLowerCase();
  if (!want) return null;
  for (const interior of place ? [INTERIOR_BY_PLACE[place]].filter(Boolean) : INTERIORS) {
    for (let level = 0; level < interior.levels.length; level++) {
      const space = interior.levels[level].spaces.find((s) => s.id.toLowerCase() === want || s.code?.toLowerCase() === want);
      if (space) return { interior, level, space };
    }
  }
  return null;
}

/**
 * Rooms the team confirmed that the campus search does not know yet: A1, A2, A4 and A5's ground floor classrooms.
 * (campus.ts adds them to its room list.)
 */
export const CONFIRMED_INTERIOR_ROOMS: { code: string; place: string; floor: string; name: string }[] = INTERIORS.filter((i) => /^A[1245]$/.test(i.place)).flatMap(
  (i) => i.levels[0].spaces.filter((s) => s.kind === "classroom" && s.code).map((s) => ({ code: s.code!, place: i.place, floor: "Ground", name: s.name })),
);
