import { isDate } from "../library/policy.ts";
import { STUDENT } from "../data/academics.ts";
import { ARRANGEMENT_LABEL, type ArrangementType, type Decisions, type EventApplication, type EventDraft, type EventLine } from "./types.ts";
import { ITEM_BY_ID, ITEM_OFFICE_RULES, VENUE_BY_ID } from "./catalogue.ts";
import { addDays, isTime, MAX_LINES, MAX_PARTICIPANTS } from "./checks.ts";
import { APP_ID, LINE_ID } from "./decisions.ts";

const MY_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const long = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[ \t]+/g, " ").trim().slice(0, max) : "");

export const MAX_SAVED_APPLICATIONS = 5;

/** The next free application number. Numbers the desk has already answered are never reused. */
export function nextApplicationId(existing: readonly { id: string }[], decisions: Decisions = {}): string {
  const used = new Set([...existing.map((e) => e.id), ...Object.keys(decisions)]);
  for (let n = 1; n < 100; n++) {
    const id = `DEMO-EVT-${String(n).padStart(4, "0")}`;
    if (!used.has(id)) return id;
  }
  return `DEMO-EVT-${String(existing.length + 1).padStart(4, "0")}`;
}

/** The first free line id for a new line, such as v1, v2, i1. */
export function nextLineId(lines: readonly EventLine[], kind: EventLine["kind"]): string {
  const prefix = kind === "venue" ? "v" : kind === "item" ? "i" : "c";
  const used = new Set(lines.map((l) => l.id));
  for (let n = 1; n < 100; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
  return `${prefix}99`;
}

/** The default dates for an item, following the office's rules: ECA and IT hand out the day before, PAMO on the day. */
export function defaultItemDates(itemId: string, eventDate: string): { collectDate: string; returnDate: string } {
  const item = ITEM_BY_ID[itemId];
  const offset = item ? ITEM_OFFICE_RULES[item.office].collectDayOffset : 0;
  return { collectDate: addDays(eventDate, offset), returnDate: addDays(eventDate, 1) };
}

function cleanLine(raw: unknown): EventLine | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (typeof l.id !== "string" || !LINE_ID.test(l.id)) return null;
  if (l.kind === "venue") {
    if (typeof l.venueId !== "string" || !VENUE_BY_ID[l.venueId] || !isDate(l.date) || !isTime(l.start) || !isTime(l.end)) return null;
    return { kind: "venue", id: l.id, venueId: l.venueId, date: l.date, start: l.start, end: l.end };
  }
  if (l.kind === "item") {
    if (typeof l.itemId !== "string" || !ITEM_BY_ID[l.itemId] || !Number.isInteger(l.qty) || (l.qty as number) < 1 || (l.qty as number) > 999 || !isDate(l.collectDate) || !isDate(l.returnDate)) return null;
    return { kind: "item", id: l.id, itemId: l.itemId, qty: l.qty as number, collectDate: l.collectDate, returnDate: l.returnDate };
  }
  if (l.kind === "care") {
    if (typeof l.arrangement !== "string" || !(l.arrangement in ARRANGEMENT_LABEL) || !isDate(l.date) || !isTime(l.start) || !isTime(l.end)) return null;
    const description = long(l.description, 300);
    if (!description) return null;
    return { kind: "care", id: l.id, arrangement: l.arrangement as ArrangementType, description, date: l.date, start: l.start, end: l.end };
  }
  return null;
}

/** Cleans saved applications. Anything malformed is dropped, so a damaged save never breaks a page. */
export function sanitizeApplications(raw: unknown): EventApplication[] {
  if (!Array.isArray(raw)) return [];
  const out: EventApplication[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || !APP_ID.test(e.id) || ids.has(e.id)) continue;
    if (typeof e.submittedAt !== "string" || !MY_ISO.test(e.submittedAt)) continue;
    if (!isDate(e.date) || !isTime(e.start) || !isTime(e.end)) continue;
    const adviser = e.adviser && typeof e.adviser === "object" ? e.adviser as Record<string, unknown> : {};
    const participants = Number.isInteger(e.participants) && (e.participants as number) >= 1 && (e.participants as number) <= MAX_PARTICIPANTS ? e.participants as number : 0;
    const name = clip(e.name, 100);
    if (!name || !participants) continue;
    const seenLines = new Set<string>();
    const lines: EventLine[] = [];
    for (const rawLine of Array.isArray(e.lines) ? e.lines.slice(0, MAX_LINES) : []) {
      const line = cleanLine(rawLine);
      if (!line || seenLines.has(line.id)) continue;
      seenLines.add(line.id);
      lines.push(line);
    }
    if (lines.length === 0) continue;
    ids.add(e.id);
    out.push({
      id: e.id, submittedAt: e.submittedAt, applicant: { name: STUDENT.name, id: STUDENT.id },
      name, organisers: clip(e.organisers, 120), participants, date: e.date, start: e.start, end: e.end,
      description: long(e.description, 600), adviser: { name: clip(adviser.name, 80), email: clip(adviser.email, 100) }, lines,
    });
    if (out.length >= MAX_SAVED_APPLICATIONS) break;
  }
  return out;
}

/** Builds the saved application from a reviewed draft. */
export function applicationFrom(draft: EventDraft, id: string, submittedAt: string): EventApplication {
  return {
    id, submittedAt, applicant: { name: STUDENT.name, id: STUDENT.id },
    name: draft.name.trim().slice(0, 100), organisers: draft.organisers.trim().slice(0, 120), participants: draft.participants,
    date: draft.date, start: draft.start, end: draft.end, description: draft.description.trim().slice(0, 600),
    adviser: { name: draft.adviser.name.trim().slice(0, 80), email: draft.adviser.email.trim().slice(0, 100) },
    lines: draft.lines.slice(0, MAX_LINES),
  };
}

export const emptyDraft = (): EventDraft => ({
  name: "", organisers: "", participants: 0, date: "", start: "16:00", end: "22:00", description: "",
  adviser: { name: "", email: "" }, lines: [],
});

/** Applications from the same club on the same day, such as a rooms request and an items request for one event. */
export function relatedApplications(app: EventApplication, all: readonly EventApplication[]): EventApplication[] {
  return all.filter((o) => o.id !== app.id && o.date === app.date && o.organisers.toLowerCase() === app.organisers.toLowerCase());
}
