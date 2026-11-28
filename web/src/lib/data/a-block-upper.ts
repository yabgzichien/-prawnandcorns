import type { Level, Pt, Space } from "./interiors.ts";

/**
 * Levels 1 to 5 of Blocks A1, A2 and A4, which share one layout on their posted fire evacuation plans (team photos,
 * November 2026). Only the square block is drawn: A1's auditorium is left off the upper floors.
 *
 * Coordinates are pixels on a 1500 px wide copy of A1's Level 1 photo, turned into metres round the middle of the
 * square. Simplified at the user's request: rooms are lined up, Level 1 shows a porch on each side (the sign calls it
 * a terrace) and Levels 2 to 5 do not, and the round centre feature and small service rooms are left out.
 * The plans show no room numbers, so the classroom numbers are assumed.
 */
const CENTRE_PX: Pt = [1099, 814];
const METRES_PER_PX = 0.0719;

const at = ([x, y]: Pt): Pt => [Math.round((x - CENTRE_PX[0]) * METRES_PER_PX * 100) / 100, Math.round((y - CENTRE_PX[1]) * METRES_PER_PX * 100) / 100];
export const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]).map(at);

// Shared columns and rows. The top and bottom rows of offices use the same columns.
export const COL = { west: [753, 890], c1: [896, 976], c2: [980, 1060], c3: [1128, 1208], c4: [1212, 1433], east: [1296, 1433] } as const;
export const ROW = { top: [483, 610], upper: [637, 775], porch: [779, 835], lower: [839, 981], bottom: [1012, 1145] } as const;
type Span = readonly [number, number];
export const cell = (col: Span, row: Span) => box(col[0], row[0], col[1], row[1]);

/** Which side of a room its door is on. */
const SIDE = { top: 0, right: 1, bottom: 2, left: 3 } as const;

export function room(id: string, name: string, kind: Space["kind"], shape: Pt[], side: keyof typeof SIDE, extra: Partial<Space> = {}): Space {
  const [a, b] = [shape[SIDE[side]], shape[(SIDE[side] + 1) % shape.length]];
  return { id, name, kind, shape, walled: true, door: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...extra };
}
const classroom = (code: string, shape: Pt[], side: keyof typeof SIDE) =>
  room(code, `Classroom ${code.slice(3)}`, "classroom", shape, side, { code, furniture: "desks", assumed: true, detail: "A specialised classroom on the plan. Its number is not confirmed." });
/** An open porch between two rooms. */
const porch = (place: string, level: number, side: string, shape: Pt[]): Space => ({ id: `${place}-${level}-porch-${side}`, name: `Porch, ${side}`, kind: "porch", shape, label: "Porch" });
const office = (place: string, level: number, id: string, name: string, shape: Pt[], side: keyof typeof SIDE) =>
  room(`${place}-${level}-office-${id}`, `Office, ${name}`, "office", shape, side, { furniture: "desk", label: "Office" });

function firstFloor(place: string, ends: string[]): Level {
  const [frontLeft, backLeft, backRight, frontRight] = ends.map((n) => `${place}-1${n}`);
  const spaces: Space[] = [
    // Back row
    room(`${place}-1-toilets`, "Toilets, ladies and gents", "service", cell(COL.west, ROW.top), "right", { furniture: "none", label: "Toilets" }),
    office(place, 1, "back-1", "back 1", cell(COL.c1, ROW.top), "bottom"),
    office(place, 1, "back-2", "back 2", cell(COL.c2, ROW.top), "bottom"),
    office(place, 1, "back-3", "back 3", cell(COL.c3, ROW.top), "bottom"),
    office(place, 1, "back-4", "back 4", cell(COL.c4, ROW.top), "bottom"),
    // Sides: the four specialised classrooms, numbered clockwise from the front left
    classroom(backLeft, cell(COL.west, ROW.upper), "right"),
    classroom(frontLeft, cell(COL.west, ROW.lower), "right"),
    classroom(backRight, cell(COL.east, ROW.upper), "left"),
    classroom(frontRight, cell(COL.east, ROW.lower), "left"),
    // A porch in the middle of each side
    porch(place, 1, "back", box(1064, ROW.top[0], 1124, ROW.top[1])),
    porch(place, 1, "front", box(1064, ROW.bottom[0], 1124, ROW.bottom[1])),
    porch(place, 1, "left", cell(COL.west, ROW.porch)),
    porch(place, 1, "right", cell(COL.east, ROW.porch)),
    // Middle
    room(`${place}-1-meeting`, "Meeting Room", "office", box(COL.c1[0], ROW.upper[0], COL.c2[1], 743), "bottom", { furniture: "tables", label: "Meeting" }),
    room(`${place}-1-stairs-lifts`, "Stairs beside the lifts", "stairs", box(COL.c1[0], 872, COL.c1[1], ROW.lower[1]), "bottom", { label: "Stairs" }),
    room(`${place}-1-lifts`, "Lift lobby", "service", box(985, 872, COL.c2[1], ROW.lower[1]), "bottom", { furniture: "none", label: "Lifts" }),
    // The back right stairs, in line with the meeting room. The middle of the floor is left open.
    room(`${place}-1-stairs`, "Stairs", "stairs", box(COL.c3[0], ROW.upper[0], 1275, 743), "bottom"),
    // Front row
    office(place, 1, "front-1", "front 1", box(COL.west[0], ROW.bottom[0], COL.c1[1], ROW.bottom[1]), "top"),
    office(place, 1, "front-2", "front 2", cell(COL.c2, ROW.bottom), "top"),
    office(place, 1, "front-3", "front 3", cell(COL.c3, ROW.bottom), "top"),
    office(place, 1, "front-4", "front 4", cell(COL.c4, ROW.bottom), "top"),
  ];
  return {
    id: "1",
    label: "Level 1",
    short: "1",
    title: "Classrooms and offices",
    spaces,
    holes: [],
    note: "Traced from the fire evacuation plan posted in the block. Simplified, and the classroom numbers are not confirmed.",
  };
}

// With no porches, the two classrooms on each side meet, and the middle offices close the gap.
const SIDE_ROWS = { upper: [637, 806], lower: [810, 981] } as const;
const WIDE = { c2: [980, 1092], c3: [1096, 1208] } as const;
const INNER = { top: [637, 743], bottom: [872, 981] } as const;

/** The two staircases and the lift lobby, in the same place on every floor. */
const core = (place: string, level: number): Space[] => [
  room(`${place}-${level}-stairs`, "Stairs", "stairs", box(COL.c3[0], INNER.top[0], 1275, INNER.top[1]), "bottom"),
  room(`${place}-${level}-stairs-lifts`, "Stairs beside the lifts", "stairs", box(COL.c1[0], INNER.bottom[0], COL.c1[1], INNER.bottom[1]), "bottom", { label: "Stairs" }),
  room(`${place}-${level}-lifts`, "Lift lobby", "service", box(COL.c2[0], INNER.bottom[0], COL.c2[1], INNER.bottom[1]), "bottom", { furniture: "none", label: "Lifts" }),
];

/** Levels 2, 3 and 4: offices front and back, two classrooms on each side, offices and a meeting room inside. */
function teaching(place: string, level: 2 | 3 | 4, ends: string[]): Level {
  const codes = ends.map((n) => `${place}-${level}${n}`);
  // Level 4's front offices are narrower and leave the two front corners open
  const front =
    level === 4
      ? [cell(COL.c1, ROW.bottom), box(WIDE.c2[0], ROW.bottom[0], WIDE.c2[1], ROW.bottom[1]), box(WIDE.c3[0], ROW.bottom[0], WIDE.c3[1], ROW.bottom[1]), box(COL.c4[0], ROW.bottom[0], 1292, ROW.bottom[1])]
      : [box(COL.west[0], ROW.bottom[0], COL.c1[1], ROW.bottom[1]), box(WIDE.c2[0], ROW.bottom[0], WIDE.c2[1], ROW.bottom[1]), box(WIDE.c3[0], ROW.bottom[0], WIDE.c3[1], ROW.bottom[1]), cell(COL.c4, ROW.bottom)];
  return {
    id: String(level),
    label: `Level ${level}`,
    short: String(level),
    title: "Classrooms and offices",
    holes: [],
    note: "Traced from the fire evacuation plan posted in the block. Simplified, and the classroom numbers are not confirmed.",
    spaces: [
      room(`${place}-${level}-toilets`, "Toilets, ladies and gents", "service", cell(COL.west, ROW.top), "right", { furniture: "none", label: "Toilets" }),
      office(place, level, "back-1", "back 1", cell(COL.c1, ROW.top), "bottom"),
      office(place, level, "back-2", "back 2", box(WIDE.c2[0], ROW.top[0], WIDE.c2[1], ROW.top[1]), "bottom"),
      office(place, level, "back-3", "back 3", box(WIDE.c3[0], ROW.top[0], WIDE.c3[1], ROW.top[1]), "bottom"),
      office(place, level, "back-4", "back 4", cell(COL.c4, ROW.top), "bottom"),
      classroom(codes[1], cell(COL.west, SIDE_ROWS.upper), "right"),
      classroom(codes[0], cell(COL.west, SIDE_ROWS.lower), "right"),
      classroom(codes[2], cell(COL.east, SIDE_ROWS.upper), "left"),
      classroom(codes[3], cell(COL.east, SIDE_ROWS.lower), "left"),
      office(place, level, "inner-1", "inner 1", box(896, INNER.top[0], 964, INNER.top[1]), "top"),
      office(place, level, "inner-2", "inner 2", box(968, INNER.top[0], 1036, INNER.top[1]), "top"),
      office(place, level, "inner-3", "inner 3", box(1040, INNER.top[0], 1108, INNER.top[1]), "top"),
      room(`${place}-${level}-meeting`, "Meeting Room", "office", box(COL.c3[0], INNER.bottom[0], 1275, INNER.bottom[1]), "bottom", { furniture: "tables", label: "Meeting" }),
      ...core(place, level),
      ...front.map((shape, i) => office(place, level, `front-${i + 1}`, `front ${i + 1}`, shape, "top")),
    ],
  };
}

/** Level 5: mostly open, with two meeting rooms, the stairs, the lifts and a plant area. */
const fifth = (place: string): Level => ({
  id: "5",
  label: "Level 5",
  short: "5",
  title: place === "A4" ? "Meeting rooms and pump room" : "Meeting rooms and plant area",
  holes: [],
  note: "Traced from the fire evacuation plan posted in the block. Simplified: the room names on this floor were hard to read.",
  spaces: [
    // A4's sign names this room; the others were too small to read
    place === "A4"
      ? room(`${place}-5-pump`, "Cold water pump room", "service", cell(COL.west, SIDE_ROWS.upper), "right", { furniture: "none", label: "Pump room" })
      : room(`${place}-5-plant`, "Plant area", "service", cell(COL.west, SIDE_ROWS.upper), "right", { furniture: "none", label: "Plant", assumed: true }),
    room(`${place}-5-meeting-1`, "Meeting Room, back", "office", box(COL.c1[0], INNER.top[0], COL.c2[1], INNER.top[1]), "top", { furniture: "tables", label: "Meeting", assumed: true }),
    room(`${place}-5-meeting-2`, "Meeting Room, front", "office", box(COL.c3[0], INNER.bottom[0], 1275, INNER.bottom[1]), "bottom", { furniture: "tables", label: "Meeting", assumed: true }),
    ...core(place, 5),
  ],
});

/**
 * Levels 1 to 5 for one block. A classroom's number is its level then two digits, clockwise from the front left;
 * `numbers` changes those digits where the demo timetable already uses a particular room.
 */
export function aBlockPlannedUpper(place: "A1" | "A2" | "A4", numbers: Partial<Record<1 | 2 | 3 | 4, string[]>> = {}): Level[] {
  const usual = ["01", "02", "03", "04"];
  return [firstFloor(place, numbers[1] ?? usual), ...([2, 3, 4] as const).map((level) => teaching(place, level, numbers[level] ?? usual)), fifth(place)];
}
