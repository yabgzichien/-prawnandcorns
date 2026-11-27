import { COURSE_BY_ID, sessionDate, type Assignment, type ClassSession, type Tone } from "../data/academics.ts";
import { EVENTS, type Dues, type EventItem } from "../data/life.ts";
import { addDays, dateLabel } from "../events/checks.ts";
import { LIBRARY_ROOM_BY_ID, whereIs } from "../library/rooms.ts";
import { SLOTS, slotWindow, ymd, type LibraryBooking } from "../library/policy.ts";
import type { StudySession } from "../planning.ts";
import type { PersonalEvent, Reminder } from "../updates/types.ts";
import { DEMO_NOW } from "../time.ts";
import { EXAMS, SEMESTER_1, examName, type Exam } from "./semester.ts";

// ──────────────────────────────────────────────────────────────────────
// The master calendar: one list in time order, built only from data the app
// already holds. Nothing here is fetched, and the dates are the demo's.
// ──────────────────────────────────────────────────────────────────────

export type TimelineKind = "class" | "deadline" | "exam" | "fee" | "event" | "semester" | "saved";

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  /** The kind in words, so colour and icon are never the only signal. */
  label: string;
  title: string;
  detail: string;
  /** ISO 8601 with +08:00. For an all-day item this is midnight of the day. */
  start: string;
  end?: string;
  allDay: boolean;
  /** Malaysia calendar date of the start, YYYY-MM-DD. */
  date: string;
  href: string;
  tone: Tone;
  /** Cancelled and overdue are said in words on the row. */
  state?: "cancelled" | "changed" | "replacement" | "overdue";
  stateLabel?: string;
  /** True for things the student confirmed and this browser holds. */
  saved?: boolean;
};

export type TimelineInput = {
  now?: Date;
  classes: readonly ClassSession[];
  assignments: readonly Assignment[];
  /** Assignment ids the student ticked as done in Compass. */
  submitted: readonly string[];
  dues: readonly Dues[];
  currency: string;
  studySessions?: readonly StudySession[];
  reminders?: readonly Reminder[];
  personalEvents?: readonly PersonalEvent[];
  bookings?: readonly LibraryBooking[];
  exams?: readonly Exam[];
  events?: readonly EventItem[];
};

const MY = 8 * 3_600_000;
const myIso = (ms: number) => `${new Date(ms + MY).toISOString().slice(0, 19)}+08:00`;
const dayStart = (date: string) => `${date}T00:00:00+08:00`;
const hhmm = (iso: string) => iso.slice(11, 16);
const money = (n: number, currency: string) => `${currency} ${n.toLocaleString("en-MY")}`;

function classItems(classes: readonly ClassSession[]): TimelineItem[] {
  return classes.map((c) => {
    const course = COURSE_BY_ID[c.courseId];
    const { start, end } = sessionDate(c);
    const room = c.status === "room-changed" && c.originalRoom ? `${c.room}, moved from ${c.originalRoom}` : c.room;
    const state: Pick<TimelineItem, "state" | "stateLabel"> =
      c.status === "cancelled" ? { state: "cancelled", stateLabel: "Cancelled" }
      : c.status === "room-changed" ? { state: "changed", stateLabel: "Room changed" }
      : c.status === "makeup" ? { state: "replacement", stateLabel: c.replacementId ? "Replacement class" : "Make-up class" }
      : {};
    const iso = myIso(start.getTime());
    return {
      id: `class:${c.id}`, kind: "class", label: "Class", title: `${course?.code ?? c.courseId} ${c.kind}`,
      detail: `${course?.title ?? ""}${course ? ", " : ""}${room}`,
      start: iso, end: myIso(end.getTime()), allDay: false, date: iso.slice(0, 10), href: "/hub?section=timetable", tone: course?.tone ?? "blue", ...state,
    };
  });
}

function deadlineItems(assignments: readonly Assignment[], submitted: readonly string[], now: Date): TimelineItem[] {
  return assignments
    .filter((a) => a.status !== "submitted" && !submitted.includes(a.id))
    .map((a) => {
      const course = COURSE_BY_ID[a.courseId];
      const late = Date.parse(a.due) < now.getTime();
      return {
        id: `deadline:${a.id}`, kind: "deadline", label: "Deadline", title: a.title,
        detail: `${course?.code ?? a.courseId}, ${a.type}, ${a.weight}% of the course${late && a.note ? `. ${a.note}` : ""}`,
        start: a.due, allDay: false, date: ymd(Date.parse(a.due)), href: "/hub?section=assignments", tone: late ? "red" : course?.tone ?? "orange",
        ...(late ? { state: "overdue" as const, stateLabel: "Overdue" } : {}),
      };
    });
}

function examItems(exams: readonly Exam[]): TimelineItem[] {
  return exams.map((e) => ({
    id: `exam:${e.id}`, kind: "exam", label: e.kind === "Midterm" ? "Midterm" : "Final exam", title: examName(e),
    detail: `${e.room}, ${e.weight}% of the course`,
    start: e.start, end: e.end, allDay: false, date: e.start.slice(0, 10), href: "/hub?section=courses", tone: "red",
  }));
}

function feeItems(dues: readonly Dues[], currency: string, now: Date): TimelineItem[] {
  const today = ymd(now.getTime());
  return dues
    .filter((d) => d.status !== "paid")
    .map((d) => {
      const date = ymd(Date.parse(d.due));
      return {
        id: `fee:${d.id}`, kind: "fee", label: "Fee due", title: d.label,
        detail: `${money(d.amount, currency)}, shown from the demo fees data`,
        start: dayStart(date), allDay: true, date, href: "/hub?section=finance", tone: "orange",
        ...(date < today ? { state: "overdue" as const, stateLabel: "Overdue" } : {}),
      };
    });
}

function campusEventItems(events: readonly EventItem[]): TimelineItem[] {
  return events.map((e) => ({
    id: `event:${e.id}`, kind: "event", label: "Campus event", title: e.title,
    detail: e.where,
    start: `${e.date}T${e.start}:00+08:00`, end: `${e.date}T${e.end}:00+08:00`, allDay: false, date: e.date, href: "/hub?section=clubs", tone: "teal",
  }));
}

function semesterItems(): TimelineItem[] {
  const S = SEMESTER_1;
  return [
    { id: "semester:revision", date: S.revision.start, title: "Revision week begins", detail: `No classes until exams start on ${dateLabel(S.exams.start)}` },
    { id: "semester:exams", date: S.exams.start, title: "Exam weeks begin", detail: `Exams run until ${dateLabel(S.exams.end)}` },
    { id: "semester:next", date: S.next, title: "Semester 2 begins", detail: "Demo date, used by the elective planner" },
  ].map((m) => ({ ...m, kind: "semester" as const, label: "Semester", start: dayStart(m.date), allDay: true, href: "/hub?section=courses", tone: "purple" as const }));
}

function savedItems(input: Pick<TimelineInput, "studySessions" | "reminders" | "personalEvents" | "bookings">): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const s of input.studySessions ?? []) {
    out.push({ id: `saved:study:${s.id}`, kind: "saved", label: "Study session", title: s.title, detail: "From the study plan you confirmed", start: s.start, end: s.end, allDay: false, date: s.start.slice(0, 10), href: "/hub?section=assignments", tone: "blue", saved: true });
  }
  for (const r of input.reminders ?? []) {
    out.push({ id: `saved:reminder:${r.id}`, kind: "saved", label: "Reminder", title: r.title, detail: "Reminder you saved", start: r.at, allDay: false, date: r.at.slice(0, 10), href: "/hub?section=timetable", tone: "orange", saved: true });
  }
  for (const e of input.personalEvents ?? []) {
    out.push({ id: `saved:entry:${e.id}`, kind: "saved", label: "Calendar entry", title: e.title, detail: e.place ?? "Entry you saved", start: e.start, end: e.end, allDay: false, date: e.start.slice(0, 10), href: "/hub?section=timetable", tone: "blue", saved: true });
  }
  for (const b of input.bookings ?? []) {
    const room = LIBRARY_ROOM_BY_ID[b.roomId];
    if (!room || !SLOTS[b.slot]) continue;
    const w = slotWindow(b.date, b.slot);
    out.push({ id: `saved:booking:${b.id}`, kind: "saved", label: "Library booking", title: room.name, detail: `A3 ${whereIs(room)}`, start: w.start, end: w.end, allDay: false, date: b.date, href: "/hub?section=library", tone: "green", saved: true });
  }
  return out;
}

const order = (a: TimelineItem, b: TimelineItem) =>
  Date.parse(a.start) - Date.parse(b.start) || Number(b.allDay) - Number(a.allDay) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);

/** Everything that is going to happen, in time order. Past items are dropped by `groupTimeline`, not here. */
export function buildTimeline(input: TimelineInput): TimelineItem[] {
  const now = input.now ?? DEMO_NOW;
  return [
    ...classItems(input.classes),
    ...deadlineItems(input.assignments, input.submitted, now),
    ...examItems(input.exams ?? EXAMS),
    ...feeItems(input.dues, input.currency, now),
    ...campusEventItems(input.events ?? EVENTS),
    ...semesterItems(),
    ...savedItems(input),
  ].sort(order);
}

export type TimelineRange = "week" | "month" | "all";
export const RANGE_DAYS: Record<Exclude<TimelineRange, "all">, number> = { week: 7, month: 30 };

export type DayGroup = {
  key: string;
  label: string;
  /** Overdue things sit above the first day. */
  overdue?: boolean;
  isToday?: boolean;
  items: TimelineItem[];
  /** In today's group: where the "Now" line goes, as an index into `items`. */
  nowIndex?: number;
};

/** A timed item is past once it has ended (or started, if it has no end). All-day items are never past on their own day. */
export const isPast = (item: TimelineItem, now: Date = DEMO_NOW): boolean =>
  !item.allDay && Date.parse(item.end ?? item.start) < now.getTime();

export function dayLabel(date: string, today: string): string {
  if (date === today) return `Today, ${dateLabel(date)}`;
  if (date === addDays(today, 1)) return `Tomorrow, ${dateLabel(date)}`;
  return dateLabel(date);
}

/** Group by Malaysia day inside a range. Today's group always exists so the Now line has a place. */
export function groupTimeline(items: readonly TimelineItem[], now: Date = DEMO_NOW, range: TimelineRange = "month"): DayGroup[] {
  const today = ymd(now.getTime());
  const last = range === "all" ? "9999-12-31" : addDays(today, RANGE_DAYS[range] - 1);
  const overdue = items.filter((i) => i.state === "overdue" && i.date <= today && (i.date < today || isPast(i, now)));
  const overdueIds = new Set(overdue.map((i) => i.id));
  const inside = items.filter((i) => !overdueIds.has(i.id) && i.date >= today && i.date <= last);
  const days = new Map<string, TimelineItem[]>([[today, []]]);
  for (const i of inside) days.set(i.date, [...(days.get(i.date) ?? []), i]);

  const groups: DayGroup[] = [];
  if (overdue.length) groups.push({ key: "overdue", label: "Overdue", overdue: true, items: overdue });
  for (const date of [...days.keys()].sort()) {
    const list = days.get(date)!;
    const group: DayGroup = { key: date, label: dayLabel(date, today), items: list };
    if (date === today) {
      group.isToday = true;
      const at = list.findIndex((i) => !i.allDay && !isPast(i, now));
      group.nowIndex = at === -1 ? list.length : at;
    }
    groups.push(group);
  }
  return groups;
}

/** `hhmm` of an item for the time column: "All day" or "10:00" or "10:00 to 12:00". */
export function timeText(item: TimelineItem): string {
  if (item.allDay) return "All day";
  return item.end && item.end.slice(0, 10) === item.start.slice(0, 10) ? `${hhmm(item.start)} to ${hhmm(item.end)}` : hhmm(item.start);
}

// ──────────────────────────────────────────────────────────────────────
// Grid helpers for the week and month views.
// ──────────────────────────────────────────────────────────────────────

const toMin = (hhmmText: string) => Number(hhmmText.slice(0, 2)) * 60 + Number(hhmmText.slice(3, 5));
const MINUTES_PER_DAY = 24 * 60;
/** A reminder has no end, so the grid gives it a half hour block. */
export const POINT_BLOCK_MINUTES = 30;

/** Monday on or before a date. */
export function weekStartOf(date: string): string {
  const dow = (new Date(Date.parse(`${date}T12:00:00+08:00`) + MY).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}
export const daysFrom = (start: string, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(start, i));

/** First day of the month containing the date, and the first day of the month after `delta` months. */
export function monthStartOf(date: string, delta = 0): string {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}
export const monthLabel = (date: string): string => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** The weeks a Monday-first month grid shows: whole weeks, 5 or 6 rows. */
export function monthWeeks(anchor: string): string[][] {
  const first = monthStartOf(anchor);
  const nextFirst = monthStartOf(anchor, 1);
  const weeks: string[][] = [];
  for (let start = weekStartOf(first); start < nextFirst; start = addDays(start, 7)) weeks.push(daysFrom(start, 7));
  return weeks;
}

export const itemsOnDate = (items: readonly TimelineItem[], date: string): TimelineItem[] => items.filter((i) => i.date === date);

/** True when the item is drawn as a block with hours (it has a duration, or it is a reminder). Deadlines and all-day items go in the strip. */
export const isBlock = (item: TimelineItem): boolean => !item.allDay && item.kind !== "deadline";

export type GridBlock = { item: TimelineItem; startMin: number; endMin: number; lane: number; lanes: number };

/** Minutes of the day an item covers. An end on a later day is cut at midnight. */
function span(item: TimelineItem): { startMin: number; endMin: number } {
  const startMin = toMin(hhmm(item.start));
  const sameDay = item.end && item.end.slice(0, 10) === item.start.slice(0, 10);
  const endMin = item.end ? (sameDay ? toMin(hhmm(item.end)) : MINUTES_PER_DAY) : Math.min(MINUTES_PER_DAY, startMin + POINT_BLOCK_MINUTES);
  return { startMin, endMin: Math.max(endMin, startMin + 15) };
}

/** Blocks for one day. Overlapping blocks get their own lane so none sits under another. */
export function layoutDay(items: readonly TimelineItem[]): GridBlock[] {
  const sorted = items.filter(isBlock).map((item) => ({ item, ...span(item) })).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.item.id.localeCompare(b.item.id));
  const out: GridBlock[] = [];
  let cluster: GridBlock[] = [];
  let clusterEnd = -1;
  const flush = () => { const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1)); for (const b of cluster) b.lanes = lanes; out.push(...cluster); cluster = []; };
  for (const b of sorted) {
    if (cluster.length && b.startMin >= clusterEnd) flush();
    const taken = new Set(cluster.filter((x) => x.endMin > b.startMin).map((x) => x.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  if (cluster.length) flush();
  return out;
}

/** The hours the week grid shows: 08:00 to 20:00 at least, widened to hold any block outside that. */
export function hourRange(blocks: readonly GridBlock[], min = 8, max = 20): { from: number; to: number } {
  let from = min;
  let to = max;
  for (const b of blocks) { from = Math.min(from, Math.floor(b.startMin / 60)); to = Math.max(to, Math.ceil(b.endMin / 60)); }
  return { from, to: Math.min(24, to) };
}

/** The "all day" strip of a day: everything that is not a block. */
export const stripItems = (items: readonly TimelineItem[]): TimelineItem[] => items.filter((i) => !isBlock(i));
