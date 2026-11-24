"use client";

import { useState } from "react";
import { Check, Copy, LifeBuoy } from "lucide-react";
import type { AskaDraft } from "@/lib/aska";
import { useApp } from "@/lib/state";
import { Pill } from "@/components/ui/kit";

/** A help desk ticket the assistant prepared. The student reviews and submits it; nothing is sent from here. */
export function AskaCard({ draft }: { draft: AskaDraft }) {
  const { openAskaTicket, tickets } = useApp();
  const [copied, setCopied] = useState(false);
  const where = draft.block && draft.room ? `${draft.block}-${draft.room}` : null;
  const already = tickets.some((t) => t.title === draft.title && t.description === draft.description);
  return (
    <section className="overflow-hidden rounded-2xl bg-surface" aria-label="AskA ticket ready to review">
      <div className="flex items-start gap-3 border-b border-sep p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><LifeBuoy size={18} /></span>
        <div className="min-w-0 flex-1"><h3 className="text-[0.95rem] font-semibold">AskA ticket, ready to review</h3><p className="t-caption break-words">{draft.path}</p></div>
        {already ? <Pill tone="green">Submitted</Pill> : <Pill tone="orange">Not submitted</Pill>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3.5 py-3 text-[0.88rem]">
        <dt className="text-label-2">Where</dt><dd className="font-semibold">{where ?? "Add your block and room on the form"}</dd>
        <dt className="text-label-2">Urgency</dt><dd className="font-semibold">{draft.urgent ? "Urgent" : "Normal"}</dd>
        <dt className="text-label-2">Title</dt><dd className="break-words font-semibold">{draft.title}</dd>
      </dl>
      <pre className="max-h-[170px] overflow-y-auto whitespace-pre-wrap border-t border-sep px-3.5 py-3 font-sans text-[0.86rem] leading-[1.5]">{draft.description}</pre>
      <div className="flex flex-wrap gap-2 border-t border-sep p-3">
        <button type="button" onClick={() => openAskaTicket(draft)} className="press btn btn-sm btn-primary"><LifeBuoy size={14} /> Review and submit</button>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`${draft.path}\n${draft.title}\n\n${draft.description}`); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} }} className="press btn btn-sm btn-plain">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy text"}</button>
      </div>
      <p className="t-caption border-t border-sep px-3.5 py-2.5">Draft only. On the real help desk you paste this in yourself. Nothing is sent from Compass.</p>
    </section>
  );
}
