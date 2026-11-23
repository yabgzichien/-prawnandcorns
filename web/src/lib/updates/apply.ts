import type { StudySession } from "../planning.ts";
import { checkFix, describeFix, type FixContext } from "./validate.ts";
import type { Fix, PlanState } from "./types.ts";

export type ApplyResult =
  | { ok: true; plan: PlanState; ackIds: string[]; saved: number; summary: string }
  | { ok: false; error: string };

/**
 * Saves approved fixes to the student's own plan. Each fix is checked again, in order, against the plan
 * as it would be after the fixes before it, in case something changed while the card was open.
 * All or nothing: if one fix no longer holds, nothing is saved. Questions are never saved.
 */
export function applyFixes(start: PlanState, fixes: readonly Fix[], ctx: FixContext): ApplyResult {
  let plan: PlanState = { studySessions: [...start.studySessions], reminders: [...start.reminders], personalEvents: [...start.personalEvents] };
  const ackIds: string[] = [];
  let saved = 0;
  const parts: string[] = [];

  for (const fix of fixes) {
    if (fix.type === "ask_question") { if (fix.changeId) ackIds.push(fix.changeId); continue; }
    const check = checkFix(fix, plan, ctx);
    if (!check.ok) return { ok: false, error: `${describeFix(fix)}: ${check.error} Nothing was saved.` };
    switch (fix.type) {
      case "move_study_session":
        plan = { ...plan, studySessions: plan.studySessions.map((s): StudySession => (s.id === fix.sessionId ? { ...s, start: fix.start, end: fix.end } : s)) };
        parts.push("moved a study session");
        break;
      case "remove_study_session":
        plan = { ...plan, studySessions: plan.studySessions.filter((s) => s.id !== fix.sessionId) };
        parts.push("removed a study session");
        break;
      case "add_reminder":
        plan = { ...plan, reminders: [...plan.reminders, { id: `rem-${fix.id}`, title: fix.title, at: fix.at, ...(fix.ref ? { ref: fix.ref } : {}) }] };
        parts.push("added a reminder");
        break;
      case "add_calendar_event":
        plan = { ...plan, personalEvents: [...plan.personalEvents, { id: `ev-${fix.id}`, title: fix.title, start: fix.start, end: fix.end, ...(fix.place ? { place: fix.place } : {}) }] };
        parts.push("added a calendar entry");
        break;
      case "acknowledge":
        ackIds.push(fix.changeId);
        break;
    }
    if (fix.type !== "acknowledge") saved++;
  }
  const noted = ackIds.length;
  const summary = saved || noted
    ? `Saved in this browser: ${[...new Set(parts)].join(", ") || "nothing new in your plan"}${noted ? `. ${noted} update${noted === 1 ? "" : "s"} marked as reviewed` : ""}.`
    : "Nothing selected.";
  return { ok: true, plan, ackIds, saved, summary };
}
