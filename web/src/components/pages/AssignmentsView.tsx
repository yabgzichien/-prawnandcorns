"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, CheckCircle2, Link2, Loader2, Lock, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { ASSIGNMENTS, COURSE_BY_ID, type Assignment } from "@/lib/data/academics";
import { dueLabel, relative, DEMO_NOW, atDay } from "@/lib/time";
import { deadlinesICS, download } from "@/lib/ics";
import { useApp } from "@/lib/state";
import { SPRING } from "@/lib/hooks";
import { Item, PageHeader, Pill, Segmented, Stagger, toneClass } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/Sheet";

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
      <PageHeader eyebrow="From Moodle" title="Assignments" sub={`${openCount} open · deadlines from all your courses in one list, ordered by what's due first.`}
        action={<button onClick={() => { download("xmum-deadlines.ics", deadlinesICS()); showToast("Deadlines exported with reminders"); }} className="press btn btn-plain"><CalendarPlus size={17} /> Export .ics</button>} />

      {/* Moodle connection */}
      <section className="card mb-6 flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: moodle === "connected" ? "var(--green-soft)" : "var(--orange-soft)", color: moodle === "connected" ? "var(--green)" : "var(--orange)" }}>
          {moodle === "connected" ? <CheckCircle2 size={22} /> : <Link2 size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-headline">{moodle === "connected" ? "Moodle connected" : "Connect Moodle"}</p>
          <p className="t-sub">{moodle === "connected" ? `Last synced ${synced} · read-only` : "Sync your real deadlines. You sign in on Moodle itself; Compass only reads dates."}</p>
        </div>
        {moodle === "connected" ? (
          <div className="flex gap-2">
            <button onClick={() => { setSynced("just now"); showToast("Synced (demo)"); }} className="press btn btn-sm btn-plain"><RefreshCw size={14} /> Sync</button>
            <button onClick={() => setMoodle("disconnected")} className="press btn btn-sm btn-plain"><Unplug size={14} /> Disconnect</button>
          </div>
        ) : (
          <button onClick={() => setSheet(true)} className="press btn btn-primary">Connect</button>
        )}
      </section>

      <div className="mb-4"><Segmented label="Filter" value={filter} onChange={setFilter} options={[{ value: "open", label: "Open" }, { value: "done", label: "Done" }, { value: "all", label: "All" }]} /></div>

      <Stagger key={filter} className="space-y-6">
        {groups.map((g) => (
          <Item key={g.title}>
            <h2 className="t-eyebrow mb-2 flex items-center gap-2 px-1"><span className={`h-2 w-2 rounded-full bg-${g.tone}`} style={{ background: `var(--${g.tone === "blue" ? "accent" : g.tone})` }} />{g.title} · {g.items.length}</h2>
            <ul className="card divide-y divide-sep overflow-hidden">
              {g.items.map((a) => {
                const done = isDone(a);
                const course = COURSE_BY_ID[a.courseId];
                return (
                  <li key={a.id}>
                    <button onClick={() => toggleSubmitted(a.id)} aria-pressed={done} disabled={a.status === "submitted"} className="press-row flex w-full items-center gap-4 px-4 py-3.5 text-left">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors" style={{ borderColor: done ? "var(--green)" : "var(--label-3)", background: done ? "var(--green)" : "transparent" }}>
                        <AnimatePresence>{done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={SPRING}><Check size={16} color="#fff" strokeWidth={3.5} /></motion.span>}</AnimatePresence>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[1rem] font-semibold tracking-[-0.012em] ${done ? "text-label-3 line-through" : ""}`}>{a.title}</span>
                        <span className="t-caption mt-0.5 flex flex-wrap items-center gap-x-2">
                          <span className={`inline-flex items-center gap-1.5 ${toneClass[course.tone].fg} font-semibold`}><span className={`h-1.5 w-1.5 rounded-full ${toneClass[course.tone].dot}`} />{course.code}</span>
                          <span>{a.type}</span><span>{a.weight}%</span>
                          {a.note && <span className="text-red">{a.note}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
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

      <MoodleSheet open={sheet} onClose={() => setSheet(false)} onConnected={() => { setMoodle("connected"); setSynced("just now"); showToast("Moodle connected (demo)"); }} />
    </div>
  );
}

function MoodleSheet({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [phase, setPhase] = useState<"intro" | "auth" | "sync" | "done">("intro");
  const go = () => {
    setPhase("auth");
    setTimeout(() => setPhase("sync"), 1300);
    setTimeout(() => { setPhase("done"); onConnected(); }, 2700);
  };
  const close = () => { onClose(); setTimeout(() => setPhase("intro"), 400); };
  return (
    <Sheet open={open} onClose={close} label="Connect Moodle" modalOnDesktop>
      <div className="px-6 pb-8 pt-3 lg:pt-6">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Link2 size={26} /></span>
        <h2 className="t-title mt-4 !text-[1.6rem]">Connect Moodle</h2>
        <p className="t-sub mt-2">Compass reads assignment names, courses and due dates so your deadlines live in one place.</p>
        <ul className="mt-5 space-y-3 text-[0.92rem]">
          {[[ShieldCheck, "You sign in on Moodle’s own page. Compass never sees or stores your password."], [Lock, "Read-only. It can’t submit, edit or delete anything."], [Unplug, "Disconnect any time and the synced data is removed."]].map(([I, t], i) => {
            const Icon = I as typeof Lock;
            return <li key={i} className="flex gap-3"><Icon size={19} className="mt-0.5 shrink-0 text-accent" /><span>{t as string}</span></li>;
          })}
        </ul>
        <div className="mt-7">
          {phase === "intro" && <button onClick={go} className="press btn btn-primary w-full">Continue to Moodle sign-in</button>}
          {phase !== "intro" && (
            <div className="rounded-2xl bg-surface p-4">
              {[["auth", "Signing in on Moodle (demo)"], ["sync", "Reading your course deadlines"], ["done", "Connected"]].map(([k, label], i) => {
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
