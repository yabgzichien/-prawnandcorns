import { CORE_CREDITS, CORE_SEM2, GE_BY_CODE, GE_CATALOGUE, SEMESTER_CREDIT_LIMIT, type CoreClass } from "./catalogue.ts";
import { dayShortOf, parseSchedule, weeksLabel } from "./parse.ts";
import { ALLOWED_STREAMS, type GeCourse, type Interest, type Meeting, type ParsedSchedule, type Stream, type TimePrefs } from "./types.ts";

/** Plain code, not AI: which electives a student may take, what clashes, and which sets add up to the credits needed. */

const PARSED = new Map<string, ParsedSchedule>(GE_CATALOGUE.map((c) => [c.code, parseSchedule(c.schedule)]));
export const parsedOf = (code: string): ParsedSchedule => PARSED.get(code) ?? parseSchedule(GE_BY_CODE[code]?.schedule ?? "");

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The weeks two meetings share at overlapping times, or an empty list. */
export function sharedWeeks(a: Meeting, b: Meeting): number[] {
  if (a.day !== b.day || !(toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end))) return [];
  const wb = new Set(b.weeks);
  return a.weeks.filter((w) => wb.has(w));
}

export type Clash = { with: string; label: string; day: number; start: string; weeks: number[] };

const coreLabel = (c: CoreClass) => `${c.code} ${c.kind}`;
const whenText = (c: Clash) => `${dayShortOf(c.day)} ${c.start}${c.weeks.length < 14 ? `, ${weeksLabel(c.weeks)}` : ""}`;
export const clashText = (c: Clash) => `Clashes with ${c.label}, ${whenText(c)}`;

export function coreClashes(code: string, core: readonly CoreClass[] = CORE_SEM2): Clash[] {
  const out: Clash[] = [];
  for (const m of parsedOf(code).meetings) for (const c of core) {
    const weeks = sharedWeeks(m, c.meeting);
    if (weeks.length) out.push({ with: c.code, label: coreLabel(c), day: m.day, start: m.start > c.meeting.start ? m.start : c.meeting.start, weeks });
  }
  return out;
}

export function electiveClashes(code: string, others: readonly string[]): Clash[] {
  const out: Clash[] = [];
  for (const other of others) {
    if (other === code || !GE_BY_CODE[other]) continue;
    for (const a of parsedOf(code).meetings) for (const b of parsedOf(other).meetings) {
      const weeks = sharedWeeks(a, b);
      if (weeks.length) out.push({ with: other, label: `${other} ${GE_BY_CODE[other].title}`, day: a.day, start: a.start > b.start ? a.start : b.start, weeks });
    }
  }
  return out;
}

export type CourseStatus =
  | { kind: "fits"; message: string }
  | { kind: "stream" | "full" | "unreadable" | "core-clash" | "ge-clash"; message: string; clashes?: Clash[] };

/** Why a course can or cannot be chosen, in words. The first rule that fails is the one shown. */
export function courseStatus(course: GeCourse, stream: Stream, selected: readonly string[] = []): CourseStatus {
  if (!ALLOWED_STREAMS[stream].includes(course.stream)) return { kind: "stream", message: `${stream} stream students cannot take ${course.stream} electives` };
  if (course.seats <= 0) return { kind: "full", message: "Full: no seats left" };
  const parsed = parsedOf(course.code);
  if (parsed.unreadable.length || (!parsed.meetings.length && !parsed.flexible)) return { kind: "unreadable", message: "Compass could not read this time. Check it on the AC." };
  const core = coreClashes(course.code);
  if (core.length) return { kind: "core-clash", message: clashText(core[0]), clashes: core };
  const ge = electiveClashes(course.code, selected);
  if (ge.length) return { kind: "ge-clash", message: clashText(ge[0]), clashes: ge };
  return { kind: "fits", message: parsed.flexible && !parsed.meetings.length ? "No fixed time, fits any timetable" : "Fits your timetable" };
}

/** A course that could ever be part of a valid set for this student. */
export const choosable = (course: GeCourse, stream: Stream) => {
  const k = courseStatus(course, stream).kind;
  return k === "fits";
};

export type SetSuggestion = { codes: string[]; credits: number; score: number; reasons: string[]; warnings: string[]; exact: boolean };

const prefBreaks = (code: string, prefs: TimePrefs): string[] => {
  const out: string[] = [];
  for (const m of parsedOf(code).meetings) {
    if (prefs.noSaturday && m.day === 5) out.push("Saturday");
    if (prefs.freeFriday && m.day === 4 && toMin(m.end) > 12 * 60) out.push("Friday afternoon");
    if (prefs.noEvening && toMin(m.end) > 18 * 60) out.push("after 6 pm");
    if (prefs.noEarly && toMin(m.start) < 9 * 60) out.push("before 9 am");
  }
  return [...new Set(out)];
};

function scoreSet(codes: string[], interests: readonly Interest[], prefs: TimePrefs): { score: number; matched: Interest[]; breaks: string[]; lowSeats: GeCourse[] } {
  let score = -0.5 * codes.length;
  const matched = new Set<Interest>();
  const breaks: string[] = [];
  const lowSeats: GeCourse[] = [];
  for (const code of codes) {
    const c = GE_BY_CODE[code];
    const hits = c.tags.filter((t) => interests.includes(t));
    hits.forEach((h) => matched.add(h));
    if (hits.length) score += 3 + (hits.length - 1);
    const b = prefBreaks(code, prefs);
    score -= 6 * b.length;
    breaks.push(...b.map((x) => `${code} meets ${x === "Saturday" ? "on a Saturday" : x === "Friday afternoon" ? "on Friday afternoon" : x}`));
    if (c.seats <= 5) { score -= 1; lowSeats.push(c); }
  }
  return { score, matched: [...matched], breaks, lowSeats };
}

/**
 * Sets of electives that add up to the credits needed, with no clash with the core timetable or each other,
 * ranked by the student's interests and time preferences. When no set adds up exactly, the closest sets above
 * (then below) the target are offered and say so.
 */
export function suggestSets(input: { stream: Stream; target: number; interests: readonly Interest[]; prefs: TimePrefs; count?: number }): SetSuggestion[] {
  const { stream, target, interests, prefs, count = 3 } = input;
  const pool = GE_CATALOGUE.filter((c) => choosable(c, stream)).sort((a, b) => a.code.localeCompare(b.code));
  const sets: string[][] = [];
  const walk = (start: number, picked: string[], credits: number) => {
    if (picked.length) sets.push([...picked]);
    if (picked.length >= 4) return;
    for (let i = start; i < pool.length; i++) {
      const c = pool[i];
      if (credits + c.credits > target + 1) continue;
      if (electiveClashes(c.code, picked).length) continue;
      walk(i + 1, [...picked, c.code], credits + c.credits);
    }
  };
  walk(0, [], 0);
  const creditsOf = (codes: string[]) => codes.reduce((n, code) => n + GE_BY_CODE[code].credits, 0);
  let chosen = sets.filter((s) => creditsOf(s) === target);
  if (!chosen.length) chosen = sets.filter((s) => creditsOf(s) === target + 1);
  if (!chosen.length) { const best = Math.max(0, ...sets.map(creditsOf)); chosen = sets.filter((s) => creditsOf(s) === best); }
  const ranked = chosen.map((codes) => {
    const credits = creditsOf(codes);
    const s = scoreSet(codes, interests, prefs);
    const reasons: string[] = [credits === target ? `Adds up to exactly ${target} credits` : `${credits} credits: no set adds up to exactly ${target}`];
    if (s.matched.length) reasons.push(`Matches your interests: ${s.matched.join(", ")}`);
    reasons.push("No clash with your core classes or with each other");
    const kept = (Object.keys(prefs) as (keyof TimePrefs)[]).filter((k) => prefs[k]);
    if (kept.length && !s.breaks.length) reasons.push("Keeps to your time preferences");
    const warnings = [...s.breaks, ...s.lowSeats.map((c) => `Only ${c.seats} seat${c.seats === 1 ? "" : "s"} left in ${c.code}`)];
    return { codes, credits, score: s.score, reasons, warnings, exact: credits === target };
  });
  return ranked.sort((a, b) => b.score - a.score || a.codes.length - b.codes.length || a.codes.join().localeCompare(b.codes.join())).slice(0, count);
}

export type ShortlistCheck = { ok: boolean; problems: string[]; warnings: string[]; credits: number };

/** Checked again before saving, whatever the screen showed. Problems block saving; warnings do not. */
export function checkShortlist(codes: readonly string[], stream: Stream, target: number): ShortlistCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const known = codes.filter((c) => GE_BY_CODE[c]);
  if (known.length !== codes.length) problems.push("A course in the shortlist is no longer offered.");
  if (new Set(known).size !== known.length) problems.push("A course is in the shortlist twice.");
  for (const code of known) {
    const st = courseStatus(GE_BY_CODE[code], stream, known);
    if (st.kind !== "fits") problems.push(`${code}: ${st.message}.`);
  }
  const credits = known.reduce((n, c) => n + GE_BY_CODE[c].credits, 0);
  if (CORE_CREDITS + credits > SEMESTER_CREDIT_LIMIT) problems.push(`That makes ${CORE_CREDITS + credits} credits with your core courses, over the ${SEMESTER_CREDIT_LIMIT} credit limit for a semester.`);
  if (credits < target) warnings.push(`${target - credits} credit${target - credits === 1 ? "" : "s"} short of the ${target} you need.`);
  if (credits > target) warnings.push(`${credits - target} credit${credits - target === 1 ? "" : "s"} more than the ${target} you need.`);
  if (known.length === 0) problems.push("Choose at least one elective.");
  return { ok: problems.length === 0, problems: [...new Set(problems)], warnings, credits };
}

export function sanitizeShortlist(raw: unknown): { codes: string[]; target: number; savedAt: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.codes) || typeof r.savedAt !== "string" || !Number.isFinite(Date.parse(r.savedAt))) return null;
  const codes = [...new Set(r.codes.filter((c): c is string => typeof c === "string" && !!GE_BY_CODE[c]))].slice(0, 6);
  const target = Number.isInteger(r.target) && (r.target as number) >= 1 && (r.target as number) <= 8 ? (r.target as number) : 4;
  return codes.length ? { codes, target, savedAt: r.savedAt } : null;
}
