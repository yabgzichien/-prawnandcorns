import { validateStudySessions, type BusyBlock, type StudySession, type StudyTask } from "../planning.ts";
import { FIX_TYPES, isMyIso, type Fix, type PlanState } from "./types.ts";

/** Code checks every fix before the card is shown, and again before anything is saved. */

export type FixContext = {
  now: string;
  tasks: StudyTask[];
  classBlocks: BusyBlock[];
  /** Ids of the changes from the latest sync that the student has not reviewed. */
  changeIds: ReadonlySet<string>;
};

export type FixCheck = { ok: true; warning?: string } | { ok: false; error: string };

const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const ms = (iso: string) => Date.parse(iso);
const overlap = (a: { start: string; end: string }, b: { start: string; end: string }) => ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end);

export const describeFix = (fix: Fix): string => {
  switch (fix.type) {
    case "move_study_session": return `Move study session ${fix.sessionId}`;
    case "remove_study_session": return `Remove study session ${fix.sessionId}`;
    case "add_reminder": return `Reminder: ${fix.title}`;
    case "add_calendar_event": return `Calendar: ${fix.title}`;
    case "acknowledge": return `Acknowledge: ${fix.summary}`;
    case "ask_question": return `Question: ${fix.question}`;
  }
};

export function checkFix(fix: Fix, plan: PlanState, ctx: FixContext): FixCheck {
  if (!FIX_TYPES.includes(fix.type)) return { ok: false, error: "That kind of change is not allowed." };
  if (!text(fix.reason, 220) || !text(fix.source, 120)) return { ok: false, error: "Every change needs a short reason and a source." };
  switch (fix.type) {
    case "move_study_session": {
      const session = plan.studySessions.find((s) => s.id === fix.sessionId);
      if (!session) return { ok: false, error: "That study session is not in your plan." };
      if (!isMyIso(fix.start) || !isMyIso(fix.end)) return { ok: false, error: "Use valid Malaysian local dates and times." };
      const moved: StudySession = { ...session, start: fix.start, end: fix.end };
      const blocks: BusyBlock[] = [...ctx.classBlocks, ...plan.personalEvents.map((e) => ({ label: `Your event: ${e.title}`, start: e.start, end: e.end }))];
      const errors = validateStudySessions([moved], ctx.tasks, blocks, plan.studySessions.filter((s) => s.id !== session.id), ctx.now);
      return errors.length ? { ok: false, error: errors[0] } : { ok: true };
    }
    case "remove_study_session":
      return plan.studySessions.some((s) => s.id === fix.sessionId) ? { ok: true } : { ok: false, error: "That study session is not in your plan." };
    case "add_reminder": {
      if (!text(fix.title, 120)) return { ok: false, error: "A reminder needs a title of up to 120 characters." };
      if (!isMyIso(fix.at)) return { ok: false, error: "Use a valid Malaysian local date and time." };
      if (plan.reminders.length >= 30) return { ok: false, error: "You already have 30 reminders. Remove one first." };
      if (plan.reminders.some((r) => r.title === fix.title && r.at === fix.at)) return { ok: false, error: "That reminder is already saved." };
      return { ok: true };
    }
    case "add_calendar_event": {
      if (!text(fix.title, 120) || (fix.place !== undefined && !text(fix.place, 80))) return { ok: false, error: "Check the event title and place." };
      if (!isMyIso(fix.start) || !isMyIso(fix.end) || ms(fix.end) <= ms(fix.start) || ms(fix.end) - ms(fix.start) > 8 * 3_600_000) return { ok: false, error: "Use a start and end on valid dates, up to 8 hours long." };
      if (plan.personalEvents.length >= 30) return { ok: false, error: "You already have 30 calendar entries. Remove one first." };
      if (plan.personalEvents.some((e) => e.title === fix.title && e.start === fix.start)) return { ok: false, error: "That event is already saved." };
      const clash = ctx.classBlocks.find((b) => overlap(fix, b)) ?? plan.studySessions.map((s) => ({ label: `Study: ${s.title}`, start: s.start, end: s.end })).find((b) => overlap(fix, b));
      return { ok: true, ...(clash ? { warning: `Overlaps ${clash.label}.` } : {}) };
    }
    case "acknowledge":
      return ctx.changeIds.has(fix.changeId) && text(fix.summary, 220) ? { ok: true } : { ok: false, error: "That update is not waiting for review." };
    case "ask_question":
      if (!text(fix.question, 300)) return { ok: false, error: "A question needs text of up to 300 characters." };
      if (fix.to !== undefined && (!text(fix.to.name, 80) || !/^[^\s@<>]{1,64}@[^\s@<>]{1,80}$/.test(fix.to.email ?? ""))) return { ok: false, error: "Check who the email should go to." };
      if (fix.changeId !== undefined && !ctx.changeIds.has(fix.changeId)) return { ok: false, error: "That update is not waiting for review." };
      return { ok: true };
  }
}
