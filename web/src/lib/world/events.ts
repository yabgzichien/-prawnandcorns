import {
  EMAIL_LAB6_EXTENDED, EMAIL_NEWSLETTER, EMAIL_QUIZ_AMBIGUOUS, EMAIL_ROBOTICS_INFO, EMAIL_SPAM,
} from "../data/inbox.ts";
import type { ScenarioEvent } from "./types.ts";

/**
 * The scenario events the Lecturer and Office console can trigger.
 * Everything is invented. Room A1-210 exists on the campus map, so a moved class
 * never points students at a room the map cannot show.
 */
export const SCENARIO_EVENTS: ScenarioEvent[] = [
  {
    id: "move-class-tue",
    title: "Move Tuesday's CST1103 lecture to A1-210",
    group: "Lecturer",
    system: "ac",
    summary: "The Tuesday 14:00 lecture changes room. The time stays the same.",
    effects: [
      { op: "moveClass", classId: "c5", room: "A1-210" },
      {
        op: "addAnnouncement",
        notice: {
          id: "ac-n-room-tue", system: "ac", kind: "room", courseId: "cst1103",
          title: "CST1103 Tuesday lecture moved to A1-210",
          body: "Tuesday's 14:00 CST1103 lecture moves from A4-301 to A1-210. The time is unchanged.",
          posted: "2026-11-23T13:24:00+08:00", source: "Academic Centre (demo)",
        },
      },
    ],
  },
  {
    id: "extend-lab6-deadline",
    title: "Extend the Lab 6 report deadline to Friday",
    group: "Lecturer",
    system: "moodle",
    summary: "Moodle shows a new due date and Dr. Lim sends an email about it.",
    effects: [
      { op: "setDue", assignmentId: "a1", due: "2026-11-27T23:59:00+08:00" },
      { op: "addEmail", message: EMAIL_LAB6_EXTENDED },
    ],
  },
  {
    id: "cancel-lecture-makeup",
    title: "Cancel Friday's ENG1101 lecture, add a Saturday make-up",
    group: "Academic Centre",
    system: "ac",
    summary: "One class is cancelled and a make-up class appears on Saturday morning.",
    effects: [
      { op: "cancelClass", classId: "c10" },
      {
        op: "addClass",
        session: { id: "c12", courseId: "eng1101", day: 5, start: "10:00", end: "12:00", kind: "Lecture", room: "A3-201", status: "makeup", noticeId: "ac-n-makeup" },
      },
      {
        op: "addAnnouncement",
        notice: {
          id: "ac-n-makeup", system: "ac", kind: "cancellation", courseId: "eng1101",
          title: "ENG1101 Friday lecture cancelled, make-up on Saturday",
          body: "The Fri 27 Nov 09:00 ENG1101 lecture is cancelled. A make-up lecture is on Sat 28 Nov, 10:00 in A3-201.",
          posted: "2026-11-23T13:26:00+08:00", source: "Academic Centre (demo)",
        },
      },
    ],
  },
  {
    id: "finance-instalment-2",
    title: "Post tuition instalment 2, due 30 Nov",
    group: "Finance Office",
    system: "finance",
    summary: "Finance posts the second tuition instalment.",
    effects: [{ op: "postFee", feeId: "f2" }],
  },
  {
    id: "new-moodle-assignment",
    title: "Add a new Moodle assignment due in three days",
    group: "Lecturer",
    system: "moodle",
    summary: "A new CST1103 worksheet appears, due Thursday night.",
    effects: [
      {
        op: "addAssignment",
        assignment: { id: "a7", courseId: "cst1103", title: "Lab 4: Flip-Flops Worksheet", due: "2026-11-26T23:59:00+08:00", weight: 5, type: "Submission", status: "todo" },
      },
    ],
  },
  {
    id: "club-info-session",
    title: "Robotics club announces an info session by email",
    group: "Clubs",
    system: "mail",
    summary: "A club email with a date, time and room in free text.",
    effects: [{ op: "addEmail", message: EMAIL_ROBOTICS_INFO }],
  },
  {
    id: "noise-emails",
    title: "Send two noise emails (newsletter and spam)",
    group: "Inbox and systems",
    system: "mail",
    summary: "The agent should ignore both. The spam includes a planted instruction it must not follow.",
    effects: [
      { op: "addEmail", message: EMAIL_NEWSLETTER },
      { op: "addEmail", message: EMAIL_SPAM },
    ],
  },
  {
    id: "ambiguous-quiz-email",
    title: "Send an unclear email: the quiz is moved to next week",
    group: "Lecturer",
    system: "mail",
    summary: "No exact date. The agent should ask, not guess.",
    effects: [{ op: "addEmail", message: EMAIL_QUIZ_AMBIGUOUS }],
  },
  {
    id: "moodle-outage",
    title: "Take Moodle down for one sync",
    group: "Inbox and systems",
    system: "moodle",
    summary: "The next Moodle request fails once. Compass should say so and keep the last known data.",
    effects: [{ op: "outage", system: "moodle" }],
  },
];

export const EVENT_BY_ID: Record<string, ScenarioEvent> = Object.fromEntries(SCENARIO_EVENTS.map((event) => [event.id, event]));
export const EVENT_GROUPS = ["Lecturer", "Academic Centre", "Finance Office", "Clubs", "Inbox and systems"] as const;
