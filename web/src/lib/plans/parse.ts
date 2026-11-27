import { dateLabel, isTime } from "../events/checks.ts";
import { parseDate, parseTimes } from "../events/request.ts";
import { isDate, ymd } from "../library/policy.ts";
import { DEMO_NOW } from "../time.ts";
import { hourAfter, type EntryDraft } from "./entries.ts";

/**
 * Reads "I have a dentist appointment this Friday at 3pm" or "remind me to buy a calculator tomorrow" into a draft
 * the student can see and edit. Plain code: it proposes, the student confirms, nothing is saved here.
 */

export type PlanReading = {
  isRequest: boolean;
  kind: "event" | "todo";
  draft: EntryDraft;
  /** What the student still has to fill in before it can be saved. */
  missing: ("title" | "date" | "start")[];
  assumedEnd: boolean;
  notes: string[];
};

const WEEKDAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const ROOM = /\b([AB]\d-(?:G\d{2}|L\d|\d{3}))\b|\b(B1 Hall|Lakeside Walk|Lakefront Caf[eé]|Library)\b/i;
const QUESTION = /^\s*(what|when|where|which|who|why|how|can|could|should|do|does|did|is|are|am|will|would)\b/i;
const TODO_WORD = /\b(remind me|reminder|to-?do|todo|task|don'?t (?:let me )?forget|need to|have to|must|should|note to self)\b/;
const STATEMENT = /\b(i have|i've got|i have got|i got|i'm having|i am having|we have|there'?s|there is|i will have|i'll have)\b/;
const ADD_VERB = /^\s*(?:please\s+|can you\s+|could you\s+)?(?:add|put|schedule|save|block|set up|create|note(?: down)?)\b/;
const TASKISH = /\b(due|deadline|submit|hand in|assignment|homework|report|essay)\b/;

const normal = (text: string) => text.toLowerCase().replace(/(\d)\.(\d{2})\s*(am|pm)/g, "$1:$2$3").replace(/\s+/g, " ").trim();

function singleTime(t: string): string {
  if (/\bnoon\b/.test(t)) return "12:00";
  const m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/) ?? t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : "";
}

const TITLE_LEAD = /^(?:i'?ve got|i have got|i have to|i have|i got|i'?m having|i am having|we have|there'?s|there is|i will have|i'?ll have|remind me to|remind me about|remind me|don'?t (?:let me )?forget to|don'?t (?:let me )?forget|i need to|i must|i should|need to|to-?do:?|todo:?|task:?)\s+/i;

function titleOf(raw: string): string {
  const quoted = raw.match(/["“]([^"”]{2,80})["”]/);
  if (quoted) return quoted[1].trim();
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:please\s+|can you\s+|could you\s+)?(?:add|put|schedule|save|block|set up|create|note(?: down)?)\s+/i, "");
  s = s.replace(/\b(?:to|in|on|into)\s+(?:my|the)\s+(?:calendar|to-?do(?: list)?|schedule|plans|tasks?)\b/gi, " ");
  s = s.replace(TITLE_LEAD, "");
  // a place goes to its own field
  s = s.replace(new RegExp(`\\b(?:at|in|@)\\s+(?:the\\s+)?${ROOM.source}`, "ig"), " ").replace(ROOM, " ");
  // times, then dates
  const clock = "\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?";
  s = s.replace(new RegExp(`\\b(?:from\\s+|at\\s+|by\\s+)?${clock}\\s*(?:to|until|till|-|\\u2013)\\s*${clock}\\b`, "ig"), " ");
  s = s.replace(/\b(?:at\s+|by\s+)?\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/ig, " ").replace(/\b(?:at\s+|by\s+)?(?:[01]?\d|2[0-3]):[0-5]\d\b/g, " ").replace(/\b(?:at\s+|by\s+)?noon\b/ig, " ");
  s = s.replace(/\b(?:on\s+|by\s+|due\s+|before\s+)?\d{4}-\d{2}-\d{2}\b/g, " ");
  s = s.replace(new RegExp(`\\b(?:on\\s+|by\\s+|due\\s+|before\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH}|${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`, "ig"), " ");
  s = s.replace(/\b(?:on\s+|by\s+|due\s+|before\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  s = s.replace(new RegExp(`\\b(?:(?:on|by|due|before|this|next|coming)\\s+)*${WEEKDAY}\\b`, "ig"), " ");
  s = s.replace(/\b(?:(?:on|by|due|before)\s+)?(?:day after tomorrow|tomorrow|today|tonight)\b/ig, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    s = s.replace(/^(?:on|at|by|for|due|from|in|to|a|an|the|my|and)\s+/i, "").replace(/\s+(?:on|at|by|for|due|from|in|to|and|this|next|a|an|the)$/i, "").replace(/^[,.:;\s-]+|[,.:;\s-]+$/g, "");
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function placeOf(raw: string): string {
  const room = raw.match(ROOM)?.[0];
  if (room) return room;
  const named = raw.match(/\b(?:at|in)\s+(?:the\s+)?([A-Z][\w']*(?:\s+[A-Z][\w']*){0,3})/);
  const word = named?.[1] ?? "";
  return word && !new RegExp(`^(?:${WEEKDAY}|${MONTH})\\b`, "i").test(word) ? word.slice(0, 60) : "";
}

/** True for a statement or an instruction that puts something on the student's calendar or to-do list. Questions are never one. */
export function parsePlanRequest(text: string, now: Date = DEMO_NOW): PlanReading {
  const raw = text.slice(0, 600);
  const t = normal(raw);
  const none: PlanReading = { isRequest: false, kind: "event", draft: { kind: "event", title: "", date: "", start: "", end: "", place: "" }, missing: [], assumedEnd: false, notes: [] };
  if (!t || QUESTION.test(t) || t.endsWith("?")) return none;

  const today = ymd(now.getTime());
  let date = parseDate(t, now);
  const rolled = !!date && date < today && !/\b20\d{2}\b/.test(t);
  if (rolled) { const next = `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`; if (isDate(next)) date = next; }
  const range = parseTimes(t);
  const start = range.start || singleTime(t);
  const hasWhen = !!date || !!start;

  const todoWord = TODO_WORD.test(t);
  const explicitAdd = ADD_VERB.test(t) || /\b(?:calendar|to-?do list|todo list)\b/.test(t) && /\b(add|put|save)\b/.test(t);
  const statement = STATEMENT.test(t) && !/\bi have to\b/.test(t);
  const isRequest = (todoWord && (hasWhen || /\b(remind|add|put|note|to-?do|todo|task)\b/.test(t))) || ((statement || explicitAdd) && hasWhen) || (explicitAdd && /\b(calendar|to-?do|todo|schedule)\b/.test(t));
  if (!isRequest) return none;

  const kind: "event" | "todo" = todoWord || (TASKISH.test(t) && !range.end) ? "todo" : "event";
  const title = titleOf(raw);
  const place = kind === "event" ? placeOf(raw) : "";
  let end = range.end;
  let assumedEnd = false;
  if (kind === "event" && isTime(start) && !isTime(end)) { end = hourAfter(start); assumedEnd = true; }
  const draft: EntryDraft = { kind, title, date: date && isDate(date) ? date : "", start: kind === "todo" && !date ? "" : start, end: kind === "event" ? end : "", place };
  const missing: PlanReading["missing"] = [];
  if (!title) missing.push("title");
  if (kind === "event" && !draft.date) missing.push("date");
  if (kind === "event" && !isTime(draft.start)) missing.push("start");
  const notes: string[] = [];
  if (assumedEnd) notes.push("You did not say when it ends, so I assumed one hour. Change it if that is wrong.");
  if (rolled) notes.push(`That date has already passed this year, so I used ${dateLabel(draft.date)} next year.`);
  return { isRequest: true, kind, draft, missing, assumedEnd, notes };
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Fields a model passed to a tool. Anything malformed is dropped and then read from the student's own words, never guessed.
 * The result is still only a proposal: the student sees and edits it before anything is saved.
 */
export function readingFromArgs(args: Record<string, unknown>, request: string, now: Date = DEMO_NOW): PlanReading {
  const fromWords = parsePlanRequest(request, now);
  const kind: "event" | "todo" = args.kind === "todo" ? "todo" : args.kind === "event" ? "event" : fromWords.isRequest ? fromWords.kind : "event";
  const date = typeof args.date === "string" && isDate(args.date) ? args.date : fromWords.draft.date;
  const start = typeof args.start === "string" && isTime(args.start) ? args.start : fromWords.draft.start;
  let end = typeof args.end === "string" && isTime(args.end) ? args.end : kind === "event" ? fromWords.draft.end : "";
  let assumedEnd = false;
  if (kind === "event" && isTime(start) && (!isTime(end) || end <= start)) { end = hourAfter(start); assumedEnd = true; }
  const title = clean(args.title, 120) || fromWords.draft.title;
  const draft: EntryDraft = { kind, title, date: kind === "todo" && !date ? "" : date, start: kind === "todo" && !date ? "" : start, end: kind === "event" ? end : "", place: kind === "event" ? clean(args.place, 60) || fromWords.draft.place : "" };
  const missing: PlanReading["missing"] = [];
  if (!title) missing.push("title");
  if (kind === "event" && !draft.date) missing.push("date");
  if (kind === "event" && !isTime(draft.start)) missing.push("start");
  return { isRequest: true, kind, draft, missing, assumedEnd, notes: assumedEnd ? ["No end time was given, so one hour was assumed. Change it if that is wrong."] : [] };
}
