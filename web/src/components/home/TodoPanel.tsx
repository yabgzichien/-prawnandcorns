"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { ChevronDown, ListChecks, Plus } from "lucide-react";
import { dateLabel } from "@/lib/events/checks";
import { emptyDraft, type Todo } from "@/lib/plans/entries";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { DEMO_NOW, timeOf } from "@/lib/time";
import { ymd } from "@/lib/library/policy";
import { CheckButton, type EntryRef } from "./CalendarGrid";

const TODAY = ymd(DEMO_NOW.getTime());
const dueOrder = (a: Todo, b: Todo) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title);
const dueText = (t: Todo) => (t.due ? `${t.due === TODAY ? "Today" : dateLabel(t.due)}${t.time ? `, ${t.time}` : ""}` : "No date");
const isLate = (t: Todo) => !t.done && !!t.due && (t.time ? `${t.due}T${t.time}` < `${TODAY}T${timeOf(DEMO_NOW)}` : t.due < TODAY);

/** The student's own to-do list: a quick add line, ticks that respond at once, and a tap to edit. Saved in this browser only. */
export function TodoPanel({ onEdit }: { onEdit: (ref: EntryRef) => void }) {
  const { hydrated, todos, saveEntry, setTodoDone } = useApp();
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = useMemo(() => todos.filter((t) => !t.done).sort(dueOrder), [todos]);
  const done = useMemo(() => todos.filter((t) => t.done).sort(dueOrder), [todos]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = saveEntry({ ...emptyDraft("todo"), title: text });
    if (r.ok) { setText(""); setError(""); } else setError(r.error);
  };

  const row = (t: Todo) => (
    <motion.li
      key={t.id}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: t.done ? 0.55 : 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={SPRING}
      className="flex items-center gap-1 overflow-hidden"
    >
      <CheckButton checked={t.done} label={`Done: ${t.title}`} onToggle={() => setTodoDone(t.id, !t.done)} size={20} />
      <button type="button" onClick={() => onEdit({ kind: "todo", id: t.id })} aria-label={`${t.title}, ${dueText(t)}${isLate(t) ? ", overdue" : ""}. Edit`} className="press-row min-h-[44px] min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left">
        <span className={`block text-[0.95rem] font-semibold leading-snug [overflow-wrap:anywhere] ${t.done ? "line-through" : ""}`}>{t.title}</span>
        <span className={`t-caption block ${isLate(t) ? "!font-semibold !text-red" : ""}`}>{isLate(t) ? "Overdue, " : t.due ? "Due " : ""}{dueText(t)}</span>
      </button>
    </motion.li>
  );

  return (
    <section aria-label="To-do list" className="mt-5 border-t border-sep pt-4">
      <h3 className="t-headline mb-2 flex items-center gap-2 !text-[1.05rem]"><ListChecks size={18} className="text-accent" aria-hidden /> To-do {hydrated && <span className="t-caption font-semibold">{open.length} open</span>}</h3>
      <form onSubmit={add} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-4 pr-1 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
        <input value={text} onChange={(e) => { setText(e.target.value); setError(""); }} aria-label="New to-do" enterKeyHint="done" autoComplete="off" maxLength={120} placeholder="Add a to-do, then press Enter" className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-label-3" />
        <button type="submit" aria-label="Add this to-do" className="press btn btn-sm btn-primary" disabled={!text.trim()}><Plus size={15} /> Add</button>
      </form>
      {error && <p role="alert" className="mt-1 text-[0.85rem] font-semibold text-red">{error}</p>}

      {hydrated && open.length === 0 && <p className="t-sub mt-3">Nothing to do. Add one above, or tell Compass, for example &ldquo;remind me to print my lab report tomorrow&rdquo;.</p>}
      <ul className="mt-2">
        <AnimatePresence initial={false}>{open.map(row)}</AnimatePresence>
      </ul>

      {done.length > 0 && (
        <>
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="press mt-1 inline-flex items-center gap-1 text-[0.88rem] font-semibold text-accent">
            Completed ({done.length}) <ChevronDown size={15} className={showDone ? "rotate-180" : ""} />
          </button>
          {showDone && <ul className="mt-1"><AnimatePresence initial={false}>{done.map(row)}</AnimatePresence></ul>}
        </>
      )}
    </section>
  );
}
