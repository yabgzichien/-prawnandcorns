"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Mail, Pencil, Undo2 } from "lucide-react";
import { checkFix, type FixCheck } from "@/lib/updates/validate";
import type { Fix, UpdatesProposal } from "@/lib/updates/types";
import { classBlocksFrom, tasksFrom } from "@/lib/planning-demo";
import { asMalaysiaIso, type StudySession } from "@/lib/planning";
import { composeLecturerEmail, mailtoHref } from "@/lib/email";
import { DEMO_NOW, dateShort, dayShort, timeOf } from "@/lib/time";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { Pill } from "@/components/ui/kit";

const when = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}` : "invalid time"; };
const range = (a: string, b: string) => `${when(a)} to ${timeOf(new Date(b))}`;
const isChange = (f: Fix) => f.type === "move_study_session" || f.type === "remove_study_session" || f.type === "add_reminder" || f.type === "add_calendar_event";
const editable = (f: Fix) => f.type === "move_study_session" || f.type === "add_reminder" || f.type === "add_calendar_event";

function title(fix: Fix, sessions: StudySession[]): string {
  switch (fix.type) {
    case "move_study_session": {
      const s = sessions.find((x) => x.id === fix.sessionId);
      return `Move study session "${s?.title ?? fix.sessionId}"${s ? ` from ${range(s.start, s.end)}` : ""} to ${range(fix.start, fix.end)}`;
    }
    case "remove_study_session": return `Remove study session "${sessions.find((x) => x.id === fix.sessionId)?.title ?? fix.sessionId}"`;
    case "add_reminder": return `Add reminder: ${fix.title} (${when(fix.at)})`;
    case "add_calendar_event": return `Add to your calendar: ${fix.title}, ${range(fix.start, fix.end)}${fix.place ? `, ${fix.place}` : ""}`;
    case "acknowledge": return fix.summary;
    case "ask_question": return fix.question;
  }
}

const local = (iso: string) => iso.slice(0, 16);
const fromLocal = (v: string) => `${v}:00+08:00`;

/**
 * The approval card. The agent proposes; nothing here is saved until the student approves.
 * Each row can be unticked or edited, and a single Undo restores the plan as it was.
 */
export function UpdatesCard({ card }: { card: { proposal: UpdatesProposal } }) {
  const { studySessions, reminders, personalEvents, submitted, applyUpdates, undoLastApply, lastApply, showToast } = useApp();
  const { data, changes } = useCampus();
  const { proposal } = card;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(proposal.fixes.filter((f) => f.type !== "ask_question").map((f) => f.id)));
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, "asked" | "ignored">>({});
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "review" } | { kind: "saved"; applyId: number; summary: string } | { kind: "rejected" }>({ kind: "review" });
  const [error, setError] = useState("");

  const effective = useMemo(() => proposal.fixes.map((f): Fix => ({ ...f, ...(edits[f.id] ?? {}) } as Fix)), [proposal.fixes, edits]);
  const plan = useMemo(() => ({ studySessions, reminders, personalEvents }), [studySessions, reminders, personalEvents]);
  const ctx = useMemo(() => ({
    now: asMalaysiaIso(DEMO_NOW.getTime()), tasks: tasksFrom(data.assignments, submitted), classBlocks: classBlocksFrom(data.classes),
    changeIds: new Set(changes.map((c) => c.id)),
  }), [data, submitted, changes]);
  const reviewing = status.kind === "review";
  const checks = useMemo(() => new Map<string, FixCheck>(effective.map((f) => [f.id, reviewing ? checkFix(f, plan, ctx) : { ok: true } as FixCheck])), [effective, plan, ctx, reviewing]);
  const chosen = effective.filter((f) => selected.has(f.id) && f.type !== "ask_question");
  const answered = effective.filter((f) => f.type === "ask_question" && answers[f.id]);
  const blocked = chosen.filter((f) => checks.get(f.id)?.ok === false);

  if (status.kind === "rejected") {
    return <div className="rounded-2xl bg-surface p-4 text-[0.9rem] font-medium" role="status">Rejected. Nothing was saved, and these updates are still waiting for review.</div>;
  }
  if (status.kind === "saved") {
    const canUndo = lastApply?.id === status.applyId;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4" role="status">
        <p className="min-w-0 flex-1 text-[0.9rem] font-medium">{status.summary}</p>
        {canUndo && <button onClick={() => { if (undoLastApply()) setStatus({ kind: "review" }); }} className="press btn btn-sm btn-tint"><Undo2 size={14} /> Undo</button>}
      </div>
    );
  }

  const changesList = effective.filter((f) => isChange(f));
  const notedList = effective.filter((f) => f.type === "acknowledge");
  const questions = effective.filter((f) => f.type === "ask_question");
  const set = (id: string, patch: Record<string, string>) => { setError(""); setEdits((all) => ({ ...all, [id]: { ...(all[id] ?? {}), ...patch } })); };
  const toggle = (id: string) => setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const row = (f: Fix) => {
    const check = checks.get(f.id);
    const bad = check && !check.ok ? check.error : "";
    return (
      <li key={f.id} className="py-3">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} aria-label={title(f, studySessions)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-[0.9rem] font-semibold leading-snug">{title(f, studySessions)}</p>
            <p className="t-caption mt-0.5 break-words">{f.reason}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5"><Pill tone="blue">from {f.source}</Pill>{f.warning && <Pill tone="orange">{f.warning}</Pill>}</p>
            {editing === f.id && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {f.type === "add_reminder" ? (
                  <label className="text-[0.76rem] font-medium text-label-2">Remind me at
                    <input type="datetime-local" step={300} value={local(f.at)} onChange={(e) => set(f.id, { at: fromLocal(e.target.value) })} className="mt-1 block w-full min-w-0 rounded-lg border border-sep bg-surface px-2 py-2 text-[0.82rem] text-label" />
                  </label>
                ) : f.type === "move_study_session" || f.type === "add_calendar_event" ? (
                  <>
                    <label className="text-[0.76rem] font-medium text-label-2">Start
                      <input type="datetime-local" step={300} value={local(f.start)} onChange={(e) => set(f.id, { start: fromLocal(e.target.value) })} className="mt-1 block w-full min-w-0 rounded-lg border border-sep bg-surface px-2 py-2 text-[0.82rem] text-label" />
                    </label>
                    <label className="text-[0.76rem] font-medium text-label-2">End
                      <input type="datetime-local" step={300} value={local(f.end)} onChange={(e) => set(f.id, { end: fromLocal(e.target.value) })} className="mt-1 block w-full min-w-0 rounded-lg border border-sep bg-surface px-2 py-2 text-[0.82rem] text-label" />
                    </label>
                  </>
                ) : null}
              </div>
            )}
            {bad && selected.has(f.id) && <p className="mt-1.5 text-[0.8rem] text-red" role="alert">{bad}</p>}
          </div>
          {editable(f) && <button type="button" onClick={() => setEditing(editing === f.id ? null : f.id)} aria-expanded={editing === f.id} className="press inline-flex shrink-0 items-center gap-1 text-[0.78rem] font-semibold text-accent underline-offset-2 hover:underline" aria-label={`Edit: ${title(f, studySessions)}`}><Pencil size={13} /> Edit</button>}
        </div>
      </li>
    );
  };

  const approve = () => {
    setError("");
    const result = applyUpdates([...chosen, ...answered]);
    if (result.ok) setStatus({ kind: "saved", applyId: result.applyId, summary: result.summary });
    else setError(result.error);
  };

  return (
    <section className="rounded-2xl bg-surface p-3.5" aria-label="Review proposed updates">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><h3 className="text-[0.95rem] font-semibold">Proposed updates</h3><p className="t-caption">Your own plan only. Moodle, AC and Finance are never changed.</p></div>
        <Pill tone="orange">Not saved</Pill>
      </div>

      {proposal.notes.map((n) => <p key={n} className="mb-2 flex gap-2 rounded-lg bg-orange-soft px-3 py-2 text-[0.8rem] text-orange"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{n}</p>)}
      {proposal.fixes.length === 0 && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[0.85rem]">Nothing to change in your plan.</p>}

      {changesList.length > 0 && <>
        <h4 className="t-eyebrow mt-2">Changes to your plan</h4>
        <ul className="divide-y divide-sep">{changesList.map(row)}</ul>
      </>}
      {notedList.length > 0 && <>
        <h4 className="t-eyebrow mt-3">Mark as reviewed</h4>
        <ul className="divide-y divide-sep">{notedList.map(row)}</ul>
      </>}
      {questions.length > 0 && <>
        <h4 className="t-eyebrow mt-3">Not sure, so asking you</h4>
        <ul className="divide-y divide-sep">
          {questions.map((f) => f.type !== "ask_question" ? null : (
            <li key={f.id} className="py-3">
              <p className="break-words text-[0.9rem] font-semibold leading-snug">{f.question}</p>
              <p className="mt-1 flex flex-wrap gap-1.5"><Pill tone="blue">from {f.source}</Pill><Pill tone="orange">Low confidence</Pill></p>
              {answers[f.id] ? (
                <p className="mt-2 text-[0.82rem] font-medium text-label-2" role="status">{answers[f.id] === "asked" ? "Draft ready below. Approve to mark this as reviewed." : "Ignored. Approve to mark this as reviewed."}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.to && <button type="button" onClick={() => { setAnswers((a) => ({ ...a, [f.id]: "asked" })); setDraftFor(f.id); }} className="press btn btn-sm btn-tint"><Mail size={14} /> Ask {f.to.name.replace(/\s*\(demo\)/i, "")}</button>}
                  <button type="button" onClick={() => setAnswers((a) => ({ ...a, [f.id]: "ignored" }))} className="press btn btn-sm btn-plain">Ignore</button>
                </div>
              )}
              {draftFor === f.id && f.to && <LecturerDraft name={f.to.name} email={f.to.email} question={`Your message said "${f.quote ?? "something about the schedule"}"`} onToast={showToast} />}
            </li>
          ))}
        </ul>
      </>}

      {error && <p className="mt-3 rounded-lg bg-red-soft px-3 py-2 text-[0.8rem] text-red" role="alert">{error}</p>}
      <p className="t-caption mt-3">Approving saves to this browser only. You can undo it straight after.</p>
      <div className="sticky bottom-0 z-10 -mx-3.5 mt-3 border-t border-sep bg-surface px-3.5 pb-3 pt-3 shadow-[0_-6px_18px_-12px_rgba(0,0,0,0.3)]" aria-label="Updates review actions">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={approve} disabled={(chosen.length === 0 && answered.length === 0) || blocked.length > 0} className="press btn btn-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40">
            <Check size={16} /> Approve selected ({chosen.length + answered.length})
          </button>
          <button type="button" onClick={() => setStatus({ kind: "rejected" })} className="press btn btn-plain min-h-11 flex-1 justify-center">Reject all</button>
        </div>
        {blocked.length > 0 && <p className="mt-2 text-[0.78rem] text-red" role="status">Fix or untick the highlighted rows before approving.</p>}
      </div>
    </section>
  );
}

function LecturerDraft({ name, email, question, onToast }: { name: string; email: string; question: string; onToast: (t: string) => void }) {
  const draft = composeLecturerEmail(name, email, question);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-surface-2">
      <div className="space-y-0.5 border-b border-sep px-3 py-2"><p className="t-caption"><span className="font-semibold text-label">To:</span> {draft.to.name} &lt;{draft.to.email}&gt;</p><p className="t-caption"><span className="font-semibold text-label">Subject:</span> {draft.subject}</p></div>
      <pre className="max-h-[180px] overflow-y-auto whitespace-pre-wrap px-3 py-2 font-sans text-[0.84rem] leading-[1.5]">{draft.body}</pre>
      <div className="flex flex-wrap items-center gap-2 border-t border-sep px-3 py-2">
        <span className="mr-auto text-[0.76rem] font-semibold text-orange">Draft only, not sent</span>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied(true); setTimeout(() => setCopied(false), 1600); onToast("Draft copied"); } catch { onToast("Could not copy. Select the text instead."); } }} className="press btn btn-sm btn-plain">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
        <a href={mailtoHref(draft)} className="press btn btn-sm btn-plain"><ExternalLink size={14} /> Open in mail app</a>
      </div>
    </div>
  );
}

