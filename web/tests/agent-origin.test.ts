import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedAgentOrigin } from "../src/lib/agent-origin.ts";

const localUrl = "http://localhost:3456/api/agent";

test("allows browser's 127.0.0.1 origin when Next normalizes route URL to localhost", () => {
  assert.equal(isAllowedAgentOrigin("http://127.0.0.1:3456", localUrl, false), true);
  assert.equal(isAllowedAgentOrigin("http://localhost:3456", localUrl, false), true);
  assert.equal(isAllowedAgentOrigin("http://[::1]:3456", localUrl, false), true);
});

test("rejects malicious hosts, different ports, different schemes and invalid origins", () => {
  const rejected = [
    "http://evil.example:3456",
    "http://127.0.0.1.evil.example:3456",
    "http://localhost.evil.example:3456",
    "http://127.0.0.1:3457",
    "https://127.0.0.1:3456",
    "null",
    "not-a-url",
    "http://localhost:3456/extra/path",
    "http://user:pass@localhost:3456",
  ];
  for (const origin of rejected) {
    assert.equal(isAllowedAgentOrigin(origin, localUrl, false), false, `should reject ${origin}`);
  }
});

test("does not allow loopback aliases when remote access is enabled", () => {
  assert.equal(isAllowedAgentOrigin("http://127.0.0.1:3456", localUrl, true), false);
  assert.equal(isAllowedAgentOrigin("http://localhost:3456", localUrl, true), true);
  assert.equal(isAllowedAgentOrigin("https://example.com", "https://example.com/api/agent", true), true);
  assert.equal(isAllowedAgentOrigin("https://evil.example", "https://example.com/api/agent", true), false);
});

test("preserves requests that do not have Origin headers", () => {
  assert.equal(isAllowedAgentOrigin(null, localUrl, false), true);
});
