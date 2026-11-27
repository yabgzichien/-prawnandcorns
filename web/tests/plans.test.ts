import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline } from "../src/lib/calendar/timeline.ts";
import { ASSIGNMENTS, CLASSES } from "../src/lib/data/academics.ts";
import { FINANCE } from "../src/lib/data/life.ts";
import { draftFromEvent, emptyDraft, eventFromDraft, hourAfter, overlapsFor, sanitizeTodos, todoFromDraft, upsert, validateDraft, type EntryDraft } from "../src/lib/plans/entries.ts";
import { parsePlanRequest } from "../src/lib/plans/parse.ts";

// The demo clock is Monday 23 Nov 2026, 13:20 Malaysia time.
const read = (s: string) => parsePlanRequest(s);

test("an event with a weekday and a time becomes a draft with an assumed hour", () => {
  const r = read("I have a dentist appointment this Friday at 3pm");
  assert.equal(r.isRequest, true);
  assert.equal(r.kind, "event");
  assert.deepEqual({ title: r.draft.title, date: r.draft.date, start: r.draft.start, end: r.draft.end }, { title: "Dentist appointment", date: "2026-11-27", start: "15:00", end: "16:00" });
  assert.equal(r.assumedEnd, true);
  assert.deepEqual(r.missing, []);
});

test("a specific date, a time range and a room are all read, and no end is assumed", () => {
  const r = read("Add team meeting on 4 Dec from 2 to 4pm in B1 Hall to my calendar");
  assert.deepEqual({ kind: r.kind, title: r.draft.title, date: r.draft.date, start: r.draft.start, end: r.draft.end, place: r.draft.place }, { kind: "event", title: "Team meeting", date: "2026-12-04", start: "14:00", end: "16:00", place: "B1 Hall" });
  assert.equal(r.assumedEnd, false);
});

test("remind me and to-do wording make a to-do, with or without a due date", () => {
  const a = read("Remind me to buy a calculator tomorrow");
  assert.equal(a.kind, "todo");
  assert.deepEqual({ title: a.draft.title, date: a.draft.date, start: a.draft.start }, { title: "Buy a calculator", date: "2026-11-24", start: "" });
  const b = read("add to my to-do list: print the lab report");
  assert.equal(b.isRequest, true);
  assert.equal(b.kind, "todo");
  assert.equal(b.draft.date, "");
  assert.equal(b.draft.title, "Print the lab report");
  const c = read("I need to submit the poster by Thursday 5pm");
  assert.equal(c.kind, "todo");
  assert.deepEqual({ date: c.draft.date, start: c.draft.start, title: c.draft.title }, { date: "2026-11-26", start: "17:00", title: "Submit the poster" });
});

test("a missing time is asked for, not invented", () => {
  const r = read("I have a hack-day meetup on Friday");
  assert.equal(r.kind, "event");
  assert.deepEqual(r.missing, ["start"]);
  assert.equal(r.draft.start, "");
  assert.equal(r.draft.end, "");
});

test("a date that has passed this year moves to next year and says so", () => {
  const r = read("I have a family dinner on 3 Nov at 7pm");
  assert.equal(r.draft.date, "2027-11-03");
  assert.ok(r.notes.some((n) => /passed/.test(n)));
});

test("questions and other requests are never taken for a calendar entry", () => {
  for (const q of [
    "Do I have a class on Friday?", "When is my next class?", "Is my 2pm class still on?", "What's due this week?", "Where is A3-G01?",
    "Add a finance widget and hide clubs", "Book a study room for 2 tomorrow at 3pm", "Help me plan my week around my deadlines",
    "Which electives fit my timetable? I need 4 credits", "The air-con in my room is leaking water", "Can I go to the hack-day on Saturday?",
  ]) assert.equal(read(q).isRequest, false, q);
});

test("validation says the first thing to fix", () => {
  const ok: EntryDraft = { kind: "event", title: "Dentist", date: "2026-11-27", start: "15:00", end: "16:00", place: "" };
  assert.equal(validateDraft(ok), null);
  assert.match(validateDraft({ ...ok, title: "  " })!, /title/i);
  assert.match(validateDraft({ ...ok, date: "" })!, /date/i);
  assert.match(validateDraft({ ...ok, end: "14:00" })!, /after the start/);
  assert.equal(validateDraft({ ...emptyDraft("todo"), title: "Buy pens" }), null);
  assert.match(validateDraft({ ...emptyDraft("todo"), title: "Buy pens", start: "10:00" })!, /due date/);
  assert.match(validateDraft({ ...emptyDraft("reminder"), title: "Ring", date: "2026-11-27" })!, /time/i);
});

test("drafts round trip through events and to-dos", () => {
  const ev = eventFromDraft({ kind: "event", title: " Dentist ", date: "2026-11-27", start: "15:00", end: "16:00", place: "Town" }, "pe-1");
  assert.deepEqual(ev, { id: "pe-1", title: "Dentist", start: "2026-11-27T15:00:00+08:00", end: "2026-11-27T16:00:00+08:00", place: "Town" });
  assert.deepEqual(draftFromEvent(ev), { kind: "event", id: "pe-1", title: "Dentist", date: "2026-11-27", start: "15:00", end: "16:00", place: "Town" });
  assert.deepEqual(todoFromDraft({ ...emptyDraft("todo"), title: "Buy pens" }, "td-1"), { id: "td-1", title: "Buy pens", done: false });
  assert.deepEqual(todoFromDraft({ ...emptyDraft("todo", "2026-11-27", "09:00"), title: "Buy pens" }, "td-1", true), { id: "td-1", title: "Buy pens", done: true, due: "2026-11-27", time: "09:00" });
  assert.equal(hourAfter("23:30"), "23:59");
  assert.deepEqual(upsert([{ id: "a", v: 1 }, { id: "b", v: 2 }], { id: "a", v: 9 }), [{ id: "a", v: 9 }, { id: "b", v: 2 }]);
});

test("stored to-dos are cleaned, never trusted", () => {
  const out = sanitizeTodos([{ id: "td-1", title: "Ok", done: true, due: "2026-11-27", time: "09:00" }, { id: "td-2", title: "", done: false }, { id: "td-3", title: "Bad date", due: "nope", time: "09:00", done: 1 }, null, 5]);
  assert.deepEqual(out, [{ id: "td-1", title: "Ok", done: true, due: "2026-11-27", time: "09:00" }, { id: "td-3", title: "Bad date", done: false }]);
  assert.deepEqual(sanitizeTodos("x"), []);
});

test("a new event shows what it overlaps, but not a cancelled class or itself", () => {
  const items = buildTimeline({ classes: CLASSES, assignments: ASSIGNMENTS, submitted: [], dues: FINANCE.dues, currency: "RM" });
  const clash = overlapsFor(items, { kind: "event", title: "x", date: "2026-11-23", start: "16:30", end: "17:30", place: "" });
  assert.deepEqual(clash.map((i) => i.id), ["class:c3"]);
  assert.deepEqual(overlapsFor(items, { kind: "event", title: "x", date: "2026-11-23", start: "14:00", end: "15:00", place: "" }), [], "the 14:00 tutorial is cancelled");
  assert.deepEqual(overlapsFor(items, { kind: "todo", title: "x", date: "2026-11-23", start: "16:30", end: "", place: "" }), []);
});

import { isEventFitQuestion } from "../src/lib/eventfit/read.ts";
import { parseEventRequest } from "../src/lib/events/request.ts";
import { parseRoomRequest } from "../src/lib/library/search.ts";
import { readingFromArgs } from "../src/lib/plans/parse.ts";

test("what the assistant reads as a calendar entry is not claimed by another route first", () => {
  for (const p of [
    "I have a dentist appointment this Friday at 3pm", "Add team meeting on 4 Dec from 2 to 4pm in B1 Hall to my calendar",
    "Remind me to print my lab report tomorrow", "I have a club meeting on Saturday at 10am", "Put my project demo on Thursday at 2pm in the calendar",
  ]) {
    assert.equal(parsePlanRequest(p).isRequest, true, p);
    assert.equal(isEventFitQuestion(p), false, `${p} (event check)`);
    assert.equal(parseEventRequest(p).isEventRequest, false, `${p} (club event application)`);
    assert.equal(parseRoomRequest(p).isRoomRequest, false, `${p} (library room)`);
  }
});

test("fields from a model are checked, and anything malformed falls back to the student's words", () => {
  const r = readingFromArgs({ kind: "event", title: "<b>Dentist</b>", date: "not a date", start: "25:99", end: "nope", place: "Town" }, "I have a dentist appointment this Friday at 3pm");
  assert.equal(r.kind, "event");
  assert.equal(r.draft.date, "2026-11-27");
  assert.equal(r.draft.start, "15:00");
  assert.equal(r.draft.end, "16:00");
  assert.equal(r.draft.title, "b Dentist /b");
  assert.equal(r.draft.place, "Town");
  const todo = readingFromArgs({ kind: "todo", title: "Buy pens" }, "remind me to buy pens");
  assert.deepEqual({ kind: todo.kind, date: todo.draft.date, end: todo.draft.end, missing: todo.missing }, { kind: "todo", date: "", end: "", missing: [] });
  const gap = readingFromArgs({ kind: "event", title: "Talk" }, "talk");
  assert.deepEqual(gap.missing, ["date", "start"]);
});
