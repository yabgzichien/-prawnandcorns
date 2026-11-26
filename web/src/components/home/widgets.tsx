"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, BookOpen, CalendarX2, Check, Clock, Code2, DoorOpen, FileText, FlaskConical, ListChecks, MapPin, Search, Sigma, Users, Wallet } from "lucide-react";
import { COURSE_BY_ID, sessionDate } from "@/lib/data/academics";
import { CLUBS, EVENTS } from "@/lib/data/life";
import { PLACE_BY_ID, ROOM_BY_CODE } from "@/lib/data/campus";
import { DEMO_NOW, dateShort, dueLabel, minutesBetween, relative, timeOf } from "@/lib/time";
import { classesOn, TODAY_IDX, upcomingClasses } from "@/lib/schedule";
import { useApp, type WidgetId } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { markedHereOnly, MOODLE_NOT_SUBMITTED } from "@/lib/sync/view";
import { CardTitle, Pill, Ring, toneClass } from "@/components/ui/kit";

const money = (n: number, currency = "RM") => `${currency} ${n.toLocaleString("en-MY")}`;

function NextWidget() {
  const { data } = useCampus();
  const next = upcomingClasses(DEMO_NOW, data.classes)[0];
  if (!next) return <p className="t-sub">No more classes this week.</p>;
  const course = COURSE_BY_ID[next.courseId];
  const tone = toneClass[course.tone];
  const { start, end } = sessionDate(next);
  const mins = minutesBetween(DEMO_NOW, start);
  const room = ROOM_BY_CODE[next.room];
  const cancelledToday = classesOn(TODAY_IDX, data.classes).filter((c) => c.status === "cancelled");
  return (
    <div className="next-content grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="t-eyebrow mb-3">Up next: {relative(start)}</p>
        <div className="next-details flex items-start gap-3">
          <span className={`mt-2 h-12 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
          <div>
            <h2 className="t-title !text-[1.9rem]">{course.title}</h2>
            <p className="t-sub mt-1">{next.kind}, {timeOf(start)}–{timeOf(end)} in {next.room}{room ? `, ${PLACE_BY_ID[room.place].name}` : ""}</p>
          </div>
        </div>
        {cancelledToday.length > 0 && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-soft px-3 py-2 text-[0.85rem] font-semibold text-red">
            <CalendarX2 size={16} /> {COURSE_BY_ID[cancelledToday[0].courseId].code} {cancelledToday[0].start} is cancelled — you&rsquo;re free until {timeOf(start)}.
          </p>
        )}
      </div>
      <div className="mascot-spot mascot-next" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
        <div className="text-right">
          <p className="tnum text-[2.6rem] font-bold leading-none tracking-[-0.04em]">{Math.floor(mins / 60)}<span className="text-[1.1rem] font-semibold text-label-2">h </span>{mins % 60}<span className="text-[1.1rem] font-semibold text-label-2">m</span></p>
          <p className="t-caption mt-1">until class</p>
        </div>
        <Link href={`/hub?section=map&focus=${next.room}`} className="press btn btn-primary"><MapPin size={17} /> Find {next.room}</Link>
      </div>
    </div>
  );
}

function AlertsWidget() {
  const { data } = useCampus();
  const notices = data.notices.slice(0, 4);
  return (
    <>
      <CardTitle icon={<AlertTriangle size={18} className="text-orange" />} title={`Class changes (${data.notices.length})`} />
      <ul className="-mx-2 divide-y divide-sep">
        {notices.map((n) => (
          <li key={n.id} className="flex gap-3 px-2 py-3">
            <span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${n.kind === "cancellation" ? "bg-red-soft text-red" : n.kind === "room" ? "bg-orange-soft text-orange" : "bg-accent-soft text-accent"}`}>
              {n.kind === "cancellation" ? <CalendarX2 size={16} /> : n.kind === "room" ? <DoorOpen size={16} /> : <Clock size={16} />}
            </span>
            <div className="min-w-0">
              <p className="text-[0.95rem] font-semibold leading-snug tracking-[-0.01em]">{n.title}</p>
              <p className="t-caption mt-0.5 line-clamp-2">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function DueWidget() {
  const { submitted, toggleSubmitted } = useApp();
  const { data } = useCampus();
  const items = data.assignments.filter((a) => a.status !== "submitted").sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()).slice(0, 4);
  return (
    <>
      <CardTitle title="Due soon" action={<Link href="/hub?section=assignments" className="press text-[0.85rem] font-semibold text-accent">View all <ArrowRight className="inline" size={14} /></Link>} />
      <ul className="-mx-2">
        {items.map((a, index) => {
          const done = submitted.includes(a.id);
          const warn = markedHereOnly(a, submitted, data);
          const DueIcon = [FlaskConical, ListChecks, Sigma, FileText][index];
          return (
            <li key={a.id}>
              <button onClick={() => toggleSubmitted(a.id)} aria-pressed={done} className="press-row flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors" style={{ borderColor: done ? "var(--green)" : "var(--label-3)", background: done ? "var(--green)" : "transparent" }}>
                  {done && <Check size={14} color="#fff" strokeWidth={3.5} />}
                </span>
                <span className="due-row-icon"><DueIcon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[0.95rem] font-semibold tracking-[-0.01em] ${done ? "text-label-3 line-through" : ""}`}>{a.title}</span>
                  {warn && <span className="block truncate text-[0.78rem] font-semibold text-orange">{MOODLE_NOT_SUBMITTED}</span>}
                  <span className="t-caption block truncate">{COURSE_BY_ID[a.courseId].code}, <span style={{ color: a.status === "overdue" ? "var(--red)" : undefined, fontWeight: a.status === "overdue" ? 600 : undefined }}>{a.status === "overdue" ? "Overdue" : dueLabel(new Date(a.due))}</span></span>
                </span>
                <span className="due-row-date">{a.status === "overdue" ? "Overdue" : dueLabel(new Date(a.due))}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TodayWidget() {
  const { data } = useCampus();
  const list = classesOn(TODAY_IDX, data.classes);
  return (
    <>
      <CardTitle title="Today" action={<Link href="/hub?section=timetable" className="press text-[0.85rem] font-semibold text-accent">View timetable <ArrowRight className="inline" size={14} /></Link>} />
      <ol className="relative space-y-1">
        {list.map((c) => {
          const course = COURSE_BY_ID[c.courseId];
          const past = sessionDate(c).end < DEMO_NOW;
          const cancelled = c.status === "cancelled";
          return (
            <li key={c.id} className="flex items-center gap-3 py-2" style={{ opacity: past ? 0.5 : 1 }}>
              <span className="tnum w-11 shrink-0 text-[0.85rem] font-semibold text-label-2">{c.start}</span>
              <span className={`h-9 w-1 shrink-0 rounded-full ${cancelled ? "bg-red" : toneClass[course.tone].dot}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[0.95rem] font-semibold tracking-[-0.01em] ${cancelled ? "text-label-3 line-through" : ""}`}>{course.code} {c.kind}</span>
                <span className="t-caption block">{c.room}</span>
              </span>
              {cancelled && <Pill tone="red">Cancelled</Pill>}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function TodayOverview() {
  const { data } = useCampus();
  const next = upcomingClasses()[0];
  const course = COURSE_BY_ID[next.courseId];
  const { start, end } = sessionDate(next);
  const mins = minutesBetween(DEMO_NOW, start);
  const notice = data.notices[0];
  const list = classesOn(TODAY_IDX);
  return (
    <div className="today-overview">
      <div className="today-overview-head">
        <h2>Today</h2>
        <Link href="/hub?section=timetable" className="press">View full timetable <ArrowRight size={17} /></Link>
      </div>
      <div className="today-next">
        <span className="today-next-tag">Up next</span>
        <span className="today-next-icon"><BookOpen size={24} /></span>
        <div className="today-next-copy">
          <h3>{course.title} ({course.code})</h3>
          <p>{next.kind} in {next.room}</p>
          <p className="today-next-count"><Clock size={16} /> Starts in <strong>{Math.floor(mins / 60)} h {mins % 60} min</strong></p>
          <span>{timeOf(start)}–{timeOf(end)}</span>
        </div>
        <Link href={`/hub?section=map&focus=${next.room}`} className="press today-next-link"><MapPin size={16} /> Find {next.room}</Link>
      </div>
      {notice && (
        <Link href="/hub?section=timetable" className="press today-notice">
          <span className="today-notice-icon"><AlertTriangle size={22} /></span>
          <span className="min-w-0"><strong>Class change today</strong><small>{notice.title}. See all {data.notices.length} class changes</small></span>
          <ArrowRight size={17} className="shrink-0" />
        </Link>
      )}
      <h3 className="today-timetable-title">Today’s timetable</h3>
      <ol className="today-timeline">
        {list.map((c) => {
          const entry = COURSE_BY_ID[c.courseId];
          const cancelled = c.status === "cancelled";
          return <li key={c.id} className={cancelled ? "is-cancelled" : ""}>
            <span className="today-timeline-time">{c.start}–{c.end}</span>
            <span className="today-timeline-dot" />
            <span className="today-timeline-icon"><BookOpen size={20} /></span>
            <span className="today-timeline-copy"><strong>{entry.code} {c.kind}</strong><small><MapPin size={13} /> {c.room}</small></span>
            {cancelled && <Pill tone="red">Cancelled</Pill>}
          </li>;
        })}
      </ol>
    </div>
  );
}

function FeesWidget() {
  const { data } = useCampus();
  const FINANCE = data.fees;
  const next = FINANCE.dues.find((d) => d.status === "upcoming");
  return (
    <>
      <CardTitle icon={<Wallet size={18} className="text-accent" />} title="Fees" action={<Link href="/hub?section=finance" className="press text-[0.85rem] font-semibold text-accent">Details <ArrowRight className="inline" size={14} /></Link>} />
      <div className="flex items-center gap-4">
        <Ring value={FINANCE.paid / FINANCE.tuitionTotal} size={72} stroke={8} tone="var(--green)"><span className="tnum text-[0.85rem] font-bold">{Math.round((FINANCE.paid / FINANCE.tuitionTotal) * 100)}%</span></Ring>
        <div>
          <p className="t-caption">Next instalment</p>
          <p className="tnum text-[1.6rem] font-bold leading-tight tracking-[-0.03em]">{next ? money(next.amount, FINANCE.currency) : "None posted"}</p>
          <p className="t-caption">{next ? `Due ${dateShort(new Date(next.due))}, ${relative(new Date(next.due))}` : "Finance has not posted another instalment."}</p>
        </div>
      </div>
    </>
  );
}

function ProgressWidget() {
  return (
    <>
      <CardTitle title="Degree progress" action={<Link href="/hub?section=courses" className="press text-[0.85rem] font-semibold text-accent">Plan <ArrowRight className="inline" size={14} /></Link>} />
      <div className="flex items-center gap-4">
        <Ring value={14 / 120} size={72} stroke={8}><span className="tnum text-[0.85rem] font-bold">14</span></Ring>
        <div>
          <p className="text-[1.05rem] font-semibold tracking-[-0.01em]">14 of 120 credits</p>
          <p className="t-caption">Taking 5 courses this semester (4 core, 1 GE)</p>
        </div>
      </div>
    </>
  );
}

function ClubsWidget() {
  const { joined } = useApp();
  const ev = EVENTS[0];
  const picks = CLUBS.filter((c) => c.recruiting && !joined.includes(c.id)).slice(0, 2);
  return (
    <>
      <CardTitle icon={<Users size={19} className="text-accent" />} title="Clubs & events" action={<Link href="/hub?section=clubs" className="press text-[0.85rem] font-semibold text-accent">Explore <ArrowRight className="inline" size={14} /></Link>} />
      <div className="rounded-xl bg-accent-soft p-3">
        <span className="club-fair-icon" aria-hidden="true" />
        <p className="text-[0.95rem] font-semibold tracking-[-0.01em] text-accent">{ev.title}</p>
        <p className="t-caption">{ev.when}, {ev.where}</p>
      </div>
      <ul className="mt-2 divide-y divide-sep">
        {picks.map((c, index) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="club-row-icon">{index === 0 ? <Users size={19} /> : <Code2 size={19} />}</span>
            <div className="min-w-0"><p className="truncate text-[0.92rem] font-semibold">{c.name}</p><p className="t-caption">{c.meets}, {c.members} members</p></div>
            <Pill tone="green">Recruiting</Pill>
          </li>
        ))}
      </ul>
    </>
  );
}

function FindWidget() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <>
      <CardTitle icon={<MapPin size={19} className="text-accent" />} title="Find a room" />
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/hub?section=map&q=${encodeURIComponent(q.trim())}`); }} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-4 pr-1 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
        <Search size={17} className="text-label-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A3-G01, library, canteen…" aria-label="Search campus" className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-label-3" />
        <button className="press btn btn-sm btn-primary">Go</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {["A3-G01", "A5-L2", "Library", "Canteen"].map((s) => <Link key={s} href={`/hub?section=map&q=${s}`} className="press btn btn-sm btn-plain">{s}</Link>)}
      </div>
    </>
  );
}

export const WIDGETS: Record<WidgetId, { span: 1 | 2; hero?: boolean; render: () => ReactNode }> = {
  next: { span: 2, hero: true, render: () => <NextWidget /> },
  alerts: { span: 1, render: () => <AlertsWidget /> },
  due: { span: 1, render: () => <DueWidget /> },
  today: { span: 1, render: () => <TodayWidget /> },
  fees: { span: 1, render: () => <FeesWidget /> },
  progress: { span: 1, render: () => <ProgressWidget /> },
  clubs: { span: 1, render: () => <ClubsWidget /> },
  find: { span: 1, render: () => <FindWidget /> },
};
