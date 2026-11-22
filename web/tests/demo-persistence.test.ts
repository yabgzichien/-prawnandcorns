import assert from "node:assert/strict";
import test from "node:test";
import { persistDemoSnapshot } from "../src/lib/demo-persistence.ts";

test("reports success only after the browser storage write succeeds", () => {
  const saved = new Map<string, string>();
  const result = persistDemoSnapshot(() => ({ setItem: (key, value) => { saved.set(key, value); } }),
    "xmum-compass:v1", { studySessions: [{ id: "s1" }] });
  assert.equal(result, true);
  assert.deepEqual(JSON.parse(saved.get("xmum-compass:v1")!), { studySessions: [{ id: "s1" }] });
});

test("does not falsely report saved if storage is blocked or full", () => {
  assert.equal(persistDemoSnapshot(() => { throw new Error("Storage unavailable"); }, "key", {}), false);
  assert.equal(persistDemoSnapshot(() => ({ setItem: () => { throw new Error("Quota exceeded"); } }), "key", {}), false);
});
