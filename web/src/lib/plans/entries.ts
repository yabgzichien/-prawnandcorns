import type { TimelineItem } from "../calendar/timeline.ts";
import { isBlock } from "../calendar/timeline.ts";
import { isTime } from "../events/checks.ts";
import { isDate } from "../library/policy.ts";
import type { PersonalEvent, Reminder } from "../updates/types.ts";

// ──────────────────────────────────────────────────────────────────────
// What the student writes into their own calendar by hand or through the assistant:
// calendar events, reminders and to-dos. Plain data and plain rules, so tests can load it.
// Nothing here touches a university record.
// ──────────────────────────────────────────────────────────────────────

export type Todo = { id: string; title: string; /** YYYY-MM-DD, optional */ due?: string; /** HH:MM, only together with a due date */ time?: string; done: boolean };

export type EntryKind = "event" | "todo" | "reminder";

/** One shape for the editor. For a to-do, `date` and `start` are the optional due date and time. For a reminder they are the day and time. */
export type EntryDraft = { kind: EntryKind; id?: string; title: string; date: string; start: string; end: string; place: string };

export const LIMITS = { title: 120, place: 60, events: 100, reminders: 100, todos: 200 } as const;

export const emptyDraft = (kind: EntryKind, date = "", start = "", end = ""): EntryDraft => ({ kind, title: "", date, start, end, place: "" });

export const isoOf = (date: string, time: string): string => `${date}T${time}:00+08:00`;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** An hour after a start, kept inside the same day. */
export const hourAfter = (start: string): string => (isTime(start) ? fromMin(Math.min(toMin(start) + 60, 23 * 60 + 59)) : "");

/** The one thing to fix first, in words, or null when the draft can be saved. */
export function validateDraft(d: EntryDraft): string | null {
  const title = d.title.trim();
  if (!title) return "Give it a title.";
  if (title.length > LIMITS.title) return `Keep the title to ${LIMITS.title} characters.`;
  if (d.kind === "todo") {
    if (d.date && !isDate(d.date)) return "Choose a valid due date.";
    if (d.start && !d.date) return "Choose a due date for that time, or clear the time.";
    if (d.start && !isTime(d.start)) return "Choose a valid time.";
    return null;
  }
  if (!isDate(d.date)) return "Choose a date.";
  if (!isTime(d.start)) return d.kind === "reminder" ? "Choose a time." : "Choose a start time.";
  if (d.kind === "event") {
    if (!isTime(d.end)) return "Choose an end time.";
    if (toMin(d.end) <= toMin(d.start)) return "The end must be after the start.";
    if (d.place.length > LIMITS.place) return `Keep the place to ${LIMITS.place} characters.`;
  }
  return null;
}

export const draftFromEvent = (e: PersonalEvent): EntryDraft => ({ kind: "event", id: e.id, title: e.title, date: e.start.slice(0, 10), start: e.start.slice(11, 16), end: e.end.slice(11, 16), place: e.place ?? "" });
export const draftFromReminder = (r: Reminder): EntryDraft => ({ kind: "reminder", id: r.id, title: r.title, date: r.at.slice(0, 10), start: r.at.slice(11, 16), end: "", place: "" });
export const draftFromTodo = (t: Todo): EntryDraft => ({ kind: "todo", id: t.id, title: t.title, date: t.due ?? "", start: t.time ?? "", end: "", place: "" });

/** A new id that is the same on the server and the client for the same input, so tests can rely on it. */
export const newEntryId = (kind: EntryKind, seed: string): string => `${kind === "event" ? "pe" : kind === "reminder" ? "rm" : "td"}-${seed}`;

export const eventFromDraft = (d: EntryDraft, id: string): PersonalEvent => ({ id, title: d.title.trim().slice(0, LIMITS.title), start: isoOf(d.date, d.start), end: isoOf(d.date, d.end), ...(d.place.trim() ? { place: d.place.trim().slice(0, LIMITS.place) } : {}) });
export const reminderFromDraft = (d: EntryDraft, id: string, keep?: Reminder): Reminder => ({ ...(keep ?? {}), id, title: d.title.trim().slice(0, LIMITS.title), at: isoOf(d.date, d.start) });
export const todoFromDraft = (d: EntryDraft, id: string, done = false): Todo => ({ id, title: d.title.trim().slice(0, LIMITS.title), done, ...(d.date ? { due: d.date, ...(d.start ? { time: d.start } : {}) } : {}) });

/** Replace the entry with the same id, or add it at the end. */
export function upsert<T extends { id: string }>(list: readonly T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export function sanitizeTodos(raw: unknown): Todo[] {
  if (!Array.isArray(raw)) return [];
  const out: Todo[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const r = t as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length > 150 || typeof r.title !== "string" || !r.title.trim() || r.title.length > 120) continue;
    const due = typeof r.due === "string" && isDate(r.due) ? r.due : undefined;
    const time = due && typeof r.time === "string" && isTime(r.time) ? r.time : undefined;
    out.push({ id: r.id, title: r.title, done: r.done === true, ...(due ? { due, ...(time ? { time } : {}) } : {}) });
    if (out.length >= LIMITS.todos) break;
  }
  return out;
}

/** What a new event would overlap, so the student sees it before saving. Cancelled classes and the entry being edited do not count. */
export function overlapsFor(items: readonly TimelineItem[], d: EntryDraft): TimelineItem[] {
  if (d.kind !== "event" || !isDate(d.date) || !isTime(d.start) || !isTime(d.end) || toMin(d.end) <= toMin(d.start)) return [];
  const a = toMin(d.start);
  const b = toMin(d.end);
  return items.filter((i) => {
    if (!isBlock(i) || i.date !== d.date || i.state === "cancelled") return false;
    if (d.id && (i.id === `saved:entry:${d.id}`)) return false;
    const s = toMin(i.start.slice(11, 16));
    const e = i.end && i.end.slice(0, 10) === i.start.slice(0, 10) ? toMin(i.end.slice(11, 16)) : s + 30;
    return s < b && a < e;
  });
}
