import assert from "node:assert/strict";
import test from "node:test";
import { connectSystems, getConnections } from "../src/lib/connectors/connections.ts";
import { ONBOARDING_KEY, clearOnboarding, readOnboarding, writeOnboarding } from "../src/lib/onboarding.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    data,
  };
}
const blocked = () => ({
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
});

test("starts as none, remembers done and skipped, and ignores unknown values", () => {
  const s = memoryStorage();
  assert.equal(readOnboarding(s), "none");
  assert.equal(writeOnboarding("skipped", s), true);
  assert.equal(readOnboarding(s), "skipped");
  assert.equal(writeOnboarding("done", s), true);
  assert.equal(readOnboarding(s), "done");
  assert.equal(readOnboarding(memoryStorage({ [ONBOARDING_KEY]: "maybe" })), "none");
  clearOnboarding(s);
});

test("clearing brings the first-run step back", () => {
  const s = memoryStorage();
  writeOnboarding("done", s);
  clearOnboarding(s);
  assert.equal(readOnboarding(s), "none");
  assert.equal(s.data.has(ONBOARDING_KEY), false);
});

test("blocked storage keeps the answer for this page session and says it was not saved", () => {
  assert.equal(writeOnboarding("skipped", blocked()), false);
  assert.equal(readOnboarding(blocked()), "skipped");
  clearOnboarding(blocked());
  assert.equal(readOnboarding(blocked()), "none");
});

test("connectSystems writes every chosen system once and keeps earlier tokens", () => {
  const s = memoryStorage();
  const first = connectSystems(["moodle", "ac"], "2026-11-27T09:00:00.000Z", s)!;
  assert.deepEqual(Object.keys(first).sort(), ["ac", "moodle"]);
  const again = connectSystems(["moodle", "finance", "mail"], "2026-11-27T09:05:00.000Z", s)!;
  assert.deepEqual(Object.keys(again).sort(), ["ac", "finance", "mail", "moodle"]);
  assert.equal(again.moodle?.token, first.moodle?.token);
  assert.equal(Object.keys(getConnections(s)).length, 4);
});

test("connectSystems reports failure instead of success when storage is blocked or nothing is chosen", () => {
  assert.equal(connectSystems(["moodle"], "2026-11-27T09:00:00.000Z", blocked()), null);
  assert.equal(connectSystems([], "2026-11-27T09:00:00.000Z", memoryStorage()), null);
  assert.equal(connectSystems(["moodle"], "2026-11-27T09:00:00.000Z", null), null);
});
