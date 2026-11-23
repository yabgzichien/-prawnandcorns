import { ASSIGNMENTS, CLASSES, NOTICES, type Assignment, type ClassSession, type Notice } from "../data/academics.ts";
import { FINANCE, type Dues } from "../data/life.ts";
import type { CampusItem, ClassItem, DeadlineItem, FeeItem, NoticeItem } from "../connectors/types.ts";
import type { SystemId } from "../world/types.ts";
import { DEMO_NOW } from "../time.ts";
import type { Snapshot } from "./types.ts";

/**
 * The same facts in the shapes the existing pages already understand.
 * A system that is not connected falls back to the built-in example data, exactly as before.
 * `live` tells a page whether any real (mock-API) data is behind what it shows.
 */

export type FeesView = {
  currency: string;
  tuitionTotal: number;
  paid: number;
  dues: Dues[];
  history: { id: string; label: string; amount: number; date: string; method: string }[];
  live: boolean;
};

export type CampusData = {
  /** Which systems are feeding this data. */
  live: SystemId[];
  classes: ClassSession[];
  assignments: Assignment[];
  notices: Notice[];
  fees: FeesView;
};

const raw = (id: string) => id.split(":").slice(2).join(":");
const STATUS_FROM_AC = { normal: "normal", cancelled: "cancelled", moved: "room-changed", "make-up": "makeup" } as const;

function noticeKind(subject: string, text: string): Notice["kind"] {
  const t = `${subject} ${text}`.toLowerCase();
  return /cancel/.test(t) ? "cancellation" : /moved|room|venue/.test(t) ? "room" : "admin";
}

function toNotices(items: NoticeItem[]): Notice[] {
  return items
    .filter((n) => n.source === "ac" || n.source === "moodle")
    .map((n) => ({
      id: raw(n.id), kind: noticeKind(n.subject, n.text), title: n.subject, body: n.text, posted: n.date,
      source: n.source === "ac" ? "Academic Centre (demo)" : "Course announcement (demo)", courseId: n.courseId,
    }))
    .sort((a, b) => Date.parse(b.posted) - Date.parse(a.posted));
}

function toClasses(items: ClassItem[], notices: Notice[]): ClassSession[] {
  return items.map((c) => {
    const status = STATUS_FROM_AC[c.status];
    // Link a changed class to the newest notice about its course, so the timetable can explain the change.
    const notice = status === "normal" ? undefined : notices.find((n) => n.courseId === c.courseId);
    return {
      id: raw(c.id), courseId: c.courseId, day: c.day, start: c.start, end: c.end, kind: c.sessionKind,
      room: c.room, status, ...(c.previousRoom ? { originalRoom: c.previousRoom } : {}), ...(notice ? { noticeId: notice.id } : {}),
    };
  });
}

function toAssignments(items: DeadlineItem[]): Assignment[] {
  return items.map((d) => ({
    id: raw(d.id), courseId: d.courseId, title: d.title, due: d.due, weight: d.weight, type: d.activity,
    status: d.submitted ? "submitted" : d.submission === "draft" ? "progress" : Date.parse(d.due) < DEMO_NOW.getTime() ? "overdue" : "todo",
    ...(Date.parse(d.due) < DEMO_NOW.getTime() && !d.submitted ? { note: ASSIGNMENTS.find((a) => a.id === raw(d.id))?.note } : {}),
  }));
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });

function toFees(items: FeeItem[], account: Snapshot["account"]): FeesView {
  const sorted = [...items].sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const firstOpen = sorted.find((f) => f.status !== "paid")?.id;
  const dues: Dues[] = sorted.map((f) => ({
    id: raw(f.id), label: f.description, amount: f.amount, due: f.due,
    status: f.status === "paid" ? "paid" : f.id === firstOpen ? "upcoming" : "later", ...(f.paidOn ? { paidOn: f.paidOn } : {}),
  }));
  const paid = account?.paid ?? sorted.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
  return {
    currency: account?.currency ?? "RM", tuitionTotal: account?.total ?? FINANCE.tuitionTotal, paid, dues, live: true,
    history: sorted.filter((f) => f.status === "paid").map((f) => ({ id: `p-${raw(f.id)}`, label: f.description, amount: f.amount, date: f.paidOn ? dateLabel(f.paidOn) : "Date not listed", method: "Online banking" })),
  };
}

export function baseCampusData(): CampusData {
  return {
    live: [], classes: CLASSES, assignments: ASSIGNMENTS, notices: NOTICES,
    fees: { currency: FINANCE.currency, tuitionTotal: FINANCE.tuitionTotal, paid: FINANCE.paid, dues: FINANCE.dues, history: FINANCE.history, live: false },
  };
}

export function campusDataFrom(items: readonly CampusItem[], account: Snapshot["account"], connected: readonly SystemId[]): CampusData {
  const base = baseCampusData();
  const live = (["moodle", "ac", "finance", "mail"] as const).filter((s) => connected.includes(s));
  const noticeItems = items.filter((i): i is NoticeItem => i.kind === "notice");
  const hasAc = connected.includes("ac");
  const hasMoodle = connected.includes("moodle");
  const hasFinance = connected.includes("finance");
  // Notices come from AC and Moodle. Whichever system is not connected keeps its built-in example notices.
  const liveNotices = toNotices(noticeItems);
  const baseAc = NOTICES.filter((n) => n.id === "n3");
  const baseMoodle = NOTICES.filter((n) => n.id !== "n3");
  const notices = [
    ...(hasAc || hasMoodle ? liveNotices : []),
    ...(!hasAc ? baseAc : []),
    ...(!hasMoodle ? baseMoodle : []),
  ].sort((a, b) => Date.parse(b.posted) - Date.parse(a.posted));
  return {
    live,
    classes: hasAc ? toClasses(items.filter((i): i is ClassItem => i.kind === "class"), notices) : base.classes,
    assignments: hasMoodle ? toAssignments(items.filter((i): i is DeadlineItem => i.kind === "deadline")) : base.assignments,
    notices,
    fees: hasFinance ? toFees(items.filter((i): i is FeeItem => i.kind === "fee"), account) : base.fees,
  };
}
