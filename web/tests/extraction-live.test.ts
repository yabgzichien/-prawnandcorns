import assert from "node:assert/strict";
import test from "node:test";
import { extractNotice } from "../src/lib/agent-tools/gemini-extract.ts";
import { expectedFacts } from "../src/lib/agent-tools/expected.ts";
import type { NoticeItem } from "../src/lib/connectors/types.ts";
import { contextAfter } from "./campus-helpers.ts";
import { SCENARIO_EVENTS } from "../src/lib/world/events.ts";

/**
 * Spec section 13, the extraction check: run extract_notice against real Gemini on every invented email and compare
 * with the hand-written expected answers. It sends invented email text to Google, so it only runs when a key is set:
 *
 *   GEMINI_API_KEY=... npm test
 *
 * Target: every high confidence fact is correct, noise emails give "no action needed", the unclear email gives a question.
 */
const key = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

test("live Gemini reads every invented email the way the stored answers say", { skip: key ? false : "set GEMINI_API_KEY to run the live extraction check", timeout: 240_000 }, async () => {
  const ctx = await contextAfter(SCENARIO_EVENTS.map((e) => e.id).filter((id) => id !== "moodle-outage"));
  const notices = ctx.items.filter((i): i is NoticeItem => i.kind === "notice" && i.source === "mail" && !i.custom);
  assert.ok(notices.length >= 8);
  const wrong: string[] = [];
  for (const notice of notices) {
    const expected = expectedFacts(notice);
    if (!expected) continue;
    const live = await extractNotice({ notice, ctx, apiKey: key!, model });
    if (live.via !== "gemini") { wrong.push(`${notice.id}: Gemini did not answer (${live.note})`); continue; }
    for (const want of expected) {
      const got = live.facts.find((f) => f.type === want.type);
      if (!got) { wrong.push(`${notice.id}: expected a ${want.type} fact, got ${live.facts.map((f) => f.type).join(",") || "none"}`); continue; }
      if (want.confidence === "high") {
        if (got.confidence !== "high") wrong.push(`${notice.id}: expected high confidence, got ${got.confidence} (${got.reason ?? ""})`);
        if (want.newDate && got.newDate !== want.newDate) wrong.push(`${notice.id}: expected date ${want.newDate}, got ${got.newDate}`);
        if (want.newRoom && got.newRoom !== want.newRoom) wrong.push(`${notice.id}: expected room ${want.newRoom}, got ${got.newRoom}`);
        if (want.targetId && got.targetId !== want.targetId) wrong.push(`${notice.id}: expected target ${want.targetId}, got ${got.targetId}`);
      }
      if (want.confidence === "low" && got.confidence !== "low") wrong.push(`${notice.id}: expected a low confidence question, got ${got.confidence}`);
    }
    if (expected.every((f) => f.type === "no_action") && live.facts.some((f) => f.type !== "no_action")) wrong.push(`${notice.id}: noise email produced an action`);
  }
  assert.deepEqual(wrong, [], wrong.join("\n"));
});
