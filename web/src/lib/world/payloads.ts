import { moodleAssignmentId, moodleCourseId, unixSeconds } from "../data/moodle.ts";
import { roomRemark, slotStatus } from "../library/availability.ts";
import { isDate, SLOTS, slotWindow } from "../library/policy.ts";
import { LIBRARY_ROOMS } from "../library/rooms.ts";
import type { World, SystemId } from "./types.ts";

/**
 * What each invented campus system would send back, built from a World.
 * Moodle copies the shape of its real web service responses where that is easy.
 * Academic Centre, Finance and Email are invented formats, kept simple on purpose.
 * Pure functions: the mock route handlers and the server-side agent both call them.
 */

export const DEMO_STAMP = "fictional demo data";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* ───────── Moodle ───────── */

export function moodleCourses(world: World) {
  return world.courses.map((course) => ({
    id: moodleCourseId(course.id),
    shortname: course.code,
    fullname: course.title,
    displayname: `${course.code} ${course.title}`,
    summary: course.blurb,
    // Real Moodle exposes teachers through another call. The mock folds it in to keep the demo small.
    lecturer: course.lecturer,
  }));
}

const submissionStatus = (status: string): "new" | "draft" | "submitted" =>
  status === "submitted" ? "submitted" : status === "progress" ? "draft" : "new";

/** Mirrors `mod_assign_get_assignments`. Quizzes are not assignments in Moodle, so they are left out here. */
export function moodleAssignments(world: World) {
  return {
    courses: world.courses.map((course) => ({
      id: moodleCourseId(course.id),
      shortname: course.code,
      fullname: course.title,
      assignments: world.assignments
        .filter((a) => a.courseId === course.id && a.type !== "Quiz")
        .map((a) => ({
          id: moodleAssignmentId(a.id),
          course: moodleCourseId(course.id),
          name: a.title,
          duedate: unixSeconds(a.due),
          grade: a.weight, // share of the final grade, in percent
          activitytype: a.type, // extra field, not in real Moodle
          submissionstatus: submissionStatus(a.status), // real Moodle needs a second call for this
        })),
    })),
    warnings: [] as string[],
    notice: DEMO_STAMP,
  };
}

/** Mirrors `core_calendar_get_action_events_by_timesort`: due dates and quiz closings, including overdue ones. */
export function moodleActionEvents(world: World) {
  const events = world.assignments
    .map((a) => {
      const course = world.courses.find((c) => c.id === a.courseId);
      const isQuiz = a.type === "Quiz";
      return {
        id: 70000 + moodleAssignmentId(a.id),
        name: isQuiz ? `${a.title} closes` : `${a.title} is due`,
        timesort: unixSeconds(a.due),
        eventtype: isQuiz ? "close" : "due",
        modulename: isQuiz ? "quiz" : "assign",
        instance: moodleAssignmentId(a.id),
        course: { id: moodleCourseId(a.courseId), shortname: course?.code ?? "" },
        action: { name: isQuiz ? "Attempt quiz now" : "Add submission", actionable: a.status !== "submitted" },
        // extra fields, not in real Moodle
        title: a.title,
        grade: a.weight,
        draft: a.status === "progress",
      };
    })
    .sort((a, b) => a.timesort - b.timesort);
  return { events, notice: DEMO_STAMP };
}

/** Mirrors the news forum of each course, which is where lecturers post announcements. */
export function moodleAnnouncements(world: World) {
  return {
    discussions: world.announcements
      .filter((n) => n.system === "moodle")
      .map((n) => ({
        id: 5000 + (Number(n.id.replace(/\D/g, "")) || 0),
        ref: n.id,
        name: n.title,
        message: n.body,
        timemodified: unixSeconds(n.posted),
        course: n.courseId ? moodleCourseId(n.courseId) : 0,
        userfullname: n.source,
      })),
    notice: DEMO_STAMP,
  };
}

/* ───────── Academic Centre (invented format) ───────── */

const AC_STATUS = { normal: "normal", cancelled: "cancelled", "room-changed": "moved", makeup: "make-up" } as const;

export function acTimetable(world: World) {
  return {
    weekStart: "2026-11-23",
    timeZone: "Asia/Kuala_Lumpur",
    classes: world.classes.map((c) => ({
      id: c.id,
      course: world.courses.find((course) => course.id === c.courseId)?.code ?? c.courseId,
      type: c.kind,
      day: DAYS[c.day],
      start: c.start,
      end: c.end,
      room: c.room,
      status: AC_STATUS[c.status],
      previousRoom: c.originalRoom ?? null,
    })),
    notice: DEMO_STAMP,
  };
}

export function acNotices(world: World) {
  return {
    notices: world.announcements
      .filter((n) => n.system === "ac")
      .map((n) => ({
        id: n.id,
        title: n.title,
        text: n.body,
        postedAt: n.posted,
        issuer: n.source,
        course: world.courses.find((c) => c.id === n.courseId)?.code ?? null,
        category: n.kind,
      })),
    notice: DEMO_STAMP,
  };
}

/* ───────── Finance Office (invented format) ───────── */

export function financeAccount(world: World) {
  const paid = world.fees.filter((f) => f.status === "paid" && f.posted).reduce((sum, f) => sum + f.amount, 0);
  return { currency: world.currency, totalFees: world.feeTotal, amountPaid: paid, amountOutstanding: world.feeTotal - paid, notice: DEMO_STAMP };
}

export function financeInstalments(world: World) {
  return {
    currency: world.currency,
    instalments: world.fees.filter((f) => f.posted).map((f) => ({
      id: f.id, description: f.description, amount: f.amount, dueDate: f.due, status: f.status, paidOn: f.paidOn ?? null,
    })),
    notice: DEMO_STAMP,
  };
}

/* ───────── University email (invented format) ───────── */

const preview = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 110);

/** Newest first. The hand-written `expected` answers are never part of what a mail system sends. */
export function mailList(world: World) {
  return {
    messages: [...world.inbox]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .map((m) => ({ id: m.id, from: m.from, address: m.address, subject: m.subject, date: m.date, preview: preview(m.body) })),
    notice: DEMO_STAMP,
  };
}

export function mailMessage(world: World, id: string) {
  const m = world.inbox.find((message) => message.id === id);
  return m ? { message: { id: m.id, from: m.from, address: m.address, subject: m.subject, date: m.date, body: m.body }, notice: DEMO_STAMP } : null;
}

/* ───────── Library room booking (invented format) ───────── */

/** Every room for one day: whether each two-hour slot is free, taken by someone else, or closed. */
export function libraryRooms(world: World, date: string) {
  if (!isDate(date)) return null;
  return {
    date,
    slots: SLOTS.map((s) => ({ index: s.index, ...slotWindow(date, s.index) })),
    rooms: LIBRARY_ROOMS.map((room) => ({
      id: room.id, name: room.name, category: room.category, level: room.level, wing: room.wing, capacity: room.capacity,
      ...(room.minPax ? { minPax: room.minPax } : {}),
      remark: roomRemark(world.library, room, date) ?? null,
      slots: SLOTS.map((s) => ({ index: s.index, ...slotStatus(world.library, room, date, s.index) })),
    })),
    notice: DEMO_STAMP,
  };
}

/* ───────── outages ───────── */

/**
 * A system is down only until the client has seen the outage once.
 * The server keeps no memory between requests, so the browser reports what it has seen.
 */
export function outageFor(world: World, system: SystemId, seen: readonly string[]): string | null {
  const eventId = world.outage[system];
  return eventId && !seen.includes(eventId) ? eventId : null;
}
