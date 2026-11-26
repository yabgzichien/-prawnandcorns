import { COURSE_BY_ID, type ClassSession } from "../data/academics.ts";
import { overlaps } from "./time.ts";

// ──────────────────────────────────────────────────────────
// ALL DATA IN THIS FILE IS INVENTED FOR THE DEMO.
// The cohort, its programmes and sections, the lecturer's other teaching and
// room use are made up and generated the same way every time.
// ──────────────────────────────────────────────────────────

/** A stretch of time someone or something is busy this week. `day` is days from Monday 23 Nov 2026. */
export type Block = { day: number; start: string; end: string; label: string; room?: string };

export const LECTURER = {
  name: "Dr. Lim (demo)",
  courseId: "cst1101",
  /** The lecturer's own sessions of this course, by the ids in the student timetable. */
  sessionIds: ["c1", "c6", "c11"],
  /** The lecturer's other duties this week. */
  other: [
    { day: 1, start: "14:00", end: "16:00", label: "CST2105 Web Programming lecture", room: "A2-305" },
    { day: 2, start: "16:00", end: "17:00", label: "Faculty meeting" },
    { day: 3, start: "11:00", end: "13:00", label: "CST2105 Web Programming lab", room: "A5-L1" },
  ] satisfies Block[],
};

/** Sections of the other courses the cohort takes, with this week's times. */
const SECTIONS: Record<string, Block[]> = {
  "MAT1101 Lecture": [{ day: 1, start: "09:00", end: "11:00", label: "MAT1101 Lecture", room: "A3-G01" }],
  // Tutorial group 1 lost Monday's class; this week it meets for the make-up on Thursday instead.
  "MAT1101 Tutorial 1": [{ day: 3, start: "10:00", end: "12:00", label: "MAT1101 Tutorial", room: "A2-104" }],
  "MAT1101 Tutorial 2": [{ day: 2, start: "16:00", end: "18:00", label: "MAT1101 Tutorial", room: "A2-104" }],
  "CST1103 Lecture": [{ day: 1, start: "14:00", end: "16:00", label: "CST1103 Lecture", room: "A4-301" }],
  "CST1103 Lab 1": [{ day: 3, start: "14:00", end: "16:00", label: "CST1103 Lab", room: "A5-L3" }],
  "CST1103 Lab 2": [{ day: 4, start: "16:00", end: "18:00", label: "CST1103 Lab", room: "A5-L3" }],
  "ENG1101 Group 1": [
    { day: 0, start: "16:00", end: "18:00", label: "ENG1101 Lecture", room: "A3-G01" },
    { day: 4, start: "09:00", end: "11:00", label: "ENG1101 Lecture", room: "A3-201" },
  ],
  "ENG1101 Group 2": [
    { day: 1, start: "11:00", end: "13:00", label: "ENG1101 Lecture", room: "A3-201" },
    { day: 3, start: "16:00", end: "18:00", label: "ENG1101 Lecture", room: "A3-201" },
  ],
  "GEN1201 Malaysian Studies": [{ day: 2, start: "14:00", end: "16:00", label: "GEN1201 Lecture", room: "A3-G01" }],
  "GE Chinese Culture": [{ day: 3, start: "11:00", end: "13:00", label: "GE Chinese Culture", room: "A2-305" }],
  "GE Design Thinking": [{ day: 5, start: "09:00", end: "12:00", label: "GE Design Thinking", room: "A2-305" }],
  "SWE1101 Lecture": [{ day: 2, start: "14:00", end: "16:00", label: "SWE1101 Lecture", room: "A2-203" }],
  "SWE1101 Tutorial": [{ day: 3, start: "11:00", end: "12:00", label: "SWE1101 Tutorial", room: "A1-102" }],
  "DSC1101 Lecture": [{ day: 1, start: "16:00", end: "18:00", label: "DSC1101 Lecture", room: "A2-203" }],
  "DSC1101 Lab": [{ day: 3, start: "16:00", end: "18:00", label: "DSC1101 Lab", room: "A5-L1" }],
  "Co-curriculum Wednesday": [{ day: 2, start: "08:00", end: "10:00", label: "Co-curricular activity" }],
  "Co-curriculum Thursday": [{ day: 3, start: "18:00", end: "20:00", label: "Co-curricular activity" }],
  "Co-curriculum Saturday": [{ day: 5, start: "08:00", end: "11:00", label: "Co-curricular activity" }],
  "MAT1105 Statistics": [
    { day: 2, start: "16:00", end: "18:00", label: "MAT1105 Lecture", room: "A1-210" },
    { day: 4, start: "11:00", end: "13:00", label: "MAT1105 Lecture", room: "A1-210" },
  ],
};

const CO_CURRICULUM = ["Co-curriculum Wednesday", "Co-curriculum Thursday", "Co-curriculum Saturday"];

/** Each programme takes one section from each group, in order. */
const PROGRAMMES: { name: string; count: number; groups: string[][] }[] = [
  {
    name: "BSc Computer Science", count: 16, groups: [
      ["MAT1101 Lecture"], ["MAT1101 Tutorial 1", "MAT1101 Tutorial 2"], ["CST1103 Lecture"], ["CST1103 Lab 1", "CST1103 Lab 2"],
      ["ENG1101 Group 1", "ENG1101 Group 2"], ["GEN1201 Malaysian Studies", "GE Chinese Culture", "GE Design Thinking"], CO_CURRICULUM,
    ],
  },
  {
    name: "BSc Software Engineering", count: 11, groups: [
      ["MAT1101 Lecture"], ["MAT1101 Tutorial 1", "MAT1101 Tutorial 2"], ["SWE1101 Lecture"], ["SWE1101 Tutorial"],
      ["ENG1101 Group 1", "ENG1101 Group 2"], ["GEN1201 Malaysian Studies", "GE Chinese Culture", "GE Design Thinking"], CO_CURRICULUM,
    ],
  },
  {
    name: "BSc Data Science", count: 9, groups: [
      ["DSC1101 Lecture"], ["DSC1101 Lab"], ["MAT1105 Statistics"], ["ENG1101 Group 1", "ENG1101 Group 2"],
      ["GEN1201 Malaysian Studies", "GE Chinese Culture", "GE Design Thinking"], CO_CURRICULUM,
    ],
  },
];

/** A small, stable hash, so the invented cohort is the same on every load and in tests. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export type Student = { key: string; programme: string; blocks: Block[]; isDemoStudent: boolean };

/** Turns the demo student's timetable into busy blocks. Cancelled classes are free time. */
export function blocksFromClasses(classes: readonly ClassSession[], skipSessionId?: string): Block[] {
  return classes
    .filter((c) => c.status !== "cancelled" && c.id !== skipSessionId)
    .map((c) => ({ day: c.day, start: c.start, end: c.end, label: `${COURSE_BY_ID[c.courseId]?.code ?? c.courseId} ${c.kind}`, room: c.room }));
}

/** Every student in the course: the demo student (from their real demo timetable) and 35 invented classmates. */
export function buildCohort(courseClasses: readonly ClassSession[], demoClasses: readonly ClassSession[], skipSessionId: string): Student[] {
  const shared = blocksFromClasses(courseClasses, skipSessionId);
  const out: Student[] = [{ key: "demo-student", programme: "BSc Computer Science", blocks: blocksFromClasses(demoClasses, skipSessionId), isDemoStudent: true }];
  let n = 0;
  for (const p of PROGRAMMES) {
    for (let i = 0; i < p.count; i++) {
      const key = `s${++n}`;
      if (p.name === "BSc Computer Science" && i === 0) continue; // that place is the demo student
      const blocks: Block[] = [...shared];
      for (const group of p.groups) {
        const startAt = hash(`${key}:${group[0]}`) % group.length;
        for (let k = 0; k < group.length; k++) {
          const section = SECTIONS[group[(startAt + k) % group.length]];
          if (!section.some((b) => blocks.some((x) => overlaps(b, x)))) { blocks.push(...section); break; }
        }
      }
      out.push({ key, programme: p.name, blocks, isDemoStudent: false });
    }
  }
  return out;
}

export const COHORT_SIZE = PROGRAMMES.reduce((s, p) => s + p.count, 0);

/** Rooms the desk may offer, by the kind of class. */
export const CANDIDATE_ROOMS: Record<ClassSession["kind"], string[]> = {
  Lecture: ["A3-G02", "A2-203", "A4-301", "A3-201"],
  Tutorial: ["A4-105", "A2-104", "A1-102", "A1-210", "A3-201", "A4-301"],
  Lab: ["A5-L2", "A5-L1"],
};

/** Every room booked this week by a known section, the lecturer's duties or the demo timetable. */
export function knownRoomUse(demoClasses: readonly ClassSession[]): Block[] {
  return [
    ...Object.values(SECTIONS).flat(),
    ...LECTURER.other,
    ...blocksFromClasses(demoClasses),
  ].filter((b) => b.room);
}

/** Invented bookings by other departments: about a third of each room's hours are taken, more around midday. */
export function roomTakenByOthers(room: string, day: number, hour: number): boolean {
  const busy = hour >= 10 && hour < 15 ? 38 : 24;
  return hash(`${room}|${day}|${hour}`) % 100 < busy;
}
