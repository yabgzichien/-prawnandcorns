import assert from "node:assert/strict";
import test from "node:test";
import { readJsonBodyWithinLimit, RequestBodyTooLargeError } from "../src/lib/request-body.ts";

const url = "http://127.0.0.1:3456/api/agent";

test("accepts a normal JSON body inside the byte limit", async () => {
  const request = new Request(url, { method: "POST", body: JSON.stringify({ prompt: "Plan my week" }) });
  assert.deepEqual(await readJsonBodyWithinLimit(request, 1024), { prompt: "Plan my week" });
});

test("rejects an oversized body without relying on Content-Length", async () => {
  const request = new Request(url, { method: "POST", body: JSON.stringify({ prompt: "x".repeat(2000) }) });
  request.headers.delete("content-length");
  await assert.rejects(readJsonBodyWithinLimit(request, 256), RequestBodyTooLargeError);
});

test("rejects cumulative size in a chunked stream", async () => {
  let reads = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads++;
      controller.enqueue(new TextEncoder().encode("x".repeat(130)));
      if (reads >= 3) controller.close();
    },
  });
  const request = new Request(url, { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(readJsonBodyWithinLimit(request, 250), RequestBodyTooLargeError);
});

test("rejects malformed JSON instead of accepting a partial body", async () => {
  const request = new Request(url, { method: "POST", body: '{"prompt":' });
  await assert.rejects(readJsonBodyWithinLimit(request, 200), SyntaxError);
});
