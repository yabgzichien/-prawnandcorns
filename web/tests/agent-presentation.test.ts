import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGeneratedCopy, parseAgentText, presentGeminiAnswer } from "../src/lib/agent-presentation.ts";
import type { AgentCard } from "../src/lib/agent.ts";

const planCard: AgentCard = {
  kind: "study-plan",
  proposal: {
    sessions: [{ id: "1", taskId: "a1", title: "Lab", start: "2026-11-23T13:30:00+08:00", end: "2026-11-23T14:30:00+08:00" }],
    blocked: [], assumptions: ["Check Wednesday evening meeting"], skipped: ["Quiz: review separately"],
  },
};

test("schedule card keeps a concise introduction, not a duplicate model timetable", () => {
  const text = presentGeminiAnswer("**Proposed Study Sessions:**\n* Lab\n* Quiz", [planCard], "gemini-2.5-flash", "gemini-4-hydrogen");
  assert.match(text, /Model fallback/);
  assert.match(text, /I found 1 possible study session/);
  assert.match(text, /Nothing has been saved/);
  assert.doesNotMatch(text, /\* Lab|Proposed Study Sessions/);
});

test("non-plan Gemini answers preserve details", () => {
  const answer = "**Due soon**\n* Lab\n* Quiz";
  assert.equal(presentGeminiAnswer(answer, [], "gemini-4-hydrogen"), answer);
});

test("generated copy uses plain punctuation instead of decorative midpoints", () => {
  const marker = String.fromCodePoint(0x00b7);
  const bullet = String.fromCodePoint(0x2022);
  const raw = `Lab 6 ${marker} Loops & Arrays\n${bullet} Check the deadline`;
  const normalized = normalizeGeneratedCopy(raw);
  assert.equal(normalized, "Lab 6, Loops & Arrays\n- Check the deadline");
  assert.equal(presentGeminiAnswer(raw, [], "gemini-2.5-flash"), normalized);
});

test("empty proposal displays a clarification instead of a phantom schedule", () => {
  const blank: AgentCard = { kind: "study-plan", proposal: { sessions: [], blocked: [], assumptions: ["Which day?"], skipped: [] } };
  assert.match(presentGeminiAnswer("I made a plan", [blank], "gemini-2.5-flash"), /couldn't propose/);
});

test("parses paragraphs, headings, bullets and ordered items without evaluating HTML", () => {
  assert.deepEqual(parseAgentText("## Deadlines\n\n**Next**\n\n* **Lab** Monday\n- Quiz Tuesday\n\n1. Review\n2. Confirm\n\n<script>alert(1)</script>"), [
    { kind: "heading", text: "Deadlines" },
    { kind: "paragraph", text: "**Next**" },
    { kind: "list", items: ["**Lab** Monday", "Quiz Tuesday"] },
    { kind: "list", items: ["Review", "Confirm"] },
    { kind: "paragraph", text: "<script>alert(1)</script>" },
  ]);
});
