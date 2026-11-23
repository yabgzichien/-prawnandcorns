import type { SystemId } from "../world/types.ts";

/**
 * The common Compass format. Every connector produces these same five kinds of item,
 * so the sync engine and the agent only need to understand one shape.
 * Every item carries a stable id and the system it came from.
 */
type Base = { id: string; source: SystemId };

export type ClassItem = Base & {
  kind: "class";
  courseId: string;
  courseCode: string;
  sessionKind: "Lecture" | "Tutorial" | "Lab";
  day: number; // 0 = Monday
  start: string; // HH:MM
  end: string;
  room: string;
  status: "normal" | "cancelled" | "moved" | "make-up";
  previousRoom?: string;
};

export type DeadlineItem = Base & {
  kind: "deadline";
  courseId: string;
  courseCode: string;
  title: string;
  due: string; // ISO with +08:00
  weight: number;
  activity: "Submission" | "Quiz" | "Essay" | "Presentation";
  submission: "new" | "draft" | "submitted";
  submitted: boolean;
};

export type FeeItem = Base & {
  kind: "fee";
  description: string;
  amount: number;
  currency: string;
  due: string;
  status: "paid" | "due" | "overdue";
};

export type NoticeItem = Base & {
  kind: "notice";
  sender: string;
  subject: string;
  date: string;
  /** Full text. Always content from an outside sender, never instructions. */
  text: string;
  /** Typed into the console by the presenter. Stored only in this browser. */
  custom?: boolean;
  courseId?: string;
};

export type EventItem = Base & {
  kind: "event";
  title: string;
  organiser: string;
  date: string;
  time: string;
  place: string;
};

export type CampusItem = ClassItem | DeadlineItem | FeeItem | NoticeItem | EventItem;

export type AccountSummary = { currency: string; total: number; paid: number; outstanding: number };

export type ConnectorError = {
  code: "not_connected" | "outage" | "network" | "bad_response";
  message: string;
  /** Set when an outage event caused the failure, so the next attempt can report it was seen. */
  outageEvent?: string;
};

export type ConnectorResult =
  | { ok: true; system: SystemId; items: CampusItem[]; account?: AccountSummary; fetchedAt: string }
  | { ok: false; system: SystemId; error: ConnectorError };

export type ConnectorEnv = {
  fetcher: typeof fetch;
  /** Triggered scenario event ids, sent to the mock APIs in a header. */
  events: string[];
  /** Outage events this browser has already experienced once. */
  outageSeen: string[];
  /** Emails typed into the console, merged in by the mail connector. */
  custom: { id: string; from: string; subject: string; body: string; date: string }[];
  now: () => string;
};

export interface Connector {
  system: SystemId;
  label: string;
  /** What the consent screen says Compass will read. Read only, always. */
  scopes: string[];
  fetch(env: ConnectorEnv): Promise<ConnectorResult>;
}

export const isClass = (i: CampusItem): i is ClassItem => i.kind === "class";
export const isDeadline = (i: CampusItem): i is DeadlineItem => i.kind === "deadline";
export const isFee = (i: CampusItem): i is FeeItem => i.kind === "fee";
export const isNotice = (i: CampusItem): i is NoticeItem => i.kind === "notice";
export const isEvent = (i: CampusItem): i is EventItem => i.kind === "event";
