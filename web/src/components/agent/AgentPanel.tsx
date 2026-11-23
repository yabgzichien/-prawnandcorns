"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUp, Check, ChevronDown, Loader2, Mic, MicOff, Shield, Sparkles, Square, X } from "lucide-react";
import { runAgent, SUGGESTIONS, type AgentCard, type AgentEvent } from "@/lib/agent";
import { runGeminiAgent } from "@/lib/gemini-client";
import { useApp, type WidgetPref } from "@/lib/state";
import { Sheet } from "@/components/ui/Sheet";
import { SPRING, SPRING_FAST } from "@/lib/hooks";
import { AgentCardView } from "./Cards";
import { STUDENT } from "@/lib/data/academics";
import { parseAgentText } from "@/lib/agent-presentation";
import { GEMINI_MODEL_CHOICES, isSelectableGeminiModel, type SelectableGeminiModel } from "@/lib/gemini-model-selection";
import {
  appendTranscript, checkOnDeviceSpeech, createDictationSession, installOnDeviceSpeech,
  speechRecognitionConstructor, supportsOnDeviceSpeech, type DictationSession,
} from "@/lib/voice-dictation";

type ToolRow = { id: string; tool: string; input: string; status: "running" | "done"; output?: string };
type AgentMsg = { id: number; role: "agent"; plan: string[]; step: number; tools: ToolRow[]; text: string; cards: AgentCard[]; done: boolean };
type UserMsg = { id: number; role: "user"; text: string };
type Msg = UserMsg | AgentMsg;
type DictationState = "idle" | "starting" | "listening" | "stopping";
type LocalSpeechStatus = "hidden" | "checking" | "downloadable" | "installing" | "ready" | "unavailable";
const LOCAL_SPEECH_LANGUAGE = "en-US";

const noSpeechSubscription = () => () => {};
const browserHasSpeechRecognition = () => Boolean(speechRecognitionConstructor(window));
const browserHasOnDeviceSpeech = () => supportsOnDeviceSpeech(speechRecognitionConstructor(window));
const serverHasSpeechRecognition = () => false;

/** Inline emphasis only. Content is always React text, never injected HTML. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
  );
}

function AgentText({ value }: { value: string }) {
  return <div className="space-y-2 text-[0.97rem] leading-[1.55] tracking-[-0.008em]">
    {parseAgentText(value).map((block, i) => {
      if (block.kind === "heading") return <p key={i} className="font-semibold">{rich(block.text)}</p>;
      if (block.kind === "list") return <ul key={i} className="list-outside list-disc space-y-1 pl-5">
        {block.items.map((item, j) => <li key={j}>{rich(item)}</li>)}
      </ul>;
      return <p key={i} className="whitespace-pre-line">{rich(block.text)}</p>;
    })}
  </div>;
}

export function AgentPanel() {
  const { agentOpen, closeAgent, agentSeed, widgets, submitted, studySessions, setWidgets, showToast } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [dictationState, setDictation] = useState<DictationState>("idle");
  const supportsDictation = useSyncExternalStore(noSpeechSubscription, browserHasSpeechRecognition, serverHasSpeechRecognition);
  const supportsLocalSpeech = useSyncExternalStore(noSpeechSubscription, browserHasOnDeviceSpeech, serverHasSpeechRecognition);
  const dictation = supportsDictation ? dictationState : "unsupported";
  const [speechMode, setSpeechMode] = useState<"browser" | "on-device">("browser");
  const [localSpeechStatus, setLocalSpeechStatus] = useState<LocalSpeechStatus>("hidden");
  const [dictationErrorCode, setDictationErrorCode] = useState<string | null>(null);
  const [dictationInterim, setDictationInterim] = useState("");
  const [dictationMessage, setDictationMessage] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<"checking" | "ready" | "missing">("checking");
  const [model, setModel] = useState<SelectableGeminiModel>("gemini-2.5-flash");
  const [mode, setMode] = useState<"gemini" | "demo">("demo");
  const abort = useRef<AbortController | null>(null);
  const speech = useRef<DictationSession | null>(null);
  const speechHasFinal = useRef(false);
  const speechHadError = useRef(false);
  const speechStopWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDeviceRequest = useRef(0);
  const messageInput = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const handled = useRef<number>(0);
  const ctxRef = useRef({ widgets, submitted, studySessions });
  useEffect(() => { ctxRef.current = { widgets, submitted, studySessions }; });

  useEffect(() => {
    return () => {
      speech.current?.cancel();
      if (speechStopWatchdog.current) clearTimeout(speechStopWatchdog.current);
    };
  }, []);

  const cancelDictation = useCallback(() => {
    speech.current?.cancel();
    speech.current = null;
    if (speechStopWatchdog.current) clearTimeout(speechStopWatchdog.current);
    speechStopWatchdog.current = null;
    setDictationInterim("");
    setDictation("idle");
  }, []);

  // The assistant stays mounted while hidden, so explicitly release the mic
  // rather than relying on unmount cleanup when a sheet is dismissed.
  useEffect(() => {
    if (!agentOpen) {
      onDeviceRequest.current++;
      // Close the microphone promptly even when another part of the app
      // dismisses the panel. Defer UI cleanup to avoid cascading renders.
      speech.current?.cancel();
      speech.current = null;
      if (speechStopWatchdog.current) clearTimeout(speechStopWatchdog.current);
      speechStopWatchdog.current = null;
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setDictation("idle");
        setDictationInterim("");
        setDictationError(null);
        setDictationErrorCode(null);
        setDictationMessage(null);
      });
      return () => { active = false; };
    }
  }, [agentOpen]);

  const tryOnDeviceSpeech = async () => {
    const id = ++onDeviceRequest.current;
    setLocalSpeechStatus("checking");
    const result = await checkOnDeviceSpeech(speechRecognitionConstructor(window), LOCAL_SPEECH_LANGUAGE);
    if (onDeviceRequest.current !== id) return;
    if (result === "available") {
      setSpeechMode("on-device");
      setLocalSpeechStatus("ready");
      setDictationError(null);
      setDictationErrorCode(null);
      setDictationMessage("On-device English recognition is ready. Tap the microphone again. Your audio will be processed on this device.");
    } else if (result === "downloadable" || result === "downloading") {
      setLocalSpeechStatus("downloadable");
    } else {
      setLocalSpeechStatus("unavailable");
    }
  };

  const installLocalSpeech = async () => {
    const id = ++onDeviceRequest.current;
    setLocalSpeechStatus("installing");
    const installed = await installOnDeviceSpeech(speechRecognitionConstructor(window), LOCAL_SPEECH_LANGUAGE);
    if (onDeviceRequest.current !== id) return;
    if (installed) {
      setSpeechMode("on-device");
      setLocalSpeechStatus("ready");
      setDictationError(null);
      setDictationErrorCode(null);
      setDictationMessage("English language pack is ready. Tap the microphone again to dictate on this device.");
    } else {
      setLocalSpeechStatus("unavailable");
      setDictationMessage("The browser could not install an on-device speech language pack. You can use your keyboard's dictation or try another browser.");
    }
  };

  const toggleDictation = () => {
    if (dictation === "starting" || dictation === "listening") {
      const session = speech.current;
      if (!session) return;
      setDictation("stopping");
      // Some browser engines may not emit an end event after stop().
      speechStopWatchdog.current = setTimeout(() => {
        if (speech.current !== session) return;
        cancelDictation();
        setDictationError("Speech recognition did not finish. Try again or type your question.");
        messageInput.current?.focus();
      }, 5_000);
      session.stop();
      return;
    }
    if (dictation !== "idle" || running) return;
    const Recognition = speechRecognitionConstructor(window);
    if (!Recognition) {
      setDictationError("Voice recognition is unavailable in this browser. You can still type your message.");
      return;
    }

    setDictationMessage(null);
    setDictationError(null);
    setDictationErrorCode(null);
    setDictationInterim("");
    speechHasFinal.current = false;
    speechHadError.current = false;
    setDictation("starting");
    let session: DictationSession;
    try {
      session = createDictationSession(Recognition, speechMode === "on-device" ? LOCAL_SPEECH_LANGUAGE : navigator.language || "en-MY", {
        onStart: () => setDictation((current) => current === "stopping" ? current : "listening"),
        onInterim: setDictationInterim,
        onFinal: (spoken) => {
          speechHasFinal.current = true;
          setInput((current) => appendTranscript(current, spoken));
          setDictationMessage("Transcript added. Check the wording before sending.");
        },
        onError: (message, code) => {
          speechHadError.current = true;
          setDictationError(code === "network" && speechMode === "on-device"
            ? "On-device recognition could not start. Try the browser service or type instead."
            : message);
          setDictationErrorCode(code ?? null);
        },
        onEnd: () => {
          if (speech.current !== session) return;
          speech.current = null;
          if (speechStopWatchdog.current) clearTimeout(speechStopWatchdog.current);
          speechStopWatchdog.current = null;
          setDictation("idle");
          setDictationInterim("");
          if (!speechHasFinal.current && !speechHadError.current) {
            setDictationMessage("No words were recognized. You can try again or type your message.");
          }
          messageInput.current?.focus();
        },
      }, { processLocally: speechMode === "on-device" });
    } catch {
      setDictation("idle");
      setDictationError("This browser could not open its speech recognition service. You can retry or type instead.");
      return;
    }
    speech.current = session;
    session.start();
  };

  useEffect(() => {
    let active = true;
    fetch("/api/agent", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { configured?: boolean; model?: string }) => {
        if (!active) return;
        const ready = data.configured === true;
        setGeminiConfigured(ready ? "ready" : "missing");
        setMode(ready ? "gemini" : "demo");
        if (isSelectableGeminiModel(data.model)) setModel(data.model);
      })
      .catch(() => { if (active) { setGeminiConfigured("missing"); setMode("demo"); } });
    return () => { active = false; };
  }, []);

  const patchAgent = useCallback((id: number, fn: (m: AgentMsg) => AgentMsg) => {
    setMsgs((all) => all.map((m) => (m.id === id && m.role === "agent" ? fn(m) : m)));
  }, []);

  const run = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    cancelDictation();
    setDictationMessage(null);
    setDictationError(null);
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const uid = ++idRef.current;
    const aid = ++idRef.current;
    setMsgs((m) => [...m, { id: uid, role: "user", text }, { id: aid, role: "agent", plan: [], step: -1, tools: [], text: "", cards: [], done: false }]);
    setInput("");
    setRunning(true);
    try {
      const generator = mode === "gemini" && geminiConfigured === "ready"
        ? runGeminiAgent(text, ctxRef.current, ac.signal, model)
        : runAgent(text, ctxRef.current, ac.signal);
      for await (const ev of generator as AsyncGenerator<AgentEvent>) {
        if (ac.signal.aborted) break;
        switch (ev.type) {
          case "plan": patchAgent(aid, (m) => ({ ...m, plan: ev.steps })); break;
          case "step": patchAgent(aid, (m) => ({ ...m, step: ev.index })); break;
          case "tool": patchAgent(aid, (m) => ({ ...m, tools: m.tools.some((t) => t.id === ev.id) ? m.tools.map((t) => (t.id === ev.id ? { ...t, status: ev.status, output: ev.output } : t)) : [...m.tools, { id: ev.id, tool: ev.tool, input: ev.input, status: ev.status, output: ev.output }] })); break;
          case "text": patchAgent(aid, (m) => ({ ...m, text: ev.text })); break;
          case "card":
            if (ev.card.kind === "layout") setWidgets(ev.card.after); // applied immediately, always undoable
            patchAgent(aid, (m) => ({ ...m, cards: [...m.cards, ev.card] }));
            break;
          case "done": patchAgent(aid, (m) => ({ ...m, done: true, step: m.plan.length })); break;
        }
      }
    } catch (error) {
      const message = error instanceof Error && !ac.signal.aborted ? error.message : "Request cancelled.";
      patchAgent(aid, (m) => ({ ...m, text: `Unable to complete this request: ${message} Nothing was saved.`, done: true }));
    } finally {
      if (abort.current === ac) { setRunning(false); abort.current = null; }
      patchAgent(aid, (m) => ({ ...m, done: true }));
    }
  }, [patchAgent, setWidgets, mode, geminiConfigured, cancelDictation, model]);

  // Prompts handed over from elsewhere (Home ask bar, chips, ⌘K)
  useEffect(() => {
    if (agentOpen && agentSeed && agentSeed.nonce !== handled.current) {
      handled.current = agentSeed.nonce;
      void run(agentSeed.prompt);
    }
  }, [agentOpen, agentSeed, run]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const stop = () => { abort.current?.abort(); setRunning(false); };

  const dismiss = () => {
    cancelDictation();
    setDictationError(null);
    setDictationMessage(null);
    closeAgent();
  };

  const undoLayout = (before: WidgetPref[]) => { setWidgets(before); showToast("Dashboard restored"); };

  return (
    <Sheet open={agentOpen} onClose={dismiss} label="Compass assistant">
      <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-3 lg:pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-fg"><Sparkles size={19} strokeWidth={2.4} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="t-headline">Compass</h2>
          <p className="t-caption flex items-center gap-1"><Shield size={12} /> {mode === "gemini" && geminiConfigured === "ready" ? `${model} (demo data)` : "Rule-based demo (fictional data)"}</p>
        </div>
        {msgs.length > 0 && <button onClick={() => { stop(); setMsgs([]); }} className="press btn btn-sm btn-plain">Clear</button>}
        <button onClick={dismiss} aria-label="Close assistant" className="press grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-label-2"><X size={17} /></button>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 text-[0.8rem]" role="group" aria-label="Assistant model mode">
        <button type="button" onClick={() => setMode("gemini")} disabled={geminiConfigured !== "ready" || running} aria-pressed={mode === "gemini"} className={`press rounded-full px-3 py-1.5 font-semibold ${mode === "gemini" ? "bg-accent text-accent-fg" : "bg-surface-2 text-label-2"} disabled:cursor-not-allowed disabled:opacity-40`}>Gemini API</button>
        <button type="button" onClick={() => setMode("demo")} disabled={running} aria-pressed={mode === "demo"} className={`press rounded-full px-3 py-1.5 font-semibold ${mode === "demo" ? "bg-accent text-accent-fg" : "bg-surface-2 text-label-2"}`}>Demo</button>
        {geminiConfigured === "missing" && <span className="t-caption">Gemini needs a server API key</span>}
        {geminiConfigured === "checking" && <span className="t-caption">Checking model…</span>}
      </div>
      {geminiConfigured === "ready" && mode === "gemini" && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 px-5 pb-3 text-[0.8rem]">
          <label htmlFor="compass-gemini-model" className="font-medium text-label-2">Gemini model</label>
          <select
            id="compass-gemini-model"
            aria-label="Gemini model"
            value={model}
            disabled={running}
            onChange={(event) => { if (isSelectableGeminiModel(event.target.value)) setModel(event.target.value); }}
            className="min-w-0 max-w-full rounded-xl bg-surface-2 px-3 py-2 text-[0.8rem] font-semibold text-label ring-1 ring-sep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {GEMINI_MODEL_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
          <span className="t-caption">Hydrogen may take longer and requires model access.</span>
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4" aria-live="polite">
        {msgs.length === 0 ? (
          <div className="pt-4">
            <h3 className="t-title !text-[1.7rem]">Hi {STUDENT.first}.<br /><span className="text-label-2">What do you need?</span></h3>
            <p className="t-sub mt-3">I can check your timetable, find rooms, track deadlines, explain fees, match you with clubs, draft emails to the right office and reshape your dashboard.</p>
            <ul className="mt-5 flex flex-col gap-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.li key={s} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 * i }}>
                  <button onClick={() => run(s)} className="press w-full rounded-2xl bg-surface px-4 py-3 text-left text-[0.95rem] font-medium tracking-[-0.01em]">{s}</button>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            {msgs.map((m) => m.role === "user" ? (
              <motion.div key={m.id} initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING_FAST} className="ml-10 self-end rounded-[20px] rounded-br-md bg-accent px-4 py-2.5 text-[0.95rem] text-accent-fg">{m.text}</motion.div>
            ) : (
              <AgentBubble key={m.id} m={m} onNavigate={dismiss} onUndo={undoLayout} onSuggest={run} />
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void run(input); }} className="shrink-0 border-t border-sep p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full bg-surface py-1.5 pl-5 pr-1.5 shadow-sm ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
          <input ref={messageInput} value={input} onChange={(e) => { setInput(e.target.value); setDictationMessage(null); }} readOnly={dictation === "starting" || dictation === "listening" || dictation === "stopping"} placeholder="Ask about classes, fees, rooms…" aria-label="Message Compass" aria-describedby="voice-dictation-hint" autoFocus className="min-w-0 flex-1 bg-transparent py-2 text-[1rem] outline-none placeholder:text-label-3" />
          <button
            type="button"
            onClick={toggleDictation}
            disabled={running || dictation === "unsupported" || dictation === "stopping"}
            aria-label={dictation === "listening" || dictation === "starting" || dictation === "stopping" ? "Stop voice dictation" : dictation === "unsupported" ? "Voice dictation unavailable" : "Start voice dictation"}
            aria-pressed={dictation === "starting" || dictation === "listening" || dictation === "stopping"}
            title={dictation === "unsupported" ? "Voice recognition isn't supported in this browser" : dictation === "listening" || dictation === "starting" ? "Stop listening" : "Dictate a message"}
            className={`press grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40 ${dictation === "listening" || dictation === "starting" || dictation === "stopping" ? "bg-red-soft text-red" : "bg-surface-2 text-label"}`}
          >
            {dictation === "unsupported" ? <MicOff size={19} /> : dictation === "stopping" ? <Loader2 size={18} className="animate-spin" /> : dictation === "starting" || dictation === "listening" ? <Square size={15} fill="currentColor" /> : <Mic size={19} />}
          </button>
          {running ? (
            <button type="button" onClick={stop} aria-label="Stop" className="press grid h-10 w-10 place-items-center rounded-full bg-label text-bg"><Square size={14} fill="currentColor" /></button>
          ) : (
            <button type="submit" aria-label="Send" disabled={!input.trim() || dictation === "starting" || dictation === "listening" || dictation === "stopping"} className="press grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-30"><ArrowUp size={19} strokeWidth={2.6} /></button>
          )}
        </div>
        {dictationError && <p role="alert" className="mt-2 px-2 text-[0.77rem] text-red">{dictationError}</p>}
        {dictationErrorCode === "network" && speechMode === "browser" && (
          <div className="mt-2 space-y-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[0.77rem] text-label-2">
            <p>This is the browser&apos;s speech connection, not the Gemini API. You can still type or use the device&apos;s built-in keyboard dictation.</p>
            {supportsLocalSpeech && (localSpeechStatus === "hidden" || localSpeechStatus === "checking") && (
              <button type="button" onClick={() => void tryOnDeviceSpeech()} disabled={localSpeechStatus === "checking"} className="press btn btn-sm btn-plain">
                {localSpeechStatus === "checking" ? "Checking on-device speech..." : "Try on-device speech (English)"}
              </button>
            )}
            {localSpeechStatus === "downloadable" && (
              <button type="button" onClick={() => void installLocalSpeech()} className="press btn btn-sm btn-plain">Install English speech pack</button>
            )}
            {localSpeechStatus === "installing" && <p role="status">Installing the browser&apos;s English speech pack...</p>}
            {localSpeechStatus === "unavailable" && <p>On-device English recognition is unavailable in this browser. Try Safari or your keyboard&apos;s dictation feature.</p>}
          </div>
        )}
        {speechMode === "on-device" && (
          <p className="mt-2 px-2 text-[0.74rem] text-label-2">On-device English recognition selected. <button type="button" onClick={() => { cancelDictation(); setSpeechMode("browser"); setLocalSpeechStatus("hidden"); setDictationError(null); setDictationErrorCode(null); setDictationMessage("Browser speech service selected. Tap the microphone to try again."); }} className="press font-semibold text-accent underline">Use browser speech instead</button></p>
        )}
        <p id="voice-dictation-hint" role="status" className="mt-2 px-2 text-[0.74rem] leading-relaxed text-label-2">
          {dictation === "unsupported" ? "Voice dictation is not supported in this browser. You can still type your message."
            : dictation === "starting" ? "Requesting microphone access..."
            : dictation === "listening" ? `Listening${dictationInterim ? `: ${dictationInterim}` : ". Speak now, then press Stop."}`
            : dictation === "stopping" ? "Finishing your transcript..."
            : dictationMessage ?? (speechMode === "on-device"
              ? "On-device English speech selected. Review the recognized text before pressing Send."
              : "Voice dictation uses your browser's speech service, which may process audio online. Review the text before pressing Send.")}
        </p>
      </form>
    </Sheet>
  );
}

function AgentBubble({ m, onNavigate, onUndo, onSuggest }: { m: AgentMsg; onNavigate: () => void; onUndo: (b: WidgetPref[]) => void; onSuggest: (p: string) => void }) {
  const [open, setOpen] = useState(true);
  // collapse the working once the answer has arrived
  useEffect(() => { if (m.done && m.text) { const t = setTimeout(() => setOpen(false), 900); return () => clearTimeout(t); } }, [m.done, m.text]);
  const suggest = m.cards.find((c): c is Extract<AgentCard, { kind: "suggest" }> => c.kind === "suggest");
  const working = !m.done && !m.text;

  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="mr-4 flex flex-col gap-3">
      {(m.plan.length > 0 || m.tools.length > 0) && (
        <div className="overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-sep">
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="press-row flex w-full min-h-[40px] items-center gap-2 px-3.5 text-left text-[0.8rem] font-semibold text-label-2">
            {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="text-green" strokeWidth={3} />}
            <span className="flex-1">{working ? "Working…" : `Worked through ${m.tools.length} step${m.tools.length === 1 ? "" : "s"}`}</span>
            <ChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .25s" }} />
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
                <ol className="space-y-1 px-3.5 pb-2.5">
                  {m.plan.map((p, i) => (
                    <li key={p} className="flex items-center gap-2 text-[0.82rem]" style={{ color: i <= m.step ? "var(--label)" : "var(--label-3)" }}>
                      <span className="grid h-4 w-4 shrink-0 place-items-center">
                        {i < m.step ? <Check size={13} className="text-green" strokeWidth={3} /> : i === m.step && !m.done ? <Loader2 size={13} className="animate-spin text-accent" /> : <span className="h-1.5 w-1.5 rounded-full bg-label-3" />}
                      </span>
                      {p}
                    </li>
                  ))}
                </ol>
                {m.tools.length > 0 && (
                  <ul className="space-y-1.5 border-t border-sep px-3.5 py-2.5">
                    {m.tools.map((t) => (
                      <motion.li key={t.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SPRING_FAST} className="flex items-start gap-2 font-mono text-[0.72rem] leading-5">
                        <span className="mt-0.5 shrink-0">{t.status === "running" ? <Loader2 size={12} className="animate-spin text-accent" /> : <Check size={12} className="text-green" strokeWidth={3} />}</span>
                        <span className="min-w-0 text-label-2"><span className="font-semibold text-label">{t.tool}</span>({t.input}){t.output && <span className="block truncate text-label-3">→ {t.output}</span>}</span>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {m.text && <AgentText value={m.text} />}

      {m.cards.map((c, i) => c.kind === "suggest" ? null : (
        <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING}>
          <AgentCardView card={c} onNavigate={onNavigate} onUndoLayout={c.kind === "layout" ? () => onUndo(c.before) : undefined} />
        </motion.div>
      ))}

      {suggest && (
        <div className="flex flex-wrap gap-2">
          {suggest.prompts.map((p) => <button key={p} onClick={() => onSuggest(p)} className="press btn btn-sm btn-tint">{p}</button>)}
        </div>
      )}
    </motion.div>
  );
}
