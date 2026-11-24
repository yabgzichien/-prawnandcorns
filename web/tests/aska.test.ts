import assert from "node:assert/strict";
import test from "node:test";
import { ASKA_STATUSES, detectDormIssue, draftTicket, nextTicketId, parseLocation, sanitizeTickets, sanitizeUpdates } from "../src/lib/aska.ts";

test("hostel faults are recognised, including the two the user named: a water leak and the air-conditioner", () => {
  const cases: [string, string][] = [
    ["There is water leaking from the ceiling in my room", "leak"],
    ["my toilet is blocked and overflowing", "leak"],
    ["the air-con in my room is not working", "aircon"],
    ["My aircon is leaking water onto the floor", "aircon"],
    ["AC is too noisy and smells bad", "aircon"],
    ["the ceiling light in D3-512 keeps flickering", "electrical"],
    ["socket is dead near my desk", "electrical"],
    ["my wardrobe door is broken", "furniture"],
    ["there are cockroaches in the bathroom", "pests"],
  ];
  for (const [text, kind] of cases) assert.equal(detectDormIssue(text)?.kind, kind, text);
});

test("ordinary questions are not mistaken for hostel faults", () => {
  for (const text of [
    "What's due this week?", "Is my 2pm class still on?", "Where is A3-G01?", "Draft an email to Finance about my fee instalment", "How much do I owe?",
    "my laptop charger is not working", "the wifi in my hostel keeps dropping", "I can't log in to Moodle", "Book a study room for tomorrow",
    "Add a finance widget and hide clubs", "the air-con policy", "I like robotics and photography",
  ]) assert.equal(detectDormIssue(text), null, text);
});

test("danger words mark a ticket urgent", () => {
  assert.equal(detectDormIssue("water is leaking near the socket and it sparks")?.urgent, true);
  assert.equal(detectDormIssue("the pipe burst and the room is flooding")?.urgent, true);
  assert.equal(detectDormIssue("the air-con is not very cold")?.urgent, false);
});

test("a block and room number are read from the message", () => {
  assert.deepEqual(parseLocation("air-con broken in D3-512"), { block: "D3", room: "512" });
  assert.deepEqual(parseLocation("leak in ly2 room 1203"), { block: "LY2", room: "1203" });
  assert.deepEqual(parseLocation("block D4, my room is 305 and the tap drips"), { block: "D4", room: "305" });
  assert.equal(parseLocation("something is leaking in my room"), null);
});

test("a ticket draft names the help desk path, keeps the location and never claims to be sent", () => {
  const d = draftTicket("The air-con in D3-512 is leaking water")!;
  assert.equal(d.kind, "aircon");
  assert.equal(d.path, "Accommodation > Maintenance > Air-conditioner");
  assert.equal(d.block, "D3"); assert.equal(d.room, "512");
  assert.match(d.title, /^Air-conditioner: /);
  assert.match(d.description, /staying in D3-512/);
  assert.match(d.description, /technician/);
  assert.ok(d.title.length <= 100 && d.description.length <= 900);
  const noRoom = draftTicket("my toilet is blocked")!;
  assert.match(noRoom.description, /\[block and room number\]/);
  assert.equal(draftTicket("What's due this week?"), null);
  assert.equal(draftTicket("hello", { kind: "leak" })?.path, "Accommodation > Maintenance > Water leak or plumbing");
});

test("saved tickets and help desk updates are cleaned, and ticket numbers continue from what is saved", () => {
  const good = { ...draftTicket("the air-con in D3-512 is leaking")!, id: "T-1041", submittedAt: "2026-11-23T13:30:00+08:00" };
  const out = sanitizeTickets([good, { ...good }, { ...good, id: "bad" }, { ...good, id: "T-1042", submittedAt: "yesterday" }, { ...good, id: "T-1043", kind: "nope" }, null, "x"]);
  assert.deepEqual(out.map((t) => t.id), ["T-1041"]);
  assert.equal(nextTicketId(out), "T-1042");
  assert.equal(nextTicketId([]), "T-1041");
  const updates = sanitizeUpdates({ "T-1041": { status: "Technician scheduled", note: "Bring keys", visit: { start: "2026-11-26T10:00:00+08:00", end: "2026-11-26T11:00:00+08:00" } }, "T-1042": { status: "Teleported" }, nope: { status: "Resolved" } });
  assert.deepEqual(Object.keys(updates), ["T-1041"]);
  assert.equal(updates["T-1041"].visit?.start, "2026-11-26T10:00:00+08:00");
  assert.deepEqual(ASKA_STATUSES, ["Submitted", "In progress", "Technician scheduled", "Resolved"]);
  assert.deepEqual(sanitizeUpdates("junk"), {});
});

import { createDemoExecutor, sanitizeDemoContext } from "../src/lib/gemini-tools.ts";
import { ASKA_UPDATES_KEY } from "../src/lib/aska.ts";
import { getAskaUpdates, resetScenario, setAskaUpdate } from "../src/lib/world/storage.ts";

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
};

test("the Gemini tool prepares a ticket for a hostel fault, refuses anything else, and never submits", async () => {
  const exec = createDemoExecutor({ prompt: "x", context: sanitizeDemoContext({}), apiKey: "", model: "gemini-2.5-flash" });
  const ok = await exec("prepare_aska_ticket", { problem: "water is leaking from the ceiling in LY2 1203" });
  assert.equal(ok.card?.kind, "aska");
  const v = ok.value as { submitted: boolean; ticket: { path: string; location: string } };
  assert.equal(v.submitted, false);
  assert.equal(v.ticket.path, "Accommodation > Maintenance > Water leak or plumbing");
  assert.equal(v.ticket.location, "LY2-1203");
  const no = await exec("prepare_aska_ticket", { problem: "What's due this week?" });
  assert.equal(no.card, undefined);
  assert.match(no.summary, /Not a hostel fault/);
  assert.equal((await exec("prepare_aska_ticket", { problem: { evil: true } })).card, undefined);
});

test("help desk updates are written by the console, read back cleaned, and cleared by Reset scenario", () => {
  const storage = memory();
  assert.deepEqual(getAskaUpdates(storage), {});
  assert.ok(setAskaUpdate("T-1041", { status: "In progress", note: "On it" }, storage));
  assert.ok(setAskaUpdate("T-1041", { status: "Technician scheduled", visit: { start: "2026-11-26T09:00:00+08:00", end: "2026-11-26T10:00:00+08:00" } }, storage));
  assert.equal(getAskaUpdates(storage)["T-1041"].status, "Technician scheduled");
  assert.ok(!setAskaUpdate("T-1041", { status: "Resolved" }, null));
  storage.setItem(ASKA_UPDATES_KEY, "{broken");
  assert.deepEqual(getAskaUpdates(storage), {});
  setAskaUpdate("T-1042", { status: "Resolved" }, storage);
  resetScenario(storage);
  assert.deepEqual(getAskaUpdates(storage), {});
});
