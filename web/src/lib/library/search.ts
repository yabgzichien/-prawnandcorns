import { DEMO_NOW } from "../time.ts";
import type { LibraryDay } from "./client.ts";
import { bookableDates, checkBooking, SLOTS, type LibraryBooking } from "./policy.ts";
import { LIBRARY_ROOM_BY_ID, type RoomCategory } from "./rooms.ts";

/**
 * Understanding "book me a study room for two tomorrow at 3pm", and finding rooms that fit. Plain code, so the
 * assistant never has to guess whether a slot is free or whether the rules allow it.
 */

export type RoomRequest = {
  /** The message really is asking for a library room. */
  isRoomRequest: boolean;
  date: string;
  /** Slots the student asked for. Empty means any time. */
  slots: number[];
  people: number | null;
  category: RoomCategory | null;
  /** What the request was understood as, in words the student can check. */
  summary: string;
};

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function parseRoomRequest(text: string, now: Date = DEMO_NOW): RoomRequest {
  const t = text.toLowerCase();
  const isRoomRequest = /\b(study|library|silent|quiet|discussion|group|success|meeting)\s+rooms?\b/.test(t) && /\b(book|reserve|find|need|get|any|available|free|want|looking|show|can i|could i)\b/.test(t);

  // which day
  const dates = bookableDates(now);
  let date = dates[0];
  if (/\bday after tomorrow\b/.test(t)) date = dates[2];
  else if (/\btomorrow\b/.test(t)) date = dates[1];
  else if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(t)) date = dates[0];
  else {
    const named = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b|\\b${d.slice(0, 3)}\\b`).test(t));
    const hit = named >= 0 ? dates.find((d) => new Date(`${d}T12:00:00+08:00`).getUTCDay() === named) : undefined;
    if (hit) date = hit;
  }

  // which time
  let slots: number[] = [];
  const clock = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? t.match(/\b(\d{1,2}):(\d{2})\b()/) ?? t.match(/\bat\s+(\d{1,2})\b()/);
  if (clock) {
    let h = Number(clock[1]);
    if (clock[3] === "pm" && h < 12) h += 12;
    if (clock[3] === "am" && h === 12) h = 0;
    const slot = Math.floor((h - 9) / 2);
    if (h >= 9 && h < 21 && slot >= 0 && slot < SLOTS.length) slots = [slot];
  } else if (/\bmorning\b/.test(t)) slots = [0, 1];
  else if (/\bafternoon\b/.test(t)) slots = [2, 3];
  else if (/\b(evening|tonight|night)\b/.test(t)) slots = [4, 5];
  else if (/\b(lunch|noon|midday)\b/.test(t)) slots = [1, 2];

  // how many people
  let people: number | null = null;
  const num = t.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:people|persons?|pax|of us|students?|friends|members)\b|\bfor\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b|\bgroup of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  const raw = num ? num[1] ?? num[2] ?? num[3] : undefined;
  if (raw) people = Number(raw) || NUMBER_WORDS[raw] || null;
  else if (/\b(alone|solo|myself|by myself)\b/.test(t)) people = 1;
  if (people !== null && (people < 1 || people > 10)) people = null;

  let category: RoomCategory | null = null;
  if (/\b(silent|quiet|alone|solo)\b/.test(t)) category = "silent";
  else if (/\b(success|presentation|present|projector|meeting)\b/.test(t)) category = "success";
  else if (/\b(group|discussion|team|project)\b/.test(t) && (people === null || people >= 3 || /\b(group|discussion)\s+room/.test(t))) category = "group";

  const when = `${new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" })}`;
  const at = slots.length === 1 ? `at ${SLOTS[slots[0]].start}` : slots.length > 1 ? `between ${SLOTS[slots[0]].start} and ${SLOTS[slots[slots.length - 1]].end}` : "at any time";
  return { isRoomRequest, date, slots, people, category, summary: `${when}, ${at}${people ? `, for ${people}` : ""}${category ? `, ${category} room` : ""}` };
}

export type RoomOption = { roomId: string; date: string; slot: number };

const fits = (roomId: string, people: number | null) => {
  const r = LIBRARY_ROOM_BY_ID[roomId];
  return people === null || (people <= r.capacity && (r.minPax ?? 1) <= people);
};

/** Free rooms that fit, best first: the smallest room that holds everyone, nearest the time asked for. */
export function searchRooms(day: LibraryDay, query: { slots: number[]; people: number | null; category: RoomCategory | null }, bookings: readonly LibraryBooking[], now: Date = DEMO_NOW, limit = 4): RoomOption[] {
  const wanted = query.slots.length ? query.slots : SLOTS.map((s) => s.index);
  const options: (RoomOption & { score: number })[] = [];
  for (const room of day.rooms) {
    if (query.category && room.category !== query.category) continue;
    if (!fits(room.id, query.people)) continue;
    for (const slot of SLOTS.map((s) => s.index)) {
      if (room.slots[slot]?.status !== "available") continue;
      if (!checkBooking({ roomId: room.id, date: day.date, slot }, bookings, now).ok) continue;
      const near = query.slots.length ? Math.min(...query.slots.map((s) => Math.abs(s - slot))) : 0;
      if (query.slots.length && !wanted.includes(slot) && near > 1) continue; // never wander more than one slot from what was asked
      options.push({ roomId: room.id, date: day.date, slot, score: near * 100 + (room.capacity - (query.people ?? 1)) * 3 + (room.category === "silent" ? 0 : 1) });
    }
  }
  options.sort((a, b) => a.score - b.score || a.slot - b.slot || a.roomId.localeCompare(b.roomId));
  // offer a spread of rooms rather than four slots of the same room
  const seen = new Set<string>();
  const spread: RoomOption[] = [];
  for (const o of options) { if (seen.has(o.roomId)) continue; seen.add(o.roomId); spread.push({ roomId: o.roomId, date: o.date, slot: o.slot }); if (spread.length >= limit) break; }
  return spread;
}


/**
 * Finds rooms for a request, widening it only when it has to: first the time asked for, then any time that day,
 * then the following days. `alternatives` says the answer is not an exact match, so the assistant can say so.
 */
export async function findRooms(
  getDay: (date: string) => Promise<LibraryDay>,
  request: Pick<RoomRequest, "date" | "slots" | "people" | "category">,
  bookings: readonly LibraryBooking[],
  now: Date = DEMO_NOW,
): Promise<{ options: RoomOption[]; alternatives: boolean }> {
  const first = await getDay(request.date);
  const exact = searchRooms(first, request, bookings, now);
  if (exact.length) {
    // rooms one slot either side of the time asked for are allowed, but only a room at that time counts as an exact match
    const onTime = request.slots.length === 0 || exact.some((o) => request.slots.includes(o.slot));
    return { options: exact, alternatives: !onTime };
  }
  const anyTime = searchRooms(first, { ...request, slots: [] }, bookings, now);
  if (anyTime.length) return { options: anyTime, alternatives: true };
  for (const date of bookableDates(now).filter((d) => d > request.date)) {
    const day = await getDay(date);
    const near = searchRooms(day, request, bookings, now);
    if (near.length) return { options: near, alternatives: true };
    const any = searchRooms(day, { ...request, slots: [] }, bookings, now);
    if (any.length) return { options: any, alternatives: true };
  }
  return { options: [], alternatives: true };
}
