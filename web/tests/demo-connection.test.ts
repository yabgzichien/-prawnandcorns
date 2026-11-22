import assert from "node:assert/strict";
import test from "node:test";
import { runDemoConnection } from "../src/lib/demo-connection.ts";

test("demo walkthrough reports progress and completion only when still active", () => {
  const scheduled: Array<() => void> = [];
  const clock = { setTimeout: (fn: () => void) => (scheduled.push(fn), scheduled.length), clearTimeout: () => {} };
  const phases: string[] = [];
  let completed = 0;
  const cancel = runDemoConnection((phase) => phases.push(phase), () => completed++, clock as never);
  scheduled.forEach((fn) => fn());
  assert.deepEqual(phases, ["sync", "done"]);
  assert.equal(completed, 1);
  cancel();
});

test("closing the demo before completion cannot turn a disconnected page into connected", () => {
  const scheduled: Array<() => void> = [];
  const cleared: unknown[] = [];
  const clock = { setTimeout: (fn: () => void) => (scheduled.push(fn), scheduled.length), clearTimeout: (id: unknown) => cleared.push(id) };
  const phases: string[] = [];
  let connected = false;
  const cancel = runDemoConnection((phase) => phases.push(phase), () => { connected = true; }, clock as never);
  cancel();
  scheduled.forEach((fn) => fn());
  assert.equal(connected, false);
  assert.deepEqual(phases, []);
  assert.equal(cleared.length, 2);
});
