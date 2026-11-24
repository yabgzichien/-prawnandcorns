import { LIBRARY_ROOMS, type LibraryRoom, type RoomCategory } from "./rooms.ts";
import { SLOTS } from "./policy.ts";

/**
 * Who else has booked what. Nothing here is real: a fixed pattern fills about half the slots, busier in the
 * afternoon and for group rooms, and scenario events can fill or close more. The same inputs always give the same answer.
 */

/** The library can fill or close rooms. Events in the demo world add these. */
export type LibraryBlock = {
  rooms?: string[];
  categories?: RoomCategory[];
  dates: string[];
  slots: number[];
  status: "reserved" | "closed";
  remark?: string;
};

export type LibraryState = { blocks: LibraryBlock[] };
export type SlotStatus = "available" | "reserved" | "closed";

function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Share of slots already taken by other people, by slot of the day. */
const BUSY_BY_SLOT = [22, 38, 50, 56, 44, 24];

export function reservedByOthers(room: LibraryRoom, date: string, slot: number): boolean {
  const chance = BUSY_BY_SLOT[slot] + (room.category === "group" ? 12 : 0) + (room.category === "success" ? 8 : 0);
  return fnv(`${room.id}|${date}|${slot}`) % 100 < chance;
}

const matches = (block: LibraryBlock, room: LibraryRoom, date: string, slot: number) =>
  block.dates.includes(date) && block.slots.includes(slot) && ((block.rooms?.includes(room.id) ?? false) || (block.categories?.includes(room.category) ?? false));

export function slotStatus(library: LibraryState, room: LibraryRoom, date: string, slot: number): { status: SlotStatus; remark?: string } {
  const closed = library.blocks.find((b) => b.status === "closed" && matches(b, room, date, slot));
  if (closed) return { status: "closed", remark: closed.remark };
  const reserved = library.blocks.find((b) => b.status === "reserved" && matches(b, room, date, slot));
  if (reserved) return { status: "reserved", remark: reserved.remark };
  return { status: reservedByOthers(room, date, slot) ? "reserved" : "available" };
}

/** A room's remark, shown beside its name (for example "Under maintenance"), when any block closes it that day. */
export function roomRemark(library: LibraryState, room: LibraryRoom, date: string): string | undefined {
  return library.blocks.find((b) => b.status === "closed" && b.remark && SLOTS.some((s) => matches(b, room, date, s.index)))?.remark;
}

export const roomsInCategory = (category: RoomCategory) => LIBRARY_ROOMS.filter((r) => r.category === category);
