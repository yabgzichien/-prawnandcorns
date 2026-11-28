import { box, cell, COL, room, ROW } from "./a-block-upper.ts";
import type { Level, Space } from "./interiors.ts";

/**
 * Block A5's Levels 1 to 5, from the fire evacuation plan posted in the building (team photos, November 2026). A5 is a
 * lab block, so its floors differ from the other A blocks; they sit on the same grid so every block lines up.
 * Simplified like the others: porches on Level 1 only, stairs and lifts kept, no round centre feature and no small
 * service rooms. Small clusters of rooms are drawn as fewer, tidier ones.
 *
 * The plans show room uses, not numbers. A5-L1, A5-L2 (computing labs) and A5-L3 (electronics lab) are the demo
 * timetable's rooms, placed on Level 1 and Level 2 by assumption, as are the Level 1 classroom numbers.
 */

type Side = "top" | "right" | "bottom" | "left";
type Shape = Space["shape"];

const SIDE_ROWS = { upper: [637, 806], lower: [810, 981] } as const;
const TOP = ROW.top;
const BOTTOM = ROW.bottom;
const INNER = { top: [637, 743], bottom: [872, 981] } as const;
const across = (x0: number, x1: number, row: readonly [number, number]) => box(x0, row[0], x1, row[1]);

function lab(id: string, name: string, label: string, shape: Shape, side: Side): Space {
  return room(id, name, "lab", shape, side, { furniture: "desks", label });
}
const office = (id: string, name: string, shape: Shape, side: Side) => room(id, name, "office", shape, side, { furniture: "desk", label: "Office" });
const coded = (code: string, name: string, kind: Space["kind"], shape: Shape, side: Side) =>
  room(code, name, kind, shape, side, { code, furniture: "desks", assumed: true, detail: "Placed here by assumption. The plan shows no room numbers." });
const porch = (side: string, shape: Shape): Space => ({ id: `A5-1-porch-${side}`, name: `Porch, ${side}`, kind: "porch", shape, label: "Porch" });
const toilets = (level: number) => room(`A5-${level}-toilets`, "Toilets, ladies and gents", "service", cell(COL.west, ROW.top), "right", { furniture: "none", label: "Toilets" });

const core = (level: number): Space[] => [
  room(`A5-${level}-stairs`, "Stairs", "stairs", across(COL.c3[0], 1275, INNER.top), "bottom"),
  room(`A5-${level}-stairs-lifts`, "Stairs beside the lifts", "stairs", across(COL.c1[0], COL.c1[1], INNER.bottom), "bottom", { label: "Stairs" }),
  room(`A5-${level}-lifts`, "Lift lobby", "service", across(COL.c2[0], COL.c2[1], INNER.bottom), "bottom", { furniture: "none", label: "Lifts" }),
];

const NOTE = "Traced from the fire evacuation plan posted in the block. Simplified, and room numbers are not on the plan.";
const level = (n: number, title: string, spaces: Space[]): Level => ({ id: String(n), label: `Level ${n}`, short: String(n), title, holes: [], note: NOTE, spaces });

const classroom = (n: number, shape: Shape, side: Side) => coded(`A5-10${n}`, `Classroom 10${n}`, "classroom", shape, side);

const first = level(1, "Computing labs, classrooms and offices", [
  toilets(1),
  office("A5-1-office-back-1", "Office, back 1", cell(COL.c1, ROW.top), "bottom"),
  office("A5-1-office-back-2", "Office, back 2", cell(COL.c2, ROW.top), "bottom"),
  porch("back", across(1064, 1124, TOP)),
  classroom(1, across(1128, 1228, TOP), "bottom"),
  classroom(2, across(1232, 1332, TOP), "bottom"),
  classroom(3, across(1336, 1433, TOP), "bottom"),
  coded("A5-L2", "Computing Lab 2", "lab", cell(COL.west, ROW.upper), "right"),
  porch("left", cell(COL.west, ROW.porch)),
  coded("A5-L1", "Computing Lab 1", "lab", cell(COL.west, ROW.lower), "right"),
  office("A5-1-office-east", "Office, east", box(COL.east[0], 637, COL.east[1], 668), "left"),
  classroom(4, box(COL.east[0], 672, COL.east[1], 775), "left"),
  porch("right", cell(COL.east, ROW.porch)),
  classroom(5, cell(COL.east, ROW.lower), "left"),
  room("A5-1-meeting", "Meeting Room", "office", across(COL.c1[0], COL.c2[1], INNER.top), "bottom", { furniture: "tables", label: "Meeting" }),
  ...core(1),
  office("A5-1-office-front-left-1", "Office, front left 1", box(COL.west[0], 1012, COL.west[1], 1076), "right"),
  office("A5-1-office-front-left-2", "Office, front left 2", box(COL.west[0], 1080, COL.west[1], 1145), "right"),
  office("A5-1-office-front-1", "Office, front 1", cell(COL.c1, ROW.bottom), "top"),
  office("A5-1-office-front-2", "Office, front 2", cell(COL.c2, ROW.bottom), "top"),
  porch("front", across(1064, 1124, BOTTOM)),
  classroom(6, across(1128, 1292, BOTTOM), "top"),
  office("A5-1-office-front-right-1", "Office, front right 1", box(COL.east[0], 1012, COL.east[1], 1076), "left"),
  office("A5-1-office-front-right-2", "Office, front right 2", box(COL.east[0], 1080, COL.east[1], 1145), "left"),
]);

const equipment = (id: string, where: string, shape: Shape, side: Side) => lab(`A5-${id}`, `Lab Equipment Room, ${where}`, "Equipment", shape, side);

const second = level(2, "Lab equipment rooms", [
  toilets(2),
  equipment("2-back-1", "back 1", across(896, 1092, TOP), "bottom"),
  equipment("2-back-2", "back 2", across(1096, 1292, TOP), "bottom"),
  equipment("2-back-3", "back corner", across(1296, 1433, TOP), "bottom"),
  coded("A5-L3", "Electronics Lab 3", "lab", cell(COL.west, SIDE_ROWS.upper), "right"),
  equipment("2-west", "west", cell(COL.west, SIDE_ROWS.lower), "right"),
  equipment("2-east-1", "east 1", cell(COL.east, SIDE_ROWS.upper), "left"),
  equipment("2-east-2", "east 2", cell(COL.east, SIDE_ROWS.lower), "left"),
  lab("A5-2-sample", "Sample Room", "Sample", across(896, 964, INNER.top), "top"),
  { ...equipment("2-inner", "inner", across(968, 1036, INNER.top), "top"), label: "Equip." },
  office("A5-2-office", "Office", across(1040, 1108, INNER.top), "top"),
  equipment("2-inner-front", "inner front", across(COL.c3[0], 1275, INNER.bottom), "bottom"),
  ...core(2),
  equipment("2-front-1", "front left", across(COL.west[0], COL.west[1], BOTTOM), "top"),
  equipment("2-front-2", "front 1", across(896, 1092, BOTTOM), "top"),
  equipment("2-front-3", "front 2", across(1096, 1292, BOTTOM), "top"),
  equipment("2-front-4", "front right", across(1296, 1433, BOTTOM), "top"),
]);

/** Levels 3 and 4 share their sides and middle: process rooms, three offices and the marine study lab. */
const middle = (n: 3 | 4): Space[] => [
  toilets(n),
  lab(`A5-${n}-process-1`, "Process Room, west 1", "Process", cell(COL.west, SIDE_ROWS.upper), "right"),
  lab(`A5-${n}-process-2`, "Process Room, west 2", "Process", cell(COL.west, SIDE_ROWS.lower), "right"),
  lab(`A5-${n}-process-3`, "Process Room, east 1", "Process", cell(COL.east, SIDE_ROWS.upper), "left"),
  lab(`A5-${n}-process-4`, "Process Room, east 2", "Process", cell(COL.east, SIDE_ROWS.lower), "left"),
  office(`A5-${n}-office-1`, "Office, inner 1", across(896, 964, INNER.top), "top"),
  office(`A5-${n}-office-2`, "Office, inner 2", across(968, 1036, INNER.top), "top"),
  office(`A5-${n}-office-3`, "Office, inner 3", across(1040, 1108, INNER.top), "top"),
  lab(`A5-${n}-marine-study`, "Marine Study Lab", "Marine study", across(COL.c3[0], 1275, INNER.bottom), "bottom"),
  ...core(n),
];

const third = level(3, "Marine, molecule and sample labs", [
  ...middle(3),
  lab("A5-3-preservation", "Preservation Lab", "Preserv.", across(896, 976, TOP), "bottom"),
  equipment("3-back-1", "back 1", across(980, 1092, TOP), "bottom"),
  equipment("3-back-2", "back 2", across(1096, 1208, TOP), "bottom"),
  lab("A5-3-sample-1", "Sample Room, 1", "Sample", across(1212, 1284, TOP), "bottom"),
  lab("A5-3-sample-2", "Sample Room, 2", "Sample", across(1288, 1360, TOP), "bottom"),
  lab("A5-3-sample-3", "Sample Room, 3", "Sample", across(1364, 1433, TOP), "bottom"),
  lab("A5-3-molecule-1", "Molecule Lab, 1", "Molecule", across(753, 862, BOTTOM), "top"),
  lab("A5-3-molecule-2", "Molecule Lab, 2", "Molecule", across(866, 976, BOTTOM), "top"),
  equipment("3-front-1", "front 1", across(980, 1092, BOTTOM), "top"),
  equipment("3-front-2", "front 2", across(1096, 1208, BOTTOM), "top"),
  lab("A5-3-marine-1", "Marine Lab, 1", "Marine", across(1212, 1284, BOTTOM), "top"),
  lab("A5-3-marine-2", "Marine Lab, 2", "Marine", across(1288, 1360, BOTTOM), "top"),
  lab("A5-3-marine-3", "Marine Lab, 3", "Marine", across(1364, 1433, BOTTOM), "top"),
]);

const fourth = level(4, "Processing, analysis and marine labs", [
  ...middle(4),
  lab("A5-4-preservation", "Preservation Lab", "Preserv.", across(896, 976, TOP), "bottom"),
  equipment("4-back", "back", across(980, 1092, TOP), "bottom"),
  lab("A5-4-processing", "Processing Lab", "Processing", across(1096, 1208, TOP), "bottom"),
  lab("A5-4-analysis-1", "Analysis Lab, 1", "Analysis", across(1212, 1320, TOP), "bottom"),
  lab("A5-4-analysis-2", "Analysis Lab, 2", "Analysis", across(1324, 1433, TOP), "bottom"),
  lab("A5-4-purification", "Purification Lab", "Purif.", across(896, 976, BOTTOM), "top"),
  equipment("4-front-1", "front 1", across(980, 1092, BOTTOM), "top"),
  equipment("4-front-2", "front 2", across(1096, 1208, BOTTOM), "top"),
  lab("A5-4-marine", "Marine Lab", "Marine", across(1212, 1292, BOTTOM), "top"),
]);

const fifth = level(5, "Meeting rooms, pump room and aquatic breeding", [
  room("A5-5-pump", "Cold water pump room", "service", cell(COL.west, SIDE_ROWS.upper), "right", { furniture: "none", label: "Pump room" }),
  room("A5-5-meeting-1", "Meeting Room, back", "office", across(COL.c1[0], COL.c2[1], INNER.top), "top", { furniture: "tables", label: "Meeting" }),
  room("A5-5-meeting-2", "Meeting Room, front", "office", across(COL.c3[0], 1275, INNER.bottom), "bottom", { furniture: "tables", label: "Meeting" }),
  lab("A5-5-aquatic", "Aquatic Breeding Room", "Aquatic", cell(COL.east, SIDE_ROWS.lower), "left"),
  ...core(5),
]);

export const A5_UPPER: Level[] = [first, second, third, fourth, fifth];
