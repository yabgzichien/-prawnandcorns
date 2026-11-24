import type { Assignment, ClassSession, Course, Notice } from "../data/academics.ts";
import type { LibraryBlock, LibraryState } from "../library/availability.ts";

/** Shared vocabulary for the invented campus systems. Every record in a World is fictional. */

export type SystemId = "moodle" | "ac" | "finance" | "mail";
export const SYSTEM_IDS: readonly SystemId[] = ["moodle", "ac", "finance", "mail"];
export const SYSTEM_LABEL: Record<SystemId, string> = {
  moodle: "Moodle",
  ac: "Academic Centre",
  finance: "Finance Office",
  mail: "University email",
};
/** Short names used in banners and tool output. */
export const SYSTEM_SHORT: Record<SystemId, string> = { moodle: "Moodle", ac: "AC", finance: "Finance", mail: "Email" };

export type FactType = "class_change" | "deadline" | "fee" | "event" | "no_action";
export type Confidence = "high" | "medium" | "low";

/** One fact the notice reader pulled out of a free-text message. */
export type ExtractedFact = {
  type: FactType;
  summary: string;
  /** The exact sentence (or phrase) from the message this fact came from. */
  quote: string;
  confidence: Confidence;
  /** Course code the message is about, for example CST1103, when it names one. */
  courseCode?: string;
  /** Raw id of the class or assignment the fact is about, when there is one. */
  targetId?: string;
  newDate?: string; // ISO with +08:00
  newRoom?: string;
  /** Why code lowered the confidence, or why the reader was unsure. */
  reason?: string;
};

export type InboxMessage = {
  id: string;
  from: string;
  address: string;
  subject: string;
  date: string; // ISO
  body: string;
  /** Hand-written expected answer. Doubles as the offline fallback and as the test answer. Never sent by the mail API. */
  expected?: ExtractedFact[];
};

export type FeeRecord = {
  id: string;
  description: string;
  amount: number;
  due: string; // ISO
  status: "paid" | "due" | "overdue";
  paidOn?: string;
  /** Finance only lists instalments once it has posted them. */
  posted: boolean;
};

export type WorldNotice = Notice & { system: "moodle" | "ac" };

export type World = {
  courses: Course[];
  classes: ClassSession[];
  assignments: Assignment[];
  currency: string;
  feeTotal: number;
  fees: FeeRecord[];
  announcements: WorldNotice[];
  inbox: InboxMessage[];
  /** Rooms other people have booked, and rooms the library has closed. */
  library: LibraryState;
  /** system -> id of the event that took it down */
  outage: Partial<Record<SystemId, string>>;
  applied: string[];
};

export type Effect =
  | { op: "moveClass"; classId: string; room: string }
  | { op: "cancelClass"; classId: string }
  | { op: "addClass"; session: ClassSession }
  | { op: "setDue"; assignmentId: string; due: string }
  | { op: "addAssignment"; assignment: Assignment }
  | { op: "postFee"; feeId: string }
  | { op: "addAnnouncement"; notice: WorldNotice }
  | { op: "addEmail"; message: InboxMessage }
  | { op: "outage"; system: SystemId }
  | { op: "libraryBlock"; block: LibraryBlock };

export type EventGroup = "Lecturer" | "Academic Centre" | "Finance Office" | "Clubs" | "Library" | "Inbox and systems";

export type ScenarioEvent = {
  id: string;
  title: string;
  group: EventGroup;
  /** The system a student would see change first. */
  system: SystemId | "library";
  summary: string;
  effects: Effect[];
};
