import type { Level, Pt, Space } from "./interiors.ts";

/**
 * The ground floor of Blocks A2, A4 and A5, which share one layout on their posted fire evacuation plans (team photos,
 * November 2026).
 *
 * Coordinates are pixels on the 810 px wide photo of A2's sign, turned into metres round the middle of the square
 * block. Simplified like A1: rooms are lined up, the porches and small service rooms are left out, and the common
 * rooms and study lounges are called classrooms (the user's wording). The bottom of the sign is drawn as the front.
 * Not measured. The signs show no room numbers.
 */
const CENTRE_PX: Pt = [357, 547];
const METRES_PER_PX = 0.099;

const at = ([x, y]: Pt): Pt => [Math.round((x - CENTRE_PX[0]) * METRES_PER_PX * 100) / 100, Math.round((y - CENTRE_PX[1]) * METRES_PER_PX * 100) / 100];
const trace = (...points: Pt[]) => points.map(at);
const box = (x0: number, y0: number, x1: number, y1: number) => trace([x0, y0], [x1, y0], [x1, y1], [x0, y1]);

/**
 * A4's club event venues are A4-G05 to A4-G10, so its ground floor rooms carry numbers, clockwise from the front left,
 * with those six on classrooms. The numbers are assumed.
 */
const A4_CODES: Record<string, string> = {
  "classroom-front-corner": "G01",
  "classroom-front-west": "G02",
  "classroom-west": "G03",
  "hall-back": "G04",
  "classroom-north": "G05",
  "classroom-corner": "G06",
  "classroom-east": "G07",
  "classroom-study-1": "G08",
  "classroom-study-2": "G09",
  "classroom-front": "G10",
  "hall-front": "G11",
};

function spaces(place: "A2" | "A4" | "A5"): Space[] {
  /** A walled room, with its door in the middle of the edge that starts at corner `edge` (0 top, 1 right, 2 bottom, 3 left). */
  function room(id: string, name: string, kind: Space["kind"], shape: Pt[], edge: number, extra: Partial<Space> = {}): Space {
    const [a, b] = [shape[edge], shape[(edge + 1) % shape.length]];
    const door: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const number = place === "A4" ? A4_CODES[id] : undefined;
    if (!number) return { id: `${place}-G-${id}`, name, kind, shape, walled: true, door, ...extra };
    const code = `${place}-${number}`;
    const what = kind === "hall" ? "Lecture Hall" : "Classroom";
    return { ...extra, id: code, code, name: `${what} ${number}`, label: undefined, kind, shape, walled: true, door, assumed: true, detail: "Its number is not on the plan and is not confirmed." };
  }
  const classroom = (id: string, where: string, shape: Pt[], edge: number) => room(`classroom-${id}`, `Classroom, ${where}`, "classroom", shape, edge, { furniture: "desks", label: "Classroom" });
  const hall = (id: string, where: string, shape: Pt[], edge: number) => room(`hall-${id}`, `Lecture Hall, ${where}`, "hall", shape, edge, { furniture: "seats", label: "Lecture hall" });

  return [
  // Back half
  room("toilets", "Toilets, ladies and gents", "service", box(150, 340, 224, 410), 1, { furniture: "none", label: "Toilets" }),
  classroom("west", "west", box(150, 413, 224, 520), 1),
  hall("back", "back", box(228, 340, 336, 520), 1),
  // The back right corner keeps the shapes drawn on the sign, as in A1
  classroom("north", "back right", trace([380, 340], [488, 340], [488, 412], [471, 429], [380, 429]), 2),
  classroom("corner", "back right corner", box(492, 340, 564, 409), 1),
  classroom("east", "east", trace([492, 413], [564, 413], [564, 520], [475, 520], [475, 430]), 1),
  room("stairs", "Stairs", "stairs", box(433, 433, 472, 502), 2),
  // Front half
  classroom("front-west", "front west", box(150, 567, 235, 677), 1),
  classroom("front-corner", "front left corner", box(150, 681, 217, 754), 1),
  classroom("front", "front", box(221, 681, 334, 754), 0),
  room("stairs-lifts", "Stairs beside the lifts", "stairs", box(239, 587, 283, 661), 2, { label: "Stairs" }),
  room("lifts", "Lift lobby", "service", box(286, 587, 334, 661), 2, { furniture: "none", label: "Lifts" }),
  hall("front", "front", box(380, 567, 488, 754), 3),
  classroom("study-1", "front east 1", box(492, 567, 564, 660), 1),
  classroom("study-2", "front east 2", box(492, 664, 564, 754), 1),
  ];
}

export const aBlockPlannedGround = (place: "A2" | "A4" | "A5"): Level => ({
  id: "G",
  label: "Ground floor",
  short: "G",
  title: "Lecture halls and classrooms",
  spaces: spaces(place),
  holes: [],
  note: "Traced from the fire evacuation plan posted in the block. Simplified, and the bottom of the sign is drawn as the front. " + (place === "A4" ? "The plan shows no room numbers, so these are assumed." : "The plan shows no room numbers."),
});
