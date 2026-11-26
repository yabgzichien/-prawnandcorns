import { DEMO_NOW } from "../time.ts";
import { isDate, ymd } from "../library/policy.ts";
import { ITEM_BY_ID, ITEM_OFFICE_RULES, VENUE_BY_ID, VENUES } from "./catalogue.ts";
import { effectiveQty, effectiveVenueId, lineStatusOf } from "./decisions.ts";
import type { Decisions, EventApplication, EventDraft, Issue, ItemLine, VenueLine } from "./types.ts";

/**
 * The checks behind both screens. The student sees them before submitting, so a room that is already taken is
 * found in seconds instead of after a week. The ECA desk shows the same list as "Suggested": staff decide.
 * Plain code, no model. The numbers below are demo policy, not XMUM policy.
 */

export const LEAD_DAYS = 14;
export const SEMESTER_END = "2026-12-31";
export const VENUE_OPEN = "08:00";
export const VENUE_CLOSE = "22:00";
export const MAX_PARTICIPANTS = 500;
export const MAX_LINES = 20;

const DAY = 86_400_000;
const MY = 8 * 3_600_000;

export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }): boolean => toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
export const dayMs = (date: string): number => Date.parse(`${date}T00:00:00+08:00`);
export const addDays = (date: string, n: number): string => ymd(dayMs(date) + n * DAY);
export const weekdayOf = (date: string): number => new Date(Date.parse(`${date}T12:00:00+08:00`) + MY).getUTCDay();
export const isSunday = (date: string): boolean => isDate(date) && weekdayOf(date) === 0;
export const daysBetween = (from: string, to: string): number => Math.round((dayMs(to) - dayMs(from)) / DAY);

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Thu 10 Dec" */
export const dateLabel = (date: string): string => isDate(date) ? `${DAY_NAMES[weekdayOf(date)].slice(0, 3)} ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}` : date;
export const timeRange = (start: string, end: string): string => `${start} to ${end}`;

const issue = (level: Issue["level"], code: string, message: string, lineId?: string): Issue => ({ id: `${code}:${lineId ?? "event"}`, level, message, ...(lineId ? { lineId } : {}) });

/** A stable form of an issue, for tests and for deduplicating in the UI. */
export const issueKey = (i: Issue) => `${i.level}|${i.lineId ?? ""}|${i.message}`;

export type Holder = { app: EventApplication; line: VenueLine; status: "Approved" | "Approve With Condition" | "Pending"; venueId: string };

/** Other applications that hold or have asked for this room at an overlapping time on the same day. Refused lines do not count. */
export function venueHolders(venueId: string, date: string, start: string, end: string, others: readonly EventApplication[], decisions: Decisions): Holder[] {
  const out: Holder[] = [];
  for (const app of others) {
    for (const line of app.lines) {
      if (line.kind !== "venue" || line.date !== date) continue;
      const status = lineStatusOf(decisions, app.id, line.id);
      if (status === "Rejected") continue;
      const room = effectiveVenueId(decisions, app.id, line);
      if (room !== venueId || !overlaps({ start, end }, line)) continue;
      out.push({ app, line, status, venueId: room });
    }
  }
  return out;
}

/** Items from other applications that are out on the same days, so stock can be compared. */
export function itemsOut(itemId: string, collectDate: string, returnDate: string, others: readonly EventApplication[], decisions: Decisions): number {
  let total = 0;
  for (const app of others) {
    for (const line of app.lines) {
      if (line.kind !== "item" || line.itemId !== itemId) continue;
      if (lineStatusOf(decisions, app.id, line.id) === "Rejected") continue;
      if (line.collectDate <= returnDate && collectDate <= line.returnDate) total += effectiveQty(decisions, app.id, line);
    }
  }
  return total;
}

export function itemsLeft(itemId: string, collectDate: string, returnDate: string, others: readonly EventApplication[], decisions: Decisions): number {
  const item = ITEM_BY_ID[itemId];
  return item ? Math.max(0, item.stock - itemsOut(itemId, collectDate, returnDate, others, decisions)) : 0;
}

export function checkApplication(draft: EventDraft, others: readonly EventApplication[], decisions: Decisions, now: Date = DEMO_NOW): Issue[] {
  const out: Issue[] = [];
  const today = ymd(now.getTime());
  // the position keeps ids unique and the same for the same input, so React keeps rows steady between renders
  const push = (i: Issue) => { out.push({ ...i, id: `${i.id}:${out.length}` }); };

  if (!draft.name.trim()) push({ ...issue("problem", "name", "Give the event a name."), missing: true });
  if (!draft.organisers.trim()) push({ ...issue("problem", "organisers", "Say which club or clubs are organising it."), missing: true });
  if (!Number.isInteger(draft.participants) || draft.participants < 1 || draft.participants > MAX_PARTICIPANTS) push({ ...issue("problem", "participants", `Enter the number of participants, from 1 to ${MAX_PARTICIPANTS}.`), missing: true });
  if (!draft.adviser.name.trim()) push({ ...issue("problem", "adviser", "Add your adviser's name. They are told about the application."), missing: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.adviser.email.trim())) push({ ...issue("problem", "adviser-email", "Add your adviser's email address."), missing: true });

  const dateOk = isDate(draft.date);
  if (!dateOk) push({ ...issue("problem", "date", "Choose the event date."), missing: true });
  else if (draft.date <= today) push(issue("problem", "date-past", "That date has already started or passed. Choose a later day."));
  else {
    if (draft.date > SEMESTER_END) push(issue("problem", "date-late", "Demo policy: events must be inside this semester, which ends on 31 Dec 2026."));
    const lead = daysBetween(today, draft.date);
    if (lead < LEAD_DAYS && draft.date <= SEMESTER_END) push(issue("warning", "lead", `Short notice: the event is in ${lead} day${lead === 1 ? "" : "s"}. Offices ask for ${LEAD_DAYS} days (demo policy), so some lines may be declined.`));
  }
  const timesOk = isTime(draft.start) && isTime(draft.end);
  if (!timesOk) push(issue("problem", "times", "Choose the start and end time."));
  else if (toMinutes(draft.end) <= toMinutes(draft.start)) push(issue("problem", "times-order", "The event must end after it starts."));

  if (draft.lines.length === 0) push(issue("problem", "no-lines", "Add at least one room or item."));
  if (draft.lines.length > MAX_LINES) push(issue("problem", "too-many", `One application can hold up to ${MAX_LINES} lines. Split the rest into a second application.`));

  // rooms
  const venueLines = draft.lines.filter((l): l is VenueLine => l.kind === "venue");
  const seen = new Set<string>();
  for (const line of venueLines) {
    const venue = VENUE_BY_ID[line.venueId];
    if (!venue) { push(issue("problem", "venue-unknown", "That room is not on the list.", line.id)); continue; }
    if (!isDate(line.date)) { push(issue("problem", "venue-date", `${venue.name}: choose a date.`, line.id)); continue; }
    if (!isTime(line.start) || !isTime(line.end) || toMinutes(line.end) <= toMinutes(line.start)) { push(issue("problem", "venue-times", `${venue.name}: the end time must be after the start time.`, line.id)); continue; }
    if (line.date <= today) push(issue("problem", "venue-past", `${venue.name}: that day has already started or passed.`, line.id));
    if (toMinutes(line.start) < toMinutes(VENUE_OPEN) || toMinutes(line.end) > toMinutes(VENUE_CLOSE)) push(issue("problem", "venue-hours", `${venue.name}: rooms can be used from ${VENUE_OPEN} to ${VENUE_CLOSE} only.`, line.id));
    const dupe = `${line.venueId}|${line.date}`;
    if (venueLines.some((o) => o !== line && o.venueId === line.venueId && o.date === line.date && overlaps(o, line)) && !seen.has(dupe)) push(issue("problem", "venue-dupe", `${venue.name} appears twice for the same time. Remove one.`, line.id));
    seen.add(dupe);
    if (timesOk && dateOk && line.date === draft.date && (toMinutes(line.start) > toMinutes(draft.start) || toMinutes(line.end) < toMinutes(draft.end))) push(issue("warning", "venue-short", `${venue.name} is booked for ${timeRange(line.start, line.end)}, which does not cover the whole event (${timeRange(draft.start, draft.end)}). Add time for set up and clearing up.`, line.id));
    for (const h of venueHolders(line.venueId, line.date, line.start, line.end, others, decisions)) {
      const who = h.app.organisers || "another club";
      if (h.status === "Pending") push(issue("warning", "venue-asked", `${who} has also asked for ${venue.name} on ${dateLabel(line.date)}, ${timeRange(h.line.start, h.line.end)}. The ECA office answers in the order requests arrive.`, line.id));
      else push(issue("problem", "venue-taken", `${venue.name} is already approved for ${who} on ${dateLabel(line.date)}, ${timeRange(h.line.start, h.line.end)}. Choose another room or time.`, line.id));
    }
  }
  const validVenues = [...new Map(venueLines.filter((l) => VENUE_BY_ID[l.venueId] && (!timesOk || !dateOk || l.date === draft.date)).map((l) => [l.venueId, VENUE_BY_ID[l.venueId]])).values()];
  if (validVenues.length > 0 && Number.isInteger(draft.participants) && draft.participants > 0) {
    const capacity = validVenues.reduce((n, v) => n + v.capacity, 0);
    if (capacity < draft.participants) push(issue("warning", "capacity", `The rooms you picked hold about ${capacity} people and you expect ${draft.participants}. Add a room or ask for a bigger one.`));
  }
  if (venueLines.length === 0 && draft.lines.length > 0) push(issue("info", "no-venue", "No room requested. That is fine if the event is outdoors or the room is booked elsewhere."));

  // items
  const itemLines = draft.lines.filter((l): l is ItemLine => l.kind === "item");
  const wanted = new Map<string, number>();
  for (const line of itemLines) {
    const item = ITEM_BY_ID[line.itemId];
    if (!item) { push(issue("problem", "item-unknown", "That item is not on the list.", line.id)); continue; }
    if (!Number.isInteger(line.qty) || line.qty < 1) { push(issue("problem", "item-qty", `${item.name}: enter how many you need.`, line.id)); continue; }
    wanted.set(line.itemId, (wanted.get(line.itemId) ?? 0) + line.qty);
    if (line.qty > item.maxPerRequest) push(issue("problem", "item-max", `${item.name}: one application can ask for at most ${item.maxPerRequest}.`, line.id));
    if (!isDate(line.collectDate) || !isDate(line.returnDate)) { push(issue("problem", "item-dates", `${item.name}: choose the collect and return dates.`, line.id)); continue; }
    if (line.returnDate < line.collectDate) { push(issue("problem", "item-order", `${item.name}: the return date cannot be before the collect date.`, line.id)); continue; }
    if (line.collectDate <= today) push(issue("problem", "item-past", `${item.name}: the collect date has already started or passed.`, line.id));
    const rule = ITEM_OFFICE_RULES[item.office];
    if (isSunday(line.collectDate) || isSunday(line.returnDate)) push(issue("warning", "item-sunday", `${item.name}: the office is closed on Sundays (demo). Pick another day.`, line.id));
    const left = itemsLeft(line.itemId, line.collectDate, line.returnDate, others, decisions);
    if (line.qty <= item.maxPerRequest && line.qty > left) push(issue("warning", "item-stock", `${item.name}: only ${left} left on those dates because other clubs have asked too. Staff may approve fewer.`, line.id));
    if (dateOk && timesOk && line.returnDate === draft.date && toMinutes(rule.return.end) <= toMinutes(draft.end)) push(issue("warning", "item-return-early", `${item.name}: the return window (${timeRange(rule.return.start, rule.return.end)}) closes before your event ends at ${draft.end}. Return it the next working day instead.`, line.id));
    if (dateOk && timesOk && line.collectDate === draft.date && toMinutes(rule.collect.end) > toMinutes(draft.start)) push(issue("warning", "item-collect-late", `${item.name}: collection ends at ${rule.collect.end}, after your event starts at ${draft.start}. Collect the day before.`, line.id));
    push(issue("info", "item-where", `Collect ${item.name.toLowerCase()} from ${rule.place}, ${timeRange(rule.collect.start, rule.collect.end)}. Return ${timeRange(rule.return.start, rule.return.end)}.`, line.id));
  }
  for (const [itemId, qty] of wanted) {
    const item = ITEM_BY_ID[itemId];
    if (itemLines.filter((l) => l.itemId === itemId).length > 1 && qty > item.maxPerRequest) push(issue("problem", "item-max-total", `${item.name}: the lines add up to ${qty}, more than the ${item.maxPerRequest} one application may ask for.`));
  }

  // arrangements
  for (const line of draft.lines) {
    if (line.kind !== "care") continue;
    if (!line.description.trim()) push(issue("problem", "care-text", "Say what you need from the Operation and Maintenance Office.", line.id));
    if (!isDate(line.date) || !isTime(line.start) || !isTime(line.end) || toMinutes(line.end) <= toMinutes(line.start)) push(issue("problem", "care-times", "Choose a day and a start and end time for the arrangement.", line.id));
    else if (line.date <= today) push(issue("problem", "care-past", "That day has already started or passed.", line.id));
  }
  return out;
}

export const problemsOf = (issues: readonly Issue[]) => issues.filter((i) => i.level === "problem");
export const warningsOf = (issues: readonly Issue[]) => issues.filter((i) => i.level === "warning");
export const issuesForLine = (issues: readonly Issue[], lineId: string) => issues.filter((i) => i.lineId === lineId);

/** Free rooms of at least this many seats at that time, smallest first. Rooms another club holds are left out. */
export function freeVenues(date: string, start: string, end: string, minCapacity: number, others: readonly EventApplication[], decisions: Decisions, exclude: readonly string[] = []) {
  return VENUES
    .filter((v) => v.capacity >= minCapacity && !exclude.includes(v.id))
    .map((v) => ({ venue: v, holders: venueHolders(v.id, date, start, end, others, decisions) }))
    .filter((x) => !x.holders.some((h) => h.status !== "Pending"))
    .sort((a, b) => Number(a.holders.length > 0) - Number(b.holders.length > 0) || a.venue.capacity - b.venue.capacity || a.venue.id.localeCompare(b.venue.id))
    .map((x) => ({ ...x.venue, asked: x.holders.length > 0 }));
}
