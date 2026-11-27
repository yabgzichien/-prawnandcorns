import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WIDGETS, mergeWidgets, packWidgets, type WidgetPref } from "../src/lib/widget-layout.ts";

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
  assert.deepEqual(shown(merged), ["calendar", "fees", "attention", "alerts", "clubs", "find"]);
});

test("a layout that already has the calendar is respected, including switched off", () => {
  const off = mergeWidgets([{ id: "calendar", hidden: true }, { id: "due", hidden: false }]);
  assert.equal(off[0].id, "calendar");
  assert.equal(off[0].hidden, true);
  assert.ok(shown(off).includes("attention"));
  assert.ok(!shown(off).includes("calendar"));
});

test("unknown and repeated ids are dropped and every card is present once", () => {
  const merged = mergeWidgets([{ id: "calendar", hidden: false }, { id: "calendar", hidden: true }, { id: "nope", hidden: false }, null, 3]);
  assert.deepEqual(merged.map((w) => w.id).sort(), DEFAULT_WIDGETS.map((w) => w.id).sort());
  assert.equal(merged.find((w) => w.id === "calendar")!.hidden, false);
});

test("merged cards inherit visibility from either source and survive another reload", () => {
  const merged = mergeWidgets([{id: "calendar", hidden: true}, {id: "today", hidden: false},
    {id: "due", hidden: true}, {id: "headsup", hidden: false}]);
  assert.deepEqual(shown(merged), ["calendar", "attention"]);
  assert.deepEqual(mergeWidgets(merged), merged);
});

test("preset migration preserves visibility and order while validating sizes", () => {
  const layout = mergeWidgets([
    { id: "clubs", hidden: true, size: "wide" },
    { id: "fees", hidden: false, size: "compact" },
    { id: "calendar", hidden: false, size: "wide" },
    { id: "find", hidden: false, size: "unknown" },
  ]);
  assert.deepEqual(layout.slice(0, 4), [
    { id: "calendar", hidden: false },
    { id: "clubs", hidden: true, size: "wide" },
    { id: "fees", hidden: false, size: "compact" },
    { id: "find", hidden: false },
  ]);
  assert.deepEqual(mergeWidgets(layout), layout);
});

test("a short card can fill an earlier gap before a wide card", () => {
  const cards: WidgetPref[] = [
    { id: "attention", hidden: false },
    { id: "fees", hidden: false },
    { id: "clubs", hidden: false, size: "wide" },
    { id: "find", hidden: false, size: "compact" },
  ];
  const packed = packWidgets(cards, { attention: 340, fees: 120, clubs: 140, find: 110 }, 16);
  assert.deepEqual(packed.map(({ card, top, column, span }) => [card.id, top, column, span]), [
    ["attention", 0, 0, 1],
    ["fees", 0, 1, 1],
    ["find", 136, 1, 1],
    ["clubs", 356, 0, 2],
  ]);
});
