import { CLASSES, COURSE_BY_ID, type Assignment, type ClassSession } from "../data/academics.ts";
import { EXAMS, examName, phaseOfDate, SEMESTER_1, type Exam } from "../calendar/semester.ts";
import { addDays, dateLabel, isTime, weekdayOf } from "../events/checks.ts";
import { isDate, slotWindow, ymd, type LibraryBooking } from "../library/policy.ts";
import { LIBRARY_ROOM_BY_ID } from "../library/rooms.ts";
import type { StudySession } from "../planning.ts";
import { DEMO_NOW, WEEK_START, timeOf } from "../time.ts";
import type { PersonalEvent } from "../updates/types.ts";
import type { EventFields } from "./read.ts";

/**
 * Does an event fit? Plain code decides, from the student's own timetable and plans. The assistant may fill
 * in the event's fields, but it never decides the answer, and a pasted instruction cannot change it.
 */

export type BusyKind = "class" | "exam" | "study" | "plan" | "booking";
export type Busy = { kind: BusyKind; label: string; date: string; start: string; end: string };
export type FitWarning = { kind: "near" | "deadline" | "exam" | "phase"; text: string };
export type Verdict = "free" | "tight" | "clash" | "past" | "incomplete";

export type FitResult = {
  verdict: Verdict;
  /** One sentence, the same everywhere the answer is shown. */
  headline: string;
  clashes: Busy[];
  warnings: FitWarning[];
  /** Everything else that day, for the day strip. */
  day: Busy[];
};

export type FitSources = {
  now?: Date;
  /** This week's classes as Compass shows them: cancellations, room changes and lecturers' replacement classes applied. */
  thisWeek?: readonly ClassSession[];
  studySessions?: readonly StudySession[];
  personalEvents?: readonly PersonalEvent[];
  bookings?: readonly LibraryBooking[];
  assignments?: readonly Assignment[];
  exams?: readonly Exam[];
};

const NEAR_MINUTES = 30;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+08:00`);
const DEMO_WEEK = ymd(WEEK_START.getTime());

const classLabel = (c: ClassSession) => `${COURSE_BY_ID[c.courseId]?.code ?? c.courseId} ${c.kind}${c.status === "makeup" ? (c.replacementId ? " (replacement)" : " (make-up)") : ""}, ${c.room}`;

/** Classes on a date. This week uses the timetable as it is now; other teaching weeks use the normal weekly classes. */
export function classesOnDate(date: string, thisWeek: readonly ClassSession[] = CLASSES): ClassSession[] {
  if (!isDate(date)) return [];
  const day = (weekdayOf(date) + 6) % 7; // Monday is 0
  if (date >= DEMO_WEEK && date <= addDays(DEMO_WEEK, 6)) return thisWeek.filter((c) => c.day === day && c.status !== "cancelled");
  if (phaseOfDate(date).phase !== "teaching") return [];
  // A cancellation, a moved room or a make-up belongs to this week only.
  return CLASSES.filter((c) => c.day === day && c.status !== "makeup").map((c) => (c.status === "room-changed" && c.originalRoom ? { ...c, room: c.originalRoom, status: "normal" as const } : { ...c, status: "normal" as const }));
}

/** Everything the student already has on a date, in time order. */
export function busyOn(date: string, s: FitSources): Busy[] {
  const out: Busy[] = [];
  for (const c of classesOnDate(date, s.thisWeek)) out.push({ kind: "class", label: classLabel(c), date, start: c.start, end: c.end });
  for (const e of s.exams ?? EXAMS) if (ymd(Date.parse(e.start)) === date) out.push({ kind: "exam", label: `${examName(e)}, ${e.room}`, date, start: timeOf(new Date(e.start)), end: timeOf(new Date(e.end)) });
  for (const x of s.studySessions ?? []) if (ymd(Date.parse(x.start)) === date) out.push({ kind: "study", label: `Study: ${x.title}`, date, start: timeOf(new Date(x.start)), end: timeOf(new Date(x.end)) });
  for (const p of s.personalEvents ?? []) if (ymd(Date.parse(p.start)) === date) out.push({ kind: "plan", label: p.title, date, start: timeOf(new Date(p.start)), end: timeOf(new Date(p.end)) });
  for (const b of s.bookings ?? []) if (b.date === date) {
    const w = slotWindow(b.date, b.slot);
    out.push({ kind: "booking", label: `Library room ${LIBRARY_ROOM_BY_ID[b.roomId]?.name ?? b.roomId}`, date, start: w.start.slice(11, 16), end: w.end.slice(11, 16) });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

const hoursPhrase = (mins: number) => mins < 60 ? `${mins} minutes` : mins < 60 * 36 ? `${Math.round(mins / 60)} hours` : `${Math.round(mins / 1440)} days`;

export function checkEventFit(f: Pick<EventFields, "date" | "start" | "end">, s: FitSources = {}): FitResult {
  const now = s.now ?? DEMO_NOW;
  if (!isDate(f.date) || !isTime(f.start) || !isTime(f.end) || toMin(f.end) <= toMin(f.start)) {
    return { verdict: "incomplete", headline: "Add the date and the start time to check it.", clashes: [], warnings: [], day: [] };
  }
  const start = at(f.date, f.start);
  const end = at(f.date, f.end);
  const day = busyOn(f.date, s);
  if (end <= now) return { verdict: "past", headline: `This was on ${dateLabel(f.date)}, so it has already happened.`, clashes: [], warnings: [], day };

  const a = toMin(f.start);
  const b = toMin(f.end);
  const clashes = day.filter((x) => toMin(x.start) < b && a < toMin(x.end));
  const warnings: FitWarning[] = [];

  for (const x of day) {
    if (clashes.includes(x)) continue;
    const gapBefore = a - toMin(x.end);
    const gapAfter = toMin(x.start) - b;
    if (gapBefore >= 0 && gapBefore <= NEAR_MINUTES) warnings.push({ kind: "near", text: `Straight after ${x.label}, which ends at ${x.end}.` });
    else if (gapAfter >= 0 && gapAfter <= NEAR_MINUTES) warnings.push({ kind: "near", text: `Right before ${x.label} at ${x.start}.` });
  }

  for (const asg of s.assignments ?? []) {
    if (asg.status === "submitted") continue;
    const due = new Date(asg.due);
    const after = Math.round((due.getTime() - end.getTime()) / 60_000);
    const during = due >= start && due <= end;
    const major = asg.weight >= 10;
    if (due < now) continue;
    if (during || (after > 0 && after <= (major ? 48 : 24) * 60)) {
      const code = COURSE_BY_ID[asg.courseId]?.code ?? asg.courseId;
      warnings.push({ kind: "deadline", text: `${asg.title} (${code}, ${asg.weight}%) is due ${dateLabel(ymd(due.getTime()))} at ${timeOf(due)}, ${during ? "during the event" : `${hoursPhrase(after)} after it ends`}.` });
    }
  }

  for (const e of s.exams ?? EXAMS) {
    const after = Math.round((Date.parse(e.start) - end.getTime()) / 60_000);
    if (after > 0 && after <= 48 * 60) {
      const next = ymd(Date.parse(e.start)) === addDays(f.date, 1);
      warnings.push({ kind: "exam", text: `Your ${examName(e)} is ${next ? "the next day" : `${hoursPhrase(after)} later`}, ${dateLabel(ymd(Date.parse(e.start)))} at ${timeOf(new Date(e.start))}.` });
    }
  }

  const phase = phaseOfDate(f.date).phase;
  if (phase === "revision") warnings.push({ kind: "phase", text: `It is in revision week. Exams start ${dateLabel(SEMESTER_1.exams.start)}.` });
  if (phase === "exams") warnings.push({ kind: "phase", text: "It is during the exam weeks." });

  const when = `${dateLabel(f.date)}, ${f.start} to ${f.end}`;
  if (clashes.length) {
    const first = clashes[0];
    return { verdict: "clash", headline: `It clashes with ${first.label} (${first.start} to ${first.end})${clashes.length > 1 ? ` and ${clashes.length - 1} more` : ""}.`, clashes, warnings, day };
  }
  if (warnings.length) return { verdict: "tight", headline: `You are free ${when}, but check ${warnings.length === 1 ? "one thing" : `${warnings.length} things`} first.`, clashes, warnings, day };
  return { verdict: "free", headline: `You are free ${when}. Nothing clashes.`, clashes, warnings, day };
}
