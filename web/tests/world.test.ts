import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIO_EVENTS } from "../src/lib/world/events.ts";
import { applyEvent, baseWorld, buildWorld, cleanEventIds } from "../src/lib/world/world.ts";
import { addCustomNotice, getCustomNotices, getTriggeredEvents, resetScenario, triggerEvent } from "../src/lib/world/storage.ts";
import { ROOM_BY_CODE } from "../src/lib/data/campus.ts";

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
};

test("the same event ids always build the same world", () => {
  const a = buildWorld(["move-class-tue", "extend-lab6-deadline"]);
  const b = buildWorld(["move-class-tue", "extend-lab6-deadline"]);
  assert.deepEqual(a, b);
  assert.deepEqual(buildWorld([]), baseWorld());
});

test("unknown, repeated and non-string ids are ignored, never trusted", () => {
  assert.deepEqual(cleanEventIds(["move-class-tue", "nope", 42, null, "move-class-tue", "__proto__", "constructor"]), ["move-class-tue"]);
  assert.deepEqual(buildWorld(["nope"]), baseWorld());
});

test("applyEvent returns a new world and never edits the old one", () => {
  const before = baseWorld();
  const snapshot = JSON.stringify(before);
  const after = applyEvent(before, SCENARIO_EVENTS.find((e) => e.id === "move-class-tue")!);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(after.classes.find((c) => c.id === "c5")?.room, "A1-210");
  assert.equal(after.classes.find((c) => c.id === "c5")?.originalRoom, "A4-301");
  assert.equal(after.classes.find((c) => c.id === "c5")?.status, "room-changed");
  assert.equal(before.classes.find((c) => c.id === "c5")?.room, "A4-301");
});

test("every scenario event produces its documented change", () => {
  const w = (id: string) => buildWorld([id]);
  assert.equal(w("extend-lab6-deadline").assignments.find((a) => a.id === "a1")?.due, "2026-11-27T23:59:00+08:00");
  assert.ok(w("extend-lab6-deadline").inbox.some((m) => m.id === "mail-lab6-extended"));
  const cancelled = w("cancel-lecture-makeup");
  assert.equal(cancelled.classes.find((c) => c.id === "c10")?.status, "cancelled");
  assert.equal(cancelled.classes.find((c) => c.id === "c12")?.status, "makeup");
  assert.equal(w("finance-instalment-2").fees.find((f) => f.id === "f2")?.posted, true);
  assert.equal(baseWorld().fees.find((f) => f.id === "f2")?.posted, false);
  assert.ok(w("new-moodle-assignment").assignments.some((a) => a.id === "a7"));
  assert.ok(w("club-info-session").inbox.some((m) => m.id === "mail-robotics-info"));
  assert.equal(w("noise-emails").inbox.length, baseWorld().inbox.length + 2);
  assert.ok(w("ambiguous-quiz-email").inbox.some((m) => m.id === "mail-quiz-ambiguous"));
  assert.equal(w("moodle-outage").outage.moodle, "moodle-outage");
});

test("events never reuse an existing id and only point at records that exist", () => {
  const base = baseWorld();
  for (const event of SCENARIO_EVENTS) {
    for (const effect of event.effects) {
      if (effect.op === "addClass") assert.ok(!base.classes.some((c) => c.id === effect.session.id), effect.session.id);
      if (effect.op === "addAssignment") assert.ok(!base.assignments.some((a) => a.id === effect.assignment.id));
      if (effect.op === "addEmail") assert.ok(!base.inbox.some((m) => m.id === effect.message.id));
      if (effect.op === "moveClass") { assert.ok(base.classes.some((c) => c.id === effect.classId)); assert.ok(ROOM_BY_CODE[effect.room], `${effect.room} is not on the campus map`); }
      if (effect.op === "cancelClass") assert.ok(base.classes.some((c) => c.id === effect.classId));
      if (effect.op === "setDue") assert.ok(base.assignments.some((a) => a.id === effect.assignmentId));
      if (effect.op === "postFee") assert.ok(base.fees.some((f) => f.id === effect.feeId));
    }
  }
  assert.equal(new Set(SCENARIO_EVENTS.map((e) => e.id)).size, 9);
});

test("triggered events are stored in order, once, and reset clears them", () => {
  const storage = memory();
  assert.deepEqual(getTriggeredEvents(storage), []);
  triggerEvent("finance-instalment-2", storage);
  triggerEvent("move-class-tue", storage);
  triggerEvent("finance-instalment-2", storage);
  triggerEvent("not-an-event", storage);
  assert.deepEqual(getTriggeredEvents(storage), ["finance-instalment-2", "move-class-tue"]);
  resetScenario(storage);
  assert.deepEqual(getTriggeredEvents(storage), []);
});

test("storage tolerates corrupt data and a missing storage object", () => {
  const storage = memory();
  storage.setItem("compass:scenario-events:v1", "{not json");
  assert.deepEqual(getTriggeredEvents(storage), []);
  assert.equal(triggerEvent("move-class-tue", null), false);
  assert.deepEqual(getTriggeredEvents(null), []);
});

test("custom notices are capped, stay in this browser and are cleared by reset", () => {
  const storage = memory();
  const added = addCustomNotice({ from: "X".repeat(500), subject: "Hi", body: "B".repeat(9000) }, storage);
  assert.ok(added);
  assert.equal(added.from.length, 80);
  assert.equal(added.body.length, 1500);
  assert.equal(getCustomNotices(storage).length, 1);
  assert.equal(addCustomNotice({ from: "a", subject: "b", body: "   " }, storage), null);
  resetScenario(storage);
  assert.deepEqual(getCustomNotices(storage), []);
});
