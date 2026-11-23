import { checkFix, describeFix, type FixContext } from "./validate.ts";
import { FIX_TYPES, type Fix, type FixType, type PlanState, type UpdatesProposal } from "./types.ts";

/** Turns whatever the model sent for propose_updates into typed fixes. Anything that does not fit is dropped. */

const s = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);

export function parseFix(raw: unknown, id: string): Fix | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type as FixType;
  if (!FIX_TYPES.includes(type)) return null;
  const reason = s(r.reason, 220);
  const source = s(r.source, 120);
  if (!reason || !source) return null;
  const base = { id, reason, source };
  switch (type) {
    case "move_study_session": {
      const sessionId = s(r.sessionId, 150), start = s(r.start, 40), end = s(r.end, 40);
      return sessionId && start && end ? { ...base, type, sessionId, start, end } : null;
    }
    case "remove_study_session": {
      const sessionId = s(r.sessionId, 150);
      return sessionId ? { ...base, type, sessionId } : null;
    }
    case "add_reminder": {
      const title = s(r.title, 120), at = s(r.at, 40), ref = s(r.ref, 40);
      return title && at ? { ...base, type, title, at, ...(ref ? { ref } : {}) } : null;
    }
    case "add_calendar_event": {
      const title = s(r.title, 120), start = s(r.start, 40), end = s(r.end, 40), place = s(r.place, 80);
      return title && start && end ? { ...base, type, title, start, end, ...(place ? { place } : {}) } : null;
    }
    case "acknowledge": {
      const changeId = s(r.changeId, 200), summary = s(r.summary, 220);
      return changeId && summary ? { ...base, type, changeId, summary } : null;
    }
    case "ask_question": {
      const question = s(r.question, 300), changeId = s(r.changeId, 200), quote = s(r.quote, 300);
      const to = r.to && typeof r.to === "object" ? { name: s((r.to as Record<string, unknown>).name, 80), email: s((r.to as Record<string, unknown>).email, 140) } : undefined;
      return question ? { ...base, type, question, ...(changeId ? { changeId } : {}), ...(quote ? { quote } : {}), ...(to?.name && to.email ? { to: { name: to.name, email: to.email } } : {}) } : null;
    }
  }
}

export const MAX_FIXES = 12;

/**
 * Checks every fix before the card is shown. `movable` is the set of study session ids that
 * detect_conflicts found a problem with: a session can only be moved or removed when code found a
 * reason to, so text inside an email can never talk the agent into clearing the student's plan.
 */
export function buildProposal(rawItems: unknown, plan: PlanState, ctx: FixContext, movable: ReadonlySet<string>, notes: string[] = []): UpdatesProposal {
  const list = Array.isArray(rawItems) ? rawItems.slice(0, MAX_FIXES) : [];
  const fixes: Fix[] = [];
  const rejected: UpdatesProposal["rejected"] = [];
  const seen = new Set<string>();
  list.forEach((raw, i) => {
    const fix = parseFix(raw, `fix-${i + 1}`);
    const label = fix ? describeFix(fix) : `Item ${i + 1}`;
    if (!fix) { rejected.push({ summary: label, error: "Not an allowed kind of change, or missing a reason and source." }); return; }
    if ((fix.type === "move_study_session" || fix.type === "remove_study_session") && !movable.has(fix.sessionId)) {
      rejected.push({ summary: label, error: "No clash or changed deadline was found for that study session, so it stays as it is." });
      return;
    }
    const check = checkFix(fix, plan, ctx);
    if (!check.ok) { rejected.push({ summary: label, error: check.error }); return; }
    const key = JSON.stringify([fix.type, fix.type === "acknowledge" ? fix.changeId : label]);
    if (seen.has(key)) return;
    seen.add(key);
    fixes.push(check.warning ? { ...fix, warning: check.warning } : fix);
  });
  return { fixes, rejected, notes };
}
