"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Check, CheckCircle2, Link2, Loader2, Lock, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { ASSIGNMENTS, COURSE_BY_ID, type Assignment } from "@/lib/data/academics";
import { dueLabel, relative, DEMO_NOW, atDay } from "@/lib/time";
import { deadlinesICS, download } from "@/lib/ics";
import { useApp } from "@/lib/state";
import { SPRING } from "@/lib/hooks";
import { Item, PageHeader, Pill, Segmented, Stagger, toneClass } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/Sheet";
import { runDemoConnection } from "@/lib/demo-connection";

type Filter = "open" | "done" | "all";

export function AssignmentsView() {
  const { submitted, toggleSubmitted, moodle, setMoodle, showToast } = useApp();
  const [filter, setFilter] = useState<Filter>("open");
  const [sheet, setSheet] = useState(false);
  const [synced, setSynced] = useState("just now");

  const isDone = (a: Assignment) => a.status === "submitted" || submitted.includes(a.id);
  const groups = useMemo(() => {
    const all = [...ASSIGNMENTS].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
    const list = all.filter((a) => (filter === "all" ? true : filter === "done" ? isDone(a) : !isDone(a)));
    const weekEnd = atDay(7, "00:00");
    const g = [
      { title: "Overdue", tone: "red", items: list.filter((a) => !isDone(a) && a.status === "overdue") },
      { title: "This week", tone: "orange", items: list.filter((a) => !isDone(a) && a.status !== "overdue" && new Date(a.due) < weekEnd) },
      { title: "Later", tone: "blue", items: list.filter((a) => !isDone(a) && new Date(a.due) >= weekEnd) },
      { title: "Done", tone: "green", items: list.filter(isDone) },
    ];
    return g.filter((x) => x.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, submitted]);

  const openCount = ASSIGNMENTS.filter((a) => !isDone(a)).length;

  return (
    <div>
      <PageHeader eyebrow="Fictional coursework" title="Assignments" sub={`${openCount} open example assignments, ordered by deadline. No Moodle account is connected.`}
        action={<button onClick={() => { download("xmum-deadlines.ics", deadlinesICS()); showToast("Deadlines exported with reminders"); }} className="press btn btn-plain"><CalendarPlus size={17} /> Export .ics</button>} />

      {/* Moodle connection */}
      <section className="card mb-6 flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: moodle === "connected" ? "var(--green-soft)" : "var(--orange-soft)", color: moodle === "connected" ? "var(--green)" : "var(--orange)" }}>
          {moodle === "connected" ? <CheckCircle2 size={22} /> : <Link2 size={22} />}
        </span>
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="t-headline break-words">{moodle === "connected" ? "Demo connection enabled" : "Preview Moodle connection"}</p>
          <p className="t-sub break-words">{moodle === "connected" ? `Sample data refreshed ${synced}. No Moodle data was fetched.` : "Try a simulated connection using example assignments. No sign-in or Moodle access occurs."}</p>
        </div>
        {moodle === "connected" ? (
          <div className="flex gap-2">
            <button onClick={() => { setSynced("just now"); showToast("Demo data refreshed locally"); }} className="press btn btn-sm btn-plain"><RefreshCw size={14} /> Refresh demo</button>
            <button onClick={() => setMoodle("disconnected")} className="press btn btn-sm btn-plain"><Unplug size={14} /> Disconnect</button>
          </div>
        ) : (
          <button onClick={() => setSheet(true)} className="press btn btn-primary">Try demo</button>
        )}
      </section>

      <div className="mb-4"><Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "All" }]} /></div>

      <Stagger key={filter} className="space-y-6">
        {groups.map((g) => (
          <Item key={g.title}>
            <h2 className="t-eyebrow mb-2 flex items-center gap-2 px-1"><span className={`h-2 w-2 rounded-full bg-${g.tone}`} style={{ background: `var(--${g.tone === "blue" ? "accent" : g.tone})` }} />{g.title}, {g.items.length}</h2>
            <ul className="card divide-y divide-sep overflow-hidden">
              {g.items.map((a) => {
                const done = isDone(a);
                const course = COURSE_BY_ID[a.courseId];
                return (
                  <li key={a.id}>
                    <button onClick={() => toggleSubmitted(a.id)} aria-pressed={done} disabled={a.status === "submitted"} className="press-row flex w-full flex-wrap items-center gap-4 px-4 py-3.5 text-left">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors" style={{ borderColor: done ? "var(--green)" : "var(--label-3)", background: done ? "var(--green)" : "transparent" }}>
                        <AnimatePresence>{done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING}><Check size={16} color="#fff" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block break-words text-[1rem] font-semibold tracking-[-0.012em] ${done ? "text-label-3 line-through" : ""}`}>{a.title}</span>
                        <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span className={`inline-flex items-center gap-1.5 ${toneClass[course.tone].fg} font-semibold`}><span className={`h-1.5 w-1.5 rounded-full ${toneClass[course.tone].dot}`} />{course.code}</span>
                          <span>{a.type}</span><span>{a.weight}%</span>
                          {a.note && <span className="text-red">{a.note}</span>}
                        </span>
                      </span>
                      <span className="min-w-0 max-w-full text-right">
                        <span className="tnum block text-[0.88rem] font-semibold" style={{ color: a.status === "overdue" && !done ? "var(--red)" : undefined }}>{a.status === "overdue" && !done ? "Overdue" : dueLabel(new Date(a.due))}</span>
                        <span className="t-caption">{done ? "Submitted" : relative(new Date(a.due))}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Item>
        ))}
        {groups.length === 0 && <p className="t-sub px-1">Nothing here. Enjoy it.</p>}
      </Stagger>
      <p className="t-caption mt-6 px-1">Checking off an item here only marks it on this page — it doesn&rsquo;t submit anything on Moodle.</p>

      <MoodleSheet open={sheet} onClose={() => setSheet(false)} onConnected={() => { setMoodle("connected"); setSynced("just now"); showToast("Demo connection enabled (no Moodle access)"); }} />
    </div>
  );
}

function MoodleSheet({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [phase, setPhase] = useState<"intro" | "auth" | "sync" | "done">("intro");
  const cancelWalkthrough = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelWalkthrough.current?.(), []);
  const go = () => {
    cancelWalkthrough.current?.();
    setPhase("auth");
    cancelWalkthrough.current = runDemoConnection(setPhase, onConnected);
  };
  const close = () => {
    cancelWalkthrough.current?.();
    cancelWalkthrough.current = null;
    setPhase("intro");
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} label="Preview Moodle connection" modalOnDesktop>
      <div className="px-6 pb-8 pt-3 lg:pt-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Link2 size={26} /></span>
        <h2 className="t-title mt-4 !text-[1.6rem]">Preview Moodle connection</h2>
        <p className="t-sub mt-2">This is a fictional walkthrough. Compass does not sign in, fetch assignments or store Moodle credentials.</p>
        <ul className="mt-5 space-y-3 text-[0.92rem]">
          {[[ShieldCheck, "No real sign-in occurs in this prototype."], [Lock, "Only example assignments are shown. Nothing is submitted or edited on Moodle."], [Unplug, "You can exit the walkthrough at any time."]].map(([I, t], i) => {
            const Icon = I as typeof Lock;
            return <li key={i} className="flex gap-3"><Icon size={19} className="mt-0.5 shrink-0 text-accent" /><span>{t as string}</span></li>;
          })}
        </ul>
        <div className="mt-7">
          {phase === "intro" && <button onClick={go} className="press btn btn-primary w-full">Start demo walkthrough</button>}
          {phase !== "intro" && (
            <div className="rounded-2xl bg-surface p-4">
              {[["auth", "Simulating a sign-in"], ["sync", "Preparing example deadlines"], ["done", "Demo ready"]].map(([k, label], i) => {
                const order = ["auth", "sync", "done"];
                const state = order.indexOf(phase) > i ? "done" : order.indexOf(phase) === i ? "active" : "wait";
                return (
                  <p key={k} className="flex items-center gap-3 py-1.5 text-[0.95rem] font-medium" style={{ opacity: state === "wait" ? 0.35 : 1 }}>
                    {state === "done" || (k === "done" && phase === "done") ? <Check size={17} className="text-green" strokeWidth={3} /> : state === "active" ? <Loader2 size={17} className="animate-spin text-accent" /> : <span className="h-4 w-4" />}
                    {label}
                  </p>
                );
              })}
            </div>
          )}
          {phase === "done" && <button onClick={close} className="press btn btn-primary mt-3 w-full">Done</button>}
        </div>
        <p className="t-caption mt-5 text-center">Prototype: this simulates the flow with demo data and doesn&rsquo;t contact Moodle.</p>
      </div>
    </Sheet>
  );
}

export { DEMO_NOW, Pill };
