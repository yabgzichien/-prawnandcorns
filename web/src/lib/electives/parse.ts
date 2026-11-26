import type { Meeting, ParsedSchedule } from "./types.ts";

/**
 * Plain code, not AI: reads the AC's schedule text into weekly meetings. It understands the shapes the AC uses:
 * "Tue 2:00 PM - 4:00 PM", "Mon & Wed 10:00-11:00", "Thursdays 4pm to 6pm", "Weeks 1-7", "Wk 8-14",
 * "Sat 09:00-17:00 on 13 Mar and 20 Mar 2027", several parts split by ";" or " / ", and a room code.
 * Anything it cannot read is returned as unreadable, never guessed.
 */

export const SEMESTER = { name: "Semester 2", weeks: 14, week1: "2027-03-01" } as const; // demo dates: week 1 starts Monday 1 March 2027
const DAY_MS = 86_400_000;
const WEEK1 = Date.UTC(2027, 2, 1);
const ALL_WEEKS = Array.from({ length: SEMESTER.weeks }, (_, i) => i + 1);

const DAY_WORDS: [RegExp, number][] = [
  [/\b(mon|mondays?)\b/, 0], [/\b(tue|tues|tuesdays?)\b/, 1], [/\b(wed|weds|wednesdays?)\b/, 2],
  [/\b(thu|thur|thurs|thursdays?)\b/, 3], [/\b(fri|fridays?)\b/, 4], [/\b(sat|saturdays?)\b/, 5], [/\b(sun|sundays?)\b/, 6],
];
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const pad = (n: number) => String(n).padStart(2, "0");

/** Semester week and weekday of a date, or null outside the semester. */
export function weekOf(utcMs: number): { week: number; day: number } | null {
  const days = Math.round((utcMs - WEEK1) / DAY_MS);
  const week = Math.floor(days / 7) + 1;
  if (days < 0 || week > SEMESTER.weeks) return null;
  return { week, day: ((days % 7) + 7) % 7 };
}

/** The calendar date of a week and day, as "6 Mar". */
export function dateOf(week: number, day: number): string {
  const d = new Date(WEEK1 + ((week - 1) * 7 + day) * DAY_MS);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
}

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?`;
const RANGE = new RegExp(`${TIME}\\s*(?:-|–|to|until)\\s*${TIME}`, "i");

function toMinutes(h: string, m: string | undefined, ap: string | undefined): number | null {
  let hour = Number(h);
  const min = m ? Number(m) : 0;
  if (hour > 23 || min > 59) return null;
  const mer = ap?.toLowerCase().replace(/\./g, "");
  if (mer === "pm" && hour < 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  return hour * 60 + min;
}

function readTime(text: string): { start: string; end: string; rest: string } | null {
  for (const m of text.matchAll(new RegExp(RANGE.source, "gi"))) {
    const [, h1, m1, ap1, h2, m2, ap2] = m;
    // a plain "1-14" is a week range, not a time: a time has minutes or am/pm somewhere
    if (!m1 && !m2 && !ap1 && !ap2) continue;
    // "2-4pm": the second meridiem applies to the first time too
    const first = ap1 ?? (ap2 && Number(h1) <= Number(h2) ? ap2 : undefined);
    const a = toMinutes(h1, m1, first), b = toMinutes(h2, m2, ap2);
    if (a === null || b === null || b <= a) return null;
    return { start: `${pad(Math.floor(a / 60))}:${pad(a % 60)}`, end: `${pad(Math.floor(b / 60))}:${pad(b % 60)}`, rest: text.replace(m[0], " ") };
  }
  return null;
}

function readWeeks(text: string): { weeks: number[] | null; rest: string } {
  let rest = text;
  const range = /\b(?:weeks?|wks?)\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/i.exec(rest);
  if (range) {
    const a = Number(range[1]), b = Number(range[2]);
    rest = rest.replace(range[0], " ");
    if (a < 1 || b > SEMESTER.weeks || b < a) return { weeks: [], rest };
    return { weeks: Array.from({ length: b - a + 1 }, (_, i) => a + i), rest };
  }
  const list = /\b(?:weeks?|wks?)\s*(\d{1,2}(?:\s*(?:,|and|&)\s*\d{1,2})+)\b/i.exec(rest);
  if (list) {
    rest = rest.replace(list[0], " ");
    const weeks = list[1].split(/\s*(?:,|and|&)\s*/).map(Number);
    return { weeks: weeks.every((w) => w >= 1 && w <= SEMESTER.weeks) ? [...new Set(weeks)].sort((x, y) => x - y) : [], rest };
  }
  if (/\bodd weeks\b/i.test(rest)) return { weeks: ALL_WEEKS.filter((w) => w % 2 === 1), rest: rest.replace(/\bodd weeks\b/i, " ") };
  if (/\beven weeks\b/i.test(rest)) return { weeks: ALL_WEEKS.filter((w) => w % 2 === 0), rest: rest.replace(/\beven weeks\b/i, " ") };
  return { weeks: null, rest };
}

/** "6, 13 and 20 March 2027" or "13 Mar and 20 Mar 2027". Returns UTC midnights. */
function readDates(text: string): { dates: number[]; bad: boolean; rest: string } {
  const re = /((?:\d{1,2}(?:st|nd|rd|th)?\s*(?:,|and|&)?\s*)+)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/gi;
  const found: { days: number[]; month: number; year?: number; raw: string }[] = [];
  for (const m of text.matchAll(re)) found.push({ days: m[1].split(/\s*(?:,|and|&)\s*|\s+/).filter(Boolean).map((d) => parseInt(d, 10)), month: MONTHS[m[2].toLowerCase().slice(0, 3)], year: m[3] ? Number(m[3]) : undefined, raw: m[0] });
  if (!found.length) return { dates: [], bad: false, rest: text };
  const year = found.find((f) => f.year)?.year ?? 2027;
  let rest = text;
  let bad = false;
  const dates: number[] = [];
  for (const f of found) {
    rest = rest.replace(f.raw, " ");
    for (const d of f.days) {
      const ms = Date.UTC(f.year ?? year, f.month, d);
      if (new Date(ms).getUTCDate() !== d) { bad = true; continue; }
      dates.push(ms);
    }
  }
  return { dates: [...new Set(dates)].sort((a, b) => a - b), bad, rest };
}

const ROOM = /\b([A-D]\d-[A-Z0-9]{2,5})\b/;

function parsePart(raw: string): { meetings: Meeting[]; unreadable?: string; flexible?: boolean } {
  const part = raw.trim();
  if (!part) return { meetings: [] };
  if (/\b(tba|tbc|to be (announced|confirmed))\b/i.test(part)) return { meetings: [], unreadable: part };
  const room = ROOM.exec(part)?.[1];
  let text = room ? part.replace(room, " ") : part;
  if (!/[a-z0-9]/i.test(text)) return { meetings: [] }; // only a room, which the other parts share
  const time = readTime(text);
  if (!time) {
    if (/\b(online|self-paced|asynchronous)\b/i.test(part)) return { meetings: [], flexible: true };
    return { meetings: [], unreadable: part };
  }
  text = time.rest;
  const dated = readDates(text);
  text = dated.rest;
  const weeks = readWeeks(text);
  text = weeks.rest.toLowerCase();
  if (dated.bad || (weeks.weeks !== null && weeks.weeks.length === 0)) return { meetings: [], unreadable: part };

  if (dated.dates.length) {
    const meetings: Meeting[] = [];
    for (const ms of dated.dates) {
      const at = weekOf(ms);
      if (!at) return { meetings: [], unreadable: part };
      const same = meetings.find((m) => m.day === at.day);
      if (same) { same.weeks.push(at.week); same.dates!.push(dateOf(at.week, at.day)); }
      else meetings.push({ day: at.day, start: time.start, end: time.end, weeks: [at.week], dates: [dateOf(at.week, at.day)], ...(room ? { room } : {}) });
    }
    return { meetings };
  }
  const days = DAY_WORDS.filter(([re]) => re.test(text)).map(([, d]) => d);
  if (!days.length) return { meetings: [], unreadable: part };
  return { meetings: days.map((day) => ({ day, start: time.start, end: time.end, weeks: weeks.weeks ?? ALL_WEEKS, ...(room ? { room } : {}) })) };
}

/** "Tue 09:00-11:00 and Thu 09:00-10:00" is two meetings with different times: cut after each time range. */
function splitTimes(part: string): string[] {
  const ends: number[] = [];
  for (const m of part.matchAll(new RegExp(RANGE.source, "gi"))) if (m[2] || m[3] || m[5] || m[6]) ends.push((m.index ?? 0) + m[0].length);
  if (ends.length < 2) return [part];
  const out: string[] = [];
  let from = 0;
  ends.forEach((end, i) => { out.push(part.slice(from, i === ends.length - 1 ? part.length : end)); from = end; });
  return out;
}

export function parseSchedule(text: string): ParsedSchedule {
  const out: ParsedSchedule = { meetings: [], unreadable: [], flexible: false };
  const source = (text ?? "").slice(0, 400);
  // a room or week range written once at the end belongs to every part before it
  const sharedRoom = ROOM.exec(source)?.[1];
  for (const part of source.split(/;|\s\/\s|\n/).flatMap(splitTimes)) {
    const r = parsePart(part);
    out.meetings.push(...r.meetings.map((m) => (m.room || !sharedRoom ? m : { ...m, room: sharedRoom })));
    if (r.unreadable) out.unreadable.push(r.unreadable);
    if (r.flexible) out.flexible = true;
  }
  if (!source.trim()) out.unreadable.push("(no time given)");
  return out;
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const dayShortOf = (d: number) => DAY_SHORT[d];

/** "weeks 1 to 7", "every week", "weeks 2, 5 and 9" */
export function weeksLabel(weeks: number[]): string {
  if (weeks.length === SEMESTER.weeks) return "every week";
  const sorted = [...weeks].sort((a, b) => a - b);
  const run = sorted.every((w, i) => i === 0 || w === sorted[i - 1] + 1);
  if (run && sorted.length > 2) return `weeks ${sorted[0]} to ${sorted[sorted.length - 1]}`;
  if (sorted.length === 1) return `week ${sorted[0]}`;
  return `weeks ${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
}

/** "Tue 14:00 to 16:00, every week" or "Sat 09:00 to 12:00 on 6 Mar, 13 Mar and 20 Mar" */
export function meetingLabel(m: Meeting): string {
  const when = m.dates?.length ? `on ${m.dates.length === 1 ? m.dates[0] : `${m.dates.slice(0, -1).join(", ")} and ${m.dates[m.dates.length - 1]}`}` : weeksLabel(m.weeks);
  return `${DAY_SHORT[m.day]} ${m.start} to ${m.end}, ${when}`;
}
