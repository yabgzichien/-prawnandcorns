"use client";

import { AlertTriangle, Check, Clock, Info, X } from "lucide-react";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/kit";
import { ARRANGEMENT_LABEL, type EventLine, type Issue, type LineStatus } from "@/lib/events/types";
import { ITEM_BY_ID, VENUE_BY_ID } from "@/lib/events/catalogue";
import { dateLabel } from "@/lib/events/checks";

/** A status with a word and an icon, so it never depends on colour alone. */
export function StatusPill({ status }: { status: LineStatus }) {
  if (status === "Pending") return <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-0.5 text-[0.75rem] font-semibold leading-5 text-label-2"><Clock size={12} aria-hidden /> Pending</span>;
  if (status === "Approved") return <Pill tone="green"><Check size={12} strokeWidth={3} aria-hidden /> Approved</Pill>;
  if (status === "Rejected") return <Pill tone="red"><X size={12} strokeWidth={3} aria-hidden /> Rejected</Pill>;
  return <Pill tone="orange"><AlertTriangle size={12} aria-hidden /> Approve with condition</Pill>;
}

export function lineTitle(line: EventLine): string {
  if (line.kind === "venue") return VENUE_BY_ID[line.venueId]?.name ?? line.venueId;
  if (line.kind === "item") return `${line.qty} x ${ITEM_BY_ID[line.itemId]?.name ?? line.itemId}`;
  return ARRANGEMENT_LABEL[line.arrangement];
}

export function lineWhen(line: EventLine): string {
  if (line.kind === "venue" || line.kind === "care") return `${dateLabel(line.date)}, ${line.start} to ${line.end}`;
  return `Collect ${dateLabel(line.collectDate)}, return ${dateLabel(line.returnDate)}`;
}

/** Problems stop a submit, checks are worth reading, notes are just helpful. Each has a word as well as an icon. */
export function IssueRows({ issues, compact = false }: { issues: Issue[]; compact?: boolean }) {
  if (issues.length === 0) return null;
  return (
    <ul className="grid gap-1.5" aria-label="Checks">
      {issues.map((i) => {
        const tone = i.level === "problem" ? "bg-red-soft text-red" : i.level === "warning" ? "bg-orange-soft text-orange" : "bg-surface-2 text-label-2";
        const word = i.missing ? "Still needed" : i.level === "problem" ? "Fix this" : i.level === "warning" ? "Check" : "Note";
        return (
          <li key={i.id} className={`flex gap-2 rounded-xl px-3 py-2 ${compact ? "text-[0.8rem]" : "text-[0.85rem]"} leading-snug ${tone}`}>
            {i.level === "info" ? <Info size={15} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />}
            <span><strong className="font-semibold">{word}:</strong> {i.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={htmlFor} className="text-[0.82rem] font-semibold">{label}</label>
      {children}
      {hint && <p className="t-caption">{hint}</p>}
    </div>
  );
}

export const inputCls = "min-h-[44px] w-full rounded-xl bg-surface px-3 text-[0.95rem] outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent";
