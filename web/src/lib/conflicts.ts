import { sessionDate, type Assignment, type ClassSession } from "./data/academics.ts";
import type { Dues } from "./data/life.ts";
import type { StudySession } from "./planning.ts";
import type { Change } from "./sync/types.ts";
import { dateShort, dayShort, timeOf } from "./time.ts";
import type { PersonalEvent, Reminder } from "./updates/types.ts";
import type { ExtractedFact } from "./world/types.ts";

/**
 * Plain code, not AI. Lists every clash in the student's week, so the agent never has to guess
 * whether two things overlap.
 */
export type Conflict = {
  id: string;
  kind: "overlap" | "class-clash" | "after-deadline" | "stale-session" | "fee-no-plan";
  message: string;
  /** Ids of the things involved: study session ids, class ids, fee ids or change ids. */
  refs: string[];
};

export type ConflictInput = {
  classes: readonly ClassSession[];
  assignments: readonly Assignment[];
  fees: readonly Dues[];
  studySessions: readonly StudySession[];
  personalEvents: readonly PersonalEvent[];
  reminders: readonly Reminder[];
  /** Changes from the latest sync that the student has not reviewed. */
  changes: readonly Change[];
  /** Facts just read out of notices. Only dated, non-low-confidence class changes and events count. */
  facts?: readonly { noticeId: string; fact: ExtractedFact }[];
  now: Date;
};

type Block = { key: string; kind: "class" | "study" | "event" | "fact"; label: string; start: number; end: number; changedClass?: boolean; ref: string };

const label = (start: number, end: number) => {
  const a = new Date(start);
  return `${dayShort(a)} ${dateShort(a)} ${timeOf(a)} to ${timeOf(new Date(end))}`;
};
const rawId = (itemId: string) => itemId.split(":").slice(2).join(":");
const HOUR = 3_600_000;

export function detectConflicts(input: ConflictInput): Conflict[] {
  const out: Conflict[] = [];
  const changedClassIds = new Set(input.changes.filter((c) => c.itemKind === "class" && c.type !== "removed").map((c) => rawId(c.itemId)));
  const blocks: Block[] = [];

  for (const c of input.classes) {
    if (c.status === "cancelled") continue;
    const { start, end } = sessionDate(c);
    blocks.push({ key: `class:${c.id}`, kind: "class", label: `${c.courseId.toUpperCase()} ${c.kind}`, start: start.getTime(), end: end.getTime(), changedClass: changedClassIds.has(c.id), ref: c.id });
  }
  for (const s of input.studySessions) blocks.push({ key: `study:${s.id}`, kind: "study", label: `study session "${s.title}"`, start: Date.parse(s.start), end: Date.parse(s.end), ref: s.id });
  for (const e of input.personalEvents) blocks.push({ key: `event:${e.id}`, kind: "event", label: `your event "${e.title}"`, start: Date.parse(e.start), end: Date.parse(e.end), ref: e.id });
  for (const { noticeId, fact } of input.facts ?? []) {
    if (!fact.newDate || fact.confidence === "low" || (fact.type !== "event" && fact.type !== "class_change")) continue;
    const start = Date.parse(fact.newDate);
    if (Number.isFinite(start)) blocks.push({ key: `fact:${noticeId}:${fact.newDate}`, kind: "fact", label: `"${fact.summary}"`, start, end: start + HOUR, ref: noticeId });
  }

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (!(a.start < b.end && b.start < a.end)) continue;
      if (a.kind === "fact" && b.kind === "fact") continue;
      if (a.kind === "class" && b.kind === "class" && !a.changedClass && !b.changedClass) continue; // the base timetable is the AC's business
      const cls = a.changedClass || b.changedClass;
      out.push({
        id: `${cls ? "class-clash" : "overlap"}:${a.key}:${b.key}`,
        kind: cls ? "class-clash" : "overlap",
        message: `${cls ? "A class that changed now clashes: " : ""}${a.label} (${label(a.start, a.end)}) overlaps ${b.label} (${label(b.start, b.end)}).`,
        refs: [a.ref, b.ref],
      });
    }
  }

  const open = new Map(input.assignments.filter((a) => a.status !== "submitted").map((a) => [a.id, a]));
  for (const s of input.studySessions) {
    const task = open.get(s.taskId);
    if (task && Date.parse(s.end) > Date.parse(task.due)) {
      out.push({ id: `after-deadline:${s.id}`, kind: "after-deadline", message: `Study session "${s.title}" (${label(Date.parse(s.start), Date.parse(s.end))}) ends after its deadline.`, refs: [s.id] });
    }
  }

  // A deadline that moved leaves sessions planned for the old date.
  for (const change of input.changes) {
    if (change.type !== "changed" || change.itemKind !== "deadline") continue;
    const due = change.fields?.find((f) => f.field === "due");
    if (!due) continue;
    for (const s of input.studySessions.filter((x) => x.taskId === rawId(change.itemId))) {
      if (out.some((c) => c.kind === "after-deadline" && c.refs.includes(s.id))) continue;
      out.push({
        id: `stale-session:${s.id}:${change.id}`, kind: "stale-session",
        message: `The deadline for "${s.title}" moved from ${fmtIso(due.from)} to ${fmtIso(due.to)}, so the study session on ${label(Date.parse(s.start), Date.parse(s.end))} was planned for the old date.`,
        refs: [s.id, change.id],
      });
    }
  }

  for (const fee of input.fees) {
    const dueMs = Date.parse(fee.due);
    if (fee.status !== "upcoming" || dueMs - input.now.getTime() > 30 * 24 * HOUR) continue;
    if (input.reminders.some((r) => r.ref === `fee:${fee.id}`)) continue;
    out.push({ id: `fee-no-plan:${fee.id}`, kind: "fee-no-plan", message: `${fee.label} (${fee.amount.toLocaleString("en-MY")}) is due ${fmtIso(fee.due)} and nothing in your plan covers it.`, refs: [`fee:${fee.id}`] });
  }
  return out;
}

function fmtIso(iso: string): string {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}` : iso;
}
