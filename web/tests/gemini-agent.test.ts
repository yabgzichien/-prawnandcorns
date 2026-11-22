import assert from "node:assert/strict";
import test from "node:test";
import { runGeminiToolLoop, type GeminiToolResult } from "../src/lib/gemini-agent.ts";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

test("Gemini selects a read-only tool, gets its response, and returns an answer", async () => {
  const calls: Array<{ headers: Headers; body: Record<string, unknown> }> = [];
  const payloads = [
    { candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "get_demo_assignments", args: {} }, thoughtSignature: "opaque" }] } }] },
    { candidates: [{ content: { role: "model", parts: [{ text: "The fictional student has a Lab due Monday." }] } }] },
  ];
  const fetcher: typeof fetch = async (_url, init) => {
    calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return ok(payloads.shift());
  };
  const tools: string[] = [];
  const run = await runGeminiToolLoop({
    prompt: "What's due this week?", apiKey: "test-secret", model: "gemini-3.8-flash", fetcher,
    executeTool: async (name): Promise<GeminiToolResult> => {
      tools.push(name);
      return { value: { tasks: [{ id: "a1", title: "Lab" }] }, summary: "1 fictional task" };
    },
  });
  assert.deepEqual(tools, ["get_demo_assignments"]);
  assert.equal(run.tools[0].tool, "get_demo_assignments");
  assert.match(run.text, /fictional student/);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers.get("x-goog-api-key"), "test-secret");
  assert.doesNotMatch(JSON.stringify(run), /test-secret/);
  const contents = calls[1].body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  assert.equal(contents[1].parts[0].thoughtSignature, "opaque");
  assert.equal(contents[2].parts[0].functionResponse != null, true);
});

test("Gemini never executes a tool outside the allowlist", async () => {
  let executed = false;
  const fetcher: typeof fetch = async () => ok({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "delete_all_data", args: {} } }] } }] });
  await assert.rejects(() => runGeminiToolLoop({ prompt: "delete", apiKey: "fake", fetcher,
    executeTool: async () => { executed = true; return { value: {}, summary: "" }; },
  }), /unsupported tool/i);
  assert.equal(executed, false);
});

test("Gemini's tool loop is bounded and upstream errors don't reveal API credentials", async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ error: { message: "account unavailable" } }), { status: 429 });
  await assert.rejects(() => runGeminiToolLoop({ prompt: "test", apiKey: "dont-disclose", fetcher, executeTool: async () => ({ value: {}, summary: "" }) }), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.match(err.message, /429/);
    assert.doesNotMatch(err.message, /dont-disclose/);
    return true;
  });
});

test("Gemini includes a reviewable plan card returned by the deterministic tool", async () => {
  let turn = 0;
  const session = { id: "s1", taskId: "a1", title: "Lab", start: "2026-11-23T13:30:00+08:00", end: "2026-11-23T14:30:00+08:00" };
  const proposal = { sessions: [session], assumptions: [], blocked: [], skipped: [] };
  const fetcher: typeof fetch = async () => ok(turn++ === 0
    ? { candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "propose_study_plan", args: {} } }] } }] }
    : { candidates: [{ content: { role: "model", parts: [{ text: "Review the proposal, then confirm before saving." }] } }] });
  const result = await runGeminiToolLoop({ prompt: "Plan my week", apiKey: "test", fetcher, executeTool: async () => ({
    value: proposal, summary: "1 study session", card: { kind: "study-plan", proposal },
  }) });
  assert.equal(result.cards[0]?.kind, "study-plan");
  assert.equal(result.tools.length, 1);
});

test("defaults to Gemini 4 Hydrogen with medium thinking and adequate tool-call budget", async () => {
  let sentUrl = "";
  let sentBody: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (url, init) => {
    sentUrl = String(url);
    sentBody = JSON.parse(String(init?.body));
    return ok({ candidates: [{ content: { role: "model", parts: [{ text: "This is a fictional demo." }] } }] });
  };
  const result = await runGeminiToolLoop({
    prompt: "What do I need to do?", apiKey: "test", fetcher,
    executeTool: async () => ({ value: {}, summary: "No data" }),
  });
  assert.match(sentUrl, /gemini-4-hydrogen:generateContent$/);
  assert.equal(result.model, "gemini-4-hydrogen");
  const config = sentBody.generationConfig as Record<string, unknown>;
  assert.deepEqual(config.thinkingConfig, { thinkingLevel: "MEDIUM" });
  assert.ok(Number(config.maxOutputTokens) >= 4096);
  assert.equal("temperature" in config, false);
});
