import assert from "node:assert/strict";
import test from "node:test";
import { ASSIGNMENTS, CLASSES } from "../src/lib/data/academics.ts";
import { FINANCE } from "../src/lib/data/life.ts";
import { buildTimeline, groupTimeline, isPast, timeText, type TimelineInput } from "../src/lib/calendar/timeline.ts";
import { DEMO_NOW } from "../src/lib/time.ts";

const base: TimelineInput = { classes: CLASSES, assignments: ASSIGNMENTS, submitted: [], dues: FINANCE.dues, currency: FINANCE.currency };
const ids = (items: { id: string }[]) => items.map((i) => i.id);

test("merges classes, deadlines, exams, fees, events and semester dates into one sorted list", () => {
  const items = buildTimeline(base);
  const kinds = new Set(items.map((i) => i.kind));
  for (const k of ["class", "deadline", "exam", "fee", "event", "semester"]) assert.ok(kinds.has(k as never), k);
  const times = items.map((i) => Date.parse(i.start));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

test("never invents items: classes are the one demo week and are not repeated", () => {
  const items = buildTimeline(base);
  assert.equal(items.filter((i) => i.kind === "class").length, CLASSES.length);
  assert.ok(items.filter((i) => i.kind === "class").every((i) => i.date >= "2026-11-23" && i.date <= "2026-11-27"));
});

test("cancelled, moved and replacement classes say so in words", () => {
  const items = buildTimeline(base);
  const by = (id: string) => items.find((i) => i.id === `class:${id}`)!;
  assert.equal(by("c2").stateLabel, "Cancelled");
  assert.equal(by("c6").stateLabel, "Room changed");
  assert.match(by("c6").detail, /moved from A5-L1/);
  assert.equal(by("c8").stateLabel, "Make-up class");
});

test("submitted, ticked and paid things do not appear", () => {
  const open = ASSIGNMENTS.find((a) => a.status !== "submitted")!;
  const without = buildTimeline({ ...base, submitted: [open.id] });
  assert.ok(!ids(without).includes(`deadline:${open.id}`));
  assert.ok(!ids(buildTimeline(base)).includes("fee:f1"), "paid instalment is not an upcoming fee");
  assert.ok(ids(buildTimeline(base)).includes("fee:f2"));
});

test("fee dates are all day and the exam shows its kind", () => {
  const items = buildTimeline(base);
  const fee = items.find((i) => i.id === "fee:f2")!;
  assert.equal(fee.allDay, true);
  assert.equal(timeText(fee), "All day");
  assert.equal(items.find((i) => i.id === "exam:x-mat-mid")!.label, "Midterm");
});

test("saved items are labelled as saved in this browser and use the right date", () => {
  const items = buildTimeline({
    ...base,
    reminders: [{ id: "r1", title: "Pay the fee", at: "2026-11-25T09:00:00+08:00" }],
    personalEvents: [{ id: "e1", title: "Dentist", start: "2026-11-26T15:00:00+08:00", end: "2026-11-26T16:00:00+08:00", place: "Town" }],
    studySessions: [{ id: "s1", taskId: "t1", title: "Study CST1101", start: "2026-11-24T19:00:00+08:00", end: "2026-11-24T21:00:00+08:00" }],
    bookings: [{ id: "b1", roomId: "SSR1", date: "2026-11-23", slot: 3 }],
  });
  const saved = items.filter((i) => i.saved);
  assert.equal(saved.length, 4);
  assert.ok(saved.every((i) => i.kind === "saved"));
  assert.equal(items.find((i) => i.id === "saved:reminder:r1")!.date, "2026-11-25");
  assert.ok(items.filter((i) => !i.saved).every((i) => i.kind !== "saved"));
});

test("groups by day, puts overdue first, and today always has a group with a Now position", () => {
  const groups = groupTimeline(buildTimeline(base), DEMO_NOW, "week");
  assert.equal(groups[0].key, "overdue");
  assert.ok(groups[0].items.every((i) => i.state === "overdue"));
  const today = groups.find((g) => g.isToday)!;
  assert.equal(today.key, "2026-11-23");
  assert.match(today.label, /^Today, /);
  assert.match(groups.find((g) => g.key === "2026-11-24")!.label, /^Tomorrow, /);
  // 13:20: the 10:00 lecture is past, the cancelled 14:00 tutorial is not
  assert.deepEqual(today.items.slice(0, 1).map((i) => isPast(i, DEMO_NOW)), [true]);
  assert.equal(today.nowIndex, 1);
});

test("an empty today still gets a group and a Now position", () => {
  const groups = groupTimeline([], DEMO_NOW, "week");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].nowIndex, 0);
});

test("ranges: a week excludes the January exams, the semester includes them", () => {
  const list = buildTimeline(base);
  const flat = (r: "week" | "month" | "all") => groupTimeline(list, DEMO_NOW, r).flatMap((g) => g.items);
  assert.ok(!ids(flat("week")).includes("exam:x-cst1101"));
  assert.ok(!ids(flat("month")).includes("exam:x-cst1101"));
  assert.ok(ids(flat("all")).includes("exam:x-cst1101"));
  assert.ok(ids(flat("month")).includes("exam:x-mat-mid"));
  assert.ok(!ids(flat("week")).includes("exam:x-mat-mid"), "3 Dec is day 11");
});

test("a past day is never shown except as overdue", () => {
  const past = buildTimeline({ ...base, personalEvents: [{ id: "old", title: "Old", start: "2026-11-20T10:00:00+08:00", end: "2026-11-20T11:00:00+08:00" }] });
  assert.ok(!groupTimeline(past, DEMO_NOW, "all").flatMap((g) => g.items).some((i) => i.id === "saved:entry:old"));
});

import { hourRange, isBlock, itemsOnDate, layoutDay, monthLabel, monthStartOf, monthWeeks, stripItems, weekStartOf, daysFrom } from "../src/lib/calendar/timeline.ts";

test("weeks start on Monday and months fill whole weeks", () => {
  assert.equal(weekStartOf("2026-11-23"), "2026-11-23");
  assert.equal(weekStartOf("2026-11-29"), "2026-11-23", "Sunday belongs to the week before it");
  assert.equal(weekStartOf("2026-11-30"), "2026-11-30");
  assert.deepEqual(daysFrom("2026-11-23", 3), ["2026-11-23", "2026-11-24", "2026-11-25"]);
  assert.equal(monthStartOf("2026-11-23"), "2026-11-01");
  assert.equal(monthStartOf("2026-11-23", 2), "2027-01-01");
  assert.equal(monthStartOf("2026-01-15", -1), "2025-12-01");
  assert.equal(monthLabel("2027-01-05"), "January 2027");
  const weeks = monthWeeks("2026-11-23");
  assert.equal(weeks[0][0], "2026-10-26");
  assert.ok(weeks.every((w) => w.length === 7));
  assert.ok(weeks.flat().includes("2026-11-30") && weeks.flat().includes("2026-11-01"));
  assert.ok(weeks.length === 5 || weeks.length === 6);
});

test("deadlines, fees and semester dates go in the strip, timed things become blocks", () => {
  const items = buildTimeline(base);
  assert.equal(isBlock(items.find((i) => i.id === "class:c1")!), true);
  assert.equal(isBlock(items.find((i) => i.id === "deadline:a1")!) , false);
  assert.equal(isBlock(items.find((i) => i.id === "fee:f2")!), false);
  const monday = itemsOnDate(items, "2026-11-23");
  assert.ok(stripItems(monday).some((i) => i.kind === "deadline"));
  assert.ok(stripItems(monday).every((i) => !isBlock(i)));
});

test("overlapping blocks get their own lanes and touching ones do not", () => {
  const mk = (id: string, start: string, end: string) => ({ id, kind: "class", label: "Class", title: id, detail: "", start: `2026-11-23T${start}:00+08:00`, end: `2026-11-23T${end}:00+08:00`, allDay: false, date: "2026-11-23", href: "/", tone: "blue" }) as never;
  const blocks = layoutDay([mk("a", "10:00", "12:00"), mk("b", "11:00", "13:00"), mk("c", "13:00", "14:00")]);
  const by = Object.fromEntries(blocks.map((b) => [b.item.id, b]));
  assert.notEqual(by.a.lane, by.b.lane);
  assert.equal(by.a.lanes, 2);
  assert.equal(by.b.lanes, 2);
  assert.equal(by.c.lanes, 1, "a block that starts as another ends is not a clash");
  assert.equal(by.c.lane, 0);
});

test("a reminder is a half hour block and the hour range grows to fit", () => {
  const items = buildTimeline({ ...base, reminders: [{ id: "r", title: "Late", at: "2026-11-23T21:15:00+08:00" }, { id: "e", title: "Early", at: "2026-11-23T06:30:00+08:00" }] });
  const blocks = layoutDay(itemsOnDate(items, "2026-11-23"));
  const late = blocks.find((b) => b.item.id === "saved:reminder:r")!;
  assert.equal(late.endMin - late.startMin, 30);
  assert.deepEqual(hourRange(blocks), { from: 6, to: 22 });
  assert.deepEqual(hourRange([]), { from: 8, to: 20 });
});
