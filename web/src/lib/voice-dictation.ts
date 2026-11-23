/** Minimal Web Speech API adapter, including browsers that require the WebKit prefix.
 * This module only handles transcription. It does not send prompts or retain audio.
 */
export interface DictationResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

export interface DictationResultEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<DictationResult>;
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: DictationResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechConstructor = new () => BrowserSpeechRecognition;
type SpeechHost = { SpeechRecognition?: SpeechConstructor; webkitSpeechRecognition?: SpeechConstructor };

export function speechRecognitionConstructor(host: SpeechHost | Window): SpeechConstructor | null {
  const browser = host as SpeechHost;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

/** Append a transcript without removing an unfinished typed question. */
export function appendTranscript(existing: string, spoken: string): string {
  const addition = spoken.trim();
  if (!addition) return existing;
  if (!existing.trim()) return addition;
  return existing + (/\s$/.test(existing) ? "" : " ") + addition;
}

export function dictationErrorMessage(error: string): string | null {
  switch (error) {
    case "aborted": return null;
    case "not-allowed":
    case "service-not-allowed": return "Microphone or speech recognition permission was denied. Check your browser settings and try again.";
    case "audio-capture": return "No working microphone was found. Check your device's microphone settings.";
    case "no-speech": return "No speech was detected. Try again or type your question.";
    case "network": return "Speech recognition could not connect. Check your connection or type instead.";
    case "language-not-supported": return "Your browser cannot recognize speech in the selected language. Type your question instead.";
    default: return "Voice recognition stopped unexpectedly. You can retry or type your question.";
  }
}

export interface DictationCallbacks {
  onStart(): void;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface DictationSession {
  start(): void;
  stop(): void;
  cancel(): void;
}

export function createDictationSession(
  Recognition: SpeechConstructor,
  lang: string,
  callbacks: DictationCallbacks,
): DictationSession {
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let active = true;
  let started = false;
  let stopping = false;
  const completed = new Set<number>();

  const detach = () => {
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };
  const finish = () => {
    if (!active) return;
    active = false;
    detach();
    callbacks.onEnd();
  };

  recognition.onstart = () => { if (active) callbacks.onStart(); };
  recognition.onresult = (event) => {
    if (!active) return;
    const interim: string[] = [];
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript?.trim();
      if (!text) continue;
      if (result.isFinal) {
        if (i >= event.resultIndex && !completed.has(i)) {
          completed.add(i);
          callbacks.onFinal(text);
        }
      } else {
        interim.push(text);
      }
    }
    callbacks.onInterim(interim.join(" "));
  };
  recognition.onerror = (event) => {
    if (!active) return;
    const message = dictationErrorMessage(event.error);
    if (message) callbacks.onError(message);
    finish();
  };
  recognition.onend = finish;

  return {
    start() {
      if (started || !active) return;
      started = true;
      try {
        recognition.start();
      } catch {
        if (active) callbacks.onError("Couldn't start voice recognition. Check microphone access and try again.");
        finish();
      }
    },
    stop() {
      if (!active || !started || stopping) return;
      stopping = true;
      try {
        // stop() permits the browser to deliver the last recognized phrase.
        recognition.stop();
      } catch {
        finish();
      }
    },
    cancel() {
      if (!active) return;
      active = false;
      detach();
      try { recognition.abort(); } catch { /* Nothing left to record. */ }
    },
  };
}
