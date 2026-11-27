"use client";

import { motion, useReducedMotion } from "motion/react";
import { Fragment, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Bookmark, CalendarDays, CalendarRange, CheckSquare, ChevronLeft, ChevronRight, GraduationCap, Hourglass, Plus, Users, Wallet, type LucideIcon } from "lucide-react";
import { daysFrom, groupTimeline, isPast, monthLabel, monthStartOf, timeText, weekStartOf, type DayGroup, type TimelineItem, type TimelineRange } from "@/lib/calendar/timeline";
import { addDays, dateLabel } from "@/lib/events/checks";
import { ymd } from "@/lib/library/policy";
import { draftFromEvent, draftFromReminder, draftFromTodo, emptyDraft, hourAfter, type EntryDraft } from "@/lib/plans/entries";
import { ItemTarget, MonthGrid, TodoCheck, useNarrow, WeekGrid, type CalendarActions, type EntryRef } from "./CalendarGrid";
import { TodoPanel } from "./TodoPanel";
import { useTimeline } from "./useTimeline";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { DEMO_NOW, timeOf } from "@/lib/time";
import { EntryEditor } from "@/components/plans/EntryEditor";
import { Sheet } from "@/components/ui/Sheet";
import { CardTitle, Pill, Segmented, toneClass } from "@/components/ui/kit";

const ICON: Record<TimelineItem["kind"], LucideIcon> = { class: BookOpen, deadline: Hourglass, exam: GraduationCap, fee: Wallet, event: Users, semester: CalendarRange, saved: Bookmark, todo: CheckSquare };
const RANGES: { value: TimelineRange; label: string }[] = [
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "all", label: "Semester" },
];

type View = "week" | "month" | "agenda";
const VIEWS: { value: View; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];
const TODAY = ymd(DEMO_NOW.getTime());

/** The next whole hour after the demo time, for an event added today. Other days start at nine. */
const defaultStart = (date: string) => (date === TODAY ? `${String(Math.min(23, Number(timeOf(DEMO_NOW).slice(0, 2)) + 1)).padStart(2, "0")}:00` : "09:00");

/** True once the page is running in the browser, so a portal into the body is allowed. */
const useInBrowser = () => useSyncExternalStore(() => () => {}, () => true, () => false);

type Editor = { draft: EntryDraft; mode: "create" | "edit"; key: number };

/** Everything that is going to happen, as a week grid, a month grid or an agenda. The student can add, edit and tick things off. */
export function MasterCalendar() {
  const { personalEvents, reminders, todos, saveEntry, deleteEntry, setTodoDone } = useApp();
  const items = useTimeline();
  const reduce = useReducedMotion();
  const narrow = useNarrow();
  const [view, setView] = useState<View>("week");
  const [range, setRange] = useState<TimelineRange>("month");
  const [anchor, setAnchor] = useState(TODAY);
  const [editor, setEditor] = useState<Editor | null>(null);
  const inBrowser = useInBrowser();

  const groups = useMemo(() => groupTimeline(items, DEMO_NOW, range), [items, range]);
  const overdue = items.filter((i) => i.state === "overdue");
  const coming = groups.flatMap((g) => (g.overdue ? [] : g.items)).filter((i) => !isPast(i, DEMO_NOW)).length;

  const count = narrow ? 3 : 7;
  const days = daysFrom(narrow ? anchor : weekStartOf(anchor), count);
  const step = (dir: 1 | -1) => setAnchor((a) => (view === "month" ? monthStartOf(a, dir) : addDays(narrow ? a : weekStartOf(a), dir * count)));
  const label = view === "month" ? monthLabel(anchor) : `${dateLabel(days[0])} to ${dateLabel(days[days.length - 1])}`;
  const unit = view === "month" ? "month" : narrow ? "3 days" : "week";

  const openCreate = useCallback((date: string, start: string) => {
    setEditor((cur) => ({ draft: { ...emptyDraft("event", date, start, hourAfter(start)) }, mode: "create", key: (cur?.key ?? 0) + 1 }));
  }, []);
  const openEdit = useCallback((ref: EntryRef) => {
    const draft = ref.kind === "event" ? personalEvents.find((e) => e.id === ref.id) && draftFromEvent(personalEvents.find((e) => e.id === ref.id)!)
      : ref.kind === "reminder" ? reminders.find((r) => r.id === ref.id) && draftFromReminder(reminders.find((r) => r.id === ref.id)!)
      : todos.find((t) => t.id === ref.id) && draftFromTodo(todos.find((t) => t.id === ref.id)!);
    if (draft) setEditor((cur) => ({ draft, mode: "edit", key: (cur?.key ?? 0) + 1 }));
  }, [personalEvents, reminders, todos]);
  const actions: CalendarActions = useMemo(() => ({ onEdit: openEdit, onCreate: openCreate, onToggleTodo: setTodoDone }), [openEdit, openCreate, setTodoDone]);

  const addDate = view === "week" && !days.includes(TODAY) ? days[0] : TODAY;

  return (
    <div>
      <CardTitle
        icon={<CalendarDays size={19} className="text-accent" />}
        title="Master calendar"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openCreate(addDate, defaultStart(addDate))} aria-label="Add to calendar or to-do" className="press btn btn-sm btn-primary"><Plus size={16} /> Add</button>
            <Segmented label="Calendar view" value={view} options={VIEWS} onChange={setView} />
          </div>
        }
      />

      {view !== "agenda" ? (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAnchor(TODAY)} className="press btn btn-sm btn-plain">Today</button>
            <button type="button" onClick={() => step(-1)} aria-label={`Previous ${unit}`} className="press grid h-9 w-9 place-items-center rounded-full bg-surface-2 ring-1 ring-sep"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => step(1)} aria-label={`Next ${unit}`} className="press grid h-9 w-9 place-items-center rounded-full bg-surface-2 ring-1 ring-sep"><ChevronRight size={18} /></button>
            <h3 className="t-headline ml-1 min-w-0 flex-1 !text-[1.05rem]" aria-live="polite">{label}</h3>
          </div>
          {overdue.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-red-soft px-3 py-2 text-[0.85rem] font-semibold text-red">
              <Hourglass size={15} className="shrink-0" aria-hidden /> <span>{overdue.length} overdue:</span>
              {overdue.map((i) => <ItemTarget key={i.id} item={i} actions={actions} className="press min-h-[28px] max-w-full rounded-md px-1 underline decoration-red/40 underline-offset-2 [overflow-wrap:anywhere]">{i.title}</ItemTarget>)}
            </div>
          )}
          <motion.div key={`${view}:${view === "month" ? anchor.slice(0, 7) : days[0]}:${narrow}`} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
            {view === "week"
              ? <WeekGrid items={items} days={days} today={TODAY} narrow={narrow} actions={actions} />
              : <MonthGrid items={items} anchor={anchor} today={TODAY} narrow={narrow} onOpenDay={(d) => { setAnchor(d); setView("week"); }} />}
          </motion.div>
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="t-sub" aria-live="polite">
              {coming} {coming === 1 ? "thing" : "things"} coming up{overdue.length > 0 ? <>, and <span className="font-semibold text-red">{overdue.length} overdue</span></> : ""}.
            </p>
            <Segmented label="Agenda range" value={range} options={RANGES} onChange={setRange} />
          </div>
          <div className="mt-3 space-y-5">
            {groups.map((g, gi) => <Group key={`${range}:${g.key}`} group={g} index={gi} reduce={!!reduce} actions={actions} />)}
          </div>
        </>
      )}

      <TodoPanel onEdit={openEdit} />

      <p className="t-caption mt-5 [overflow-wrap:anywhere]">
        Demo data in Malaysia time. Classes show this week only, because the demo timetable covers one week. Entries marked saved in this browser are yours: you can add, change and remove them, and they stay on this device. Nothing here is sent to the university.
      </p>

      {inBrowser && createPortal(
      <Sheet open={!!editor} onClose={() => setEditor(null)} label={editor?.mode === "edit" ? "Edit entry" : "Add to calendar"} modalOnDesktop>
        {editor && (
          <>
            <div className="flex items-center justify-between px-5 pb-2 pt-3 lg:pt-5">
              <h2 className="t-headline">{editor.mode === "edit" ? (editor.draft.kind === "todo" ? "Edit to-do" : editor.draft.kind === "reminder" ? "Edit reminder" : "Edit event") : "Add to your calendar"}</h2>
              <button type="button" onClick={() => setEditor(null)} className="press btn btn-sm btn-plain">Close</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <EntryEditor
                key={editor.key}
                initial={editor.draft}
                mode={editor.mode}
                idPrefix="cal"
                stickyActions
                onCancel={() => setEditor(null)}
                onDelete={editor.draft.id ? () => { deleteEntry(editor.draft.kind, editor.draft.id!); setEditor(null); } : undefined}
                onSave={(d) => {
                  const r = saveEntry(d);
                  if (!r.ok) return r;
                  setEditor(null);
                  if (d.date && view !== "agenda") setAnchor(d.date);
                  return { ok: true };
                }}
              />
            </div>
          </>
        )}
      </Sheet>, document.body)}
    </div>
  );
}

function Group({ group, index, reduce, actions }: { group: DayGroup; index: number; reduce: boolean; actions: CalendarActions }) {
  const items = group.items;
  return (
    <motion.section
      aria-label={group.label}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: reduce ? 0 : Math.min(index, 6) * 0.03 }}
    >
      <h3 className={`t-eyebrow mb-1 ${group.overdue ? "!text-red" : ""}`}>{group.label}</h3>
      <ul className="-mx-2 divide-y divide-sep">
        {items.length === 0 && group.nowIndex === 0 && <NowLine />}
        {items.length === 0 && <li className="t-sub px-2 py-3">Nothing else is scheduled today.</li>}
        {items.map((item, i) => (
          <Fragment key={item.id}>
            {group.isToday && group.nowIndex === i && <NowLine />}
            <Row item={item} actions={actions} />
          </Fragment>
        ))}
        {group.isToday && items.length > 0 && group.nowIndex === items.length && <NowLine />}
      </ul>
    </motion.section>
  );
}

function NowLine() {
  return (
    <li aria-label={`Now, ${timeOf(DEMO_NOW)}`} className="flex items-center gap-2 px-2 py-1.5" style={{ color: "var(--red)" }}>
      <span className="tnum w-12 shrink-0 text-[0.72rem] font-bold uppercase tracking-wide sm:w-14">Now</span>
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--red)" }} />
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--red)", opacity: 0.55 }} />
      <span className="tnum text-[0.72rem] font-semibold">{timeOf(DEMO_NOW)}</span>
    </li>
  );
}

function Row({ item, actions }: { item: TimelineItem; actions: CalendarActions }) {
  const Icon = ICON[item.kind];
  const tone = toneClass[item.tone];
  const past = isPast(item, DEMO_NOW);
  const cancelled = item.state === "cancelled";
  const when = timeText(item).split(" to ");
  const pillTone = item.state === "cancelled" || item.state === "overdue" ? "red" : item.state === "changed" ? "orange" : item.state === "replacement" ? "green" : null;
  const body = (
    <>
      <span className="tnum w-12 shrink-0 text-[0.78rem] font-semibold leading-tight text-label-2 sm:w-14 sm:text-[0.82rem]">
        {when[0]}{when[1] && <span className="block font-normal">to {when[1]}</span>}
      </span>
      <span className={`h-9 w-1 shrink-0 rounded-full ${cancelled || item.state === "overdue" ? "bg-red" : tone.dot}`} aria-hidden />
      <span className={`hidden h-9 w-9 shrink-0 place-items-center rounded-xl sm:grid ${tone.bg} ${tone.fg}`} aria-hidden><Icon size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[0.95rem] font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere] ${cancelled || item.done ? "text-label-3 line-through" : ""}`}>{item.title}</span>
        <span className="t-caption block [overflow-wrap:anywhere]">
          <span className="font-semibold">{item.saved ? `${item.label}, saved in this browser` : item.label}</span>, {item.detail}
        </span>
        {pillTone && item.stateLabel && <span className="mt-1 block sm:hidden"><Pill tone={pillTone}>{item.stateLabel}</Pill></span>}
      </span>
      {pillTone && item.stateLabel && <span className="hidden shrink-0 sm:block"><Pill tone={pillTone}>{item.stateLabel}</Pill></span>}
    </>
  );
  return (
    <li style={{ opacity: past || item.done ? 0.5 : 1 }}>
      {item.kind === "todo" ? (
        <div className="flex items-center">
          <TodoCheck item={item} actions={actions} size={20} />
          <ItemTarget item={item} actions={actions} className="press-row flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2">{body}</ItemTarget>
        </div>
      ) : (
        <ItemTarget item={item} actions={actions} className="press-row flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-2">{body}</ItemTarget>
      )}
    </li>
  );
}
