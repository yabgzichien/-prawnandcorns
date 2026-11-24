import assert from "node:assert/strict";
import test from "node:test";
import { reservedByOthers, roomRemark, slotStatus } from "../src/lib/library/availability.ts";
import { floorPlan } from "../src/lib/library/plan.ts";
import { bookableDates, bookingId, cancelDeadline, checkBooking, checkCancel, hasStarted, sanitizeBookings, SLOTS, slotWindow } from "../src/lib/library/policy.ts";
import { CATEGORIES, LIBRARY_ROOMS, LIBRARY_ROOM_BY_ID, roomCount } from "../src/lib/library/rooms.ts";
import { libraryRooms } from "../src/lib/world/payloads.ts";
import { mockRespond } from "../src/lib/world/mock-http.ts";
import { HDR_EVENTS } from "../src/lib/world/headers.ts";
import { buildWorld } from "../src/lib/world/world.ts";
import { ROOM_BY_CODE } from "../src/lib/data/campus.ts";

process.env.COMPASS_MOCK_DELAY_MS = "0";
const NOW = new Date("2026-11-23T13:20:00+08:00"); // the demo clock

test("the catalog matches the library: 43 rooms in four kinds, with the real capacities", () => {
  assert.equal(LIBRARY_ROOMS.length, 43);
  assert.deepEqual(CATEGORIES.map((c) => LIBRARY_ROOMS.filter((r) => r.category === c).length), [14, 14, 12, 3]);
  const caps = new Map<number, number>();
  for (const r of LIBRARY_ROOMS) caps.set(r.capacity, (caps.get(r.capacity) ?? 0) + 1);
  assert.deepEqual([...caps].sort((a, b) => a[0] - b[0]), [[2, 28], [4, 14], [10, 1]]);
  assert.equal(new Set(LIBRARY_ROOMS.map((r) => r.id)).size, 43);
  assert.equal(LIBRARY_ROOM_BY_ID.SSR3.minPax, 5);
  assert.deepEqual(roomCount("group"), 12);
  assert.ok(LIBRARY_ROOMS.filter((r) => r.level === 3).every((r) => r.category === "success" && r.wing === "West"));
  assert.ok(LIBRARY_ROOMS.filter((r) => r.category === "silent").every((r) => r.wing === "North" && r.level === 2));
});

test("every library room can be found on the campus map, inside block A3", () => {
  for (const room of LIBRARY_ROOMS) {
    const found = ROOM_BY_CODE[room.id];
    assert.ok(found, `${room.id} is missing from the campus directory`);
    assert.equal(found.place, "A3");
    assert.equal(found.floor, `Level ${room.level}`);
  }
});

test("the booking window is today plus two days, in Malaysian time, on the demo clock", () => {
  assert.deepEqual(bookableDates(NOW), ["2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.deepEqual(bookableDates(new Date("2026-11-23T23:30:00+08:00")), ["2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.deepEqual(bookableDates(new Date("2026-11-23T16:30:00Z")), ["2026-11-24", "2026-11-25", "2026-11-26"], "00:30 the next day in Malaysia");
  assert.equal(SLOTS.length, 6);
  assert.deepEqual(slotWindow("2026-11-24", 3), { start: "2026-11-24T15:00:00+08:00", end: "2026-11-24T17:00:00+08:00" });
});

test("today only the slots that have not started can be booked (15:00, 17:00, 19:00 at 13:20)", () => {
  const bookable = SLOTS.filter((s) => checkBooking({ roomId: "N201", date: "2026-11-23", slot: s.index }, [], NOW).ok).map((s) => s.start);
  assert.deepEqual(bookable, ["15:00", "17:00", "19:00"]);
  assert.equal(hasStarted("2026-11-23", 2, NOW), true, "13:00 began 20 minutes ago");
});

test("one slot per person per day, nothing beyond three days, no unknown rooms", () => {
  const mine = [{ id: bookingId("N201", "2026-11-24", 3), roomId: "N201", date: "2026-11-24", slot: 3 }];
  const second = checkBooking({ roomId: "S222", date: "2026-11-24", slot: 4 }, mine, NOW);
  assert.ok(!second.ok && /one two-hour slot per day/.test(second.error));
  const same = checkBooking({ roomId: "N201", date: "2026-11-24", slot: 3 }, mine, NOW);
  assert.ok(!same.ok && /already booked this slot/.test(same.error));
  assert.ok(checkBooking({ roomId: "S222", date: "2026-11-25", slot: 4 }, mine, NOW).ok, "a different day is fine");
  assert.ok(!checkBooking({ roomId: "S222", date: "2026-11-26", slot: 0 }, [], NOW).ok, "four days ahead");
  assert.ok(!checkBooking({ roomId: "S222", date: "2026-11-22", slot: 5 }, [], NOW).ok, "yesterday");
  assert.ok(!checkBooking({ roomId: "ZZ999", date: "2026-11-24", slot: 0 }, [], NOW).ok);
  assert.ok(!checkBooking({ roomId: "N201", date: "2026-11-24", slot: 6 }, [], NOW).ok);
  assert.ok(!checkBooking({ roomId: "N201", date: "tomorrow", slot: 1 }, [], NOW).ok);
});

test("a booking can be cancelled until 15 minutes after it starts", () => {
  const b = { id: "x", roomId: "N201", date: "2026-11-23", slot: 2 }; // started 13:00
  assert.equal(cancelDeadline(b).toISOString(), "2026-11-23T05:15:00.000Z");
  assert.ok(checkCancel(b, new Date("2026-11-23T13:14:59+08:00")).ok);
  assert.ok(checkCancel(b, new Date("2026-11-23T13:15:00+08:00")).ok);
  const late = checkCancel(b, new Date("2026-11-23T13:20:00+08:00"));
  assert.ok(!late.ok && /15 minutes after they start/.test(late.error));
  assert.ok(checkCancel({ ...b, date: "2026-11-24" }, NOW).ok);
});

test("saved bookings are cleaned: unknown rooms, duplicates per day and junk are dropped", () => {
  const out = sanitizeBookings([
    { roomId: "N201", date: "2026-11-24", slot: 1 }, { roomId: "S222", date: "2026-11-24", slot: 2 },
    { roomId: "NOPE", date: "2026-11-25", slot: 1 }, { roomId: "N202", date: "bad", slot: 1 }, { roomId: "N202", date: "2026-11-25", slot: 9 }, null, "x",
  ]);
  assert.deepEqual(out.map((b) => b.id), ["lb-N201-2026-11-24-1"]);
  assert.deepEqual(sanitizeBookings("junk"), []);
});

test("availability is deterministic, about half full, busier in the afternoon and for group rooms", () => {
  const sample = (pick: (r: (typeof LIBRARY_ROOMS)[number]) => boolean, slot: number) => {
    const rooms = LIBRARY_ROOMS.filter(pick);
    return rooms.filter((r) => reservedByOthers(r, "2026-11-24", slot)).length / rooms.length;
  };
  assert.equal(reservedByOthers(LIBRARY_ROOMS[0], "2026-11-24", 3), reservedByOthers(LIBRARY_ROOMS[0], "2026-11-24", 3));
  let total = 0, reserved = 0;
  for (const date of ["2026-11-23", "2026-11-24", "2026-11-25"]) for (const room of LIBRARY_ROOMS) for (const s of SLOTS) { total++; if (reservedByOthers(room, date, s.index)) reserved++; }
  assert.ok(reserved / total > 0.25 && reserved / total < 0.6, `reserved share ${reserved / total}`);
  assert.ok(sample(() => true, 3) > sample(() => true, 0), "3pm is busier than 9am across three days of hashing");
  const open3pm = LIBRARY_ROOMS.filter((r) => !reservedByOthers(r, "2026-11-24", 3)).length;
  assert.ok(open3pm >= 8, `only ${open3pm} rooms free tomorrow at 15:00, which makes a poor demo`);
});

test("library events fill and close rooms and show a remark; the base world has none", () => {
  const base = buildWorld([]);
  const room = LIBRARY_ROOM_BY_ID.N205;
  assert.deepEqual(base.library.blocks, []);
  const closed = buildWorld(["library-room-maintenance"]);
  assert.equal(slotStatus(closed.library, room, "2026-11-24", 2).status, "closed");
  assert.equal(slotStatus(closed.library, room, "2026-11-24", 2).remark, "Under maintenance");
  assert.equal(roomRemark(closed.library, room, "2026-11-24"), "Under maintenance");
  assert.equal(roomRemark(closed.library, room, "2026-11-26"), undefined, "outside the three days");
  assert.equal(roomRemark(closed.library, LIBRARY_ROOM_BY_ID.N206, "2026-11-24"), undefined);

  const full = buildWorld(["library-group-rooms-full"]);
  for (const r of LIBRARY_ROOMS.filter((x) => x.category === "group")) {
    for (const slot of [2, 3, 4]) assert.equal(slotStatus(full.library, r, "2026-11-24", slot).status, "reserved");
  }
  assert.notEqual(slotStatus(full.library, LIBRARY_ROOM_BY_ID.N201, "2026-11-24", 3).remark, "x");

  const rush = buildWorld(["library-evening-rush"]);
  for (const r of LIBRARY_ROOMS) for (const slot of [4, 5]) assert.equal(slotStatus(rush.library, r, "2026-11-24", slot).status, "reserved", `${r.id} slot ${slot}`);
  assert.ok(LIBRARY_ROOMS.some((r) => slotStatus(rush.library, r, "2026-11-24", 3).status === "available"), "the afternoon is untouched");
});

test("the library mock API answers per day, rebuilds the world from the header and rejects bad dates", async () => {
  const ask = (date: string, events = "") => mockRespond(new Request("http://localhost/api/mock/library/rooms", { headers: { [HDR_EVENTS]: events } }), "library", (w) => libraryRooms(w, date));
  const ok = await ask("2026-11-24", "library-room-maintenance");
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-compass-data"), "fictional-demo");
  const body = await ok.json();
  assert.equal(body.rooms.length, 43);
  assert.equal(body.slots.length, 6);
  const n205 = body.rooms.find((r: { id: string }) => r.id === "N205");
  assert.equal(n205.remark, "Under maintenance");
  assert.ok(n205.slots.every((s: { status: string }) => s.status === "closed"));
  assert.equal((await ask("nope")).status, 404);
  assert.equal((await ask("2026-13-45")).status, 404);
});

test("the floor plan places every room once, inside the drawing, and level 2 has four wings", () => {
  for (const level of [2, 3] as const) {
    const plan = floorPlan(level);
    const ids = plan.rooms.map((r) => r.id);
    assert.deepEqual([...ids].sort(), LIBRARY_ROOMS.filter((r) => r.level === level).map((r) => r.id).sort());
    for (const r of plan.rooms) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= plan.width && r.y + r.h <= plan.height, `${r.id} is inside the drawing`);
  }
  assert.equal(floorPlan(2).wings.length, 4);
});
