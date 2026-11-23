import { dateShort, dayShort, timeOf, DEMO_NOW, WEEK_START } from "../time.ts";
import { asMalaysiaIso, proposeStudyPlan, type StudyTask } from "../planning.ts";
import { tasksFrom, classBlocksFrom } from "../planning-demo.ts";
import type { Conflict } from "../conflicts.ts";
import type { NoticeItem } from "../connectors/types.ts";
import { describeChange } from "../sync/describe.ts";
import type { Change } from "../sync/types.ts";
import type { Fix, UpdatesProposal } from "../updates/types.ts";
import { checkFix } from "../updates/validate.ts";
import { SYSTEM_LABEL, type ExtractedFact } from "../world/types.ts";
import { fixContext, nowIso, type CampusToolContext } from "./campus.ts";

/**
 * The scripted reviewer: the no-AI path that turns a sync's changes, the facts read from notices and the
 * clashes code found into proposed fixes. It is the same logic whether or not Gemini is available, so the
 * demo never depends on the internet. Nothing here saves anything.
 */

const HOUR = 3_600_000;
const raw = (itemId: string) => itemId.split(":").slice(2).join(":");
const when = (ms: number) => { const d = new Date(ms); return `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}`; };

export function sourceLabel(change: Change): string {
  if (change.item.kind === "notice" && change.system === "mail") return `email: ${change.item.sender}, ${dateShort(new Date(change.item.date))}`;
  return change.system === "ac" ? "AC" : SYSTEM_LABEL[change.system];
}

/** A conflict-free slot for one assignment, using the same deterministic planner as the study plan. */
export function findSlot(task: StudyTask, ctx: CampusToolContext, exceptSessionId?: string): { start: string; end: string } | null {
  const existing = ctx.plan.studySessions.filter((s) => s.id !== exceptSessionId);
  const busy = [...classBlocksFrom(ctx.data.classes), ...ctx.plan.personalEvents.map((e) => ({ label: `Your event: ${e.title}`, start: e.start, end: e.end }))];
  try {
    const result = proposeStudyPlan({ prompt: "", tasks: [{ ...task, status: "todo" }], classes: busy, existing, now: nowIso(ctx), weekStart: asMalaysiaIso(WEEK_START.getTime()) });
    const first = result.sessions[0];
    return first ? { start: first.start, end: first.end } : null;
  } catch { return null; }
}

export type ReviewInput = {
  ctx: CampusToolContext;
  /** Validated facts by notice id. */
  facts: ReadonlyMap<string, ExtractedFact[]>;
  conflicts: readonly Conflict[];
};

export function planFixes({ ctx, facts, conflicts }: ReviewInput): UpdatesProposal {
  let n = 0;
  const id = () => `fix-${++n}`;
  const act: Fix[] = [];
  const noted: Fix[] = [];
  const asks: Fix[] = [];
  const tasks = tasksFrom(ctx.data.assignments, ctx.submitted);
  const movedSessions = new Set<string>();
  const clashSessionIds = new Map<string, Conflict>();
  for (const c of conflicts) if (c.kind === "class-clash" || c.kind === "stale-session" || c.kind === "after-deadline" || c.kind === "overlap") for (const r of c.refs) if (ctx.plan.studySessions.some((s) => s.id === r)) clashSessionIds.set(r, c);

  const moveSession = (sessionId: string, why: Conflict, source: string) => {
    if (movedSessions.has(sessionId)) return;
    const session = ctx.plan.studySessions.find((s) => s.id === sessionId);
    const task = tasks.find((t) => t.id === session?.taskId);
    if (!session || !task) return;
    movedSessions.add(sessionId);
    const slot = findSlot(task, ctx, sessionId);
    if (slot) act.push({ id: id(), type: "move_study_session", sessionId, start: slot.start, end: slot.end, reason: why.message, source });
    else act.push({ id: id(), type: "remove_study_session", sessionId, reason: `${why.message} No other free slot was found before the deadline.`, source });
  };

  for (const change of ctx.changes) {
    const src = sourceLabel(change);
    const sentence = describeChange(change).replace(/\s*\(source:[^)]*\)\s*$/, "");
    const item = change.item;

    if (item.kind === "notice") continue; // handled below, with what the message actually says

    noted.push({ id: id(), type: "acknowledge", changeId: change.id, summary: sentence, reason: `Noted so it stops showing as new.`, source: src });

    if (item.kind === "class") {
      for (const c of conflicts.filter((x) => x.kind === "class-clash" && x.refs.includes(raw(change.itemId)))) {
        for (const ref of c.refs) if (ctx.plan.studySessions.some((s) => s.id === ref)) moveSession(ref, c, src);
      }
    }
    if (item.kind === "deadline" && change.type === "changed") {
      for (const c of conflicts.filter((x) => x.kind === "stale-session" && x.refs.includes(change.id))) moveSession(c.refs[0], c, src);
      const due = Date.parse(item.due);
      const at = reminderBefore(due, 18, 1);
      if (at && due - DEMO_NOW.getTime() > 24 * HOUR && !item.submitted) {
        act.push({ id: id(), type: "add_reminder", title: `${item.title} is due tomorrow (${when(due)})`, at, reason: "The deadline moved, so an earlier reminder would have fired on the wrong day.", source: src });
      }
    }
    if (item.kind === "fee" && change.type === "added" && item.status !== "paid") {
      const due = Date.parse(item.due);
      const at = reminderBefore(due, 9, 3);
      if (at) act.push({ id: id(), type: "add_reminder", title: `Pay ${item.description} by ${dayShort(new Date(due))} ${dateShort(new Date(due))}`, at, ref: `fee:${raw(item.id)}`, reason: "Finance posted a new fee and nothing in your plan covers it.", source: src });
    }
  }

  // Study sessions that are still in trouble, whichever change caused it.
  for (const c of conflicts) {
    if (c.kind !== "after-deadline" && c.kind !== "stale-session") continue;
    const ref = c.refs.find((r) => ctx.plan.studySessions.some((s) => s.id === r));
    if (ref) moveSession(ref, c, "your plan");
  }

  for (const change of ctx.changes) {
    if (change.item.kind !== "notice") continue;
    const notice: NoticeItem = change.item;
    const src = sourceLabel(change);
    if (notice.source !== "mail") {
      noted.push({ id: id(), type: "acknowledge", changeId: change.id, summary: `${notice.source === "ac" ? "Academic Centre notice" : "Course announcement"}: ${notice.subject}`, reason: "Official notice. The class change it describes is listed separately.", source: src });
      continue;
    }
    const found = facts.get(notice.id) ?? [];
    const useful = found.filter((f) => f.type !== "no_action");
    const unsure = useful.filter((f) => f.confidence === "low");
    const sure = useful.filter((f) => f.confidence !== "low");

    for (const fact of sure) {
      if (fact.type === "event" && fact.newDate) {
        const start = Date.parse(fact.newDate);
        act.push({ id: id(), type: "add_calendar_event", title: fact.summary.replace(/,\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun).*$/, ""), start: fact.newDate, end: asMalaysiaIso(start + HOUR), ...(fact.newRoom ? { place: fact.newRoom } : {}), reason: `${notice.sender} wrote: "${fact.quote}"`, source: src });
      }
    }
    for (const fact of unsure) {
      asks.push({
        id: id(), type: "ask_question", changeId: change.id, quote: fact.quote,
        question: `${notice.sender} wrote "${fact.quote}". ${fact.reason ?? "I am not sure what this means."} I have not changed anything. Do you want to ask them?`,
        reason: fact.reason ?? "Low confidence, so I am asking instead of guessing.", source: src,
        ...(notice.address ? { to: { name: notice.sender, email: notice.address } } : {}),
      });
    }
    if (!unsure.length) {
      const agree = sure.filter((f) => f.type === "deadline" || f.type === "class_change").some((f) => ctx.changes.some((c) => c.itemId.endsWith(`:${f.targetId}`) && c.id !== change.id));
      const label = useful.length === 0 ? `No action needed: ${found[0]?.summary ?? notice.subject}` : `Read email "${notice.subject}"`;
      noted.push({ id: id(), type: "acknowledge", changeId: change.id, summary: label, reason: useful.length === 0 ? (found.length ? "Nothing in it needs you to act." : "Compass could not read this email offline, so it left it alone.") : agree ? "It agrees with the change Moodle or AC already shows." : "Handled above.", source: src });
    }
  }

  // Code checks every fix before the card is shown.
  const fixCtx = fixContext(ctx);
  const fixes: Fix[] = [];
  const rejected: UpdatesProposal["rejected"] = [];
  for (const fix of [...act, ...noted, ...asks]) {
    const check = checkFix(fix, ctx.plan, fixCtx);
    if (check.ok) fixes.push(check.warning ? { ...fix, warning: check.warning } : fix);
    else rejected.push({ summary: fix.type, error: check.error });
  }
  return { fixes, rejected, notes: ctx.failed.map((f) => `${SYSTEM_LABEL[f.system]} was unavailable at the last sync, so its data is from an earlier read. Try again later.`) };
}

/** A reminder `days` before `dueMs`, at `hour` Malaysian time, or null if that moment has already passed. */
function reminderBefore(dueMs: number, hour: number, days: number): string | null {
  const day = new Date(dueMs + 8 * HOUR - days * 24 * HOUR);
  day.setUTCHours(hour, 0, 0, 0);
  const at = day.getTime() - 8 * HOUR;
  return at > DEMO_NOW.getTime() ? asMalaysiaIso(at) : null;
}
