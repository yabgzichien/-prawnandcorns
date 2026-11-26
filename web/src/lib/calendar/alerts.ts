import { COURSE_BY_ID, type Assignment } from "../data/academics.ts";
import { dateLabel } from "../events/checks.ts";
import { ymd } from "../library/policy.ts";
import { DEMO_NOW, timeOf } from "../time.ts";
import { EXAMS, SEMESTER_1, examName, phaseOfDate, type Exam } from "./semester.ts";

/**
 * Heads-up for deadlines and exams. Plain rules, so the same thing is said on Home and by the assistant.
 * Each alert has a tier. Dismissing hides it until it reaches a nearer tier, so hiding "in 3 days" does not
 * hide "due today".
 */

export type AlertLevel = "urgent" | "soon" | "info";
export type TimeAlert = {
  /** Stable for the thing it is about, for example "a:a4" or "x:x-mat-mid". */
  id: string;
  /** The window it is in now, for example "24h". Seen is stored as id and tier together. */
  tier: string;
  level: AlertLevel;
  kind: "deadline" | "overdue" | "unsubmitted" | "exam" | "phase";
  title: string;
  detail: string;
  /** When it happens, ISO, for sorting. */
  at: string;
  href: string;
};

export const MAJOR_WEIGHT = 10;
const H = 3_600_000;
const LEVEL_ORDER: Record<AlertLevel, number> = { urgent: 0, soon: 1, info: 2 };

const inWords = (ms: number) => {
  const h = ms / H;
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} minutes`;
  if (h < 24) return `in ${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return d === 1 ? "tomorrow" : `in ${d} days`;
};
const when = (iso: string, now: Date) => {
  const d = new Date(iso);
  const day = ymd(d.getTime()) === ymd(now.getTime()) ? "today" : dateLabel(ymd(d.getTime()));
  return `${day} at ${timeOf(d)}`;
};

export type AlertInput = {
  now?: Date;
  /** As Compass shows them: Moodle's status when Moodle is connected, the demo data otherwise. */
  assignments: readonly Assignment[];
  /** Items the student ticked as done in Compass. Compass cannot submit, so Moodle's status still decides. */
  markedDone?: readonly string[];
  exams?: readonly Exam[];
};

export function timeAlerts({ now = DEMO_NOW, assignments, markedDone = [], exams = EXAMS }: AlertInput): TimeAlert[] {
  const out: TimeAlert[] = [];
  for (const a of assignments) {
    if (a.status === "submitted") continue;
    const code = COURSE_BY_ID[a.courseId]?.code ?? a.courseId;
    const left = Date.parse(a.due) - now.getTime();
    const href = "/hub?section=assignments";
    const ticked = markedDone.includes(a.id);
    if (left <= 0) {
      if (a.status === "overdue" && a.note) out.push({ id: `a:${a.id}`, tier: "overdue", level: "urgent", kind: "overdue", title: `${a.title} is overdue`, detail: `${code}. ${a.note}.`, at: a.due, href });
      continue;
    }
    const major = a.weight >= MAJOR_WEIGHT;
    const tier = left <= 24 * H ? "24h" : left <= 72 * H ? "72h" : major && left <= 14 * 24 * H ? "14d" : "";
    if (!tier) continue;
    const level: AlertLevel = tier === "24h" ? "urgent" : tier === "72h" ? "soon" : "info";
    const base = `${code}, ${a.weight}% of the course. Due ${when(a.due, now)}.`;
    if (ticked) {
      out.push({ id: `a:${a.id}`, tier: `${tier}:ticked`, level, kind: "unsubmitted", title: `${a.title}: Moodle still shows it as not submitted`, detail: `You marked it done here, but Compass cannot submit for you. ${base}`, at: a.due, href });
    } else {
      out.push({ id: `a:${a.id}`, tier, level, kind: "deadline", title: `${a.title} is due ${inWords(left)}`, detail: major ? `${base} A major piece, so start early.` : base, at: a.due, href });
    }
  }

  for (const e of exams) {
    const left = Date.parse(e.start) - now.getTime();
    if (Date.parse(e.end) <= now.getTime() || left > 14 * 24 * H) continue;
    const tier = left <= 0 ? "now" : left <= 24 * H ? "1d" : left <= 3 * 24 * H ? "3d" : "14d";
    const level: AlertLevel = tier === "now" || tier === "1d" ? "urgent" : tier === "3d" ? "soon" : "info";
    out.push({
      id: `x:${e.id}`, tier, level, kind: "exam",
      title: left <= 0 ? `${examName(e)} is on now` : `${examName(e)} ${inWords(left)}`,
      detail: `${when(e.start, now)}, ${e.room}. ${e.weight}% of the course. Demo exam timetable.`,
      at: e.start, href: "/hub?section=courses",
    });
  }

  const today = ymd(now.getTime());
  const { phase, week } = phaseOfDate(today);
  if (phase === "teaching" && week && week >= SEMESTER_1.teachingWeeks - 1) {
    out.push({ id: "p:revision", tier: `w${week}`, level: "info", kind: "phase", title: week === SEMESTER_1.teachingWeeks ? "Last teaching week" : "Revision week is close", detail: `Revision week starts ${dateLabel(SEMESTER_1.revision.start)} and exams start ${dateLabel(SEMESTER_1.exams.start)}.`, at: `${SEMESTER_1.revision.start}T00:00:00+08:00`, href: "/hub?section=courses" });
  }
  if (phase === "revision") out.push({ id: "p:revision", tier: "revision", level: "soon", kind: "phase", title: "It is revision week", detail: `No classes this week. Exams start ${dateLabel(SEMESTER_1.exams.start)}.`, at: `${SEMESTER_1.exams.start}T00:00:00+08:00`, href: "/hub?section=courses" });
  if (phase === "exams") out.push({ id: "p:exams", tier: "exams", level: "soon", kind: "phase", title: "It is the exam weeks", detail: `Exams run until ${dateLabel(SEMESTER_1.exams.end)}. Plan rest as well as revision.`, at: `${SEMESTER_1.exams.end}T23:59:00+08:00`, href: "/hub?section=courses" });

  return out.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level] || x.at.localeCompare(y.at));
}

/** The key stored when the student dismisses an alert. */
export const seenKey = (a: Pick<TimeAlert, "id" | "tier">) => `${a.id}@${a.tier}`;

/** Only well formed keys, and not too many, are kept from storage. */
export function sanitizeSeen(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((k): k is string => typeof k === "string" && /^[apx]:[\w-]{1,40}@[\w:]{1,20}$/.test(k)).slice(-60);
}
