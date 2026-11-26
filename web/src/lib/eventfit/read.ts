import { DEMO_EVENT_HOST, EVENTS } from "../data/life.ts";
import { addDays, isTime } from "../events/checks.ts";
import { parseDate, parseTimes } from "../events/request.ts";
import { isDate, ymd } from "../library/policy.ts";
import { DEMO_NOW } from "../time.ts";

/**
 * Reading an event into a few fields the student can see and edit. Plain code, and nothing is fetched:
 * a link is only matched against the fictional demo events list. Whatever the source says is data.
 * The fields propose; the check in ./check.ts decides.
 */

export type EventFields = {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hour */
  start: string;
  end: string;
  place: string;
};

export type FieldSource = "text" | "demo-link" | "picture" | "typed";

export type EventReading = {
  fields: EventFields;
  source: FieldSource;
  /** No end time was given, so the end is the start plus DEFAULT_MINUTES. */
  assumedEnd: boolean;
  /** What the student still has to fill in before the check can run. */
  missing: ("date" | "start")[];
  /** Said to the student, for example that a link was not opened. */
  notes: string[];
};

export const DEFAULT_MINUTES = 120;
const LIMITS = { title: 80, place: 60 } as const;

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
const ROOM_RE = /\b([AB]\d-(?:G\d{2}|L\d|\d{3}))\b|\b(B1 Hall|Lakeside Walk|Lakefront Caf[eé]|Library)\b/i;

/** Text without control characters, trimmed to a length. Text read from a page or a poster is never trusted further than this. */
export const cleanText = (v: unknown, max: number): string => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export const findUrl = (text: string): string | null => text.match(URL_RE)?.[0].replace(/[).,;]+$/, "") ?? null;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The end after a start, by default two hours later, kept on the same day. */
export function defaultEnd(start: string): string {
  return isTime(start) ? fromMin(Math.min(toMin(start) + DEFAULT_MINUTES, 23 * 60 + 59)) : "";
}

/** "7.30pm" and "7:30 PM" read the same; a single time with no range. */
function singleTime(t: string): string {
  const m = t.match(/\b(?:at|from|starts?(?: at)?|time:?)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h < 24 && min < 60 ? fromMin(h * 60 + min) : "";
}

/** A date without a year that has already passed this year means next year: a poster for "5 Jan" in November is for January. */
function upcoming(date: string, text: string, now: Date): string {
  if (!date) return "";
  const today = ymd(now.getTime());
  if (date >= addDays(today, -1) || /\b20\d{2}\b/.test(text)) return date;
  const next = `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`;
  return isDate(next) ? next : date;
}

function titleFrom(text: string): string {
  const quoted = text.match(/["“]([^"”]{3,80})["”]/);
  if (quoted) return quoted[1];
  const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l && !URL_RE.test(l) && !/^(can|could|should|am|is|do|does|will|would)\b/i.test(l));
  if (firstLine && firstLine.length <= 80) return firstLine.replace(/[.!:]+$/, "");
  const called = text.match(/\b(?:to|for|join|attend)\s+(?:the\s+)?([A-Z][\w'&-]*(?:\s+[A-Z][\w'&:-]*){0,6})/);
  return called?.[1] ?? "";
}

function finish(fields: EventFields, source: FieldSource, notes: string[]): EventReading {
  const missing: EventReading["missing"] = [];
  if (!isDate(fields.date)) missing.push("date");
  if (!isTime(fields.start)) missing.push("start");
  let end = fields.end;
  let assumedEnd = false;
  if (isTime(fields.start) && (!isTime(end) || toMin(end) <= toMin(fields.start))) { end = defaultEnd(fields.start); assumedEnd = true; }
  return { fields: { ...fields, end }, source, assumedEnd, missing, notes };
}

/** An event from pasted text: a poster's words, a message from a friend, or a question with the details in it. */
export function readEventText(text: string, now: Date = DEMO_NOW): EventReading {
  const raw = text.slice(0, 2000);
  const t = raw.toLowerCase().replace(/(\d)\.(\d{2})\s*(am|pm)/g, "$1:$2$3").replace(/\s+/g, " ");
  const date = upcoming(parseDate(t, now), t, now);
  const range = parseTimes(t);
  const start = range.start || singleTime(t);
  const place = raw.match(ROOM_RE)?.[0] ?? cleanText(raw.match(/\b(?:venue|location|place|where)\s*:?\s*([^\n,.;]{2,60})/i)?.[1], LIMITS.place);
  const fields: EventFields = { title: cleanText(titleFrom(raw), LIMITS.title), date, start, end: range.end, place: cleanText(place, LIMITS.place) };
  return finish(fields, "text", []);
}

/** A pasted link. Only the fictional demo events are known; any other link is not opened. */
export function readEventLink(url: string): EventReading | { unknownLink: string } {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { unknownLink: cleanText(url, 80) }; }
  if (parsed.hostname === DEMO_EVENT_HOST) {
    const ev = EVENTS.find((e) => new URL(e.link).pathname === parsed.pathname.replace(/\/+$/, ""));
    if (ev) return finish({ title: ev.title, date: ev.date, start: ev.start, end: ev.end, place: ev.where }, "demo-link", [`Read from the demo events list. ${DEMO_EVENT_HOST} is a made-up address.`]);
  }
  return { unknownLink: parsed.hostname };
}

/** Fields that came from somewhere untrusted (a model reading a picture, a tool call). Anything malformed is dropped, never guessed. */
export function sanitizeFields(raw: unknown, source: FieldSource): EventReading {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = typeof r.date === "string" && isDate(r.date) ? r.date : "";
  const start = typeof r.start === "string" && isTime(r.start) ? r.start : "";
  const end = typeof r.end === "string" && isTime(r.end) ? r.end : "";
  return finish({ title: cleanText(r.title, LIMITS.title), date, start, end, place: cleanText(r.place, LIMITS.place) }, source, []);
}

const EVENT_WORD = /\b(events?|talks?|workshops?|fair|night|competition|hack-?day|hackathon|seminar|concert|party|fun run|show|festival|meet-?up|open day|ceremony|match|screening|exhibition|webinar|gig)\b/;

/** A question about going to something, rather than organising it, joining a club or choosing electives. */
export const isEventFitQuestion = (text: string): boolean => {
  const t = text.toLowerCase();
  if (/\b(book|reserve|borrow)\b.*\b(classrooms?|rooms?|venues?|chairs?|tables?|megaphones?|projectors?)\b/.test(t)) return false;
  if (/\b(electives?|ge courses?|general electives?|credits?)\b/.test(t)) return false;
  const event = EVENT_WORD.test(t);
  const url = !!findUrl(text);
  if (/\b(can i|could i|should i|am i able to|will i be able to)\s+(go|make it|attend|participate|take part)\b/.test(t)) return true;
  if (/\b(want to|wanna|like to)\s+(go|attend|participate|take part)\b/.test(t) && (event || url)) return true;
  if (/\b(join|come to)\b/.test(t) && event && /\b(can i|could i|should i|fit|free|clash)\b/.test(t)) return true;
  if (/\b(do(?:es)? (?:this|it|that) (?:event )?(?:fit|clash|work)|am i free (?:for|on|at)|is (?:this|that|it) (?:a )?clash|check (?:this|the|my|an) event)\b/.test(t)) return true;
  if (/\b(fit my (?:time|timetable|schedule)|clash with my (?:classes|timetable))\b/.test(t) && (event || url)) return true;
  return url && /\b(event|talk|workshop|fair|night|competition|hack|seminar|go|attend|join|participate|fit|free)\b/.test(t);
};
