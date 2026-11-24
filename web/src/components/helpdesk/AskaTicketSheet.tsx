"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";
import { DORM_KINDS, DORM_KIND_LABEL, type AskaDraft, type DormIssueKind } from "@/lib/aska";
import { useApp } from "@/lib/state";
import { Sheet } from "@/components/ui/Sheet";

const BLOCKS = ["D1", "D2", "D3", "D4", "D5", "LY1", "LY2", "LY3", "LY4", "LY5", "LY6", "LY7", "LY8", "LY9"];
const lab = "text-[0.82rem] font-semibold";
const input = "min-h-[44px] w-full rounded-xl bg-surface px-3 text-[0.95rem] outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent";

/**
 * A mock of the help desk's ticket form, prefilled for the student to check. Submitting saves the ticket in this
 * browser. Nothing is sent to a real help desk, and the sheet says so.
 */
export function AskaTicketSheet({ draft, onClose }: { draft: AskaDraft | null; onClose: () => void }) {
  return (
    <Sheet open={draft !== null} onClose={onClose} label="Submit an AskA ticket" modalOnDesktop>
      {draft && <TicketForm key={draft.title + draft.description} draft={draft} onClose={onClose} />}
    </Sheet>
  );
}

function TicketForm({ draft, onClose }: { draft: AskaDraft; onClose: () => void }) {
  const { submitAskaTicket } = useApp();
  const [kind, setKind] = useState<DormIssueKind>(draft.kind);
  const [block, setBlock] = useState(draft.block);
  const [room, setRoom] = useState(draft.room);
  const [urgent, setUrgent] = useState(draft.urgent);
  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const path = `Operation and Maintenance Office > Hostel maintenance > ${DORM_KIND_LABEL[kind]}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = submitAskaTicket({ kind, path, urgent, block, room, title, description });
    if (r.ok) onClose(); else setError(r.error);
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-4 lg:pt-5">
        <div className="min-w-0 flex-1"><p className="t-eyebrow">AskA help desk, demo</p><h2 className="t-title !text-[1.5rem]">New ticket</h2></div>
        <button type="button" onClick={onClose} aria-label="Close" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-label-2"><X size={17} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 pb-4">
        <p className="flex gap-2 rounded-xl bg-orange-soft px-3 py-2.5 text-[0.84rem] text-orange"><AlertTriangle size={16} className="mt-0.5 shrink-0" />This is a demo of the form. Nothing is sent to the real help desk. On the real site you would paste this same text.</p>
        <div><p className="t-eyebrow mb-1">Department and category</p><p className="rounded-xl bg-surface px-3 py-2.5 text-[0.92rem] font-medium">{path}</p></div>
        <div className="grid gap-1"><label htmlFor="aska-kind" className={lab}>Type of problem</label>
          <select id="aska-kind" value={kind} onChange={(e) => setKind(e.target.value as DormIssueKind)} className={input}>{DORM_KINDS.map((k) => <option key={k} value={k}>{DORM_KIND_LABEL[k]}</option>)}</select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1"><label htmlFor="aska-block" className={lab}>Block</label>
            <select id="aska-block" value={block} onChange={(e) => setBlock(e.target.value)} className={input}><option value="">Choose</option>{BLOCKS.map((b) => <option key={b} value={b}>{b}</option>)}</select>
          </div>
          <div className="grid gap-1"><label htmlFor="aska-room" className={lab}>Room number</label>
            <input id="aska-room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={6} inputMode="text" placeholder="512" className={input} />
          </div>
        </div>
        <label className="flex min-h-[44px] items-center gap-3 rounded-xl bg-surface px-3 text-[0.9rem] font-semibold"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" /> Urgent, it may be unsafe (flooding, sparks, no power)</label>
        <div className="grid gap-1"><label htmlFor="aska-title" className={lab}>Title</label>
          <input id="aska-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} className={input} />
        </div>
        <div className="grid gap-1"><label htmlFor="aska-description" className={lab}>Question</label>
          <textarea id="aska-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={900} rows={7} className={`${input} resize-y py-2.5 leading-relaxed`} />
        </div>
        {error && <p className="rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-sep p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row">
        <button type="submit" className="press btn btn-primary min-h-11 flex-1 justify-center"><Check size={16} /> Submit ticket</button>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${path}\n${title}\n\n${description}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setError("Could not copy. Select the text instead."); } }} className="press btn btn-plain min-h-11 justify-center">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy text"}</button>
      </div>
    </form>
  );
}
