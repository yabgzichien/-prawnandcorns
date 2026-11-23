import { assignmentIdFromMoodle, courseIdFromMoodle } from "../data/moodle.ts";
import type { acNotices, acTimetable, financeAccount, financeInstalments, mailList, moodleActionEvents, moodleAnnouncements, moodleAssignments, moodleCourses } from "../world/payloads.ts";
import type { AccountSummary, CampusItem, ClassItem, DeadlineItem, FeeItem, NoticeItem } from "./types.ts";

/**
 * Translate each system's own answer into the common Compass format.
 * These are the only functions that know a system's response shape.
 * The server-side agent calls the same functions on the same payloads, so the browser
 * and the server always agree on what an item is.
 */

type MoodleCourses = ReturnType<typeof moodleCourses>;
type MoodleAssignments = ReturnType<typeof moodleAssignments>;
type MoodleEvents = ReturnType<typeof moodleActionEvents>;
type MoodleNews = ReturnType<typeof moodleAnnouncements>;

const isoFromUnix = (seconds: number) => {
  // Moodle sends unix seconds. Compass keeps Malaysian wall-clock ISO strings.
  const shifted = new Date(seconds * 1000 + 8 * 3600_000).toISOString().slice(0, 19);
  return `${shifted}+08:00`;
};

const ACTIVITY: Record<string, DeadlineItem["activity"]> = { Submission: "Submission", Quiz: "Quiz", Essay: "Essay", Presentation: "Presentation" };

export function normalizeMoodle(input: { courses: MoodleCourses; assignments: MoodleAssignments; events: MoodleEvents; news: MoodleNews }): CampusItem[] {
  const codeOf = new Map(input.courses.map((c) => [c.id, c.shortname]));
  const items: CampusItem[] = [];
  const seen = new Set<string>();

  for (const course of input.assignments.courses) {
    for (const a of course.assignments) {
      const id = assignmentIdFromMoodle(a.id);
      const submission = a.submissionstatus;
      seen.add(id);
      items.push({
        id: `moodle:deadline:${id}`, source: "moodle", kind: "deadline",
        courseId: courseIdFromMoodle(a.course) ?? "", courseCode: codeOf.get(a.course) ?? course.shortname,
        title: a.name, due: isoFromUnix(a.duedate), weight: a.grade,
        activity: ACTIVITY[a.activitytype] ?? "Submission", submission, submitted: submission === "submitted",
      } satisfies DeadlineItem);
    }
  }
  // Quizzes and any other dated activity arrive through the calendar. Skip what the assignment call already gave us.
  for (const e of input.events.events) {
    const id = assignmentIdFromMoodle(e.instance);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id: `moodle:deadline:${id}`, source: "moodle", kind: "deadline",
      courseId: courseIdFromMoodle(e.course.id) ?? "", courseCode: e.course.shortname,
      title: e.title, due: isoFromUnix(e.timesort), weight: e.grade,
      activity: e.modulename === "quiz" ? "Quiz" : "Submission",
      submission: e.action.actionable ? (e.draft ? "draft" : "new") : "submitted", submitted: !e.action.actionable,
    } satisfies DeadlineItem);
  }
  for (const d of input.news.discussions) {
    items.push({
      id: `moodle:notice:${d.ref}`, source: "moodle", kind: "notice",
      sender: d.userfullname, subject: d.name, date: isoFromUnix(d.timemodified), text: d.message,
      courseId: courseIdFromMoodle(d.course),
    } satisfies NoticeItem);
  }
  return items;
}

type AcTimetable = ReturnType<typeof acTimetable>;
type AcNotices = ReturnType<typeof acNotices>;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function normalizeAc(input: { timetable: AcTimetable; notices: AcNotices }, courseIdByCode: ReadonlyMap<string, string>): CampusItem[] {
  const items: CampusItem[] = [];
  for (const c of input.timetable.classes) {
    items.push({
      id: `ac:class:${c.id}`, source: "ac", kind: "class",
      courseId: courseIdByCode.get(c.course) ?? c.course.toLowerCase(), courseCode: c.course,
      sessionKind: c.type, day: Math.max(0, DAYS.indexOf(c.day)), start: c.start, end: c.end, room: c.room,
      status: c.status, ...(c.previousRoom ? { previousRoom: c.previousRoom } : {}),
    } satisfies ClassItem);
  }
  for (const n of input.notices.notices) {
    items.push({
      id: `ac:notice:${n.id}`, source: "ac", kind: "notice",
      sender: n.issuer, subject: n.title, date: n.postedAt, text: n.text,
      ...(n.course ? { courseId: courseIdByCode.get(n.course) } : {}),
    } satisfies NoticeItem);
  }
  return items;
}

type FinAccount = ReturnType<typeof financeAccount>;
type FinInstalments = ReturnType<typeof financeInstalments>;

export function normalizeFinance(input: { account: FinAccount; instalments: FinInstalments }): { items: CampusItem[]; account: AccountSummary } {
  const items = input.instalments.instalments.map((i): FeeItem => ({
    id: `finance:fee:${i.id}`, source: "finance", kind: "fee",
    description: i.description, amount: i.amount, currency: input.instalments.currency, due: i.dueDate, status: i.status,
    ...(i.paidOn ? { paidOn: i.paidOn } : {}),
  }));
  return { items, account: { currency: input.account.currency, total: input.account.totalFees, paid: input.account.amountPaid, outstanding: input.account.amountOutstanding } };
}

type MailList = ReturnType<typeof mailList>;

/** `bodies` holds the full text of each message the list named. A message that failed to load keeps its preview. */
export function normalizeMail(input: { list: MailList; bodies: ReadonlyMap<string, string> }): CampusItem[] {
  return input.list.messages.map((m): NoticeItem => ({
    id: `mail:notice:${m.id}`, source: "mail", kind: "notice",
    sender: m.from, address: m.address, subject: m.subject, date: m.date, text: input.bodies.get(m.id) ?? m.preview,
  }));
}
