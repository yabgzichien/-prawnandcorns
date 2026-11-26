"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarPlus, Check, Eye, MapPin, ShieldCheck, X } from "lucide-react";
import { COURSE_BY_ID, type ClassSession } from "@/lib/data/academics";
import { PLACE_BY_ID, ROOM_BY_CODE } from "@/lib/data/campus";
import { download, timetableICS } from "@/lib/ics";
import { asMalaysiaIso } from "@/lib/planning";
import { LECTURER } from "@/lib/replacement/cohort";
import { personalClashes } from "@/lib/replacement/overlay";
import { writeAnswer } from "@/lib/replacement/storage";
import { dayLabel, dayLabelLong } from "@/lib/replacement/time";
import type { ReplacementAnswers, ReplacementRequest, SlotOption } from "@/lib/replacement/types";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { DEMO_NOW } from "@/lib/time";
import { Pill } from "@/components/ui/kit";
import { useReplacementAlerts, useReplacementAnswers } from "./useReplacements";

const reasonLine = (r: ReplacementRequest) => (r.reason === "Public holiday" ? "Public holiday" : r.reason === "Lecturer on leave" ? "Lecturer on leave" : "Lecturer's notice");

/**
 * The student's side of a replacement class, at the top of the timetable. While the lecturer is asking, the student
 * marks which offered times work (Compass fills in a suggestion from their own timetable). Once a time is set, it
 * shows where and when, and warns about anything of the student's own that overlaps. Only "works" or "does not work"
 * is ever shared.
 */
export function ReplacementPanel({ onShowDay }: { onShowDay: (day: number) => void }) {
  const { replacements, data } = useCampus();
  const answers = useReplacementAnswers();
  const { markSeen } = useReplacementAlerts();
  if (replacements.length === 0) return null;
  return (
    <section aria-label="Replacement classes" className="mb-6 grid grid-cols-1 gap-3" onFocusCapture={markSeen} onPointerDown={markSeen}>
      <AnimatePresence initial={false}>
        {replacements.map((r) => {
          const lost = data.classes.find((c) => c.id === r.sessionId && c.courseId === r.courseId && !c.replacementId);
          if (!lost) return null;
          return (
            <motion.div key={`${r.id}-${r.status}`} layout initial={{ opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={SPRING}>
              {r.status === "scheduled" && r.chosen
                ? <ScheduledCard request={r} lost={lost} chosen={r.chosen} onShowDay={onShowDay} />
                : <AskingCard key={r.stamp} request={r} lost={lost} answers={answers} />}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </section>
  );
}

function Header({ request, lost, icon, tone, label }: { request: ReplacementRequest; lost: ClassSession; icon: ReactNode; tone: "green" | "orange"; label: string }) {
  const course = COURSE_BY_ID[lost.courseId];
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone === "green" ? "bg-green-soft text-green" : "bg-orange-soft text-orange"}`}>{icon}</span>
      <div className="min-w-0 flex-1 basis-[10rem]">
        <div className="flex flex-wrap items-center gap-2"><Pill tone={tone} className="max-w-full">{label}</Pill><span className="t-caption">{reasonLine(request)}</span></div>
        <h2 className="t-headline mt-1 break-words">{course.code} {lost.kind.toLowerCase()} on {dayLabel(lost.day)} is cancelled</h2>
        <p className="t-caption mt-0.5">{course.title}, usually {lost.start} to {lost.end} in {lost.room}. From {LECTURER.name}.</p>
      </div>
    </div>
  );
}

function ScheduledCard({ request, lost, chosen, onShowDay }: { request: ReplacementRequest; lost: ClassSession; chosen: SlotOption; onShowDay: (day: number) => void }) {
  const { data } = useCampus();
  const { studySessions, bookings, showToast } = useApp();
  const room = ROOM_BY_CODE[chosen.room];
  const mine = personalClashes(chosen, { classes: data.classes.filter((c) => c.replacementId !== request.id), studySessions, bookings });
  const session = data.classes.find((c) => c.replacementId === request.id);
  return (
    <article className="card p-4 sm:p-5">
      <Header request={request} lost={lost} icon={<CalendarCheck size={20} />} tone="green" label="Replacement set" />
      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl bg-green-soft p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
        <div className="min-w-0">
          <p className="t-eyebrow !text-green">Replacement class</p>
          <p className="mt-1 text-[1.35rem] font-bold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">{dayLabelLong(chosen.day)}</p>
          <p className="text-[1rem] font-semibold tabular-nums">{chosen.start} to {chosen.end}</p>
          <p className="t-sub mt-0.5">{chosen.room}{room ? `, ${room.name}, ${PLACE_BY_ID[room.place]?.name}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <button onClick={() => onShowDay(chosen.day)} className="press btn btn-sm max-w-full [overflow-wrap:anywhere] btn-primary"><Eye size={15} /> Show in timetable</button>
          <Link href={`/hub?section=map&focus=${chosen.room}`} className="press btn btn-sm max-w-full [overflow-wrap:anywhere] btn-plain"><MapPin size={15} /> Find {chosen.room}</Link>
          {session && <button onClick={() => { download(`${COURSE_BY_ID[lost.courseId].code}-replacement.ics`, timetableICS([session])); showToast("Calendar file downloaded for the replacement class"); }} className="press btn btn-sm max-w-full [overflow-wrap:anywhere] btn-plain"><CalendarPlus size={15} /> Add to calendar</button>}
        </div>
      </div>
      {request.note && <p className="t-sub mt-3 break-words">Note from {LECTURER.name}: &ldquo;{request.note}&rdquo;</p>}
      {mine.length > 0 && (
        <div className="mt-3 rounded-2xl bg-orange-soft px-3.5 py-3 text-[0.88rem]">
          <p className="flex items-center gap-2 font-semibold text-orange"><AlertTriangle size={16} /> This overlaps something of yours</p>
          <ul className="mt-1 grid gap-0.5">{mine.map((m) => <li key={m} className="break-words">{m}</li>)}</ul>
          <p className="t-caption mt-1.5">Only you see this. Move it on <Link href="/" className="font-semibold text-accent underline-offset-2 hover:underline">Today</Link> or ask Compass to plan your week again.</p>
        </div>
      )}
    </article>
  );
}

function AskingCard({ request, lost, answers }: { request: ReplacementRequest; lost: ClassSession; answers: ReplacementAnswers }) {
  const { data } = useCampus();
  const { studySessions, bookings, showToast, hydrated } = useApp();
  const saved = answers[request.id]?.stamp === request.stamp ? answers[request.id].works : null;
  const checks = request.options.map((o) => personalClashes(o, { classes: data.classes, studySessions, bookings }));
  // Compass suggests an answer from the student's own timetable. The student decides before anything is shared.
  const suggested = Object.fromEntries(request.options.map((o, i) => [o.id, !checks[i].some((c) => c.startsWith("Clashes"))]));
  const [works, setWorks] = useState<Record<string, boolean>>(() => saved ?? suggested);
  const [error, setError] = useState("");
  const changed = !saved || request.options.some((o) => saved[o.id] !== works[o.id]);

  const send = () => {
    if (!hydrated) { setError("Compass is still loading. Try again in a moment."); return; }
    if (!writeAnswer(request, works, asMalaysiaIso(DEMO_NOW.getTime()))) { setError("Could not save your answer. Check that site storage is enabled in this browser, then try again."); return; }
    setError("");
    const yes = request.options.filter((o) => works[o.id]).length;
    showToast(`Answer saved: ${yes} of ${request.options.length} times work for you. The demo lecturer desk can see it.`);
  };

  return (
    <article className="card p-4 sm:p-5">
      <Header request={request} lost={lost} icon={<CalendarClock size={20} />} tone="orange" label="Your answer needed" />
      <p className="t-sub mt-4">{LECTURER.name} is choosing a replacement time. Which of these work for you?</p>
      <ul className="mt-3 grid gap-2">
        {request.options.map((o, i) => {
          const yes = works[o.id];
          return (
            <li key={o.id} className="grid grid-cols-1 gap-3 rounded-2xl p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style={{ background: "var(--surface-3)" }}>
              <div className="min-w-0">
                <p className="font-semibold tracking-[-0.01em]">{dayLabel(o.day)}, <span className="tabular-nums">{o.start} to {o.end}</span></p>
                <p className="t-caption">{o.room}{ROOM_BY_CODE[o.room] ? `, ${PLACE_BY_ID[ROOM_BY_CODE[o.room].place]?.name}` : ""}</p>
                {checks[i].length === 0
                  ? <p className="mt-1 flex items-center gap-1.5 text-[0.82rem] font-semibold text-green"><Check size={14} /> Free in your timetable</p>
                  : checks[i].map((c) => <p key={c} className="mt-1 flex items-start gap-1.5 text-[0.82rem] font-semibold text-orange"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{c}</span></p>)}
              </div>
              <div role="group" aria-label={`${dayLabel(o.day)} ${o.start}`} className="inline-flex rounded-full bg-surface p-1 shadow-sm">
                <button aria-pressed={yes === true} onClick={() => setWorks((w) => ({ ...w, [o.id]: true }))} className="press relative min-h-[36px] rounded-full px-3.5 text-[0.85rem] font-semibold" style={{ color: yes ? "#fff" : "var(--label-2)" }}>
                  {yes && <motion.span layoutId={`ans-${request.id}-${o.id}`} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-full bg-green" />}
                  <span className="relative inline-flex items-center gap-1"><Check size={14} /> Works</span>
                </button>
                <button aria-pressed={yes === false} onClick={() => setWorks((w) => ({ ...w, [o.id]: false }))} className="press relative min-h-[36px] rounded-full px-3.5 text-[0.85rem] font-semibold" style={{ color: yes === false ? "#fff" : "var(--label-2)" }}>
                  {yes === false && <motion.span layoutId={`ans-${request.id}-${o.id}`} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="absolute inset-0 rounded-full bg-red" />}
                  <span className="relative inline-flex items-center gap-1"><X size={14} /> Can&rsquo;t</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {request.note && <p className="t-sub mt-3 break-words">Note from {LECTURER.name}: &ldquo;{request.note}&rdquo;</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={send} disabled={!changed} className="press btn btn-primary disabled:opacity-45">{saved ? (changed ? "Update answer" : <><Check size={16} /> Answer saved</>) : "Send answer"}</button>
        <p className="t-caption flex min-w-0 flex-1 items-start gap-1.5"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-green" /> {saved ? "You can change it until a time is set. " : "Compass filled these in from your timetable. Check them before you send. "}The lecturer sees only which times work, not why.</p>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.85rem] font-semibold text-red">{error}</p>}
    </article>
  );
}
