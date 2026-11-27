"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, Copy, ExternalLink, MapPin, Pencil, Undo2 } from "lucide-react";
import type { AgentCard } from "@/lib/agent";
import { COURSE_BY_ID } from "@/lib/data/academics";
import { dueLabel, atDay, dayShort, dateShort, timeOf } from "@/lib/time";
import { mailtoHref } from "@/lib/email";
import { Pill, Ring } from "@/components/ui/kit";
import { useApp } from "@/lib/state";
import { asMalaysiaIso, validateStudySessions, type StudySession } from "@/lib/planning";
import { DEMO_NOW } from "@/lib/time";
import { useCampus } from "@/lib/sync/CampusProvider";
import { classBlocksFrom, tasksFrom } from "@/lib/planning-demo";
import { UpdatesCard } from "./UpdatesCard";
import { AskaCard } from "./AskaCard";
import { EventCard, EventStatusCard } from "./EventCard";
import { RoomsCard } from "./RoomsCard";
import { DocumentsCard } from "./DocumentsCard";
import { EventFitCard } from "./EventFitCard";
import { PlanEntryCard } from "./PlanEntryCard";
import { examName } from "@/lib/calendar/semester";
import { GraduationCap } from "lucide-react";
import { GE_BY_CODE } from "@/lib/electives/catalogue";
import { meetingLabel } from "@/lib/electives/parse";
import { parsedOf } from "@/lib/electives/plan";

const statusTone = { overdue: "red", todo: "orange", progress: "blue", submitted: "green" } as const;

export function AgentCardView({ card, onNavigate, onUndoLayout }: { card: AgentCard; onNavigate: () => void; onUndoLayout?: () => void }) {
  switch (card.kind) {
    case "study-plan":
      return <StudyPlanCard card={card} />;
    case "updates":
      return <UpdatesCard card={card} />;
    case "aska":
      return <AskaCard draft={card.draft} />;
    case "event":
      return <EventCard card={card} />;
    case "event-status":
      return <EventStatusCard card={card} onNavigate={onNavigate} />;
    case "rooms":
      return <RoomsCard card={card} onNavigate={onNavigate} />;
    case "documents":
      return <DocumentsCard card={card} onNavigate={onNavigate} />;
    case "deadlines":
      return (
        <ul className="divide-y divide-sep overflow-hidden rounded-2xl bg-surface">
          {card.items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className={`h-2 w-2 shrink-0 rounded-full`} style={{ background: `var(--${a.status === "overdue" ? "red" : a.status === "todo" ? "orange" : "accent"})` }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em]">{a.title}</p>
                <p className="t-caption truncate">{COURSE_BY_ID[a.courseId].code}, {a.status === "overdue" ? "Overdue" : dueLabel(new Date(a.due))}, {a.weight}%</p>
              </div>
              <Pill tone={statusTone[a.status]}>{a.status === "progress" ? "In progress" : a.status === "todo" ? "To do" : a.status === "overdue" ? "Overdue" : "Done"}</Pill>
            </li>
          ))}
          <li><Link href="/hub?section=assignments" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between px-3.5 text-[0.9rem] font-semibold text-accent">Open Assignments <ArrowRight size={16} /></Link></li>
        </ul>
      );

    case "class": {
      const c = card.session;
      const course = COURSE_BY_ID[c.courseId];
      const cancelled = c.status === "cancelled";
      return (
        <div className="overflow-hidden rounded-2xl bg-surface">
          <div className="flex items-start gap-3 p-3.5">
            <span className="mt-1 h-10 w-1 rounded-full" style={{ background: cancelled ? "var(--red)" : "var(--accent)" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold tracking-[-0.01em]">{course.code}, {c.kind}</p>
              <p className="t-caption">{c.start}–{c.end}, {c.room}</p>
            </div>
            <Pill tone={cancelled ? "red" : c.status === "normal" ? "green" : "orange"}>{cancelled ? "Cancelled" : c.status === "room-changed" ? "Room changed" : c.status === "makeup" ? "Make-up" : "On"}</Pill>
          </div>
          {card.makeup && (
            <div className="border-t border-sep bg-green-soft px-3.5 py-2.5">
              <p className="text-[0.85rem] font-semibold text-green">{card.makeup.replacementId ? "Replacement class" : "Make-up class"} on {dayShort(atDay(card.makeup.day, card.makeup.start))} {dateShort(atDay(card.makeup.day, card.makeup.start))} at {card.makeup.start} in {card.makeup.room}</p>
              <Link href={`/hub?section=map&focus=${card.makeup.room}`} onClick={onNavigate} className="mt-1 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-green underline-offset-2 hover:underline"><MapPin size={14} /> Show {card.makeup.room} on map</Link>
            </div>
          )}
          {cancelled && !card.makeup && c.noticeId?.startsWith("rpl-") && (
            <Link href="/hub?section=timetable" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between border-t border-sep px-3.5 text-[0.9rem] font-semibold text-accent">Tell the lecturer which times work <ArrowRight size={16} /></Link>
          )}
          {card.next && cancelled && (
            <div className="border-t border-sep px-3.5 py-2.5">
              <p className="t-caption">Next class: <span className="font-semibold text-label">{COURSE_BY_ID[card.next.courseId].code} at {card.next.start}</span> in {card.next.room}</p>
            </div>
          )}
        </div>
      );
    }

    case "schedule":
      return (
        <div className="overflow-hidden rounded-2xl bg-surface">
          <p className="t-eyebrow px-3.5 pt-3">{card.label}</p>
          <ul className="divide-y divide-sep">
            {card.items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-3" style={{ opacity: c.status === "cancelled" ? 0.6 : 1 }}>
                <span className="tnum w-12 text-[0.85rem] font-semibold text-label-2">{c.start}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[0.95rem] font-semibold ${c.status === "cancelled" ? "line-through" : ""}`}>{COURSE_BY_ID[c.courseId].code}, {c.kind}</p>
                  <p className="t-caption">{c.room}{c.status === "room-changed" ? ` (was ${c.originalRoom})` : ""}</p>
                </div>
                {c.status === "cancelled" && <Pill tone="red">Cancelled</Pill>}
                {c.status === "room-changed" && <Pill tone="orange">Room changed</Pill>}
              </li>
            ))}
          </ul>
        </div>
      );

    case "room":
      return (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><MapPin size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold tracking-[-0.01em]">{card.room.code}</p>
            <p className="t-caption truncate">{card.place.name}, {card.room.floor}</p>
          </div>
          <Link href={`/hub?section=map&focus=${card.room.code}`} onClick={onNavigate} className="press btn btn-sm btn-primary">Show on map</Link>
        </div>
      );

    case "email":
      return <EmailCard card={card} onNavigate={onNavigate} />;

    case "layout":
      return (
        <div className="rounded-2xl bg-surface p-3.5">
          <ul className="space-y-1.5">
            {card.summary.map((s) => (
              <li key={s} className="flex items-center gap-2 text-[0.9rem] font-medium"><Check size={16} className="text-green" strokeWidth={3} /> {s}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Link href="/" onClick={onNavigate} className="press btn btn-sm btn-primary">View Home</Link>
            {onUndoLayout && <button onClick={onUndoLayout} className="press btn btn-sm btn-plain"><Undo2 size={14} /> Undo</button>}
          </div>
        </div>
      );

    case "clubs":
      return (
        <ul className="divide-y divide-sep overflow-hidden rounded-2xl bg-surface">
          {card.items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em]">{c.name}</p>
                <p className="t-caption truncate">{c.category}, {c.meets}{c.room ? `, ${c.room}` : ""}, {c.members} members</p>
              </div>
              <Pill tone="green">Recruiting</Pill>
            </li>
          ))}
          <li><Link href="/hub?section=clubs" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between px-3.5 text-[0.9rem] font-semibold text-accent">Browse all clubs <ArrowRight size={16} /></Link></li>
        </ul>
      );

    case "fees":
      return (
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-3.5">
          <Ring value={card.paid / card.total} size={56} stroke={6} tone="var(--green)"><span className="tnum text-[0.75rem] font-bold">{Math.round((card.paid / card.total) * 100)}%</span></Ring>
          <div className="min-w-0 flex-1">
            <p className="font-semibold tracking-[-0.01em]">{card.label}</p>
            <p className="t-caption">RM {card.due.toLocaleString("en-MY")} due on {dateShort(new Date(card.dueIso))}</p>
          </div>
          <Link href="/hub?section=finance" onClick={onNavigate} className="press btn btn-sm btn-tint">Finance</Link>
        </div>
      );

    case "ge-plan": {
      const best = card.sets[0];
      return (
        <div className="overflow-hidden rounded-2xl bg-surface">
          {best ? (
            <div className="px-3.5 py-3">
              <p className="flex items-center justify-between gap-2 text-[0.95rem] font-semibold tracking-[-0.01em]">Best set for {card.target} credits <Pill tone="green">{best.credits} cr</Pill></p>
              <ul className="mt-1.5 grid gap-1">
                {best.codes.map((code) => <li key={code} className="text-[0.88rem]"><span className="font-semibold">{GE_BY_CODE[code].title}</span> <span className="t-caption">{code}, {GE_BY_CODE[code].stream}, {parsedOf(code).meetings.map(meetingLabel).join("; ")}</span></li>)}
              </ul>
              <ul className="mt-2 grid gap-0.5">{best.reasons.slice(0, 3).map((r) => <li key={r} className="t-caption flex items-start gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-green" />{r}</li>)}</ul>
              {card.sets.length > 1 && <p className="t-caption mt-2">{card.sets.length - 1} more option{card.sets.length === 2 ? "" : "s"} in the planner.</p>}
            </div>
          ) : (
            <p className="t-sub px-3.5 py-3">No set adds up to {card.target} credits without a clash.</p>
          )}
          <Link href={card.href} onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between border-t border-sep px-3.5 text-[0.9rem] font-semibold text-accent">Open GE planner <ArrowRight size={16} /></Link>
        </div>
      );
    }

    case "event-fit":
      return <EventFitCard card={card} />;

    case "plan-entry":
      return <PlanEntryCard card={card} />;

    case "exams":
      return (
        <div className="overflow-hidden rounded-2xl bg-surface">
          <div className="px-3.5 py-3">
            <p className="flex flex-wrap items-center gap-2 text-[0.95rem] font-semibold tracking-[-0.01em]">{card.status.label} <Pill tone={card.status.phase === "teaching" ? "blue" : "orange"}>{card.status.phase === "teaching" ? "Teaching" : card.status.phase === "revision" ? "Revision" : card.status.phase === "exams" ? "Exams" : "Break"}</Pill></p>
            <p className="t-caption mt-0.5">{card.status.detail}</p>
          </div>
          <ul className="divide-y divide-sep border-t border-sep">
            {card.exams.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3.5 py-2.5">
                <GraduationCap size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.92rem] font-semibold [overflow-wrap:anywhere]">{examName(e)}</p>
                  <p className="t-caption">{dayShort(new Date(e.start))} {dateShort(new Date(e.start))}, {timeOf(new Date(e.start))} to {timeOf(new Date(e.end))}, {e.room}, {e.weight}%</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="t-caption border-t border-sep px-3.5 py-2.5">Demo exam timetable, not the exam office&rsquo;s.</p>
        </div>
      );

    case "suggest":
      return null;
  }
}

function StudyPlanCard({ card }: { card: Extract<AgentCard, { kind: "study-plan" }> }) {
  const { confirmStudyPlan, studySessions, submitted, showToast } = useApp();
  const { data } = useCampus();
  const [sessions, setSessions] = useState<StudySession[]>(card.proposal.sessions);
  const [status, setStatus] = useState<"review" | "saved" | "rejected">("review");
  const [saveError, setSaveError] = useState("");
  const actionsRef = useRef<HTMLDivElement>(null);
  const issues = validateStudySessions(
    sessions, tasksFrom(data.assignments, submitted), [...classBlocksFrom(data.classes), ...card.proposal.blocked], studySessions, asMalaysiaIso(DEMO_NOW.getTime()),
  );
  const update = (id: string, field: "start" | "end", local: string) => {
    setSaveError("");
    setSessions((current) => current.map((s) => s.id === id ? { ...s, [field]: `${local}:00+08:00` } : s));
  };

  if (status !== "review") {
    return <div className="rounded-2xl bg-surface p-4 text-[0.9rem] font-medium" role="status">
      {status === "saved" ? "Study sessions confirmed and saved in this browser. Check your Home dashboard." : "Plan rejected. Nothing was saved."}
    </div>;
  }

  return (
    <section className="rounded-2xl bg-surface p-3.5" aria-label="Review proposed study plan">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div><h3 className="text-[0.95rem] font-semibold">Proposed study plan</h3><p className="t-caption">Demo data in Malaysia time (UTC+8)</p></div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Pill tone="orange">Not saved</Pill>
          <button type="button" className="press inline-flex items-center gap-1 text-[0.76rem] font-semibold text-accent underline-offset-2 hover:underline" onClick={() => actionsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })}>
            <ArrowDown size={13} aria-hidden /> Review actions
          </button>
        </div>
      </div>
      {card.proposal.assumptions.map((assumption) => <p key={assumption} className="mb-3 rounded-lg bg-orange-soft px-3 py-2 text-[0.8rem] text-orange">Assumption: {assumption}</p>)}
      {sessions.length > 0 && <ol className="space-y-3">
        {sessions.map((session) => <li key={session.id} className="rounded-xl bg-surface-2 p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.9rem] font-semibold">{session.title}</p>
              <p className="mt-1 text-[0.8rem] font-medium text-label-2">
                {Number.isFinite(Date.parse(session.start)) && Number.isFinite(Date.parse(session.end))
                  ? `${dayShort(new Date(session.start))} ${dateShort(new Date(session.start))}, ${timeOf(new Date(session.start))}–${timeOf(new Date(session.end))} MYT`
                  : "Choose a valid start and end time"}
              </p>
            </div>
            <button type="button" onClick={() => setSessions((all) => all.filter((s) => s.id !== session.id))} className="press text-[0.78rem] font-semibold text-label-2 underline-offset-2 hover:underline" aria-label={`Remove ${session.title}`}>Remove</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[0.76rem] font-medium text-label-2">Start
              <input type="datetime-local" step={300} value={session.start.slice(0, 16)} onChange={(e) => update(session.id, "start", e.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-sep bg-surface px-2 py-2 text-[0.82rem] text-label" />
            </label>
            <label className="text-[0.76rem] font-medium text-label-2">End
              <input type="datetime-local" step={300} value={session.end.slice(0, 16)} onChange={(e) => update(session.id, "end", e.target.value)} className="mt-1 block w-full min-w-0 rounded-lg border border-sep bg-surface px-2 py-2 text-[0.82rem] text-label" />
            </label>
          </div>
        </li>)}
      </ol>}
      {card.proposal.skipped.length > 0 && <div className="mt-3 rounded-lg bg-orange-soft px-3 py-2 text-[0.82rem] text-orange">
        <p className="font-semibold">Other tasks to review:</p>
        <ul className="list-inside list-disc">{card.proposal.skipped.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </div>}
      {issues.length > 0 && <div className="mt-3 rounded-lg bg-red-soft px-3 py-2 text-[0.8rem] text-red" role="alert">
        {issues.slice(0, 3).map((issue, i) => <p key={i}>{issue}</p>)}
        {issues.length > 3 && <p>And {issues.length - 3} more conflicts.</p>}
      </div>}
      {saveError && <p className="mt-3 text-[0.8rem] text-red" role="alert">{saveError}</p>}
      <p className="t-caption mt-3">Review the times before confirming. Saving affects this browser only, not Moodle or your university timetable.</p>
      {/* Keep decision buttons in sight while scrolling a long proposal. The
          Compass message list is the scroll container; the composer remains below. */}
      <div ref={actionsRef} className="sticky bottom-0 z-10 -mx-3.5 mt-4 border-t border-sep bg-surface px-3.5 pb-3 pt-3 shadow-[0_-6px_18px_-12px_rgba(0,0,0,0.3)]" aria-label="Study plan review actions">
        <p className="mb-2 text-[0.82rem] font-semibold">Ready to decide?</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {sessions.length > 0 && <button type="button" disabled={issues.length > 0} className="press btn btn-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40" onClick={() => {
            const result = confirmStudyPlan(sessions, card.proposal.blocked);
            if (result.ok) { setStatus("saved"); showToast("Study plan saved to Home"); }
            else setSaveError(result.error || "Could not save this plan.");
          }}><Check size={16} /> Confirm & save</button>}
          <button type="button" className="press btn btn-plain min-h-11 flex-1 justify-center" onClick={() => setStatus("rejected")}>Reject plan</button>
        </div>
        {issues.length > 0 && <p className="mt-2 text-[0.78rem] text-red" role="status">Resolve the conflicts above before saving.</p>}
      </div>
    </section>
  );
}

function EmailCard({ card, onNavigate }: { card: Extract<AgentCard, { kind: "email" }>; onNavigate: () => void }) {
  const { showToast } = useApp();
  const d = card.draft;
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <div className="space-y-1 border-b border-sep px-3.5 py-3">
        <p className="t-caption"><span className="font-semibold text-label">To:</span> {d.to.name} &lt;{d.to.email}&gt;</p>
        <p className="t-caption"><span className="font-semibold text-label">Subject:</span> {d.subject}</p>
      </div>
      <pre className="max-h-[220px] overflow-y-auto whitespace-pre-wrap px-3.5 py-3 font-sans text-[0.88rem] leading-[1.5] text-label">{d.body}</pre>
      <div className="flex flex-wrap items-center gap-2 border-t border-sep bg-orange-soft px-3.5 py-2">
        <span className="text-[0.78rem] font-semibold text-orange">Draft only — not sent</span>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        <Link href={`/mail?dept=${d.to.id}&need=${encodeURIComponent(card.need)}`} onClick={onNavigate} className="press btn btn-sm btn-primary"><Pencil size={14} /> Edit</Link>
        <button
          onClick={async () => {
            try { await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`); setCopied(true); setTimeout(() => setCopied(false), 1600); showToast("Draft copied"); } catch { showToast("Couldn't copy — select the text instead"); }
          }}
          className="press btn btn-sm btn-plain"
        >{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
        <a href={mailtoHref(d)} className="press btn btn-sm btn-plain"><ExternalLink size={14} /> Open in mail app</a>
      </div>
    </div>
  );
}
