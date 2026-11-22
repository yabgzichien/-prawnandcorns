import { GEO, type EN } from "./campus-geo";

// Building footprints come from OpenStreetMap (© OpenStreetMap contributors, ODbL).
// What each block is used for, and every room label below, is DEMO data — approximate, not an official directory.

export type PlaceKind = "teaching" | "residence" | "sports" | "food" | "landmark";

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  osm?: string; // building name in the OSM footprint set
  point?: EN; // for places without a footprint
  blurb: string;
  floors?: number;
  approximate?: boolean;
};

export const PLACES: Place[] = [
  { id: "A1", name: "Block A1", kind: "teaching", osm: "A1", floors: 6, blurb: "Teaching block, classrooms and tutorial rooms" },
  { id: "A2", name: "Block A2", kind: "teaching", osm: "A2", floors: 6, blurb: "Teaching block, classrooms and seminar rooms" },
  { id: "A3", name: "Block A3", kind: "teaching", osm: "A3", floors: 7, blurb: "Main teaching block, lecture halls and library" },
  { id: "A4", name: "Block A4", kind: "teaching", osm: "A4", floors: 6, blurb: "Teaching block, classrooms and study rooms" },
  { id: "A5", name: "Block A5", kind: "teaching", osm: "A5", floors: 6, blurb: "Teaching block, computing and electronics labs" },
  { id: "B1", name: "B1 Hall & Sports Complex", kind: "sports", osm: "B1", floors: 3, blurb: "Multi-purpose hall, indoor courts and gym", approximate: true },
  { id: "CANTEEN", name: "Canteen (D6)", kind: "food", osm: "Canteen D6", floors: 2, blurb: "Main canteen" },
  { id: "CAFE", name: "Lakefront Café", kind: "food", osm: "Musical Island", floors: 1, blurb: "Coffee and light bites by the lake" },
  ...["D1", "D2", "D3", "D4", "D5"].map<Place>((d) => ({ id: d, name: `Residence ${d}`, kind: "residence", osm: d, floors: 8, blurb: "Student residence block", approximate: true })),
  ...["LY1", "LY2", "LY3", "LY4", "LY5", "LY6", "LY7", "LY8", "LY9"].map<Place>((d) => ({ id: d, name: `Residence ${d}`, kind: "residence", osm: d, floors: 6, blurb: "Student residence block", approximate: true })),
  { id: "TRACK", name: "Track & Field", kind: "sports", point: [-3, 0], blurb: "Running track and football pitch" },
  { id: "COURTS", name: "Outdoor Courts", kind: "sports", point: [10, 145], blurb: "Basketball, tennis and volleyball courts" },
  { id: "STATUE", name: "Tan Kah Kee Statue", kind: "landmark", point: [-314, -59.7], blurb: "Campus landmark and favourite photo spot" },
  { id: "GATE", name: "East Gate & Guard House", kind: "landmark", point: [93.3, 271.9], blurb: "Main vehicle gate" },
];

export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));

export type RoomType = "Lecture hall" | "Classroom" | "Lab" | "Study room" | "Hall" | "Dining" | "Court";
export type Room = { code: string; place: string; floor: string; name: string; type: RoomType; seats?: number };

export const ROOMS: Room[] = [
  { code: "A3-G01", place: "A3", floor: "Ground", name: "Lecture Hall G01", type: "Lecture hall", seats: 240 },
  { code: "A3-G02", place: "A3", floor: "Ground", name: "Lecture Hall G02", type: "Lecture hall", seats: 180 },
  { code: "A3-201", place: "A3", floor: "Level 2", name: "Classroom 201", type: "Classroom", seats: 60 },
  { code: "A3-LIB", place: "A3", floor: "Level 3", name: "Library", type: "Study room" },
  { code: "A2-104", place: "A2", floor: "Level 1", name: "Classroom 104", type: "Classroom", seats: 48 },
  { code: "A2-203", place: "A2", floor: "Level 2", name: "Classroom 203", type: "Classroom", seats: 80 },
  { code: "A2-305", place: "A2", floor: "Level 3", name: "Seminar Room 305", type: "Classroom", seats: 30 },
  { code: "A1-102", place: "A1", floor: "Level 1", name: "Classroom 102", type: "Classroom", seats: 50 },
  { code: "A1-210", place: "A1", floor: "Level 2", name: "Classroom 210", type: "Classroom", seats: 50 },
  { code: "A4-105", place: "A4", floor: "Level 1", name: "Classroom 105", type: "Classroom", seats: 56 },
  { code: "A4-301", place: "A4", floor: "Level 3", name: "Classroom 301", type: "Classroom", seats: 70 },
  { code: "A4-S12", place: "A4", floor: "Level 2", name: "Group Study Room 12", type: "Study room", seats: 8 },
  { code: "A5-L1", place: "A5", floor: "Level 1", name: "Computing Lab 1", type: "Lab", seats: 40 },
  { code: "A5-L2", place: "A5", floor: "Level 1", name: "Computing Lab 2", type: "Lab", seats: 40 },
  { code: "A5-L3", place: "A5", floor: "Level 2", name: "Electronics Lab 3", type: "Lab", seats: 30 },
  { code: "B1-HALL", place: "B1", floor: "Ground", name: "Multi-purpose Hall", type: "Hall", seats: 600 },
  { code: "CAFE", place: "CAFE", floor: "Ground", name: "Lakefront Café", type: "Dining" },
  { code: "CANTEEN", place: "CANTEEN", floor: "Ground", name: "Main Canteen", type: "Dining" },
  { code: "COURTS", place: "COURTS", floor: "Outdoor", name: "Outdoor Courts", type: "Court" },
];

export const ROOM_BY_CODE = Object.fromEntries(ROOMS.map((r) => [r.code, r]));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type SearchHit =
  | { type: "room"; room: Room; place: Place }
  | { type: "place"; place: Place };

export function searchCampus(query: string, limit = 8): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: { score: number; hit: SearchHit }[] = [];
  for (const r of ROOMS) {
    const code = norm(r.code);
    const name = norm(r.name);
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 80;
    else if (code.includes(q)) score = 60;
    else if (name.includes(q)) score = 50;
    else if (norm(r.type).includes(q)) score = 30;
    if (score) hits.push({ score, hit: { type: "room", room: r, place: PLACE_BY_ID[r.place] } });
  }
  for (const p of PLACES) {
    const id = norm(p.id);
    const name = norm(p.name);
    let score = 0;
    if (id === q) score = 90;
    else if (name.includes(q)) score = 55;
    else if (id.startsWith(q)) score = 45;
    else if (norm(p.kind).includes(q)) score = 20;
    if (score) hits.push({ score, hit: { type: "place", place: p } });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map((h) => h.hit);
}

export function findRoom(query: string): Room | undefined {
  const q = norm(query);
  return ROOMS.find((r) => norm(r.code) === q) ?? ROOMS.find((r) => norm(r.name) === q);
}

// ─── geometry helpers ───
function centroid(ring: EN[]): EN {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

const footprints: Record<string, EN[]> = {};
for (const b of GEO.buildings) if (b.name) footprints[b.name] = b.ring as unknown as EN[];

export const footprintOf = (p: Place): EN[] | undefined => (p.osm ? footprints[p.osm] : undefined);

export function placeCenter(p: Place): EN {
  const f = footprintOf(p);
  if (f) return centroid(f);
  return p.point ?? [0, 0];
}

export function placeRadius(p: Place): number {
  const f = footprintOf(p);
  if (!f) return 25;
  const c = centroid(f);
  return Math.max(...f.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1])));
}
