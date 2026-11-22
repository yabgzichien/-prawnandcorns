import assert from "node:assert/strict";
import test from "node:test";
import { runGeminiToolLoop, runGeminiWithFallback, type GeminiToolResult } from "../src/lib/gemini-agent.ts";

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

test("defaults to the faster Gemini 2.5 Flash with a compatible tool-call budget", async () => {
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
  assert.match(sentUrl, /gemini-2.5-flash:generateContent$/);
  assert.equal(result.model, "gemini-2.5-flash");
  const config = sentBody.generationConfig as Record<string, unknown>;
  assert.equal("thinkingConfig" in config, false);
  assert.ok(Number(config.maxOutputTokens) >= 4096);
  assert.equal("temperature" in config, false);
});

test("Hydrogen remains an explicitly configurable model with medium thinking", async () => {
  let config: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (_url, init) => {
    config = JSON.parse(String(init?.body)).generationConfig;
    return ok({ candidates: [{ content: { role: "model", parts: [{ text: "Demo response" }] } }] });
  };
  const result = await runGeminiToolLoop({ prompt: "Explain", apiKey: "test", model: "gemini-4-hydrogen", fetcher,
    executeTool: async () => ({ value: {}, summary: "No data" }) });
  assert.equal(result.model, "gemini-4-hydrogen");
  assert.deepEqual(config.thinkingConfig, { thinkingLevel: "MEDIUM" });
});

test("legacy Gemini 2.5 can use the fallback without incompatible thinking levels", async () => {
  let requestBody: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return ok({ candidates: [{ content: { role: "model", parts: [{ text: "Fictional demo only." }] } }] });
  };
  await runGeminiToolLoop({ prompt: "Explain my demo plan", apiKey: "test", model: "gemini-2.5-flash", fetcher, executeTool: async () => ({ value: {}, summary: "" }) });
  const config = requestBody.generationConfig as Record<string, unknown>;
  assert.equal("thinkingConfig" in config, false);
});

test("retries a temporary Gemini 503 only a bounded number of times", async () => {
  let count = 0;
  const fetcher: typeof fetch = async () => {
    count++;
    return count === 1 ? new Response("{}", { status: 503 })
      : ok({ candidates: [{ content: { role: "model", parts: [{ text: "Recovered" }] } }] });
  };
  const result = await runGeminiToolLoop({ prompt: "hello", apiKey: "test", fetcher, executeTool: async () => ({ value: {}, summary: "" }) });
  assert.equal(count, 2);
  assert.equal(result.text, "Recovered");
});

test("fallback is explicit and only triggered when the preferred model is unavailable", async () => {
  const seen: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    seen.push(String(url));
    return String(url).includes("gemini-4-hydrogen")
      ? new Response("{}", { status: 503 })
      : ok({ candidates: [{ content: { role: "model", parts: [{ text: "Fictional response from fallback." }] } }] });
  };
  const answer = await runGeminiWithFallback({
    prompt: "Can you help?", apiKey: "test", model: "gemini-4-hydrogen", fallbackModel: "gemini-2.5-flash", fetcher,
    executeTool: async () => ({ value: {}, summary: "" }),
  });
  assert.equal(answer.model, "gemini-2.5-flash");
  assert.equal(answer.fallbackFrom, "gemini-4-hydrogen");
  assert.equal(seen.filter((url) => url.includes("gemini-4-hydrogen")).length, 3);
});

test("does not silently fall back on authentication or quota failures", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return new Response("{}", { status: 429 }); };
  await assert.rejects(() => runGeminiWithFallback({ prompt: "hello", apiKey: "test", model: "gemini-4-hydrogen", fallbackModel: "gemini-2.5-flash", fetcher,
    executeTool: async () => ({ value: {}, summary: "" }),
  }), /HTTP 429/);
  assert.equal(calls, 1);
});

test("uses an explicitly labelled fallback when the primary model times out", async () => {
  const attempts: string[] = [];
  const fetcher: typeof fetch = async (url) => {
    attempts.push(String(url));
    if (String(url).includes("gemini-4-hydrogen")) throw new DOMException("Google did not respond", "TimeoutError");
    return ok({ candidates: [{ content: { role: "model", parts: [{ text: "The fallback is working." }] } }] });
  };
  const result = await runGeminiWithFallback({
    prompt: "hello", apiKey: "test", model: "gemini-4-hydrogen", fallbackModel: "gemini-2.5-flash", fetcher,
    executeTool: async () => ({ value: {}, summary: "" }),
  });
  assert.equal(result.model, "gemini-2.5-flash");
  assert.equal(result.fallbackFrom, "gemini-4-hydrogen");
  assert.equal(attempts.length, 2);
});
