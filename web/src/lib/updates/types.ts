import type { StudySession } from "../planning.ts";

/** Things the student owns. The agent can propose changes to these and nothing else. */
export type Reminder = { id: string; title: string; at: string; /** e.g. "fee:f2" */ ref?: string };
export type PersonalEvent = { id: string; title: string; start: string; end: string; place?: string };
export type PlanState = { studySessions: StudySession[]; reminders: Reminder[]; personalEvents: PersonalEvent[] };

type Why = {
  id: string;
  /** One line: why this fix is being suggested. */
  reason: string;
  /** Where the fact came from, for example "AC" or "email: Dr. Lim (demo), 23 Nov". */
  source: string;
  /** A note from code when something is worth checking, never an error. */
  warning?: string;
};

/**
 * The only fix types the agent may propose. Deliberately small: nothing here touches a
 * university record, only the student's own plan.
 */
export type Fix =
  | (Why & { type: "move_study_session"; sessionId: string; start: string; end: string })
  | (Why & { type: "remove_study_session"; sessionId: string })
  | (Why & { type: "add_reminder"; title: string; at: string; ref?: string })
  | (Why & { type: "add_calendar_event"; title: string; start: string; end: string; place?: string })
  | (Why & { type: "acknowledge"; changeId: string; summary: string })
  | (Why & { type: "ask_question"; question: string; changeId?: string; quote?: string; /** who a draft email would go to, when the answer is theirs to give */ to?: { name: string; email: string } });

export type FixType = Fix["type"];
export const FIX_TYPES: readonly FixType[] = ["move_study_session", "remove_study_session", "add_reminder", "add_calendar_event", "acknowledge", "ask_question"];

/** What the approval card shows. Nothing is saved until the student approves. */
export type UpdatesProposal = {
  fixes: Fix[];
  /** Fixes code refused, with the reason. Shown to the agent so it can try again, never applied. */
  rejected: { summary: string; error: string }[];
  /** Notes that are not fixes, for example "Moodle was unavailable at the last sync". */
  notes: string[];
};

export const EMPTY_PLAN: PlanState = { studySessions: [], reminders: [], personalEvents: [] };

export const MY_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;
export const isMyIso = (v: unknown): v is string => typeof v === "string" && MY_ISO.test(v) && Number.isFinite(Date.parse(v));
