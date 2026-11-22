"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Check, ChevronDown, Loader2, Shield, Sparkles, Square, X } from "lucide-react";
import { runAgent, SUGGESTIONS, type AgentCard, type AgentEvent } from "@/lib/agent";
import { useApp, type WidgetPref } from "@/lib/state";
import { Sheet } from "@/components/ui/Sheet";
import { SPRING, SPRING_FAST } from "@/lib/hooks";
import { AgentCardView } from "./Cards";
import { STUDENT } from "@/lib/data/academics";

type ToolRow = { id: string; tool: string; input: string; status: "running" | "done"; output?: string };
type AgentMsg = { id: number; role: "agent"; plan: string[]; step: number; tools: ToolRow[]; text: string; cards: AgentCard[]; done: boolean };
type UserMsg = { id: number; role: "user"; text: string };
type Msg = UserMsg | AgentMsg;

/** Minimal inline markdown: **bold** and *italic*. */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) =>
    p.startsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>,
  );
}

export function AgentPanel() {
  const { agentOpen, closeAgent, agentSeed, widgets, submitted, studySessions, setWidgets, showToast } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const handled = useRef<number>(0);
  const ctxRef = useRef({ widgets, submitted, studySessions });
  useEffect(() => { ctxRef.current = { widgets, submitted, studySessions }; });

  const patchAgent = useCallback((id: number, fn: (m: AgentMsg) => AgentMsg) => {
    setMsgs((all) => all.map((m) => (m.id === id && m.role === "agent" ? fn(m) : m)));
  }, []);

  const run = useCallback(async (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    const uid = ++idRef.current;
    const aid = ++idRef.current;
    setMsgs((m) => [...m, { id: uid, role: "user", text }, { id: aid, role: "agent", plan: [], step: -1, tools: [], text: "", cards: [], done: false }]);
    setInput("");
    setRunning(true);
    try {
      for await (const ev of runAgent(text, ctxRef.current, ac.signal) as AsyncGenerator<AgentEvent>) {
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
    } catch {
      patchAgent(aid, (m) => ({ ...m, text: m.text || "Something went wrong on my side. Nothing was changed — please try again.", done: true }));
    } finally {
      if (abort.current === ac) { setRunning(false); abort.current = null; }
      patchAgent(aid, (m) => ({ ...m, done: true }));
    }
  }, [patchAgent, setWidgets]);

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

  const undoLayout = (before: WidgetPref[]) => { setWidgets(before); showToast("Dashboard restored"); };

  return (
    <Sheet open={agentOpen} onClose={closeAgent} label="Compass assistant">
      <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-3 lg:pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-fg"><Sparkles size={19} strokeWidth={2.4} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="t-headline">Compass</h2>
          <p className="t-caption flex items-center gap-1"><Shield size={12} /> Reads demo data · asks before sending anything</p>
        </div>
        {msgs.length > 0 && <button onClick={() => { stop(); setMsgs([]); }} className="press btn btn-sm btn-plain">Clear</button>}
        <button onClick={closeAgent} aria-label="Close assistant" className="press grid h-9 w-9 place-items-center rounded-full bg-surface-3 text-label-2"><X size={17} /></button>
      </header>

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
              <AgentBubble key={m.id} m={m} onNavigate={closeAgent} onUndo={undoLayout} onSuggest={run} />
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void run(input); }} className="shrink-0 border-t border-sep p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 rounded-full bg-surface py-1.5 pl-5 pr-1.5 shadow-sm ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about classes, fees, rooms…" aria-label="Message Compass" autoFocus className="min-w-0 flex-1 bg-transparent py-2 text-[1rem] outline-none placeholder:text-label-3" />
          {running ? (
            <button type="button" onClick={stop} aria-label="Stop" className="press grid h-10 w-10 place-items-center rounded-full bg-label text-bg"><Square size={14} fill="currentColor" /></button>
          ) : (
            <button type="submit" aria-label="Send" disabled={!input.trim()} className="press grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-30"><ArrowUp size={19} strokeWidth={2.6} /></button>
          )}
        </div>
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

      {m.text && <p className="whitespace-pre-line text-[0.97rem] leading-[1.55] tracking-[-0.008em]">{rich(m.text)}</p>}

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
