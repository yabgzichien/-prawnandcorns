import { COURSES } from "../data/academics.ts";
import { ROOM_BY_CODE } from "../data/campus.ts";
import { DEMO_NOW } from "../time.ts";
import type { ConflictInput } from "../conflicts.ts";
import type { Confidence, ExtractedFact } from "../world/types.ts";

/**
 * Code checks on facts read out of free-text notices. The model proposes; code decides.
 * Anything that fails a check is lowered to low confidence with a reason, and low confidence
 * is shown to the student as a question, never as a change.
 */

export const SEMESTER = { start: Date.parse("2026-08-24T00:00:00+08:00"), end: Date.parse("2026-12-31T23:59:00+08:00") };
const COURSE_CODES = new Set(COURSES.map((c) => c.code));
const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export type FactContext = Pick<ConflictInput, "classes" | "assignments">;

export function validateFacts(facts: readonly ExtractedFact[], noticeText: string, ctx: FactContext, now: Date = DEMO_NOW): ExtractedFact[] {
  const body = squash(noticeText);
  return facts.map((fact): ExtractedFact => {
    const problems: string[] = [];
    if (fact.type !== "no_action") {
      if (!fact.quote || !body.includes(squash(fact.quote))) problems.push("The quoted sentence is not in the message.");
      const needsDate = fact.type === "deadline" || fact.type === "event" || fact.type === "class_change";
      if (fact.newDate !== undefined) {
        const t = Date.parse(fact.newDate);
        if (!Number.isFinite(t)) problems.push("The date is not a real date.");
        else if (t < SEMESTER.start || t > SEMESTER.end) problems.push("The date is outside this semester.");
        else if (t < now.getTime() && fact.type !== "class_change") problems.push("That date has already passed.");
      } else if (needsDate && !(fact.type === "class_change" && fact.newRoom)) {
        problems.push(fact.reason ?? "The message gives no exact date.");
      }
      if (fact.newRoom !== undefined && !ROOM_BY_CODE[fact.newRoom]) problems.push(`Room ${fact.newRoom} is not on the campus map.`);
      if (fact.courseCode !== undefined && !COURSE_CODES.has(fact.courseCode)) problems.push(`${fact.courseCode} is not one of your courses.`);
      if (fact.targetId !== undefined) {
        const known = fact.type === "deadline" ? ctx.assignments.some((a) => a.id === fact.targetId) : fact.type === "class_change" ? ctx.classes.some((c) => c.id === fact.targetId) : true;
        if (!known) problems.push("That does not match any of your classes or deadlines.");
      }
    }
    if (!problems.length) return fact;
    const keepReason = fact.reason && problems.includes(fact.reason) ? [] : fact.reason ? [fact.reason] : [];
    return { ...fact, confidence: rank[fact.confidence] > 0 ? "low" : fact.confidence, reason: [...new Set([...keepReason, ...problems])].join(" ") };
  });
}

/** Shape the model's answer into facts. Anything that does not fit the format is dropped. */
export function parseFacts(raw: unknown): ExtractedFact[] {
  const list = raw && typeof raw === "object" && "facts" in raw ? (raw as { facts: unknown }).facts : raw;
  if (!Array.isArray(list)) return [];
  const types = new Set(["class_change", "deadline", "fee", "event", "no_action"]);
  const out: ExtractedFact[] = [];
  for (const entry of list.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.type !== "string" || !types.has(e.type) || typeof e.summary !== "string" || typeof e.quote !== "string") continue;
    const conf = e.confidence === "high" || e.confidence === "medium" || e.confidence === "low" ? e.confidence : "low";
    const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
    out.push({
      type: e.type as ExtractedFact["type"], confidence: conf, summary: e.summary.slice(0, 200), quote: e.quote.slice(0, 300),
      ...(str(e.courseCode, 12) ? { courseCode: str(e.courseCode, 12) } : {}),
      ...(str(e.targetId, 12) ? { targetId: str(e.targetId, 12) } : {}),
      ...(str(e.newDate, 40) ? { newDate: str(e.newDate, 40) } : {}),
      ...(str(e.newRoom, 20) ? { newRoom: str(e.newRoom, 20) } : {}),
      ...(str(e.reason, 200) ? { reason: str(e.reason, 200) } : {}),
    });
  }
  return out;
}
