"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, BookOpen, CalendarCheck, CalendarClock, CalendarSearch, Check, Clock3, DoorOpen, Ellipsis, Flag, FlaskConical, ListPlus, Lock, Plane, Presentation, Send, ShieldCheck, Sparkles, Undo2, UserX, Users, X, type LucideIcon } from "lucide-react";
import { COURSE_BY_ID, type ClassSession } from "@/lib/data/academics";
import { ROOM_BY_CODE } from "@/lib/data/campus";
import { asMalaysiaIso } from "@/lib/planning";
import { checkOption, clashSentence, evaluateWeek, optionFrom, plannerContext, sessionTitle, suggestSlots, usable, type PlannerContext, type SlotEval } from "@/lib/replacement/availability";
import { LECTURER } from "@/lib/replacement/cohort";
import { tallyOption } from "@/lib/replacement/poll";
import { nextRequestId, parseAnswers, parseRequests, writeRequests } from "@/lib/replacement/storage";
import { dayLabel, slotLabel } from "@/lib/replacement/time";
import { MAX_OPTIONS, NOTE_MAX, REASONS, REPLACEMENTS_KEY, REPLACEMENT_ANSWERS_KEY, type ReplacementReason, type ReplacementRequest, type SlotOption } from "@/lib/replacement/types";
import { atDay, DEMO_NOW } from "@/lib/time";
import { buildWorld } from "@/lib/world/world";
import { Badge, PButton, PCard, PModal, PageTitle } from "./ui";
import { useStored, useTriggered } from "./useScenario";

const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
const KIND_ICON: Record<string, LucideIcon> = { Lecture: Presentation, Lab: FlaskConical, Tutorial: Users };
const REASON_ICON: Record<ReplacementReason, LucideIcon> = { "Lecturer on leave": Plane, "Public holiday": Flag, Other: Ellipsis };
function ReasonIcon({ reason }: { reason: ReplacementReason }) { const Icon = REASON_ICON[reason]; return <Icon size={14} aria-hidden />; }
const StepTitle = ({ icon: Icon, children }: { icon: LucideIcon; children: string }) => <span className="inline-flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--p-primary-soft)] text-[var(--p-primary)]"><Icon size={15} /></span>{children}</span>;

/** Colour for a share of students free. Always shown together with the number. */
function heat(ratio: number): { bg: string; fg: string } {
  if (ratio >= 1) return { bg: "#13a54b", fg: "#ffffff" };
  if (ratio >= 0.9) return { bg: "#5cc27f", fg: "#06331a" };
  if (ratio >= 0.75) return { bg: "#c6ead2", fg: "#0f4f27" };
  if (ratio >= 0.5) return { bg: "#ffe7ad", fg: "#6b4700" };
  return { bg: "#fbd3dc", fg: "#8a0f33" };
}
const HATCH = "repeating-linear-gradient(135deg, #eef1f5 0 6px, #e3e7ee 6px 12px)";

type Confirm = { mode: "set"; option: SlotOption; eval: SlotEval } | { mode: "ask"; options: SlotOption[] };

/**
 * The lecturer's side of a replacement class. Pick the lost class, see when the whole class is free (from every
 * student's timetable, shown as counts only), then set a time or ask the students about a shortlist first.
 * Only this window writes the requests. Compass reads them and tells the student.
 */
export function LecturerDeskPage() {
  const triggered = useTriggered();
  const demoClasses = useMemo(() => buildWorld(triggered).classes, [triggered]);
  const requestsText = useStored(REPLACEMENTS_KEY);
  const answersText = useStored(REPLACEMENT_ANSWERS_KEY);
  const requests = useMemo(() => parseRequests(requestsText), [requestsText]);
  const answers = useMemo(() => parseAnswers(answersText), [answersText]);

  const sessions = useMemo(() => LECTURER.sessionIds.map((id) => demoClasses.find((c) => c.id === id)).filter((c): c is ClassSession => !!c), [demoClasses]);
  const upcoming = (c: ClassSession) => atDay(c.day, c.start).getTime() > DEMO_NOW.getTime();
  const [sessionId, setSessionId] = useState(() => sessions.filter(upcoming).at(-1)?.id ?? "c11");
  const existing = requests.find((r) => r.sessionId === sessionId);
  const [reasonFor, setReasonFor] = useState<Record<string, ReplacementReason>>({});
  const reason = reasonFor[sessionId] ?? existing?.reason ?? "Lecturer on leave";
  const [note, setNote] = useState("");

  const ctx = useMemo(() => plannerContext(sessionId, reason, demoClasses, DEMO_NOW), [sessionId, reason, demoClasses]);
  const week = useMemo(() => (ctx ? evaluateWeek(ctx) : []), [ctx]);
  const suggestions = useMemo(() => suggestSlots(week), [week]);

  const [pick, setPick] = useState<{ day: number; start: string } | null>(null);
  const selected = (pick && week.flat().find((e) => e.day === pick.day && e.start === pick.start)) || suggestions[0] || null;
  const [roomPick, setRoomPick] = useState<string | null>(null);
  const room = selected && roomPick && selected.rooms.includes(roomPick) ? roomPick : selected?.rooms[0] ?? null;
  const [shortlist, setShortlist] = useState<SlotOption[]>([]);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: () => void; error?: boolean } | null>(null);
  const undoRef = useRef<ReplacementRequest[] | null>(null);

  const chooseSession = (id: string) => { setSessionId(id); setPick(null); setRoomPick(null); setShortlist([]); setNotice(null); };
  const choose = (e: SlotEval) => { setPick({ day: e.day, start: e.start }); setRoomPick(null); };

  const save = (next: ReplacementRequest[], text: string) => {
    const before = requests;
    if (!writeRequests(next)) { setNotice({ text: "Could not save. Check that site storage is enabled in this browser.", error: true }); return false; }
    undoRef.current = before;
    setNotice({ text, undo: () => { if (undoRef.current && writeRequests(undoRef.current)) setNotice({ text: "Taken back. Compass shows the class as it was before." }); } });
    return true;
  };

  const base = (status: ReplacementRequest["status"]): Omit<ReplacementRequest, "options" | "chosen"> => ({
    id: existing?.id ?? nextRequestId(requests), stamp: Date.now().toString(36), courseId: LECTURER.courseId, sessionId, reason,
    note: note.trim().slice(0, NOTE_MAX) || existing?.note || "", status, updatedAt: asMalaysiaIso(DEMO_NOW.getTime()),
  });

  const publish = (option: SlotOption) => {
    if (!ctx) return;
    const check = checkOption(ctx, option);
    if (!check.ok) { setNotice({ text: check.error, error: true }); setConfirm(null); return; }
    const req: ReplacementRequest = { ...base("scheduled"), options: [], chosen: option };
    if (save([...requests.filter((r) => r.id !== req.id), req], `Replacement set for ${slotLabel(option)} in ${option.room}. ${ctx.cohort.length} students see it in Compass now.`)) { setShortlist([]); setNote(""); }
    setConfirm(null);
  };

  const ask = (options: SlotOption[]) => {
    if (!ctx) return;
    for (const o of options) {
      const check = checkOption(ctx, o);
      if (!check.ok) { setNotice({ text: `${slotLabel(o)}: ${check.error}`, error: true }); setConfirm(null); return; }
    }
    const req: ReplacementRequest = { ...base("asking"), options };
    if (save([...requests.filter((r) => r.id !== req.id), req], `Asked ${ctx.cohort.length} students about ${options.length} times. Their answers appear below as they come in.`)) { setShortlist([]); setNote(""); }
    setConfirm(null);
  };

  const withdraw = (r: ReplacementRequest) => save(requests.filter((x) => x.id !== r.id), `Withdrawn. The ${sessionTitle(ctx?.session ?? sessions[0])} is back on its usual time in Compass.`);

  const inShortlist = (o: { day: number; start: string }) => shortlist.some((s) => s.day === o.day && s.start === o.start);
  const lost = ctx?.session;

  return (
    <>
      <PageTitle title="Replacement Classes" crumbs={["Teaching", "Replacement Classes"]}>
        <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[0.82rem] shadow-[0_1px_3px_rgba(24,28,50,0.06)]"><Users size={15} className="text-[var(--p-primary)]" /> {LECTURER.name}, {COURSE_BY_ID[LECTURER.courseId].code} {COURSE_BY_ID[LECTURER.courseId].title}</span>
      </PageTitle>
      <p className="mb-5 max-w-3xl text-[0.92rem] leading-relaxed text-[var(--p-muted)]">
        Lost a class to a public holiday or leave? Pick it, and the desk checks every enrolled student&rsquo;s timetable, your own classes and the rooms. Set a time at once, or ask the students about a few times first. Students see the result in Compass.
      </p>

      <AnimatePresence>
        {notice && (
          <motion.div role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[0.88rem] font-medium ${notice.error ? "bg-[var(--p-danger-soft)] text-[var(--p-danger)]" : "bg-[var(--p-success-soft)] text-[#0f6b33]"}`}>
            {notice.error ? <AlertTriangle size={16} /> : <Check size={16} />}
            <span className="min-w-0 flex-1">{notice.text}</span>
            {notice.undo && <PButton small variant="light" onClick={notice.undo}><Undo2 size={13} /> Undo</PButton>}
            <button onClick={() => setNotice(null)} aria-label="Dismiss message" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <PCard title={<StepTitle icon={BookOpen}>1. Which class is lost?</StepTitle>} subtitle="Your classes this week. A class that has already happened cannot be replaced here." className="mb-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Class to replace">
          {sessions.map((c) => {
            const on = c.id === sessionId;
            const open = upcoming(c);
            const req = requests.find((r) => r.sessionId === c.id);
            const KindIcon = KIND_ICON[c.kind] ?? BookOpen;
            return (
              <button key={c.id} role="radio" aria-checked={on} disabled={!open} onClick={() => chooseSession(c.id)}
                className={`flex min-h-[44px] flex-col gap-1 rounded-xl border p-3.5 text-left transition-[background-color,border-color,transform] duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary)] ${on ? "border-[var(--p-primary)] bg-[var(--p-primary-soft)]" : "border-[var(--p-line)] bg-white hover:bg-[#fafbfd]"}`}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${on ? "bg-white text-[var(--p-primary)]" : "bg-[#eef1f5] text-[var(--p-muted)]"}`} aria-hidden><KindIcon size={15} /></span>
                  <span className="text-[0.95rem] font-semibold">{sessionTitle(c)}</span>
                  {!open && <Badge tone="gray"><Lock size={11} /> Already taught</Badge>}
                  {req?.status === "scheduled" && <Badge tone="green">Replacement set</Badge>}
                  {req?.status === "asking" && <Badge tone="orange">Asking students</Badge>}
                </span>
                <span className="text-[0.82rem] text-[var(--p-muted)]">{dayLabel(c.day)}, {c.start} to {c.end}, {c.room}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
          <fieldset>
            <legend className="mb-1.5 text-[0.8rem] font-semibold text-[var(--p-muted)]">Why it is lost</legend>
            <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#eef1f5] p-1">
              {REASONS.map((r) => (
                <button key={r} aria-pressed={reason === r} onClick={() => { setReasonFor((cur) => ({ ...cur, [sessionId]: r })); setPick(null); }} className={`relative min-h-[36px] rounded-lg px-3 text-[0.84rem] font-semibold transition-colors ${reason === r ? "text-[var(--p-ink)]" : "text-[var(--p-muted)] hover:text-[var(--p-ink)]"}`}>
                  {reason === r && <motion.span layoutId="reason-pill" transition={SPRING} className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgba(24,28,50,0.12)]" />}
                  <span className="relative inline-flex items-center gap-1.5"><ReasonIcon reason={r} />{r}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[0.8rem] font-semibold text-[var(--p-muted)]">Note to students (optional)</span>
            <input value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder={existing?.note || "For example: bring your Lab 6 code"} className="min-h-[40px] w-full rounded-lg border border-[var(--p-line)] bg-white px-3 text-[0.9rem] outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
          </label>
        </div>
      </PCard>

      {existing && ctx && <RequestCard request={existing} ctx={ctx} answers={answers} onSet={(o) => { const e = week.flat().find((x) => x.day === o.day && x.start === o.start); if (e) setConfirm({ mode: "set", option: o, eval: e }); }} onWithdraw={() => withdraw(existing)} />}

      {ctx && lost ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <PCard title={<StepTitle icon={CalendarSearch}>2. Pick a time</StepTitle>} subtitle={`${ctx.cohort.length} students enrolled. Each square shows how many are free for the whole ${(toLength(lost))} class.`}>
            {suggestions.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--p-muted)]"><Sparkles size={14} className="text-[var(--p-primary)]" /> Best times this week</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => {
                    const on = selected?.day === s.day && selected.start === s.start;
                    return (
                      <button key={`${s.day}-${s.start}`} onClick={() => choose(s)} aria-pressed={on} className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-left text-[0.84rem] transition-[background-color,border-color,transform] duration-100 active:scale-[0.97] ${on ? "border-[var(--p-primary)] bg-[var(--p-primary-soft)]" : "border-[var(--p-line)] bg-white hover:bg-[#fafbfd]"}`}>
                        {i === 0 && <Badge tone="blue">Best</Badge>}
                        <span><span className="font-semibold">{dayLabel(s.day)}, {s.start}</span><span className="block text-[0.76rem] text-[var(--p-muted)]">{s.free} of {s.total} free{s.flags.length ? `, ${s.flags.join(", ").toLowerCase()}` : ""}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Legend />
            <Heatmap week={week} selected={selected} onSelect={choose} shortlist={shortlist} />
            <p className="mt-3 flex items-start gap-2 text-[0.78rem] leading-relaxed text-[var(--p-muted)]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#0f7a37]" /> Only counts are shown. The desk reads class timetables, never a student&rsquo;s personal plans, and does not list who is busy.</p>
          </PCard>

          <div className="xl:sticky xl:top-[76px]">
            <PCard title={<StepTitle icon={Clock3}>3. Selected time</StepTitle>}>
              {selected ? (
                <>
                  {/* the new time arrives at once; no exit phase, so nothing on screen ever belongs to the previous time */}
                  <motion.div key={`${selected.day}-${selected.start}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, duration: 0.25 }}>
                    <SlotDetail e={selected} room={room} onRoom={setRoomPick} ctx={ctx} />
                  </motion.div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <PButton disabled={!usable(selected) || !room} onClick={() => room && setConfirm({ mode: "set", option: optionFrom(selected, room), eval: selected })}><CalendarCheck size={16} /> Set as replacement</PButton>
                    <PButton variant="light" disabled={!usable(selected) || !room || inShortlist(selected) || shortlist.length >= MAX_OPTIONS} onClick={() => room && setShortlist((cur) => (cur.some((s) => s.day === selected.day && s.start === selected.start) ? cur : [...cur, optionFrom(selected, room)].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))))}>
                      <ListPlus size={16} /> {inShortlist(selected) ? "In your shortlist" : shortlist.length >= MAX_OPTIONS ? `Shortlist full (${MAX_OPTIONS})` : "Add to shortlist to ask students"}
                    </PButton>
                  </div>
                </>
              ) : (
                <p className="text-[0.88rem] text-[var(--p-muted)]">No time this week passes every check. Try another reason, or the class may need to move to next week.</p>
              )}

              <div className="mt-5 border-t border-[var(--p-line)] pt-4">
                <p className="mb-2 text-[0.8rem] font-semibold text-[var(--p-muted)]">Shortlist ({shortlist.length} of {MAX_OPTIONS})</p>
                {shortlist.length === 0 ? (
                  <p className="text-[0.82rem] leading-relaxed text-[var(--p-muted)]">Timetables miss part-time work and travel. Add two or three times and ask the students which work.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-1.5">
                    <AnimatePresence initial={false}>
                      {shortlist.map((o) => (
                        <motion.li key={o.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={SPRING} className="flex items-center gap-2 rounded-lg bg-[#f5f8fa] px-3 py-2 text-[0.84rem]">
                          <span className="min-w-0 flex-1"><span className="font-semibold">{slotLabel(o)}</span>, {o.room}</span>
                          <button onClick={() => setShortlist((cur) => cur.filter((x) => x.id !== o.id))} aria-label={`Remove ${slotLabel(o)} from the shortlist`} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-black/5"><X size={14} /></button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
                <PButton variant="light" className="mt-3 w-full" disabled={shortlist.length < 2} onClick={() => setConfirm({ mode: "ask", options: shortlist })}><Send size={15} /> {shortlist.length < 2 ? "Add at least 2 times to ask" : `Ask students about ${shortlist.length} times`}</PButton>
              </div>
            </PCard>
          </div>
        </div>
      ) : (
        <PCard bodyClass="p-6 text-[0.9rem] text-[var(--p-muted)]">This class is not in the timetable any more.</PCard>
      )}

      <PModal open={!!confirm} title={confirm?.mode === "ask" ? "Ask the students?" : "Publish the replacement?"} onClose={() => setConfirm(null)}>
        {confirm && lost && ctx && (
          <div className="grid grid-cols-1 gap-4 text-[0.9rem] leading-relaxed">
            <p><strong>{sessionTitle(lost)}</strong> on {dayLabel(lost.day)} at {lost.start} is marked cancelled ({reason.toLowerCase()}) in every enrolled student&rsquo;s Compass.</p>
            {confirm.mode === "set" ? (
              <>
                <div className="rounded-xl bg-[var(--p-primary-soft)] p-4">
                  <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[#1556c0]">New time</p>
                  <p className="mt-1 text-[1.1rem] font-bold tracking-[-0.01em]">{slotLabel(confirm.option)}</p>
                  <p className="text-[var(--p-muted)]">{confirm.option.room}, {ROOM_BY_CODE[confirm.option.room]?.name}. {confirm.eval.free} of {confirm.eval.total} students are free by their timetables.</p>
                </div>
                <p className="text-[var(--p-muted)]">{ctx.cohort.length} students get a notification and see the class in their timetable. You can change or withdraw it later.</p>
              </>
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-1.5">{confirm.options.map((o) => <li key={o.id} className="rounded-lg bg-[#f5f8fa] px-3 py-2"><strong>{slotLabel(o)}</strong>, {o.room}</li>)}</ul>
                <p className="text-[var(--p-muted)]">Students answer in Compass with &ldquo;works&rdquo; or &ldquo;does not work&rdquo; for each time, nothing more. You then set the final time here.</p>
              </>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <PButton variant="light" onClick={() => setConfirm(null)}>Cancel</PButton>
              {confirm.mode === "set" ? <PButton onClick={() => publish(confirm.option)}><CalendarCheck size={16} /> Publish to {ctx.cohort.length} students</PButton> : <PButton onClick={() => ask(confirm.options)}><Send size={15} /> Ask {ctx.cohort.length} students</PButton>}
            </div>
          </div>
        )}
      </PModal>
    </>
  );
}

const toLength = (c: ClassSession) => {
  const [sh, sm] = c.start.split(":").map(Number);
  const [eh, em] = c.end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins % 60 === 0 ? `${mins / 60} hour` : `${mins} minute`;
};

function Legend() {
  const items = [
    { label: "Everyone", ...heat(1) },
    { label: "90% or more", ...heat(0.95) },
    { label: "75% or more", ...heat(0.8) },
    { label: "Half or more", ...heat(0.6) },
    { label: "Under half", ...heat(0.2) },
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.76rem] text-[var(--p-muted)]" aria-hidden>
      <span className="font-semibold">Students free:</span>
      {items.map((i) => <span key={i.label} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px]" style={{ background: i.bg }} />{i.label}</span>)}
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px]" style={{ background: HATCH }} />Not possible</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] border border-dashed border-[#6b7186]" />No free room</span>
    </div>
  );
}

/** A table of buttons: one row for each start time, one column for each day. Arrow keys move between times. */
function Heatmap({ week, selected, onSelect, shortlist }: { week: SlotEval[][]; selected: SlotEval | null; onSelect: (e: SlotEval) => void; shortlist: SlotOption[] }) {
  const reduce = useReducedMotion();
  const tableRef = useRef<HTMLTableElement>(null);
  const rows = week[0]?.length ?? 0;
  const focusCell = (d: number, r: number) => {
    const e = week[d]?.[r];
    if (!e) return;
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${d}-${r}"]`)?.focus();
    onSelect(e);
  };
  const onKey = (ev: KeyboardEvent<HTMLButtonElement>, d: number, r: number) => {
    const move = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
    if (!move) return;
    ev.preventDefault();
    focusCell(Math.min(week.length - 1, Math.max(0, d + move[0])), Math.min(rows - 1, Math.max(0, r + move[1])));
  };
  const isSel = (e: SlotEval) => selected?.day === e.day && selected.start === e.start;
  const listed = (e: SlotEval) => shortlist.some((s) => s.day === e.day && s.start === e.start);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table ref={tableRef} className="w-full min-w-[230px] border-separate [border-spacing:3px]" aria-label="Students free at each start time">
        <thead>
          <tr>
            <th className="w-10 sm:w-12" scope="col"><span className="sr-only">Start time</span></th>
            {week.map((d) => <th key={d[0].day} scope="col" className="pb-1 text-center text-[0.78rem] font-semibold text-[var(--p-ink)]">{dayLabel(d[0].day).split(" ")[0]}<span className="block whitespace-nowrap text-[0.72rem] font-medium text-[var(--p-muted)]">{dayLabel(d[0].day).split(" ")[1]}<span className="hidden sm:inline"> {dayLabel(d[0].day).split(" ")[2]}</span></span></th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => {
            const start = week[0][r].start;
            return (
              <tr key={start}>
                <th scope="row" className="pr-1 text-right align-middle text-[0.72rem] font-medium tabular-nums text-[var(--p-muted)]">{start.endsWith(":00") ? start : <span className="sr-only">{start}</span>}</th>
                {week.map((day, d) => {
                  const e = day[r];
                  const sel = isSel(e);
                  const ok = !e.blocked;
                  const noRoom = ok && e.rooms.length === 0;
                  const h = heat(e.free / e.total);
                  const label = e.blocked
                    ? `${dayLabel(e.day)}, ${e.start} to ${e.end}. Not possible: ${e.blocked}.`
                    : `${dayLabel(e.day)}, ${e.start} to ${e.end}. ${e.free} of ${e.total} students free.${noRoom ? " No free room." : ""}${e.flags.filter((f) => f !== "No free room").length ? ` ${e.flags.filter((f) => f !== "No free room").join(", ")}.` : ""}`;
                  return (
                    <td key={d} className="p-0">
                      <motion.button
                        data-cell={`${d}-${r}`}
                        tabIndex={sel || (!selected && d === 0 && r === 0) ? 0 : -1}
                        aria-label={label}
                        aria-pressed={sel}
                        onClick={() => onSelect(e)}
                        onKeyDown={(ev) => onKey(ev, d, r)}
                        whileTap={reduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                        className={`relative grid h-7 w-full min-w-[30px] sm:min-w-[38px] place-items-center rounded-md text-[0.72rem] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-primary)] focus-visible:ring-offset-1 sm:h-[26px] ${noRoom ? "border border-dashed border-[#6b7186]" : ""}`}
                        style={{ background: ok ? (noRoom ? "#ffffff" : h.bg) : HATCH, color: ok ? (noRoom ? "#4b5266" : h.fg) : "#9aa1b3" }}
                      >
                        {ok ? e.free : ""}
                        {listed(e) && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--p-primary)] ring-1 ring-white" aria-hidden />}
                        {sel && <motion.span layoutId="heat-sel" transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="pointer-events-none absolute -inset-[3px] rounded-[9px] border-2 border-[var(--p-ink)]" aria-hidden />}
                      </motion.button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SlotDetail({ e, room, onRoom, ctx }: { e: SlotEval; room: string | null; onRoom: (r: string) => void; ctx: PlannerContext }) {
  const share = e.free / e.total;
  return (
    <div>
      <p className="text-[1.25rem] font-bold leading-tight tracking-[-0.02em]">{dayLabel(e.day)}</p>
      <p className="text-[0.95rem] font-medium text-[var(--p-muted)]">{e.start} to {e.end}</p>
      {e.flags.filter((f) => f !== "No free room").length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{e.flags.filter((f) => f !== "No free room").map((f) => <Badge key={f} tone="orange">{f}</Badge>)}</div>}

      {e.blocked ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--p-danger-soft)] px-3 py-2.5 text-[0.86rem] font-medium text-[var(--p-danger)]"><Lock size={15} className="mt-0.5 shrink-0" /> Not possible: {e.blocked}.</p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[0.9rem]"><span className="text-[1.6rem] font-bold tabular-nums tracking-[-0.03em]">{e.free}</span> <span className="text-[var(--p-muted)]">of {e.total} students free</span></p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1f5]" role="img" aria-label={`${Math.round(share * 100)} percent of students free`}>
              <motion.div className="h-full rounded-full" style={{ background: share >= 0.75 ? "#13a54b" : share >= 0.5 ? "#e0a100" : "#d6194f" }} initial={false} animate={{ width: `${share * 100}%` }} transition={SPRING} />
            </div>
          </div>
          {e.clashes.length > 0 ? (
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[0.8rem] font-semibold text-[var(--p-muted)]"><UserX size={14} aria-hidden /> Who cannot come</p>
              <ul className="grid grid-cols-1 gap-1 text-[0.86rem]">{e.clashes.slice(0, 5).map((c) => <li key={c.label} className="flex items-start gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--p-danger)]" aria-hidden />{clashSentence(c)}</li>)}</ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 text-[0.86rem] font-medium text-[#0f7a37]"><Check size={15} /> Every student is free by their timetable.</p>
          )}
          <fieldset className="mt-4">
            <legend className="mb-1.5 text-[0.8rem] font-semibold text-[var(--p-muted)]">Room ({e.total} seats needed)</legend>
            {e.rooms.length === 0 ? (
              <p className="text-[0.86rem] text-[var(--p-danger)]">No suitable room is free then.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {e.rooms.slice(0, 6).map((r) => (
                  <button key={r} aria-pressed={room === r} onClick={() => onRoom(r)} className={`min-h-[36px] rounded-lg border px-2.5 text-[0.8rem] font-semibold transition-colors ${room === r ? "border-[var(--p-primary)] bg-[var(--p-primary-soft)] text-[#1556c0]" : "border-[var(--p-line)] bg-white hover:bg-[#fafbfd]"}`}>
                    <DoorOpen size={13} className="mr-1 inline-block align-[-2px]" aria-hidden />{r}<span className="ml-1 font-medium text-[var(--p-muted)]">{ROOM_BY_CODE[r]?.seats} seats{r === ctx.session.room ? ", usual room" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </fieldset>
        </>
      )}
    </div>
  );
}

function RequestCard({ request, ctx, answers, onSet, onWithdraw }: { request: ReplacementRequest; ctx: PlannerContext; answers: ReturnType<typeof parseAnswers>; onSet: (o: SlotOption) => void; onWithdraw: () => void }) {
  if (request.status === "scheduled" && request.chosen) {
    return (
      <PCard className="mb-5 border-[#bfe6c9]" bodyClass="flex flex-wrap items-center gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--p-success-soft)] text-[#0f7a37]"><CalendarCheck size={20} /></span>
        <div className="min-w-0 flex-1 basis-[12rem] [overflow-wrap:anywhere]">
          <p className="text-[0.78rem] font-semibold text-[var(--p-muted)]">{request.id}, published to {ctx.cohort.length} students</p>
          <p className="text-[1.05rem] font-semibold">Replacement set: {slotLabel(request.chosen)} in {request.chosen.room}</p>
          <p className="text-[0.84rem] text-[var(--p-muted)]">To change it, pick another time below and set it. Students are told again.</p>
        </div>
        <PButton variant="danger" small onClick={onWithdraw}>Withdraw</PButton>
      </PCard>
    );
  }
  return (
    <PCard className="mb-5" title={<span className="inline-flex items-center gap-2"><CalendarClock size={17} className="text-[#a35200]" /> Asking students</span>} subtitle={`${request.id}. Answers so far for each time. Pick the one that suits most people.`} action={<PButton variant="danger" small onClick={onWithdraw}>Withdraw</PButton>}>
      <ul className="grid grid-cols-1 gap-3">
        {request.options.map((o) => {
          const t = tallyOption(ctx, request, o, answers);
          const pct = (n: number) => `${(n / t.total) * 100}%`;
          return (
            <li key={o.id} className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--p-line)] p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="font-semibold">{slotLabel(o)}, {o.room}</p>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-[#eef1f5]" role="img" aria-label={`${t.works} can come, ${t.cannot} cannot, ${t.noAnswer} have not answered`}>
                  <motion.span className="h-full bg-[#13a54b]" initial={false} animate={{ width: pct(t.works) }} transition={SPRING} />
                  <motion.span className="h-full bg-[#d6194f]" initial={false} animate={{ width: pct(t.cannot) }} transition={SPRING} />
                </div>
                <p className="mt-1.5 text-[0.8rem] text-[var(--p-muted)]"><strong className="text-[#0f7a37]">{t.works} can come</strong>, <strong className="text-[var(--p-danger)]">{t.cannot} cannot</strong>, {t.noAnswer} have not answered. {t.demoStudent === null ? "The demo student has not answered in Compass yet." : `Includes the answer sent from Compass (${t.demoStudent ? "works" : "does not work"}).`}</p>
              </div>
              <PButton small onClick={() => onSet(o)}><CalendarCheck size={14} /> Set this time</PButton>
            </li>
          );
        })}
      </ul>
    </PCard>
  );
}
