"use client";

import { AnimatePresence, LayoutGroup, motion, Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import { ArrowUp, GripVertical, RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { useApp, WIDGET_META, DEFAULT_WIDGETS, type WidgetPref } from "@/lib/state";
import { STUDENT } from "@/lib/data/academics";
import { dayLong, dateShort, DEMO_NOW } from "@/lib/time";
import { SPRING } from "@/lib/hooks";
import { SUGGESTIONS } from "@/lib/agent";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/kit";
import { WIDGETS } from "./widgets";

export function HomeView() {
  const { widgets, openAgent, setWidgets, hydrated, studySessions, removeStudySession } = useApp();
  const [customise, setCustomise] = useState(false);
  const [ask, setAsk] = useState("");
  const visible = widgets.filter((w) => !w.hidden);

  return (
    <div>
      <header className="pb-6 pt-1">
        <p className="t-eyebrow mb-2">{dayLong(DEMO_NOW)} {dateShort(DEMO_NOW)}, {STUDENT.semester}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="t-display break-words max-[360px]:!text-[clamp(1.6rem,4.6vw,3.25rem)]">Good afternoon,<br className="sm:hidden" /> {STUDENT.first}.</h1>
          <button onClick={() => setCustomise(true)} className="press btn btn-plain"><SlidersHorizontal size={17} /> Customise</button>
        </div>
      </header>

      {/* The agent is the front door, not a side feature. */}
      <motion.form
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
        onSubmit={(e) => { e.preventDefault(); if (ask.trim()) { openAgent(ask.trim()); setAsk(""); } else openAgent(); }}
        className="card mb-6 p-2 pl-5"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-accent" strokeWidth={2.4} />
          <input value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Ask Compass" placeholder="Ask Compass — “What’s due this week?”" className="min-w-0 flex-1 bg-transparent py-3 text-[1.05rem] tracking-[-0.01em] outline-none placeholder:text-label-3" />
          <button aria-label="Send" className="press grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-fg"><ArrowUp size={20} strokeWidth={2.6} /></button>
        </div>
        <div className="rail -mx-1 mt-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-1">
          {SUGGESTIONS.map((s) => (
            <button type="button" key={s} onClick={() => openAgent(s)} className="press shrink-0 rounded-full bg-surface-2 px-3.5 py-1.5 text-[0.82rem] font-medium text-label-2 ring-1 ring-sep">{s}</button>
          ))}
        </div>
      </motion.form>

      {hydrated && studySessions.length > 0 && (
        <section className="card mb-6 p-5" aria-label="Confirmed study plan">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="t-title">Your study plan</h2>
            <span className="t-caption">Saved in this browser (demo data, MYT)</span>
          </div>
          <ul className="divide-y divide-sep">
            {[...studySessions].sort((a, b) => a.start.localeCompare(b.start)).map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[0.92rem] font-semibold">{session.title}</p>
                  <p className="t-caption">{session.start.slice(0, 10)}, {session.start.slice(11, 16)}–{session.end.slice(11, 16)}</p>
                </div>
                <button type="button" onClick={() => removeStudySession(session.id)} aria-label={`Remove saved study session for ${session.title}`} className="press btn btn-sm btn-plain"><X size={15} /> Remove</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LayoutGroup>
        <motion.div layout className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2" style={{ opacity: hydrated ? 1 : 0.999 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((w, i) => {
              const def = WIDGETS[w.id];
              return (
                <motion.section
                  key={w.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ ...SPRING, delay: i < 8 ? i * 0.03 : 0 }}
                  aria-label={WIDGET_META[w.id].title}
                  className={`card min-w-0 p-5 ${def.span === 2 ? "md:col-span-2" : ""} ${def.hero ? "sm:p-6" : ""}`}
                >
                  {def.render()}
                </motion.section>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {visible.length === 0 && (
        <div className="card grid place-items-center px-6 py-14 text-center">
          <p className="t-headline">Your dashboard is empty</p>
          <p className="t-sub mt-1">Add widgets with Customise — or ask Compass to build it for you.</p>
        </div>
      )}

      <CustomiseSheet open={customise} onClose={() => setCustomise(false)} widgets={widgets} setWidgets={setWidgets} onAsk={(p) => { setCustomise(false); openAgent(p); }} />
    </div>
  );
}

function CustomiseSheet({ open, onClose, widgets, setWidgets, onAsk }: { open: boolean; onClose: () => void; widgets: WidgetPref[]; setWidgets: (w: WidgetPref[]) => void; onAsk: (p: string) => void }) {
  const [prompt, setPrompt] = useState("");
  return (
    <Sheet open={open} onClose={onClose} label="Customise dashboard" modalOnDesktop>
      <div className="flex items-center justify-between px-5 pb-2 pt-3 lg:pt-5">
        <h2 className="t-headline">Customise Today</h2>
        <button onClick={onClose} className="press btn btn-sm btn-primary">Done</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="t-sub mb-4">Drag to reorder, switch off what you don&rsquo;t need. Or just describe what you want.</p>

        <form onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) onAsk(prompt.trim()); }} className="mb-5 flex items-center gap-2 rounded-full bg-surface py-1 pl-4 pr-1 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
          <Sparkles size={17} className="text-accent" />
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Describe your dashboard" placeholder="“Show fees first, hide clubs”" className="min-w-0 flex-1 bg-transparent py-2.5 outline-none placeholder:text-label-3" />
          <button className="press btn btn-sm btn-primary">Apply</button>
        </form>

        <Reorder.Group axis="y" values={widgets} onReorder={setWidgets} className="overflow-hidden rounded-2xl bg-surface" role="list">
          {widgets.map((w) => <Row key={w.id} w={w} onToggle={(hidden) => setWidgets(widgets.map((x) => (x.id === w.id ? { ...x, hidden } : x)))} />)}
        </Reorder.Group>

        <button onClick={() => setWidgets(DEFAULT_WIDGETS)} className="press btn btn-plain mt-4 w-full"><RotateCcw size={16} /> Reset to default</button>
      </div>
    </Sheet>
  );
}

function Row({ w, onToggle }: { w: WidgetPref; onToggle: (hidden: boolean) => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={w} dragListener={false} dragControls={controls} className="relative flex min-h-[56px] items-center gap-3 border-b border-sep bg-surface px-3 last:border-b-0" whileDrag={{ scale: 1.02, boxShadow: "var(--shadow-md)", zIndex: 5 }} transition={SPRING}>
      <span onPointerDown={(e) => controls.start(e)} aria-label={`Reorder ${WIDGET_META[w.id].title}`} role="img" className="grid h-10 w-8 cursor-grab touch-none place-items-center text-label-3"><GripVertical size={18} /></span>
      <span className="flex-1 text-[0.98rem] font-medium tracking-[-0.01em]" style={{ opacity: w.hidden ? 0.45 : 1 }}>{WIDGET_META[w.id].title}</span>
      <Switch checked={!w.hidden} onChange={(v) => onToggle(!v)} label={`Show ${WIDGET_META[w.id].title}`} />
    </Reorder.Item>
  );
}
