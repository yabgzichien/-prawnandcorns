import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WIDGETS, mergeWidgets, REFERENCE_LAYOUT } from "../src/lib/widget-layout.ts";

const shown = (w: { id: string; hidden: boolean }[]) => w.filter((x) => !x.hidden).map((x) => x.id);

test("a fresh visit shows the master calendar and nothing else", () => {
  assert.deepEqual(shown(mergeWidgets(undefined)), ["calendar"]);
  assert.deepEqual(shown(DEFAULT_WIDGETS), ["calendar"]);
  assert.equal(DEFAULT_WIDGETS[0].id, "calendar");
});

test("a saved layout that was never customised moves to the new default", () => {
  const legacy = [
    ...["next", "alerts", "due", "today", "clubs", "find"].map((id) => ({ id, hidden: false })),
    ...["fees", "progress", "headsup", "plans"].map((id) => ({ id, hidden: true })),
  ];
  assert.deepEqual(shown(mergeWidgets(legacy)), ["calendar"]);
  // an older save from before Heads-up and My plans existed was equally untouched
  assert.deepEqual(shown(mergeWidgets(legacy.slice(0, 8))), ["calendar"]);
});

test("a customised layout keeps every choice and gains the calendar on top", () => {
  const custom = [{ id: "fees", hidden: false }, { id: "due", hidden: false }, { id: "next", hidden: true }];
  const merged = mergeWidgets(custom);
  assert.equal(merged[0].id, "calendar");
  assert.equal(merged[0].hidden, false);
  assert.deepEqual(merged.slice(1, 4), custom);
  assert.deepEqual(shown(merged), ["calendar", "fees", "due", "alerts", "today", "clubs", "find"]);
});

test("a layout that already has the calendar is respected, including switched off", () => {
  const off = mergeWidgets([{ id: "calendar", hidden: true }, { id: "due", hidden: false }]);
  assert.equal(off[0].id, "calendar");
  assert.equal(off[0].hidden, true);
  assert.ok(shown(off).includes("due"));
  assert.ok(!shown(off).includes("calendar"));
});

test("unknown and repeated ids are dropped and every card is present once", () => {
  const merged = mergeWidgets([{ id: "calendar", hidden: false }, { id: "calendar", hidden: true }, { id: "nope", hidden: false }, null, 3]);
  assert.deepEqual(merged.map((w) => w.id).sort(), DEFAULT_WIDGETS.map((w) => w.id).sort());
  assert.equal(merged.find((w) => w.id === "calendar")!.hidden, false);
});

test("the reference layout is the six classic cards in order", () => {
  assert.deepEqual([...REFERENCE_LAYOUT], ["next", "alerts", "due", "today", "clubs", "find"]);
});
