import type { Level, Pt, Space } from "./interiors.ts";

/**
 * Block A1's ground floor, traced from the fire evacuation plan posted in the building (team photo, November 2026).
 *
 * Coordinates below are pixels on a 1500 px wide copy of that photo, so they can be checked against it. They are
 * turned into metres with the middle of the square block at (0, 0) and a scale that matches the block's OSM width, so
 * the upper floors stack over it. The photo is slightly askew and nothing was measured: this is approximate.
 * It is deliberately simplified for reading: rooms are lined up, the auditorium wing is one block, and stairs and
 * small service rooms are left out.
 * The bottom of the sign is drawn as the front. Which way that faces on campus is not confirmed.
 */
const CENTRE_PX: Pt = [1065, 1088];
const METRES_PER_PX = 0.0702;

const at = ([x, y]: Pt): Pt => [Math.round((x - CENTRE_PX[0]) * METRES_PER_PX * 100) / 100, Math.round((y - CENTRE_PX[1]) * METRES_PER_PX * 100) / 100];
const trace = (...points: Pt[]) => points.map(at);
const box = (x0: number, y0: number, x1: number, y1: number) => trace([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/** A walled room, with its door in the middle of the edge that starts at corner `edge`. */
function room(id: string, name: string, kind: Space["kind"], shape: Pt[], edge: number, extra: Partial<Space> = {}): Space {
  const [a, b] = [shape[edge], shape[(edge + 1) % shape.length]];
  return { id: `A1-G-${id}`, name, kind, shape, walled: true, door: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ...extra };
}

/** The outline of the ground floor, with its terraces and the auditorium wing to the left. */
export const A1_GROUND_OUTLINE: Pt[] = trace(
  [668, 703], [1438, 690], [1440, 806], [1415, 808], [1450, 1346], [1468, 1346], [1470, 1470],
  [680, 1484], [680, 1362], [605, 1358], [135, 1446], [90, 1380], [45, 1180], [38, 1095], [65, 925], [668, 832],
);

// Rooms sit on a tidy grid of shared columns and rows rather than on every kink of the drawing.
const COL = { west: [735, 865], inner: [873, 995], east: [1125, 1245], far: [1253, 1365] } as const;
const ROW = { r1: [795, 885], r2: [893, 1019], mid: [1027, 1137], r3: [1145, 1243], r4: [1251, 1375] } as const;
type Span = readonly [number, number];
/** The block covering these columns and rows. */
const cell = (col: Span, from: Span, to: Span = from) => box(col[0], from[0], col[1], to[1]);

const SPACES: Space[] = [
  // The square block. Doors face the lobbies: edge 1 is a room's right side, edge 3 its left.
  room("toilets", "Toilets, ladies and gents", "service", cell(COL.west, ROW.r1), 1, { furniture: "none", label: "Toilets" }),
  room("computer-west-1", "Computer Room, west 1", "lab", cell(COL.west, ROW.r2), 1, { furniture: "desks", label: "Computer" }),
  room("computer-west-2", "Computer Room, west 2", "lab", cell(COL.west, ROW.mid, ROW.r3), 1, { furniture: "desks", label: "Computer" }),
  room("computer-north", "Computer Room, north", "lab", cell(COL.inner, ROW.r1), 1, { furniture: "desks", label: "Computer" }),
  room("machine-room", "Central Machine Room", "lab", cell(COL.inner, ROW.r2), 1, { furniture: "desks", label: "Machine room" }),
  room("computer-centre", "Computer Centre", "office", cell(COL.inner, ROW.mid), 1, { furniture: "desk", label: "Centre" }),
  room("lift-lobby", "Lift lobby", "service", cell(COL.inner, ROW.r3), 1, { furniture: "none", label: "Lifts" }),
  room("common-south", "Classroom, south", "classroom", cell(COL.inner, ROW.r4), 1, { furniture: "desks", label: "Classroom" }),
  // The top right corner keeps the shapes drawn on the sign
  room("common-north", "Classroom, north", "classroom", trace([1085, 791], [1240, 791], [1243, 889], [1221, 915], [1086, 917]), 0, { furniture: "desks", label: "Classroom" }),
  room("common-corner", "Classroom, north corner", "classroom", box(1246, 790, 1342, 886), 1, { furniture: "desks", label: "Classroom" }),
  room("common-east", "Classroom, east", "classroom", trace([1246, 889], [1344, 889], [1352, 1043], [1226, 1044], [1225, 915]), 2, { furniture: "desks", label: "Classroom" }),
  room("lecture-hall", "Lecture Hall", "hall", cell(COL.east, ROW.r3, ROW.r4), 3, { furniture: "seats", label: "Lecture hall" }),
  room("study-north", "Classroom, front east 1", "classroom", cell(COL.far, ROW.r3), 1, { furniture: "desks", label: "Classroom" }),
  room("study-south", "Classroom, front east 2", "classroom", cell(COL.far, ROW.r4), 1, { furniture: "desks", label: "Classroom" }),
  // The auditorium wing on the left of the sign, drawn as one block
  room("auditorium", "Auditorium", "hall", trace([110, 955], [670, 878], [670, 1305], [160, 1400]), 1, { furniture: "none" }),
];

export const A1_GROUND: Level = {
  id: "G",
  label: "Ground floor",
  short: "G",
  title: "Computer rooms, classrooms and auditorium",
  footprint: A1_GROUND_OUTLINE,
  spaces: SPACES,
  holes: [],
  note: "Traced from the fire evacuation plan posted in the block. Simplified: rooms are lined up on a grid, the auditorium is one block, and stairs and small service rooms are left out. The bottom of the sign is drawn as the front.",
};
