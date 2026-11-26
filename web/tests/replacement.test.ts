import assert from "node:assert/strict";
import test from "node:test";
import { CLASSES, NOTICES } from "../src/lib/data/academics.ts";
import { classBlocksFrom } from "../src/lib/planning-demo.ts";
import { statusText } from "../src/lib/schedule.ts";
import { checkOption, clashSentence, evaluateSlot, evaluateWeek, optionFrom, plannerContext, suggestSlots, usable } from "../src/lib/replacement/availability.ts";
import { buildCohort, COHORT_SIZE } from "../src/lib/replacement/cohort.ts";
import { applyReplacements, personalClashes } from "../src/lib/replacement/overlay.ts";
import { tallyOption } from "../src/lib/replacement/poll.ts";
import { markSeen, nextRequestId, parseSeen, readRequests, sanitizeAnswers, sanitizeRequests, seenStamp, writeAnswer, writeRequests } from "../src/lib/replacement/storage.ts";
import { REPLACEMENTS_KEY, REPLACEMENT_ANSWERS_KEY, REPLACEMENT_SEEN_KEY, type ReplacementRequest } from "../src/lib/replacement/types.ts";
import { resetScenario } from "../src/lib/world/storage.ts";

const NOW = new Date("2026-11-23T13:20:00+08:00"); // the demo clock

function memory() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
}

const scheduled = (over: Partial<ReplacementRequest> = {}): ReplacementRequest => ({
  id: "DEMO-RPL-0001", stamp: "a1", courseId: "cst1101", sessionId: "c11", reason: "Lecturer on leave", note: "", status: "scheduled", options: [],
  chosen: { id: "3-09:00-A4-105", day: 3, start: "09:00", end: "10:00", room: "A4-105" }, updatedAt: "2026-11-23T13:20:00+08:00", ...over,
});

test("the cohort is 36 students, the same every time, and the demo student keeps their own timetable", () => {
  const ctx = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  assert.equal(ctx.cohort.length, 36);
  assert.equal(COHORT_SIZE, 36);
  assert.equal(ctx.cohort.filter((s) => s.isDemoStudent).length, 1);
  const again = buildCohort(CLASSES.filter((c) => c.courseId === "cst1101"), CLASSES, "c11");
  assert.deepEqual(again.map((s) => s.blocks.length), ctx.cohort.map((s) => s.blocks.length));
  const demo = ctx.cohort.find((s) => s.isDemoStudent)!;
  // the cancelled MAT1101 tutorial and the lost class itself are free time
  assert.ok(!demo.blocks.some((b) => b.day === 0 && b.start === "14:00"));
  assert.ok(!demo.blocks.some((b) => b.day === 4 && b.start === "14:00"));
  assert.ok(demo.blocks.some((b) => b.label === "MAT1101 Tutorial" && b.day === 3));
  // nobody's own sections clash with each other
  for (const s of ctx.cohort) for (const a of s.blocks) for (const b of s.blocks) if (a !== b) assert.ok(!(a.day === b.day && a.start < b.end && b.start < a.end), `${s.key} has a clash`);
});

test("only the lecturer's upcoming classes of their own course can be planned", () => {
  assert.equal(plannerContext("c2", "Other", CLASSES, NOW), null); // MAT1101 is not Dr. Lim's
  assert.ok(plannerContext("c6", "Other", CLASSES, NOW));
});

test("a time breaks the rules: too soon, the leave day, a public holiday, the lecturer's own class", () => {
  const leave = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  assert.equal(evaluateSlot(leave, 1, "10:00").blocked, "Less than 24 hours' notice");
  assert.equal(evaluateSlot(leave, 4, "10:00").blocked, "You are on leave");
  assert.equal(evaluateSlot(plannerContext("c11", "Public holiday", CLASSES, NOW)!, 4, "10:00").blocked, "Public holiday");
  assert.equal(evaluateSlot(plannerContext("c11", "Other", CLASSES, NOW)!, 4, "10:00").blocked, null);
  assert.match(evaluateSlot(leave, 3, "11:30").blocked ?? "", /CST2105/);
  assert.match(evaluateSlot(leave, 2, "10:00").blocked ?? "", /CST1101 Lab/);
  assert.equal(evaluateSlot(leave, 6, "10:00").blocked, "Outside this teaching week");
  assert.equal(evaluateSlot(leave, 3, "19:30").blocked, "Outside 08:00 to 20:00");
});

test("free counts and clash reasons come from the timetables, grouped by course", () => {
  const ctx = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  const slot = evaluateSlot(ctx, 3, "15:00");
  assert.equal(slot.total, 36);
  assert.equal(slot.free + slot.clashes.reduce((n, c) => n + c.count, 0), 36);
  assert.ok(slot.clashes.some((c) => c.label === "CST1103 Lab"));
  // the demo student has the CST1103 lab on Thursday at 14:00, so they are among those who cannot come
  const demo = ctx.cohort.find((s) => s.isDemoStudent)!;
  assert.ok(demo.blocks.some((b) => b.day === 3 && b.label === "CST1103 Lab"));
  assert.equal(clashSentence({ label: "CST1103 Lab", count: 1 }), "1 student has CST1103 Lab");
  assert.equal(clashSentence({ label: "CST1103 Lab", count: 4 }), "4 students have CST1103 Lab");
});

test("rooms: only free rooms with enough seats, the usual room first, and a lab is replaced in a lab", () => {
  const tut = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  const e = evaluateSlot(tut, 3, "09:00");
  assert.ok(e.rooms.length > 0);
  assert.ok(!e.rooms.includes("A2-305")); // 30 seats is too small for 36
  if (e.rooms.includes("A4-105")) assert.equal(e.rooms[0], "A4-105");
  const lab = plannerContext("c6", "Lecturer on leave", CLASSES, NOW)!;
  for (const day of evaluateWeek(lab)) for (const s of day) for (const r of s.rooms) assert.match(r, /^A5-L[12]$/);
  // the MAT1101 tutorial holds A2-104 on Thursday at 10:00
  assert.ok(!evaluateSlot(tut, 3, "10:30").rooms.includes("A2-104"));
});

test("suggestions are usable, one per day, best first", () => {
  const ctx = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  const s = suggestSlots(evaluateWeek(ctx));
  assert.equal(s.length, 3);
  assert.ok(s.every(usable));
  assert.equal(new Set(s.map((x) => x.day)).size, 3);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].free >= s[i].free);
  assert.ok(!s.some((x) => x.day === 4), "never on the leave day");
});

test("publishing is checked again: a blocked time, a busy room or a wrong length are refused", () => {
  const ctx = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  const good = suggestSlots(evaluateWeek(ctx))[0];
  assert.equal(checkOption(ctx, optionFrom(good, good.rooms[0])).ok, true);
  assert.equal(checkOption(ctx, { id: "x", day: 4, start: "10:00", end: "11:00", room: "A4-105" }).ok, false);
  assert.equal(checkOption(ctx, { ...optionFrom(good, good.rooms[0]), end: "12:00" }).ok, false);
  assert.equal(checkOption(ctx, { ...optionFrom(good, good.rooms[0]), room: "A2-305" }).ok, false);
});

test("a set replacement cancels the lost class and adds the new one everywhere the timetable is used", () => {
  const out = applyReplacements(CLASSES, NOTICES, [scheduled()]);
  const lost = out.classes.find((c) => c.id === "c11")!;
  assert.equal(lost.status, "cancelled");
  assert.equal(lost.noticeId, "rpl-DEMO-RPL-0001");
  const added = out.classes.find((c) => c.replacementId === "DEMO-RPL-0001")!;
  assert.deepEqual([added.day, added.start, added.end, added.room, added.kind, added.status], [3, "09:00", "10:00", "A4-105", "Tutorial", "makeup"]);
  assert.equal(statusText(added), "Replacement class");
  assert.equal(statusText(CLASSES.find((c) => c.id === "c8")!), "Make-up class");
  assert.equal(out.notices[0].id, "rpl-DEMO-RPL-0001");
  assert.match(out.notices[0].body, /Thu 26 Nov, 09:00 to 10:00 in A4-105/);
  // the study planner treats it as busy and the lost class as free
  const blocks = classBlocksFrom(out.classes);
  assert.ok(blocks.some((b) => b.start === "2026-11-26T09:00:00+08:00"));
  assert.ok(!blocks.some((b) => b.start === "2026-11-27T14:00:00+08:00"));
  assert.equal(CLASSES.find((c) => c.id === "c11")!.status, "normal", "the base data is not changed");
});

test("while asking, the class is cancelled but nothing is added; unknown classes are ignored", () => {
  const asking = scheduled({ status: "asking", chosen: undefined, options: [{ id: "3-09:00-A4-105", day: 3, start: "09:00", end: "10:00", room: "A4-105" }, { id: "5-10:00-A4-105", day: 5, start: "10:00", end: "11:00", room: "A4-105" }] });
  const out = applyReplacements(CLASSES, NOTICES, [asking]);
  assert.equal(out.classes.length, CLASSES.length);
  assert.equal(out.classes.find((c) => c.id === "c11")!.status, "cancelled");
  assert.match(out.notices[0].body, /which of 2 times work/);
  const stray = applyReplacements(CLASSES, NOTICES, [scheduled({ sessionId: "c99" }), scheduled({ id: "DEMO-RPL-0002", courseId: "mat1101" })]);
  assert.deepEqual(stray.classes, CLASSES);
  assert.equal(stray.notices.length, NOTICES.length);
});

test("the student privately sees overlaps with their classes, study sessions and library bookings", () => {
  const clashes = personalClashes({ day: 3, start: "14:30", end: "15:30" }, {
    classes: CLASSES,
    studySessions: [{ id: "s1", taskId: "a4", title: "Reflective Essay: Draft", start: "2026-11-26T15:00:00+08:00", end: "2026-11-26T16:00:00+08:00" }],
    bookings: [{ id: "b1", roomId: "N205", date: "2026-11-26", slot: 3 }],
  });
  assert.equal(clashes.length, 3);
  assert.match(clashes[0], /CST1103 lab/);
  assert.match(clashes[1], /Reflective Essay/);
  assert.match(clashes[2], /library booking/);
  assert.deepEqual(personalClashes({ day: 3, start: "08:00", end: "09:00" }, { classes: CLASSES, studySessions: [], bookings: [] }), []);
});

test("poll answers: every student is counted once, and the demo answer counts only for the current round", () => {
  const ctx = plannerContext("c11", "Lecturer on leave", CLASSES, NOW)!;
  const option = { id: "3-09:00-A4-105", day: 3, start: "09:00", end: "10:00", room: "A4-105" };
  const req = scheduled({ status: "asking", chosen: undefined, options: [option] });
  const none = tallyOption(ctx, req, option, {});
  assert.equal(none.works + none.cannot + none.noAnswer, 36);
  assert.equal(none.demoStudent, null);
  const yes = tallyOption(ctx, req, option, { [req.id]: { stamp: req.stamp, works: { [option.id]: true }, at: "x" } });
  assert.equal(yes.demoStudent, true);
  assert.equal(yes.works, none.works + 1);
  const old = tallyOption(ctx, req, option, { [req.id]: { stamp: "older", works: { [option.id]: true }, at: "x" } });
  assert.equal(old.demoStudent, null);
  assert.deepEqual(tallyOption(ctx, req, option, {}), none, "the invented answers are the same every time");
});

test("storage: sanitised, one writer per key, cleared by Reset scenario", () => {
  const s = memory();
  assert.deepEqual(sanitizeRequests([{ id: "bad" }, scheduled(), scheduled(), { ...scheduled({ id: "DEMO-RPL-0002" }), chosen: undefined }, { ...scheduled({ id: "DEMO-RPL-0003" }), reason: "Because" }]), [scheduled()]);
  assert.deepEqual(sanitizeAnswers({ "DEMO-RPL-0001": { stamp: "a", works: { x: true, y: "no" }, at: "t" }, junk: {} }), { "DEMO-RPL-0001": { stamp: "a", works: { x: true }, at: "t" } });
  assert.equal(writeRequests([scheduled()], s), true);
  assert.deepEqual(readRequests(s), [scheduled()]);
  assert.equal(nextRequestId(readRequests(s)), "DEMO-RPL-0002");
  assert.equal(writeAnswer(scheduled(), { a: true }, "t", s), true);
  assert.ok(s.data.has(REPLACEMENT_ANSWERS_KEY));
  markSeen([scheduled()], s);
  assert.deepEqual(parseSeen(s.data.get(REPLACEMENT_SEEN_KEY)!), { "DEMO-RPL-0001": seenStamp(scheduled()) });
  resetScenario(s);
  assert.equal(s.data.has(REPLACEMENTS_KEY), false);
  assert.ok(s.data.has(REPLACEMENT_ANSWERS_KEY), "the console reset leaves what the student saved");
});
