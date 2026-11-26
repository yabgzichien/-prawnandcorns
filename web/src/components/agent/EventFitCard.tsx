"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, CalendarCheck, CalendarDays, CalendarPlus, CircleCheck, CircleHelp, CircleX, Clock, Download, GraduationCap, Hourglass, ImageIcon, Link2, NotebookPen, Plus } from "lucide-react";
import type { AgentCard } from "@/lib/agent";
import { checkEventFit, type Busy, type FitWarning, type Verdict } from "@/lib/eventfit/check";
import { defaultEnd, type EventFields } from "@/lib/eventfit/read";
import { dateLabel, isTime } from "@/lib/events/checks";
import { isDate } from "@/lib/library/policy";
import { eventICS, download } from "@/lib/ics";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";

type Card = Extract<AgentCard, { kind: "event-fit" }>;

const VERDICT: Record<Verdict, { label: string; icon: typeof CircleCheck; bg: string; fg: string }> = {
  free: { label: "Fits", icon: CircleCheck, bg: "var(--green-soft)", fg: "var(--green)" },
  tight: { label: "Fits, with things to note", icon: AlertTriangle, bg: "var(--orange-soft)", fg: "var(--orange)" },
  clash: { label: "Clashes", icon: CircleX, bg: "var(--red-soft)", fg: "var(--red)" },
  past: { label: "Already happened", icon: Clock, bg: "var(--surface-3)", fg: "var(--label-2)" },
  incomplete: { label: "Needs a date and time", icon: CircleHelp, bg: "var(--accent-soft)", fg: "var(--accent)" },
};
const BUSY_ICON: Record<Busy["kind"], typeof BookOpen> = { class: BookOpen, exam: GraduationCap, study: NotebookPen, plan: CalendarDays, booking: CalendarCheck };
const WARN_ICON: Record<FitWarning["kind"], typeof Clock> = { near: Clock, deadline: Hourglass, exam: GraduationCap, phase: CalendarDays };

const field = "min-w-0 w-full rounded-xl bg-surface-2 px-3 py-2 text-[0.92rem] ring-1 ring-sep outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function EventFitCard({ card }: { card: Card }) {
  const { studySessions, personalEvents, bookings, addPersonalEvent } = useApp();
  const { data } = useCampus();
  const [f, setF] = useState<EventFields>(card.reading.fields);
  const [assumedEnd, setAssumedEnd] = useState(card.reading.assumedEnd);
  const [error, setError] = useState("");
  const set = (k: keyof EventFields, v: string) => {
    setError("");
    const next = { ...f, [k]: v };
    // a new start moves an assumed end with it, and fills one in when there is none yet
    if (k === "start" && isTime(v) && (assumedEnd || !isTime(f.end) || f.end <= v)) { next.end = defaultEnd(v); setAssumedEnd(true); }
    if (k === "end") setAssumedEnd(false);
    setF(next);
  };
  const ready = isDate(f.date) && isTime(f.start) && isTime(f.end);
  const result = useMemo(() => checkEventFit(f, { thisWeek: data.classes, studySessions, personalEvents, bookings, assignments: data.assignments }), [f, data.classes, data.assignments, studySessions, personalEvents, bookings]);
  const v = VERDICT[result.verdict];
  const id = `evt-${f.date}-${f.start.replace(":", "")}-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "event"}`;
  const saved = personalEvents.some((p) => p.id === id);
  const ev = ready ? { id, title: f.title.trim() || "Event", start: `${f.date}T${f.start}:00+08:00`, end: `${f.date}T${f.end}:00+08:00`, place: f.place || undefined } : null;
  const canSave = !!ev && result.verdict !== "past" && result.verdict !== "incomplete";
  const SourceIcon = card.picture ? ImageIcon : card.reading.source === "demo-link" ? Link2 : null;

  return (
    <div className="overflow-hidden rounded-2xl bg-surface" aria-label="Event time check">
      {(card.picture || card.reading.notes.length > 0) && (
        <div className="flex items-start gap-2 border-b border-sep px-3.5 py-2.5">
          {SourceIcon && <SourceIcon size={15} className="mt-0.5 shrink-0 text-label-2" aria-hidden />}
          <p className="t-caption min-w-0 [overflow-wrap:anywhere]">{card.picture ? <><span className="font-semibold text-label">{card.picture.name}</span>. {card.picture.read ? "Read by Gemini. Check the fields." : "Not read."} </> : null}{card.reading.notes.join(" ")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 px-3.5 pt-3">
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1"><span className="t-caption font-semibold">Event</span><input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Event name" className={field} /></label>
        <div className="flex flex-wrap gap-2">
          <label className="grid min-w-0 flex-1 basis-[9rem] grid-cols-[minmax(0,1fr)] gap-1"><span className="t-caption font-semibold">Date</span><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} /></label>
          <label className="grid min-w-0 flex-1 basis-[6rem] grid-cols-[minmax(0,1fr)] gap-1"><span className="t-caption font-semibold">Starts</span><input type="time" value={f.start} onChange={(e) => set("start", e.target.value)} className={field} /></label>
          <label className="grid min-w-0 flex-1 basis-[6rem] grid-cols-[minmax(0,1fr)] gap-1"><span className="t-caption font-semibold">Ends{assumedEnd ? " (assumed)" : ""}</span><input type="time" value={f.end} onChange={(e) => set("end", e.target.value)} className={field} /></label>
        </div>
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1"><span className="t-caption font-semibold">Place</span><input value={f.place} onChange={(e) => set("place", e.target.value)} maxLength={60} placeholder="Optional" className={field} /></label>
      </div>

      <div role="status" className="mx-3.5 mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: v.bg }}>
        <v.icon size={18} className="mt-0.5 shrink-0" style={{ color: v.fg }} aria-hidden />
        <div className="min-w-0">
          <p className="text-[0.92rem] font-semibold" style={{ color: v.fg }}>{v.label}</p>
          <p className="text-[0.88rem] leading-snug [overflow-wrap:anywhere]">{result.headline}</p>
        </div>
      </div>

      {(result.clashes.length > 0 || result.warnings.length > 0) && (
        <ul className="mx-3.5 mt-2 grid gap-1.5">
          {result.clashes.map((c) => { const I = BUSY_ICON[c.kind]; return <li key={`c-${c.label}-${c.start}`} className="flex items-start gap-2 text-[0.86rem]"><I size={15} className="mt-0.5 shrink-0 text-red" aria-hidden /><span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold">Clash:</span> {c.label}, {c.start} to {c.end}</span></li>; })}
          {result.warnings.map((w) => { const I = WARN_ICON[w.kind]; return <li key={w.text} className="flex items-start gap-2 text-[0.86rem]"><I size={15} className="mt-0.5 shrink-0 text-orange" aria-hidden /><span className="min-w-0 [overflow-wrap:anywhere]">{w.text}</span></li>; })}
        </ul>
      )}

      {ready && result.day.length > 0 && (
        <details className="mx-3.5 mt-2">
          <summary className="t-caption cursor-pointer font-semibold">Your {dateLabel(f.date)} ({result.day.length} item{result.day.length === 1 ? "" : "s"})</summary>
          <ul className="mt-1 grid gap-0.5">{result.day.map((d) => <li key={`${d.kind}-${d.label}-${d.start}`} className="t-caption tnum [overflow-wrap:anywhere]">{d.start} to {d.end}: {d.label}</li>)}</ul>
        </details>
      )}

      {error && <p role="alert" className="mx-3.5 mt-2 text-[0.85rem] font-semibold text-red">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-sep px-3.5 py-3">
        <button
          disabled={!canSave || saved}
          onClick={() => { if (!ev) return; const r = addPersonalEvent(ev); if (!r.ok) setError(r.error); }}
          className="press btn btn-sm btn-primary max-w-full py-1.5 text-left disabled:opacity-40"
        >
          {saved ? <><CalendarCheck size={15} /> In your plans</> : <>{result.verdict === "clash" ? <Plus size={15} /> : <CalendarPlus size={15} />} {result.verdict === "clash" ? "Add anyway" : "Add to my plans"}</>}
        </button>
        <button disabled={!ev} onClick={() => ev && download(`${id}.ics`, eventICS(ev))} className="press btn btn-sm btn-tint max-w-full py-1.5 text-left disabled:opacity-40"><Download size={15} /> Calendar file</button>
      </div>
      <p className="t-caption px-3.5 pb-3">Checked by Compass against your demo timetable, plans and bookings. Nothing is booked or registered.</p>
    </div>
  );
}
