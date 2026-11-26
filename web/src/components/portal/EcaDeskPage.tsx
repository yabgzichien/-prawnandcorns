"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Clock, Inbox, Info, Send, Undo2 } from "lucide-react";
import { useDecisions, useEventData } from "@/components/events/useEventData";
import { relatedApplications } from "@/lib/events/application";
import { CONDITION_CHIPS, ITEM_BY_ID, ITEM_OFFICE_RULES, VENUE_BY_ID, collectPlace, itemOffice } from "@/lib/events/catalogue";
import { checkApplication, dateLabel, daysBetween, freeVenues, issuesForLine, problemsOf } from "@/lib/events/checks";
import { AUTO_SWAP, applyDecisionBatch, deriveEventStatus, eventStatusOf, hasAnyDecision, lineDecision, pendingCount } from "@/lib/events/decisions";
import { readStoredDecisions, writeStoredDecisions } from "@/lib/events/storage";
import { ARRANGEMENT_LABEL, DECIDED, OFFICES, OFFICE_LABEL, lineOffice, type Decided, type EventApplication, type EventLine, type Issue, type LineDecision, type LineStatus, type Office } from "@/lib/events/types";
import { asMalaysiaIso } from "@/lib/planning";
import { DEMO_NOW } from "@/lib/time";
import { Badge, PButton, PCard, PageTitle, type PTone } from "./ui";

const TONE: Record<LineStatus, PTone> = { Pending: "gray", Approved: "green", "Approve With Condition": "orange", Rejected: "red" };
const SHORT: Record<Decided, string> = { Approved: "Approve", "Approve With Condition": "With condition", Rejected: "Reject" };
/** The desk's target for answering an application, in days. A demo target, not a university rule. */
const TARGET_DAYS = 3;

type LineDraft = { status: Decided; remark: string; assignedVenueId?: string; approvedQty?: number };
type Drafts = Record<string, Record<string, LineDraft>>;

const draftFrom = (d: LineDecision): LineDraft => ({ status: d.status, remark: d.remark ?? "", ...(d.assignedVenueId ? { assignedVenueId: d.assignedVenueId } : {}), ...(d.approvedQty ? { approvedQty: d.approvedQty } : {}) });
const same = (a: LineDraft | undefined, b: LineDraft | undefined) => !!a && !!b && a.status === b.status && a.remark.trim() === b.remark.trim() && a.assignedVenueId === b.assignedVenueId && a.approvedQty === b.approvedQty;
const ageOf = (app: EventApplication) => Math.max(0, daysBetween(app.submittedAt.slice(0, 10), DEMO_NOW.toISOString().slice(0, 10)));

function lineTitle(line: EventLine): string {
  if (line.kind === "venue") return `${VENUE_BY_ID[line.venueId]?.name ?? line.venueId}, ${VENUE_BY_ID[line.venueId]?.kind ?? "room"}`;
  if (line.kind === "item") return `${line.qty} x ${ITEM_BY_ID[line.itemId]?.name ?? line.itemId}`;
  return ARRANGEMENT_LABEL[line.arrangement];
}
function lineDetail(line: EventLine): string {
  if (line.kind === "venue") return `${dateLabel(line.date)}, ${line.start} to ${line.end}. Seats about ${VENUE_BY_ID[line.venueId]?.capacity ?? "?"}.`;
  if (line.kind === "item") { const r = ITEM_OFFICE_RULES[ITEM_BY_ID[line.itemId].office]; return `Collect ${dateLabel(line.collectDate)}, ${r.collect.start} to ${r.collect.end}. Return ${dateLabel(line.returnDate)}, ${r.return.start} to ${r.return.end}.`; }
  return `${dateLabel(line.date)}, ${line.start} to ${line.end}. ${line.description}`;
}

/**
 * The ECA office's side of club event applications. One card for each event, however many rooms and items it asks
 * for, with the checks done for you, one answer for each line, and one Send. Applications from the student's
 * Compass window appear here beside invented ones from other clubs. Only this window writes the decisions.
 */
export function EcaDeskPage() {
  const { all } = useEventData();
  const decisions = useDecisions();
  const reduce = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [office, setOffice] = useState<Office | "all">("all");
  const [eventChoice, setEventChoice] = useState<Record<string, LineStatus | "auto">>({});
  const [eventNote, setEventNote] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ text: string; undo?: () => void; error?: boolean } | null>(null);
  const undoRef = useRef<ReturnType<typeof readStoredDecisions> | null>(null);

  const queue = useMemo(() => [...all].sort((a, b) => Number(pendingCount(a, decisions) === 0) - Number(pendingCount(b, decisions) === 0) || a.submittedAt.localeCompare(b.submittedAt)), [all, decisions]);
  const selected = queue.find((a) => a.id === selectedId) ?? null;
  const stats = useMemo(() => {
    const waiting = queue.filter((a) => pendingCount(a, decisions) > 0);
    const lines = waiting.reduce((n, a) => n + pendingCount(a, decisions), 0);
    const oldest = waiting.reduce((n, a) => Math.max(n, ageOf(a)), 0);
    const total = queue.reduce((n, a) => n + a.lines.length, 0);
    return { waiting: waiting.length, lines, oldest, total, applications: queue.length };
  }, [queue, decisions]);

  const setDraft = useCallback((appId: string, lineId: string, next: LineDraft | null) => {
    setDrafts((cur) => {
      const app = { ...(cur[appId] ?? {}) };
      if (next) app[lineId] = next; else delete app[lineId];
      return { ...cur, [appId]: app };
    });
  }, []);

  const send = (app: EventApplication) => {
    const mine = drafts[app.id] ?? {};
    const batch: Record<string, LineDecision> = {};
    const at = asMalaysiaIso(DEMO_NOW.getTime());
    for (const line of app.lines) {
      const d = mine[line.id];
      const already = lineDecision(decisions, app.id, line.id);
      if (!d || same(d, already ? draftFrom(already) : undefined)) continue;
      const requestedRoom = line.kind === "venue" ? line.venueId : "";
      batch[line.id] = {
        status: d.status, updatedAt: at,
        ...(d.remark.trim() ? { remark: d.remark.trim().slice(0, 200) } : {}),
        ...(line.kind === "venue" && d.assignedVenueId && d.assignedVenueId !== requestedRoom ? { assignedVenueId: d.assignedVenueId } : {}),
        ...(line.kind === "item" && d.approvedQty && d.approvedQty !== line.qty ? { approvedQty: d.approvedQty } : {}),
      };
    }
    const count = Object.keys(batch).length;
    const choice = eventChoice[app.id] ?? "auto";
    if (count === 0 && choice === "auto" && !(eventNote[app.id] ?? "").trim()) { setNotice({ text: "Nothing new to send. Answer at least one line first.", error: true }); return; }
    const before = readStoredDecisions();
    const merged = applyDecisionBatch({ ...decisions }, app, batch, { sentAt: at, eventStatus: choice === "auto" ? undefined : choice, eventRemark: eventNote[app.id] });
    // keep only what the desk itself wrote, so the seeded answers are never copied into saved data
    const toSave = { ...before, [app.id]: merged[app.id] };
    if (!writeStoredDecisions(toSave)) { setNotice({ text: "Could not save. Check that site storage is enabled in this browser.", error: true }); return; }
    undoRef.current = before;
    setDrafts((cur) => ({ ...cur, [app.id]: {} }));
    setEventNote((cur) => ({ ...cur, [app.id]: "" }));
    setEventChoice((cur) => ({ ...cur, [app.id]: "auto" }));
    const status = merged[app.id].eventStatus;
    setNotice({
      text: `One decision sent for ${app.name}: ${count} line${count === 1 ? "" : "s"} answered, event status ${status}. The club sees it in Compass now.`,
      undo: () => { if (undoRef.current && writeStoredDecisions(undoRef.current)) setNotice({ text: "Decision taken back. The club sees the earlier answers again." }); },
    });
  };

  const list = (
    <ul className="grid gap-2" aria-label="Applications waiting for the ECA office">
      {queue.map((app) => {
        const left = pendingCount(app, decisions);
        const age = ageOf(app);
        const late = left > 0 && age >= TARGET_DAYS;
        const problems = problemsOf(checkApplication(app, all.filter((o) => o.id !== app.id), decisions)).length;
        const on = selected?.id === app.id;
        return (
          <li key={app.id}>
            <button onClick={() => setSelectedId(app.id)} aria-current={on ? "true" : undefined} className={`flex w-full min-h-[44px] flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-[background-color,border-color,transform] duration-100 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary)] ${on ? "border-[var(--p-primary)] bg-[var(--p-primary-soft)]" : "border-[var(--p-line)] bg-white hover:bg-[#fafbfd]"}`}>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.74rem] font-bold text-[var(--p-muted)]">{app.id}</span>
                <Badge tone={TONE[eventStatusOf(app, decisions)]}>{eventStatusOf(app, decisions)}</Badge>
                {late && <Badge tone="red"><Clock size={11} /> Waiting {age} days</Badge>}
                <ChevronRight size={15} className="ml-auto text-[var(--p-muted)]" aria-hidden />
              </span>
              <span className="break-words text-[0.95rem] font-semibold leading-snug">{app.name}</span>
              <span className="text-[0.8rem] text-[var(--p-muted)]">{app.organisers}, {dateLabel(app.date)}, {app.participants} people</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem] text-[var(--p-muted)]">
                <span>{app.lines.length - left} of {app.lines.length} lines answered</span>
                {problems > 0 && left > 0 && <span className="inline-flex items-center gap-1 font-semibold text-[var(--p-danger)]"><AlertTriangle size={12} /> {problems} to look at</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <PageTitle title="ECA Event Applications" crumbs={["Extracurricular Activities", "Event applications"]} />
      <p className="mb-4 max-w-3xl text-[0.92rem] leading-relaxed text-[var(--p-muted)]">A club sends one application for the whole event, with every room and item in it. Check it, answer each line, and send one decision back. The club sees it in Compass straight away.</p>

      <dl className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Queue summary">
        {[
          ["Waiting for an answer", `${stats.waiting} of ${stats.applications}`, "applications"],
          ["Lines still open", String(stats.lines), `of ${stats.total} lines asked for`],
          ["Oldest request", stats.waiting ? `${stats.oldest} days` : "None", `target ${TARGET_DAYS} days (demo)`],
          ["Messages to send", `${stats.waiting} not ${stats.lines}`, "one decision for each waiting application, not one email for each open line"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-[var(--p-line)] bg-white p-3.5">
            <dt className="text-[0.74rem] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">{label}</dt>
            <dd className="mt-1 text-[1.35rem] font-bold tracking-[-0.02em]">{value}</dd>
            <dd className="text-[0.76rem] text-[var(--p-muted)]">{hint}</dd>
          </div>
        ))}
      </dl>

      <div role="status" aria-live="polite" className="mb-3 min-h-[1px]">
        <AnimatePresence initial={false} mode="wait">
          {notice && (
            <motion.div key={notice.text} initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-[0.88rem] font-medium ${notice.error ? "border-[#f3b5c6] bg-[var(--p-danger-soft)] text-[var(--p-danger)]" : "border-[#b8e6c9] bg-[var(--p-success-soft)] text-[#0f7a37]"}`}>
              {notice.error ? <AlertTriangle size={16} /> : <Check size={16} strokeWidth={3} />}
              <span className="min-w-0 flex-1">{notice.text}</span>
              {notice.undo && <PButton small variant="light" onClick={() => { notice.undo?.(); }}><Undo2 size={13} /> Undo</PButton>}
              <button onClick={() => setNotice(null)} className="min-h-[34px] rounded-lg px-2 text-[0.8rem] font-semibold underline">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {queue.length === 0 ? (
        <PCard bodyClass="grid place-items-center gap-2 px-6 py-14 text-center"><Inbox size={26} className="text-[var(--p-muted)]" /><p className="font-semibold">No applications yet</p></PCard>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className={selected ? "hidden xl:block" : ""}>{list}</div>
          <div className={selected ? "" : "hidden xl:block"}>
            {selected ? (
              <ApplicationPanel
                key={selected.id}
                app={selected} all={all} decisions={decisions}
                drafts={drafts[selected.id] ?? {}} setDraft={setDraft}
                office={office} setOffice={setOffice}
                eventChoice={eventChoice[selected.id] ?? "auto"} setEventChoice={(v) => setEventChoice((c) => ({ ...c, [selected.id]: v }))}
                eventNote={eventNote[selected.id] ?? ""} setEventNote={(v) => setEventNote((c) => ({ ...c, [selected.id]: v }))}
                onSend={() => send(selected)} onBack={() => setSelectedId(null)} onOpenRelated={setSelectedId}
              />
            ) : (
              <PCard bodyClass="grid place-items-center gap-2 px-6 py-16 text-center text-[var(--p-muted)]"><Inbox size={26} /><p className="font-semibold text-[var(--p-ink)]">Choose an application</p><p className="max-w-xs text-[0.88rem]">Pick one from the queue to see its rooms, items and the checks already done for you.</p></PCard>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ApplicationPanel({ app, all, decisions, drafts, setDraft, office, setOffice, eventChoice, setEventChoice, eventNote, setEventNote, onSend, onBack, onOpenRelated }: {
  app: EventApplication; all: EventApplication[]; decisions: ReturnType<typeof useDecisions>;
  drafts: Record<string, LineDraft>; setDraft: (appId: string, lineId: string, d: LineDraft | null) => void;
  office: Office | "all"; setOffice: (o: Office | "all") => void;
  eventChoice: LineStatus | "auto"; setEventChoice: (v: LineStatus | "auto") => void;
  eventNote: string; setEventNote: (v: string) => void;
  onSend: () => void; onBack: () => void; onOpenRelated: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const others = useMemo(() => all.filter((o) => o.id !== app.id), [all, app.id]);
  const issues = useMemo(() => checkApplication(app, others, decisions), [app, others, decisions]);
  const related = useMemo(() => relatedApplications(app, all), [app, all]);
  const officeOf = (l: EventLine) => lineOffice(l, itemOffice);
  const counts = useMemo(() => Object.fromEntries(OFFICES.map((o) => [o, app.lines.filter((l) => officeOf(l) === o).length])) as Record<Office, number>, [app]);
  const shown = app.lines.filter((l) => office === "all" || officeOf(l) === office);

  const sent = (l: EventLine) => lineDecision(decisions, app.id, l.id);
  const current = (l: EventLine): LineDraft | undefined => drafts[l.id] ?? (sent(l) ? draftFrom(sent(l)!) : undefined);
  const dirty = app.lines.filter((l) => drafts[l.id] && !same(drafts[l.id], sent(l) ? draftFrom(sent(l)!) : undefined));
  const statusNow = (l: EventLine): LineStatus => current(l)?.status ?? "Pending";
  const suggested = deriveEventStatus(app.lines.map(statusNow));
  const readyToApprove = shown.filter((l) => statusNow(l) === "Pending" && problemsOf(issuesForLine(issues, l.id)).length === 0);
  const eventIssues = issues.filter((i) => !i.lineId && i.level !== "info");

  const approve = (l: EventLine) => setDraft(app.id, l.id, { status: "Approved", remark: l.kind === "item" ? `Collect from ${collectPlace(l.itemId)}.` : "" });

  return (
    <div className="grid gap-4">
      <button onClick={onBack} className="inline-flex min-h-[40px] items-center gap-1.5 self-start rounded-lg bg-[#eef1f5] px-3 text-[0.84rem] font-semibold xl:hidden"><ArrowLeft size={15} /> Back to queue</button>
      <PCard bodyClass="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.85rem] font-bold text-[var(--p-muted)]">{app.id}</span>
          <Badge tone={TONE[eventStatusOf(app, decisions)]}>{eventStatusOf(app, decisions)}</Badge>
          {app.seeded && <Badge tone="gray">Invented club</Badge>}
        </div>
        <h2 className="mt-2 break-words text-[1.2rem] font-bold tracking-[-0.01em]">{app.name}</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[0.86rem] sm:grid-cols-2">
          {[["Organiser", app.organisers], ["Date and time", `${dateLabel(app.date)}, ${app.start} to ${app.end}`], ["Participants", String(app.participants)], ["Applicant", `${app.applicant.name} (${app.applicant.id})`], ["Adviser", `${app.adviser.name}, ${app.adviser.email}`], ["Received", `${app.submittedAt.slice(0, 10)}, ${ageOf(app)} days ago`]].map(([k, v]) => (
            <div key={k} className="flex gap-2"><dt className="w-[96px] shrink-0 text-[var(--p-muted)]">{k}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>
          ))}
        </dl>
        {app.description && <p className="mt-3 text-[0.86rem] leading-relaxed text-[var(--p-muted)]">{app.description}</p>}
        {related.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#cfe0fb] bg-[var(--p-primary-soft)] px-3 py-2 text-[0.84rem]">
            <Info size={15} className="shrink-0 text-[var(--p-primary)]" />
            <span>The same club sent {related.length === 1 ? "another application" : `${related.length} other applications`} for this day:</span>
            {related.map((r) => <button key={r.id} onClick={() => onOpenRelated(r.id)} className="font-semibold text-[var(--p-primary)] underline">{r.id}</button>)}
          </p>
        )}
        {eventIssues.length > 0 && <IssueList issues={eventIssues} className="mt-3" />}
      </PCard>

      <PCard title="Rooms, items and arrangements" subtitle="Each line goes to the office that owns it. Here you can answer for any office so the demo can finish." bodyClass="p-0">
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--p-line)] p-3" role="group" aria-label="Show lines for">
          {(["all", ...OFFICES.filter((o) => counts[o] > 0)] as const).map((o) => {
            const on = office === o;
            const n = o === "all" ? app.lines.length : counts[o];
            return <button key={o} onClick={() => setOffice(o)} aria-pressed={on} className={`min-h-[34px] rounded-full px-3 text-[0.8rem] font-semibold transition-colors ${on ? "bg-[var(--p-ink)] text-white" : "bg-[#eef1f5] hover:bg-[#e3e8ee]"}`}>{o === "all" ? "All offices" : OFFICE_LABEL[o]} ({n})</button>;
          })}
        </div>
        <ul className="divide-y divide-[var(--p-line)]">
          {shown.map((line) => (
            <LineRow key={line.id} line={line} issues={issuesForLine(issues, line.id)} draft={current(line)} sentDecision={sent(line)} unsent={dirty.includes(line)}
              onChange={(d) => setDraft(app.id, line.id, d)} onApprove={() => approve(line)} others={others} decisions={decisions}
              taken={app.lines.filter((o) => o.kind === "venue" && o.id !== line.id).map((o) => (current(o)?.assignedVenueId ?? (o as { venueId: string }).venueId))} />
          ))}
        </ul>
      </PCard>

      <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }} className="sticky bottom-3 z-10 grid gap-3 rounded-xl border border-[var(--p-line)] bg-white/92 p-4 shadow-[0_8px_30px_rgba(24,28,50,0.12)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <PButton variant="light" small disabled={readyToApprove.length === 0} onClick={() => readyToApprove.forEach(approve)}><Check size={14} strokeWidth={3} /> Approve {readyToApprove.length} that pass the checks</PButton>
          <PButton className="sm:ml-auto" onClick={onSend} disabled={dirty.length === 0 && eventChoice === "auto" && !eventNote.trim()}><Send size={15} /> Send one decision{dirty.length ? ` (${dirty.length} line${dirty.length === 1 ? "" : "s"})` : ""}</PButton>
        </div>
        <p className="text-[0.8rem] leading-snug text-[var(--p-muted)]">
          {app.lines.filter((l) => statusNow(l) === "Pending").length === 0 ? "Every line has an answer." : `${app.lines.filter((l) => statusNow(l) === "Pending").length} lines have no answer yet and stay Pending for the club.`}{" "}
          {hasAnyDecision(app, decisions) ? "You can change an answer later. The club sees the newest one." : "The club gets one message for the whole event."}
        </p>
        <details className="group text-[0.84rem]">
          <summary className="min-h-[32px] cursor-pointer py-1 font-semibold text-[var(--p-primary)]">Event status and note to the club</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <label className="grid gap-1 text-[0.78rem] font-semibold">Event status
              <select value={eventChoice} onChange={(e) => setEventChoice(e.target.value as LineStatus | "auto")} className="min-h-[40px] rounded-lg border border-[var(--p-line)] bg-white px-2 text-[0.86rem] font-normal">
                <option value="auto">Automatic: {suggested}</option>
                {(["Pending", ...DECIDED] as const).map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[0.78rem] font-semibold">Note to the club (optional)
              <input value={eventNote} onChange={(e) => setEventNote(e.target.value.slice(0, 200))} placeholder="Please collect the items one day before" className="min-h-[40px] rounded-lg border border-[var(--p-line)] px-3 text-[0.86rem] font-normal outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
            </label>
          </div>
        </details>
      </motion.div>
    </div>
  );
}

function IssueList({ issues, className = "" }: { issues: Issue[]; className?: string }) {
  const icon = (i: Issue) => i.level === "problem" ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--p-danger)]" /> : i.level === "warning" ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--p-warn)]" /> : <Info size={14} className="mt-0.5 shrink-0 text-[var(--p-muted)]" />;
  const label = (i: Issue) => i.level === "problem" ? "Problem" : i.level === "warning" ? "Check" : "Note";
  return (
    <ul className={`grid gap-1 ${className}`} aria-label="Checks done for you">
      {issues.map((i) => <li key={i.id} className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-[0.82rem] leading-snug ${i.level === "problem" ? "bg-[var(--p-danger-soft)]" : i.level === "warning" ? "bg-[var(--p-warn-soft)]" : "bg-[#f4f6f9] text-[var(--p-muted)]"}`}>{icon(i)}<span><strong className="font-semibold">{label(i)}:</strong> {i.message}</span></li>)}
    </ul>
  );
}

function LineRow({ line, issues, draft, sentDecision, unsent, onChange, onApprove, others, decisions, taken }: {
  line: EventLine; issues: Issue[]; draft: LineDraft | undefined; sentDecision: LineDecision | undefined; unsent: boolean;
  onChange: (d: LineDraft | null) => void; onApprove: () => void; others: EventApplication[]; decisions: ReturnType<typeof useDecisions>; taken: string[];
}) {
  const owner = lineOffice(line, itemOffice);
  const status: LineStatus = draft?.status ?? "Pending";
  const chips = CONDITION_CHIPS[line.kind];
  const set = (patch: Partial<LineDraft>) => onChange({ status: "Approved", remark: "", ...draft, ...patch });
  // rooms that are free, that this application is not already using, and nearest in size to the one asked for
  const wantSeats = line.kind === "venue" ? VENUE_BY_ID[line.venueId]?.capacity ?? 0 : 0;
  const free = line.kind === "venue" ? freeVenues(line.date, line.start, line.end, 1, others, decisions, taken).sort((a, b) => Number(a.asked) - Number(b.asked) || Math.abs(a.capacity - wantSeats) - Math.abs(b.capacity - wantSeats) || a.id.localeCompare(b.id)) : [];
  const swap = line.kind === "venue" && draft?.assignedVenueId && draft.assignedVenueId !== line.venueId;
  const pick = (s: Decided) => {
    if (s === "Approved") return onApprove();
    set({ status: s });
  };
  const problems = problemsOf(issues).length > 0;
  return (
    <li className="grid gap-3 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-[0.95rem] font-semibold">{lineTitle(line)}</p>
          <p className="mt-0.5 text-[0.82rem] leading-snug text-[var(--p-muted)]">{lineDetail(line)}</p>
        </div>
        <Badge tone="blue">{OFFICE_LABEL[owner]}</Badge>
        {sentDecision && !unsent ? <Badge tone={TONE[sentDecision.status]}><Check size={11} strokeWidth={3} /> Sent: {sentDecision.status}</Badge> : <Badge tone={unsent ? "purple" : "gray"}>{unsent ? "Not sent yet" : "Pending"}</Badge>}
      </div>
      {issues.length > 0 && <IssueList issues={issues} />}
      <div role="group" aria-label={`Answer for ${lineTitle(line)}`} className="flex flex-wrap items-center gap-1.5">
        {DECIDED.map((s) => {
          const on = status === s && !!draft;
          const look = s === "Approved" ? "bg-[var(--p-success)] text-white" : s === "Rejected" ? "bg-[var(--p-danger)] text-white" : "bg-[#e49b0f] text-white";
          return <button key={s} onClick={() => pick(s)} aria-pressed={on} className={`min-h-[40px] rounded-lg px-3.5 text-[0.84rem] font-semibold transition-[transform,background-color,filter] duration-100 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary)] ${on ? look : "bg-[#eef1f5] text-[var(--p-ink)] hover:bg-[#e3e8ee]"}`}>{on && <Check size={13} strokeWidth={3} className="mr-1 inline" />}{SHORT[s]}</button>;
        })}
        {draft && unsent && <button onClick={() => onChange(null)} className="min-h-[40px] rounded-lg px-2.5 text-[0.82rem] font-semibold text-[var(--p-muted)] underline">Clear</button>}
        {problems && !draft && <span className="text-[0.78rem] font-medium text-[var(--p-danger)]">Has a problem, so it is left out of the bulk approve.</span>}
      </div>
      {draft && (
        <div className="grid gap-2.5 rounded-lg bg-[#f7f9fb] p-3">
          {line.kind === "venue" && (
            <label className="grid gap-1 text-[0.78rem] font-semibold">Room given
              <select value={draft.assignedVenueId ?? line.venueId} onChange={(e) => { const v = e.target.value; const keep = draft.remark.trim() && !AUTO_SWAP.test(draft.remark.trim()); set({ assignedVenueId: v, remark: keep ? draft.remark : v !== line.venueId ? `You asked for ${line.venueId}. ${v} is given instead.` : "", ...(v !== line.venueId ? { status: draft.status === "Rejected" ? "Rejected" as const : "Approve With Condition" as const } : {}) }); }} className="min-h-[40px] max-w-xs rounded-lg border border-[var(--p-line)] bg-white px-2 text-[0.86rem] font-normal">
                <option value={line.venueId}>{line.venueId} (as asked)</option>
                {free.filter((v) => v.id !== line.venueId).map((v) => <option key={v.id} value={v.id}>{v.id}, seats about {v.capacity}{v.asked ? ", also asked for" : ""}</option>)}
              </select>
              {swap && <span className="text-[0.76rem] font-normal text-[var(--p-muted)]">The club will see: you asked for {line.venueId}, you were given {draft.assignedVenueId}.</span>}
            </label>
          )}
          {line.kind === "item" && status !== "Rejected" && (
            <label className="grid gap-1 text-[0.78rem] font-semibold">Number approved
              <input type="number" min={1} max={line.qty} inputMode="numeric" value={draft.approvedQty ?? line.qty} onChange={(e) => { const n = Math.max(1, Math.min(line.qty, Math.floor(Number(e.target.value) || line.qty))); set({ approvedQty: n === line.qty ? undefined : n, ...(n < line.qty && draft.status === "Approved" ? { status: "Approve With Condition" as const } : {}) }); }} className="min-h-[40px] w-28 rounded-lg border border-[var(--p-line)] px-2 text-[0.86rem] font-normal" />
            </label>
          )}
          <label className="grid gap-1 text-[0.78rem] font-semibold">Remark for the club{status === "Approved" ? " (optional)" : ""}
            <input value={draft.remark} onChange={(e) => set({ remark: e.target.value.slice(0, 200) })} maxLength={200} placeholder={status === "Rejected" ? "Say why, so the club can change the plan" : "Add a condition or instruction"} className="min-h-[40px] rounded-lg border border-[var(--p-line)] bg-white px-3 text-[0.86rem] font-normal outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
          </label>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common remarks">
            {chips.map((c) => <button key={c} onClick={() => set({ remark: (draft.remark ? `${draft.remark.replace(/\s+$/, "")} ${c}` : c).slice(0, 200) })} className="min-h-[32px] rounded-full bg-white px-2.5 text-left text-[0.76rem] font-medium ring-1 ring-[var(--p-line)] hover:bg-[var(--p-primary-soft)]">{c.length > 46 ? `${c.slice(0, 44).trim()}...` : c}</button>)}
          </div>
        </div>
      )}
    </li>
  );
}

