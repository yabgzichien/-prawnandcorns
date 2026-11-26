import { addDays, dateLabel, dayMs, daysBetween } from "../events/checks.ts";
import { ymd } from "../library/policy.ts";
import { COURSE_BY_ID } from "../data/academics.ts";

// ──────────────────────────────────────────────────────────
// THE SEMESTER DATES AND THE EXAM TIMETABLE ARE INVENTED FOR THE DEMO.
// They are not the university's academic calendar.
// ──────────────────────────────────────────────────────────

/** Semester 1, demo dates. Week 1 starts Monday 21 September 2026, so the demo's Monday 23 November is week 10. */
export const SEMESTER_1 = {
  name: "Semester 1",
  week1: "2026-09-21",
  teachingWeeks: 14,
  /** Revision week, Monday to Sunday. */
  revision: { start: "2026-12-28", end: "2027-01-03" },
  /** Final exams, Monday of the first exam week to Sunday of the second. */
  exams: { start: "2027-01-04", end: "2027-01-17" },
  /** Semester 2 starts here, the date the GE planner uses. */
  next: "2027-03-01",
} as const;

export type Phase = "before" | "teaching" | "revision" | "exams" | "break";

export type SemesterStatus = {
  phase: Phase;
  /** Teaching week 1 to 14, only while teaching. */
  week?: number;
  /** "Week 10 of 14", "Revision week", "Exam weeks", "Semester break". */
  label: string;
  /** One sentence about what comes next. */
  detail: string;
};

const SEM = SEMESTER_1;
const lastTeachingDay = addDays(SEM.week1, SEM.teachingWeeks * 7 - 1);

/** The phase of a calendar date (YYYY-MM-DD, Malaysia time). */
export function phaseOfDate(date: string): { phase: Phase; week?: number } {
  if (date < SEM.week1) return { phase: "before" };
  if (date <= lastTeachingDay) return { phase: "teaching", week: Math.floor(daysBetween(SEM.week1, date) / 7) + 1 };
  if (date >= SEM.revision.start && date <= SEM.revision.end) return { phase: "revision" };
  if (date >= SEM.exams.start && date <= SEM.exams.end) return { phase: "exams" };
  return { phase: "break" };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Where the semester is at a moment, in words. */
export function semesterStatus(now: Date, exams: readonly Exam[] = EXAMS): SemesterStatus {
  const today = ymd(now.getTime());
  const { phase, week } = phaseOfDate(today);
  const next = exams.filter((e) => new Date(e.end) > now).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (phase === "teaching" && week) {
    const left = SEM.teachingWeeks - week;
    const detail = left === 0
      ? `Last teaching week. Revision week starts ${dateLabel(SEM.revision.start)}, and exams start ${dateLabel(SEM.exams.start)}.`
      : `${plural(left, "teaching week")} left after this one. Revision week starts ${dateLabel(SEM.revision.start)}.`;
    return { phase, week, label: `Week ${week} of ${SEM.teachingWeeks}`, detail };
  }
  if (phase === "revision") return { phase, label: "Revision week", detail: `No classes this week. Exams start ${dateLabel(SEM.exams.start)}.` };
  if (phase === "exams") return { phase, label: "Exam weeks", detail: next ? `Next exam: ${examName(next)}, ${dateLabel(next.start.slice(0, 10))} at ${next.start.slice(11, 16)}.` : "No more exams. Well done." };
  if (phase === "before") return { phase, label: "Before the semester", detail: `Week 1 starts ${dateLabel(SEM.week1)}.` };
  return { phase, label: "Semester break", detail: `Semester 2 starts ${dateLabel(SEM.next)}.` };
}

export type Exam = {
  id: string;
  courseId: string;
  kind: "Midterm" | "Final";
  /** ISO 8601 with +08:00 */
  start: string;
  end: string;
  room: string;
  /** Share of the course mark, from the course's assessment line. */
  weight: number;
};

/** Invented exam timetable. It follows each course's assessment: Academic English has no final exam. */
export const EXAMS: Exam[] = [
  { id: "x-mat-mid", courseId: "mat1101", kind: "Midterm", start: "2026-12-03T10:00:00+08:00", end: "2026-12-03T11:30:00+08:00", room: "A3-G01", weight: 30 },
  { id: "x-cst1101", courseId: "cst1101", kind: "Final", start: "2027-01-05T09:00:00+08:00", end: "2027-01-05T11:00:00+08:00", room: "B1 Hall", weight: 40 },
  { id: "x-mat1101", courseId: "mat1101", kind: "Final", start: "2027-01-07T14:00:00+08:00", end: "2027-01-07T16:00:00+08:00", room: "B1 Hall", weight: 50 },
  { id: "x-cst1103", courseId: "cst1103", kind: "Final", start: "2027-01-11T09:00:00+08:00", end: "2027-01-11T12:00:00+08:00", room: "B1 Hall", weight: 60 },
  { id: "x-gen1201", courseId: "gen1201", kind: "Final", start: "2027-01-13T14:00:00+08:00", end: "2027-01-13T16:00:00+08:00", room: "A3-G01", weight: 60 },
];

/** "MAT1101 Calculus I midterm" */
export const examName = (e: Exam): string => `${COURSE_BY_ID[e.courseId]?.code ?? e.courseId} ${COURSE_BY_ID[e.courseId]?.title ?? ""} ${e.kind === "Midterm" ? "midterm" : "final exam"}`.replace(/\s+/g, " ");

/** Whole days from one date to another, in Malaysia time. */
export const calendarDaysUntil = (now: Date, iso: string): number => Math.round((dayMs(ymd(Date.parse(iso))) - dayMs(ymd(now.getTime()))) / 86_400_000);
