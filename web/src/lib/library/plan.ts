import { LIBRARY_ROOMS, type LibraryRoom, type Wing } from "./rooms.ts";

/**
 * A schematic floor plan: where each room sits relative to the learning commons. It is NOT to scale and the real
 * building may differ. It exists so a booking can show which wing and level a room is in.
 */

export type PlanRoom = { id: string; x: number; y: number; w: number; h: number };
export type FloorPlan = { level: 2 | 3; width: number; height: number; rooms: PlanRoom[]; commons: { x: number; y: number; w: number; h: number; label: string }; wings: { wing: Wing; x: number; y: number; label: string }[] };

const W = 360;
const H = 232;

const row = (rooms: LibraryRoom[], y: number, h: number, x0 = 56, x1 = 304): PlanRoom[] => {
  const w = (x1 - x0) / rooms.length;
  return rooms.map((r, i) => ({ id: r.id, x: x0 + i * w + 1, y, w: w - 2, h }));
};
const column = (rooms: LibraryRoom[], x: number, w: number, y0 = 52, y1 = 180): PlanRoom[] => {
  const h = (y1 - y0) / rooms.length;
  return rooms.map((r, i) => ({ id: r.id, x, y: y0 + i * h + 1, w, h: h - 2 }));
};
const inWing = (level: 2 | 3, wing: Wing) => LIBRARY_ROOMS.filter((r) => r.level === level && r.wing === wing);

export function floorPlan(level: 2 | 3): FloorPlan {
  if (level === 2) {
    return {
      level, width: W, height: H,
      rooms: [
        ...row(inWing(2, "North"), 14, 30),
        ...row(inWing(2, "South"), 188, 30),
        ...column(inWing(2, "West"), 14, 32),
        ...column(inWing(2, "East"), 314, 32),
      ],
      commons: { x: 56, y: 52, w: 248, h: 128, label: "Learning commons" },
      wings: [{ wing: "North", x: 180, y: 9, label: "North wing" }, { wing: "South", x: 180, y: 228, label: "South wing" }, { wing: "West", x: 30, y: 116, label: "W" }, { wing: "East", x: 330, y: 116, label: "E" }],
    };
  }
  // Level 3: the student success rooms in the west wing, the rest of the floor left open.
  return {
    level, width: W, height: H,
    rooms: column(inWing(3, "West"), 14, 62, 20, 212),
    commons: { x: 88, y: 20, w: 258, h: 192, label: "Level 3 reading area" },
    wings: [{ wing: "West", x: 45, y: 226, label: "West wing" }],
  };
}
