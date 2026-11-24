"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { CalendarPlus, Check, CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { COURSE_BY_ID, type Assignment } from "@/lib/data/academics";
import { dueLabel, relative, atDay } from "@/lib/time";
import { deadlinesICS, download } from "@/lib/ics";
import { useApp } from "@/lib/state";
import { SPRING } from "@/lib/hooks";
import { Item, PageHeader, Segmented, Stagger, toneClass } from "@/components/ui/kit";
import { ConsentSheet } from "@/components/connections/ConsentSheet";
import { useCampus } from "@/lib/sync/CampusProvider";
import { markedHereOnly, MOODLE_NOT_SUBMITTED } from "@/lib/sync/view";

type Filter = "open" | "done" | "all";

export function AssignmentsView() {
  const { submitted, toggleSubmitted, showToast } = useApp();
  const { data, connections, disconnect, syncNow, syncing, failed, snapshot } = useCampus();
  const ASSIGNMENTS = data.assignments;
  const moodle = connections.moodle ? "connected" : "disconnected";
  const moodleProblem = failed.find((f) => f.system === "moodle");
  const lastRead = snapshot?.fetchedAt.moodle;
  const [filter, setFilter] = useState<Filter>("open");
  const [asking, setAsking] = useState(false);

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
  }, [filter, submitted, ASSIGNMENTS]);

  const openCount = ASSIGNMENTS.filter((a) => !isDone(a)).length;

  return (
    <div>
      <PageHeader eyebrow="Demo coursework" title="Assignments" sub={`${openCount} open assignments, ordered by deadline. ${moodle === "connected" ? "Read from the invented Moodle service." : "Built-in example data until Moodle is connected."}`}
        action={<button onClick={() => { download("xmum-deadlines.ics", deadlinesICS(ASSIGNMENTS)); showToast("Deadlines exported with reminders"); }} className="press btn btn-plain"><CalendarPlus size={17} /> Export .ics</button>} />

      {/* Moodle connection: a mock consent screen, then real reads from the mock Moodle service */}
      <section className="card mb-6 flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: moodleProblem ? "var(--orange-soft)" : moodle === "connected" ? "var(--green-soft)" : "var(--orange-soft)", color: moodleProblem ? "var(--orange)" : moodle === "connected" ? "var(--green)" : "var(--orange)" }}>
          {moodle === "connected" && !moodleProblem ? <CheckCircle2 size={22} /> : <Link2 size={22} />}
        </span>
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <p className="t-headline break-words">{moodleProblem ? "Moodle is unavailable" : moodle === "connected" ? "Moodle demo connected" : "Connect the Moodle demo"}</p>
          <p className="t-sub break-words">{moodleProblem
            ? `Showing what Compass read ${lastRead ? `at ${new Date(lastRead).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "earlier"}. Try again in a moment.`
            : moodle === "connected" ? "Deadlines come from an invented Moodle service. Read only; nothing is submitted." : "Allow Compass to read invented courses and deadlines. No password is needed and no real Moodle is contacted."}</p>
        </div>
        {moodle === "connected" ? (
          <div className="flex gap-2">
            <button onClick={() => { void syncNow(); showToast("Reading Moodle again"); }} disabled={syncing} className="press btn btn-sm btn-plain disabled:opacity-40">{syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync now</button>
            <button onClick={() => disconnect("moodle")} className="press btn btn-sm btn-plain"><Unplug size={14} /> Disconnect</button>
          </div>
        ) : (
          <button onClick={() => setAsking(true)} className="press btn btn-primary">Connect Moodle</button>
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
                const warn = markedHereOnly(a, submitted, data);
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
                        {warn && <span className="mt-1 block text-[0.8rem] font-semibold text-orange">{MOODLE_NOT_SUBMITTED}. Compass cannot submit for you.</span>}
                      </span>
                      <span className="min-w-0 max-w-full text-right">
                        <span className="tnum block text-[0.88rem] font-semibold" style={{ color: a.status === "overdue" && !done ? "var(--red)" : undefined }}>{a.status === "overdue" && !done ? "Overdue" : dueLabel(new Date(a.due))}</span>
                        <span className="t-caption">{warn ? "Done here only" : done ? "Submitted" : relative(new Date(a.due))}</span>
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

      <ConsentSheet system={asking ? "moodle" : null} onClose={() => setAsking(false)} />
    </div>
  );
}
