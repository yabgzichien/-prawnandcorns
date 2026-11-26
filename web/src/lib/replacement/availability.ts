import { COURSE_BY_ID, type ClassSession } from "../data/academics.ts";
import { ROOM_BY_CODE } from "../data/campus.ts";
import { atDay } from "../time.ts";
import { blocksFromClasses, buildCohort, CANDIDATE_ROOMS, knownRoomUse, LECTURER, roomTakenByOthers, type Block, type Student } from "./cohort.ts";
import { overlaps, toHhmm, toMin } from "./time.ts";
import type { ReplacementReason, SlotOption } from "./types.ts";

/**
 * Plain code, not AI: which times this week suit the students, the lecturer and a room.
 * Demo rules, not XMUM policy: Tuesday to Saturday of this week, 08:00 to 20:00, at least 24 hours' notice.
 */
export const GRID = { days: [1, 2, 3, 4, 5], from: "08:00", until: "20:00", step: 30 } as const;
export const NOTICE_HOURS = 24;

export type PlannerContext = {
  session: ClassSession;
  reason: ReplacementReason;
  cohort: Student[];
  lecturerBlocks: Block[];
  roomUse: Block[];
  now: Date;
};

export type SlotEval = {
  day: number;
  start: string;
  end: string;
  free: number;
  total: number;
  /** Who cannot come, grouped by the class they have then. Largest group first. */
  clashes: { label: string; count: number }[];
  /** Why this time cannot be used at all, or null. */
  blocked: string | null;
  /** Free rooms with enough seats, the original room first. */
  rooms: string[];
  /** Soft drawbacks worth showing. */
  flags: string[];
};

/** Everything the planner needs for one lost class. `demoClasses` is the demo student's timetable as it is now. */
export function plannerContext(sessionId: string, reason: ReplacementReason, demoClasses: readonly ClassSession[], now: Date): PlannerContext | null {
  const session = demoClasses.find((c) => c.id === sessionId && c.courseId === LECTURER.courseId);
  if (!session) return null;
  const courseClasses = demoClasses.filter((c) => c.courseId === LECTURER.courseId);
  return {
    session, reason, now,
    cohort: buildCohort(courseClasses, demoClasses, sessionId),
    lecturerBlocks: [...blocksFromClasses(courseClasses, sessionId), ...LECTURER.other],
    // the lost class's room is free at its old time once the class is cancelled
    roomUse: knownRoomUse(demoClasses).filter((b) => !(b.day === session.day && b.start === session.start && b.room === session.room)),
  };
}

const durationOf = (s: ClassSession) => toMin(s.end) - toMin(s.start);

export function freeRooms(ctx: PlannerContext, day: number, start: string, end: string): string[] {
  const seatsNeeded = ctx.cohort.length;
  const candidates = [...new Set([ctx.session.room, ...CANDIDATE_ROOMS[ctx.session.kind]])].filter((code) => (ROOM_BY_CODE[code]?.seats ?? 0) >= seatsNeeded);
  const slot = { day, start, end };
  return candidates.filter((room) => {
    if (ctx.roomUse.some((b) => b.room === room && overlaps(b, slot))) return false;
    for (let h = Math.floor(toMin(start) / 60); h * 60 < toMin(end); h++) if (roomTakenByOthers(room, day, h)) return false;
    return true;
  });
}

export function evaluateSlot(ctx: PlannerContext, day: number, start: string): SlotEval {
  const end = toHhmm(toMin(start) + durationOf(ctx.session));
  const slot = { day, start, end };
  const total = ctx.cohort.length;
  const base = { day, start, end, total };

  let blocked: string | null = null;
  if (!GRID.days.includes(day as 1)) blocked = "Outside this teaching week";
  else if (toMin(start) < toMin(GRID.from) || toMin(end) > toMin(GRID.until)) blocked = "Outside 08:00 to 20:00";
  else if (atDay(day, start).getTime() < ctx.now.getTime() + NOTICE_HOURS * 3_600_000) blocked = "Less than 24 hours' notice";
  else if (day === ctx.session.day && ctx.reason === "Public holiday") blocked = "Public holiday";
  else if (day === ctx.session.day && ctx.reason === "Lecturer on leave") blocked = "You are on leave";
  else {
    const mine = ctx.lecturerBlocks.find((b) => overlaps(b, slot));
    if (mine) blocked = `You have ${mine.label}`;
  }

  const groups = new Map<string, number>();
  let free = 0;
  for (const s of ctx.cohort) {
    const hit = s.blocks.find((b) => overlaps(b, slot));
    if (hit) groups.set(hit.label, (groups.get(hit.label) ?? 0) + 1);
    else free++;
  }
  const clashes = [...groups].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const rooms = blocked ? [] : freeRooms(ctx, day, start, end);
  const flags: string[] = [];
  if (day === 5) flags.push("Saturday");
  if (toMin(end) > 18 * 60) flags.push("Evening");
  if (toMin(start) < 9 * 60) flags.push("Early start");
  if (toMin(start) < 13 * 60 && toMin(end) > 12 * 60 + 30) flags.push("Over lunch");
  if (!blocked && rooms.length === 0) flags.push("No free room");
  return { ...base, free, clashes, blocked, rooms, flags };
}

/** Every start time on the grid, day by day. */
export function evaluateWeek(ctx: PlannerContext): SlotEval[][] {
  const length = durationOf(ctx.session);
  return GRID.days.map((day) => {
    const out: SlotEval[] = [];
    for (let t = toMin(GRID.from); t + length <= toMin(GRID.until); t += GRID.step) out.push(evaluateSlot(ctx, day, toHhmm(t)));
    return out;
  });
}

export const usable = (e: SlotEval) => !e.blocked && e.rooms.length > 0;
const rank = (a: SlotEval, b: SlotEval) => b.free - a.free || a.flags.length - b.flags.length || a.day - b.day || toMin(a.start) - toMin(b.start);

/** The best usable time on each day, then the best few of those, so suggestions are spread across the week. */
export function suggestSlots(week: SlotEval[][], count = 3): SlotEval[] {
  const bestPerDay = week.map((day) => day.filter(usable).sort(rank)[0]).filter((e): e is SlotEval => !!e);
  return bestPerDay.sort(rank).slice(0, count);
}

export const optionId = (day: number, start: string, room: string) => `${day}-${start}-${room}`;
export const optionFrom = (e: SlotEval, room: string): SlotOption => ({ id: optionId(e.day, e.start, room), day: e.day, start: e.start, end: e.end, room });

/** Checked again just before the desk publishes or asks, whatever the screen showed. */
export function checkOption(ctx: PlannerContext, option: SlotOption): { ok: true; eval: SlotEval } | { ok: false; error: string } {
  const e = evaluateSlot(ctx, option.day, option.start);
  if (e.end !== option.end) return { ok: false, error: "That time no longer matches the length of the class." };
  if (e.blocked) return { ok: false, error: `${e.blocked}. Choose another time.` };
  if (!e.rooms.includes(option.room)) return { ok: false, error: `${option.room} is not free then, or is too small. Choose another room.` };
  return { ok: true, eval: e };
}

/** A plain sentence for a clash group, such as "4 students have CST1103 Lab". */
export const clashSentence = (c: { label: string; count: number }) => `${c.count} student${c.count === 1 ? "" : "s"} ${c.count === 1 ? "has" : "have"} ${c.label}`;

export const sessionTitle = (s: ClassSession) => `${COURSE_BY_ID[s.courseId]?.code ?? s.courseId} ${s.kind}`;
