# XMUM Compass: Voice Dictation MVP

**Status:** Implemented on `feat/compass-voice-dictation`, pending team review and physical device testing.
**Scope:** Compose a text question by speaking, then let the student review and explicitly send it.

## User flow

1. Open Compass and select the microphone button beside the message field.
2. Allow microphone and speech recognition access if the browser asks.
3. Speak a short question. Interim recognized words appear as a preview below the input; they do not overwrite typed words.
4. When speech becomes final, it is appended to the existing message. The student can stop manually or let the browser stop after an utterance.
5. Review and correct the resulting text. Press **Send** to call the existing Demo or Gemini agent.

No voice transcript is automatically submitted. Stopping a recording attempts to recover the last recognized phrase. Closing Compass aborts recognition and ignores delayed events.

## Technology decisions

- Use the browser's `SpeechRecognition` or prefixed `webkitSpeechRecognition`. The original Gemini Agent, deterministic Study Planner and request security are unchanged.
- Use one utterance at a time (`continuous = false`), with optional interim results. The browser's active recognition language follows `navigator.language`; explicit per-message language switching can be considered later.
- No new backend endpoint, API key, audio upload implementation, audio recording file, speech synthesis, background listening or wake word.
- If unsupported, show a disabled microphone button and let the student type as normal.
- Error states include permission denied, no microphone, no speech, network problems, language not supported, failed startup and a stopped engine that never finishes.
- Keep the UI within 320 CSS px. Status and errors must be available to keyboard and screen-reader users.

## Privacy and limitations

Compass does not store audio. However, browser speech recognition may send audio to its vendor's speech service, depending on the browser and platform. The browser, not Compass, owns the recognition service and its data-processing behavior. The screen explains this before recording. The final **text** is only sent to the selected Compass agent after the student presses Send.

Browser compatibility varies, especially across Safari, Chromium and different mobile versions. Recognition may need connectivity and microphone access. Support detection checks for the API, not a guarantee that a microphone or recognition service is usable. Never claim that speech recognition is always offline or that all speech stays on-device.

## Tests and acceptance

- `web/tests/voice-dictation.test.ts`: native/prefixed API detection, transcript merging, interim/final behavior, duplicate final protection, cancellation and errors.
- `web/tests-e2e/voice-dictation.spec.ts`: mocked browser speech engine, real input/edit/send interaction, privacy guard (no auto-send), denial and unsupported states, cancellation on close, and 320px overflow check.
- Regression: `cd web && npm test && npm run test:e2e && npm run lint && npm run build`.

### Manual device acceptance still needed

- [ ] Chrome desktop: actual microphone permission, utterance, Stop and final transcription.
- [ ] Safari desktop and iOS Safari: supported API behavior, permission prompts and natural end-of-speech handling.
- [ ] Android Chrome: permission denial, unsupported/service offline fallback, keyboard after recognition.
- [ ] English and non-English system languages: speech accuracy, code-switching, punctuation and edited final text.
- [ ] VoiceOver and keyboard: button names, live transcript announcements, accessible errors and focus.

**Release boundary:** Do not treat mocked E2E tests as proof that physical microphone recognition works. This branch is not authorized for deployment or remote API enablement.
