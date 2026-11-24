import { DEMO_NOW } from "../time.ts";
import { LIBRARY_ROOM_BY_ID } from "./rooms.ts";

/**
 * The booking rules, in plain code. Times are Malaysian wall clock (UTC+8) and "now" is the demo clock.
 * Rules: campus users only; two-hour slots; book up to three days ahead counting today; one slot per person
 * per day; cancel any time until 15 minutes after the start; slots cannot be handed to someone else.
 */

export const SLOTS = [
  { index: 0, start: "09:00", end: "11:00" },
  { index: 1, start: "11:00", end: "13:00" },
  { index: 2, start: "13:00", end: "15:00" },
  { index: 3, start: "15:00", end: "17:00" },
  { index: 4, start: "17:00", end: "19:00" },
  { index: 5, start: "19:00", end: "21:00" },
] as const;

export const MAX_DAYS_AHEAD = 3; // today plus two more days
export const CANCEL_GRACE_MINUTES = 15;

/** The rules in plain words, written for this demo. The booking page and the library desk show the same list. */
export const BOOKING_RULES: readonly string[] = [
  "Library rooms are for campus users only, in fixed two-hour slots from 09:00 to 21:00.",
  `Book up to ${MAX_DAYS_AHEAD} days ahead, counting today. Each person can book one slot per day.`,
  `Cancel any time before the start, and up to ${CANCEL_GRACE_MINUTES} minutes after it. Then you can book another room if one is free.`,
  "A booking cannot be handed to someone else. The person who booked must be in the room.",
  "Student success room 3 is for 5 to 10 people. The other rooms hold 2 or 4.",
];

/** What Compass keeps for each booking. Everything else is worked out from these three facts. */
export type LibraryBooking = { id: string; roomId: string; date: string; slot: number };

const MY = 8 * 3_600_000;
const DAY = 86_400_000;

export const ymd = (ms: number) => new Date(ms + MY).toISOString().slice(0, 10);
export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00+08:00`));

/** Today and the next two days. */
export function bookableDates(now: Date = DEMO_NOW): string[] {
  return Array.from({ length: MAX_DAYS_AHEAD }, (_, i) => ymd(now.getTime() + i * DAY));
}

export function slotWindow(date: string, slot: number): { start: string; end: string } {
  const s = SLOTS[slot];
  return { start: `${date}T${s.start}:00+08:00`, end: `${date}T${s.end}:00+08:00` };
}

export const bookingId = (roomId: string, date: string, slot: number) => `lb-${roomId}-${date}-${slot}`;

export const hasStarted = (date: string, slot: number, now: Date = DEMO_NOW) => Date.parse(slotWindow(date, slot).start) <= now.getTime();

export type Check = { ok: true } | { ok: false; error: string };

/** Everything the rules say about a new booking. The booking page and the agent both ask this. */
export function checkBooking(request: { roomId: string; date: string; slot: number }, existing: readonly LibraryBooking[], now: Date = DEMO_NOW): Check {
  if (!LIBRARY_ROOM_BY_ID[request.roomId]) return { ok: false, error: "That room does not exist." };
  if (!Number.isInteger(request.slot) || request.slot < 0 || request.slot >= SLOTS.length) return { ok: false, error: "Choose one of the two-hour slots." };
  if (!isDate(request.date) || !bookableDates(now).includes(request.date)) return { ok: false, error: `Rooms can be booked up to ${MAX_DAYS_AHEAD} days ahead, counting today.` };
  if (hasStarted(request.date, request.slot, now)) return { ok: false, error: "That slot has already started." };
  const sameDay = existing.find((b) => b.date === request.date);
  if (sameDay) return { ok: false, error: sameDay.roomId === request.roomId && sameDay.slot === request.slot ? "You have already booked this slot." : `You already have a booking on this day (${sameDay.roomId}, ${SLOTS[sameDay.slot].start}). Each person can book one two-hour slot per day.` };
  return { ok: true };
}

/** A booking can be cancelled up to 15 minutes after it starts. */
export function cancelDeadline(booking: LibraryBooking): Date {
  return new Date(Date.parse(slotWindow(booking.date, booking.slot).start) + CANCEL_GRACE_MINUTES * 60_000);
}

export function checkCancel(booking: LibraryBooking, now: Date = DEMO_NOW): Check {
  return now.getTime() <= cancelDeadline(booking).getTime()
    ? { ok: true }
    : { ok: false, error: `Bookings can only be cancelled until ${CANCEL_GRACE_MINUTES} minutes after they start.` };
}

/** Drops anything malformed or duplicated from saved data, so a damaged save never breaks the page. */
export function sanitizeBookings(raw: unknown): LibraryBooking[] {
  if (!Array.isArray(raw)) return [];
  const out: LibraryBooking[] = [];
  const days = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const b = entry as Partial<LibraryBooking>;
    if (typeof b.roomId !== "string" || !LIBRARY_ROOM_BY_ID[b.roomId] || !isDate(b.date) || !Number.isInteger(b.slot) || (b.slot as number) < 0 || (b.slot as number) >= SLOTS.length) continue;
    if (days.has(b.date)) continue; // one slot per day
    days.add(b.date);
    out.push({ id: bookingId(b.roomId, b.date, b.slot as number), roomId: b.roomId, date: b.date, slot: b.slot as number });
  }
  return out.slice(0, 6);
}
