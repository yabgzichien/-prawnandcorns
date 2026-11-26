import assert from "node:assert/strict";
import test from "node:test";
import { GEMINI_MODEL_CHOICES, fallbackForGeminiModel, isSelectableGeminiModel, resolveGeminiModel } from "../src/lib/gemini-model-selection.ts";

test("only explicitly supported Gemini models can be selected from the UI", () => {
  assert.deepEqual(GEMINI_MODEL_CHOICES.map((choice) => choice.id), ["gemini-2.5-flash", "gemini-4-hydrogen"]);
  assert.equal(isSelectableGeminiModel("gemini-2.5-flash"), true);
  assert.equal(isSelectableGeminiModel("gemini-4-hydrogen"), true);
  assert.equal(isSelectableGeminiModel("custom-model-with-unknown-price"), false);
  assert.equal(isSelectableGeminiModel(null), false);
});

test("server accepts only a known per-request model or an omitted model", () => {
  assert.equal(resolveGeminiModel(undefined, "gemini-2.5-flash"), "gemini-2.5-flash");
  assert.equal(resolveGeminiModel("gemini-4-hydrogen", "gemini-2.5-flash"), "gemini-4-hydrogen");
  assert.equal(resolveGeminiModel("gemini-2.5-flash", "gemini-4-hydrogen"), "gemini-2.5-flash");
  assert.equal(resolveGeminiModel("gemini-9-unknown", "gemini-2.5-flash"), null);
  assert.equal(resolveGeminiModel({}, "gemini-2.5-flash"), null);
  assert.equal(resolveGeminiModel(null, "gemini-2.5-flash"), null);
});

test("Hydrogen falls back to Flash, but Flash never escalates to Hydrogen", () => {
  assert.equal(fallbackForGeminiModel("gemini-4-hydrogen"), "gemini-2.5-flash");
  assert.equal(fallbackForGeminiModel("gemini-2.5-flash"), "gemini-2.5-flash");
});
