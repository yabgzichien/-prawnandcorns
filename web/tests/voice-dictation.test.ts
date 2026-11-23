import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTranscript, createDictationSession, dictationErrorMessage,
  speechRecognitionConstructor, type BrowserSpeechRecognition, type DictationResultEvent,
} from "../src/lib/voice-dictation.ts";

class MockRecognition implements BrowserSpeechRecognition {
  static last: MockRecognition;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: DictationResultEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  stops = 0;
  aborts = 0;
  constructor() { MockRecognition.last = this; }
  start() { this.onstart?.(); }
  stop() { this.stops++; }
  abort() { this.aborts++; }
  result(transcript: string, final: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal: final }] });
  }
  end() { this.onend?.(); }
  error(code: string) { this.onerror?.({ error: code }); }
}

function setup() {
  const events: string[] = [];
  const session = createDictationSession(MockRecognition, "en-MY", {
    onStart: () => events.push("started"),
    onInterim: (text) => events.push(`interim:${text}`),
    onFinal: (text) => events.push(`final:${text}`),
    onError: (text) => events.push(`error:${text}`),
    onEnd: () => events.push("ended"),
  });
  return { events, session, get recognition() { return MockRecognition.last; } };
}

test("uses standard or prefixed SpeechRecognition and allows graceful absence", () => {
  assert.equal(speechRecognitionConstructor({}), null);
  assert.equal(speechRecognitionConstructor({ webkitSpeechRecognition: MockRecognition }), MockRecognition);
  assert.equal(speechRecognitionConstructor({ SpeechRecognition: MockRecognition }), MockRecognition);
});

test("appends final transcript after existing typed text without submitting or clearing it", () => {
  assert.equal(appendTranscript("Help me", "plan my week"), "Help me plan my week");
  assert.equal(appendTranscript("Help me ", " plan my week "), "Help me plan my week");
  assert.equal(appendTranscript("", "What is next?"), "What is next?");
  assert.equal(appendTranscript("Already typed", "   "), "Already typed");
});

test("collects interim and final text once, with one-shot configuration", () => {
  const mock = setup();
  mock.session.start();
  const recognition = mock.recognition;
  assert.equal(recognition.lang, "en-MY");
  assert.equal(recognition.continuous, false);
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.maxAlternatives, 1);
  recognition.result("plan my", false);
  recognition.result("plan my week", true);
  recognition.result("plan my week", true);
  mock.session.stop();
  mock.session.stop();
  assert.equal(recognition.stops, 1);
  recognition.end();
  assert.deepEqual(mock.events, ["started", "interim:plan my", "final:plan my week", "interim:", "interim:", "ended"]);
});

test("cancelling a dictation detaches events and aborts the microphone", () => {
  const mock = setup();
  mock.session.start();
  const { recognition } = mock;
  mock.session.cancel();
  mock.session.cancel();
  recognition.result("secret after dismissal", true);
  recognition.end();
  assert.deepEqual(mock.events, ["started"]);
  assert.equal(recognition.aborts, 1);
});

test("permission and microphone failures get actionable messages", () => {
  assert.match(dictationErrorMessage("not-allowed")!, /permission was denied/i);
  assert.match(dictationErrorMessage("audio-capture")!, /microphone was found/i);
  assert.match(dictationErrorMessage("no-speech")!, /No speech was detected/i);
  assert.equal(dictationErrorMessage("aborted"), null);

  const mock = setup();
  mock.session.start();
  mock.recognition.error("not-allowed");
  assert.equal(mock.events.filter((event) => event === "ended").length, 1);
  assert.equal(mock.events.some((event) => event.includes("permission was denied")), true);
  mock.recognition.end();
  assert.equal(mock.events.filter((event) => event === "ended").length, 1);
});
