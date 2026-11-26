import { CLUBS } from "../data/life.ts";
import { DEMO_NOW } from "../time.ts";
import { isDate, ymd } from "../library/policy.ts";
import { ITEMS, ITEM_BY_ID, VENUE_BY_ID } from "./catalogue.ts";
import { addDays, dateLabel, freeVenues, isTime, toMinutes, weekdayOf, DAY_NAMES } from "./checks.ts";
import { defaultItemDates, nextLineId } from "./application.ts";
import type { Decisions, EventApplication, EventDraft, EventLine } from "./types.ts";

/**
 * Understanding "book 3 classrooms and 30 chairs for our Demo Night on 10 December from 4pm to 10pm, 80 people",
 * and preparing the draft application from it. Plain code, so the model never decides a room, a quantity or a
 * date. The student reviews every step of the draft and submits it.
 */

/** The example shown on the Club events page and in the assistant's suggestions. It names a club, so the draft is nearly complete. */
export const EVENT_EXAMPLE = "Book 3 classrooms, 30 plastic chairs, 10 banquet tables and 2 megaphones for our Robotics Demo Night on 10 December from 4pm to 10pm, 80 people. The Robotics & AI Society is organising it.";

export type EventRequest = {
  /** The message really is asking to book rooms or items for a club event. */
  isEventRequest: boolean;
  name: string;
  organisers: string;
  date: string;
  start: string;
  end: string;
  participants: number;
  /** "3 classrooms" */
  roomCount: number;
  /** The message asks for a room, even if it does not say how many. */
  wantsRooms: boolean;
  venueIds: string[];
  items: { itemId: string; qty: number }[];
  /** What was understood, in words the student can check. */
  summary: string;
  /** What the message did not say, so the form can ask. */
  missing: string[];
};

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20 };
const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const STRONG_EVENT = /\b(events?|activity|activities|committee|competition|tournament|workshop|fair|demo night|programme|program|eca|ceremony|concert|talk|seminar|camp|fundraiser|booth|club event|society event)\b/;
const WEAK_EVENT = /\b(our club|the club|my club|club|society|our society)\b/;
const VENUE_WORD = /\b(classrooms?|lecture (?:rooms?|halls?)|venues?|halls?|rooms?)\b/;
const LIBRARY_WORD = /\b(study|library|silent|quiet|discussion|group|success)\s+rooms?\b/;
const ASK_WORD = /\b(book|booking|reserve|request|apply|application|need|needs|borrow|get|arrange|want)\b/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NOT_ITEM_WORDS = new Set(["guest", "keynote", "invited", "special", "main", "featured", "panel"]);

type Alias = { itemId: string; re: RegExp; length: number };
const ALIASES: Alias[] = ITEMS.flatMap((item) => item.aliases.map((a) => ({ itemId: item.id, length: a.length, re: new RegExp(`(?:\\b(\\d{1,3}|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\\s*(?:x\\s*|pcs?\\s+of\\s+|units?\\s+of\\s+|sets?\\s+of\\s+)?(?:([a-z-]+)\\s+)?)(${a})\\b`, "g") }))).sort((a, b) => b.length - a.length);

/** The items asked for, with a number each. A word the request used twice is counted once. */
export function parseItems(text: string): { itemId: string; qty: number }[] {
  const t = text.toLowerCase();
  const used: [number, number][] = [];
  const found = new Map<string, number>();
  for (const alias of ALIASES) {
    alias.re.lastIndex = 0;
    for (const m of t.matchAll(alias.re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (used.some(([a, b]) => start < b && a < end)) continue;
      if (m[2] && NOT_ITEM_WORDS.has(m[2])) continue;
      const qty = Number(m[1]) || NUMBER_WORDS[m[1]] || 0;
      if (!qty) continue;
      used.push([start, end]);
      found.set(alias.itemId, (found.get(alias.itemId) ?? 0) + qty);
    }
  }
  return [...found].map(([itemId, qty]) => ({ itemId, qty }));
}

export function parseDate(t: string, now: Date): string {
  const today = ymd(now.getTime());
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso && isDate(iso[0])) return iso[0];
  const dayFirst = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_RE}\\b`));
  const monthFirst = t.match(new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const pick = dayFirst ? { d: Number(dayFirst[1]), m: dayFirst[2] } : monthFirst ? { d: Number(monthFirst[2]), m: monthFirst[1] } : null;
  if (pick) {
    const month = MONTH_NAMES.indexOf(pick.m.slice(0, 3)) + 1;
    const year = Number(today.slice(0, 4));
    const candidate = `${year}-${String(month).padStart(2, "0")}-${String(pick.d).padStart(2, "0")}`;
    if (isDate(candidate) && Number(candidate.slice(8, 10)) === pick.d) return candidate;
  }
  const slash = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const candidate = `${Number(today.slice(0, 4))}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
    if (isDate(candidate)) return candidate;
  }
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  const named = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  if (named >= 0) {
    const nextWeek = /\bnext\s+(?:week\s+)?/.test(t);
    let n = (named - weekdayOf(today) + 7) % 7;
    if (n === 0) n = 7;
    if (nextWeek && n < 7) n += 7;
    return addDays(today, n);
  }
  return "";
}

const toHhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export function parseTimes(t: string): { start: string; end: string } {
  const clock = "(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?";
  const range = t.match(new RegExp(`\\b${clock}\\s*(?:to|until|till|-|\\u2013|and)\\s*${clock}\\b`));
  if (range) {
    const [, h1, m1, ap1, h2, m2, ap2] = range;
    const to24 = (h: number, ap: string | undefined) => (ap === "pm" && h < 12 ? h + 12 : ap === "am" && h === 12 ? 0 : h);
    let a = to24(Number(h1), ap1);
    const b = to24(Number(h2), ap2);
    if (!ap1 && ap2 && Number(h1) <= 12) {
      // "4-10pm": the first time borrows the second one's am or pm, unless that puts it after the end
      a = to24(Number(h1), ap2);
      if (a >= b) a = to24(Number(h1), ap2 === "pm" ? "am" : "pm");
    }
    if (a < 24 && b < 24 && Number(m1 ?? 0) < 60 && Number(m2 ?? 0) < 60 && a * 60 + Number(m1 ?? 0) < b * 60 + Number(m2 ?? 0)) return { start: toHhmm(a, Number(m1 ?? 0)), end: toHhmm(b, Number(m2 ?? 0)) };
  }
  return { start: "", end: "" };
}

function parseName(text: string): string {
  const quoted = text.match(/["“]([^"”]{3,80})["”]/);
  if (quoted) return quoted[1].trim();
  const called = text.match(/\b(?:called|named|titled)\s+(.{3,70}?)(?=\s+(?:on|from|at|for|with|in)\b|[,.;]|$)/i);
  if (called) return called[1].trim();
  const ours = text.match(/\bfor\s+(?:our|the|my)\s+(.{3,70}?)(?=\s+(?:on|from|at|for|with|in|this|next)\b|[,.;]|$)/i);
  const candidate = ours?.[1].trim() ?? "";
  if (!candidate || /^(club|society|committee|event|activity|activities|club event|society event|event day|programme|program)$/i.test(candidate)) return "";
  return candidate.replace(/^\w/, (c) => c.toUpperCase());
}

function parseOrganisers(t: string): string {
  const hits = CLUBS.filter((c) => t.includes(c.name.toLowerCase().replace(/&/g, "and")) || t.includes(c.name.toLowerCase()) || new RegExp(`\\b${esc(c.name.split(/[ &]/)[0].toLowerCase())}\\b`).test(t) && /\b(club|society|guild|corps)\b/.test(t));
  return hits.map((c) => c.name).slice(0, 2).join(" and ");
}

export function parseEventRequest(text: string, now: Date = DEMO_NOW): EventRequest {
  const t = text.toLowerCase().replace(/\s+/g, " ");
  const items = parseItems(t);
  const codes = [...text.toUpperCase().matchAll(/\b([AB]\d-(?:G\d{2}|B\d{2}(?:-\d)?|\d{3}))\b/g)].map((m) => m[1]).filter((id) => VENUE_BY_ID[id]);
  const countMatch = t.match(/\b(\d{1,2}|an?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:big |large |small )?(?:classrooms?|lecture (?:rooms?|halls?)|venues?|rooms?)\b/);
  const roomCount = countMatch ? Number(countMatch[1]) || NUMBER_WORDS[countMatch[1]] || 0 : 0;
  const hasVenueAsk = codes.length > 0 || roomCount > 0 || (VENUE_WORD.test(t) && ASK_WORD.test(t));
  const strong = STRONG_EVENT.test(t);
  const weak = WEAK_EVENT.test(t);
  const isEventRequest = !/\b(e-?mail|mail|draft)\b/.test(t) && ASK_WORD.test(t) && (hasVenueAsk || items.length > 0) && (strong || (weak && (items.length > 0 || roomCount > 1 || codes.length > 0))) && !(LIBRARY_WORD.test(t) && !strong);

  const people = t.match(/\b(\d{1,3})\s*(?:people|pax|participants|students|attendees|members|persons|guests|audience)\b/);
  const date = parseDate(t, now);
  const { start, end } = parseTimes(t);
  const name = parseName(text);
  const organisers = parseOrganisers(t);
  const participants = people ? Number(people[1]) : 0;

  const venueIds = [...new Set(codes)];
  const parts = [
    name || "an event",
    date ? dateLabel(date) : "",
    start && end ? `${start} to ${end}` : "",
    participants ? `${participants} people` : "",
    venueIds.length ? `rooms ${venueIds.join(", ")}` : roomCount ? `${roomCount} room${roomCount === 1 ? "" : "s"}` : "",
    items.length ? items.map((i) => `${i.qty} ${ITEM_BY_ID[i.itemId].name.toLowerCase()}`).join(", ") : "",
  ].filter(Boolean);
  const missing = [
    name ? "" : "the event name",
    organisers ? "" : "which club is organising it",
    date ? "" : "the date",
    start && end ? "" : "the start and end time",
    participants ? "" : "how many people are coming",
  ].filter(Boolean);
  return { isEventRequest, name, organisers, date, start, end, participants, roomCount, wantsRooms: hasVenueAsk, venueIds, items, summary: parts.join(", "), missing };
}

export type DraftResult = { draft: EventDraft; notes: string[] };

/** Turns what was understood into a draft application. Rooms are picked from the ones free at that time; the student can change every line. */
export function draftFromRequest(req: EventRequest, others: readonly EventApplication[], decisions: Decisions, adviser: { name: string; email: string } = { name: "", email: "" }): DraftResult {
  const notes: string[] = [];
  const date = req.date;
  const start = isTime(req.start) ? req.start : "16:00";
  const end = isTime(req.end) ? req.end : "22:00";
  const lines: EventLine[] = [];

  // rooms: the ones named, then enough free ones to hold everybody. Set up time is added in front of the event.
  const eventMinutes = toMinutes(start);
  const roomStart = eventMinutes >= 9 * 60 ? toHhmm(Math.floor((eventMinutes - 60) / 60), eventMinutes % 60) : start;
  let chosen = req.venueIds.filter((id) => VENUE_BY_ID[id]);
  if (chosen.length === 0 && req.roomCount > 0 && date) {
    const target = Math.max(1, Math.ceil((req.participants || req.roomCount) / req.roomCount));
    let pool = freeVenues(date, roomStart, end, target, others, decisions);
    if (pool.length < req.roomCount) pool = freeVenues(date, roomStart, end, 1, others, decisions);
    chosen = pool.slice(0, req.roomCount).map((v) => v.id);
    if (chosen.length < req.roomCount) notes.push(`Only ${chosen.length} room${chosen.length === 1 ? " is" : "s are"} free at that time, so I could not pick ${req.roomCount}.`);
    else notes.push(`I picked the smallest free rooms that fit: ${chosen.join(", ")}.`);
  } else if (chosen.length === 0 && req.wantsRooms && date && req.participants > 0) {
    const pool = freeVenues(date, roomStart, end, req.participants, others, decisions);
    if (pool[0]) { chosen = [pool[0].id]; notes.push(`One room is enough for ${req.participants} people: ${pool[0].id}.`); }
    else notes.push(`No single room holds ${req.participants} people at that time. Add two or more rooms on the Rooms step.`);
  }
  for (const venueId of chosen) lines.push({ kind: "venue", id: nextLineId(lines, "venue"), venueId, date, start: roomStart, end });

  // items, with the dates the owning office works to
  for (const item of req.items) {
    const dates = date ? defaultItemDates(item.itemId, date) : { collectDate: "", returnDate: "" };
    lines.push({ kind: "item", id: nextLineId(lines, "item"), itemId: item.itemId, qty: item.qty, ...dates });
  }
  const draft: EventDraft = {
    name: req.name,
    organisers: req.organisers,
    participants: req.participants,
    date, start, end,
    description: req.name ? `${req.name}, organised by ${req.organisers || "our club"}.` : "",
    adviser,
    lines,
  };
  return { draft, notes };
}

/** "Thu 10 Dec" for the weekday the date falls on, for prompts. */
export const weekdayName = (date: string): string => (isDate(date) ? DAY_NAMES[weekdayOf(date)] : "");

/** Phrases that ask how an application is going, rather than starting a new one. */
export const isEventStatusQuestion = (text: string): boolean => /\b(status|update|answer|reply|heard back|approved|approval|decision|any news|how is|how's)\b/i.test(text) && /\b(event application|event booking|events? (?:booking|application)|my (?:event|application)s?|(?:venue|item) (?:booking|application|request)s?|booking slip|eca office)\b/i.test(text) && !/\b(book|reserve)\b/i.test(text);
