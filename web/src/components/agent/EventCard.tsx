"use client";

import Link from "next/link";
import { CalendarRange, FilePen } from "lucide-react";
import type { AgentCard } from "@/lib/agent";
import { dateLabel, problemsOf } from "@/lib/events/checks";
import { useApp } from "@/lib/state";
import { Pill } from "@/components/ui/kit";
import { IssueRows, StatusPill, lineTitle } from "@/components/events/shared";

type EventCardData = Extract<AgentCard, { kind: "event" }>;
type StatusCardData = Extract<AgentCard, { kind: "event-status" }>;

/** A club event application the assistant prepared. The student goes through every step and submits; nothing is sent from here. */
export function EventCard({ card }: { card: EventCardData }) {
  const { openEventApplication, eventApplications } = useApp();
  const d = card.draft;
  const already = eventApplications.some((a) => a.name === d.name && a.date === d.date && a.lines.length === d.lines.length);
  const problems = problemsOf(card.issues).length;
  const shown = card.issues.filter((i) => i.level !== "info").slice(0, 6);
  return (
    <section className="overflow-hidden rounded-2xl bg-surface" aria-label="Club event application ready to review">
      <div className="flex items-start gap-3 border-b border-sep p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><CalendarRange size={18} /></span>
        <div className="min-w-0 flex-1"><h3 className="text-[0.95rem] font-semibold">Event application, ready to review</h3><p className="t-caption break-words">One application for the whole event</p></div>
        {already ? <Pill tone="green">Submitted</Pill> : <Pill tone="orange">Not submitted</Pill>}
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3.5 py-3 text-[0.88rem]">
        <dt className="text-label-2">Event</dt><dd className="break-words font-semibold">{d.name || "Needs a name"}</dd>
        <dt className="text-label-2">Club</dt><dd className="break-words font-semibold">{d.organisers || "Needs a club"}</dd>
        <dt className="text-label-2">When</dt><dd className="font-semibold">{d.date ? `${dateLabel(d.date)}, ${d.start} to ${d.end}` : "Needs a date"}</dd>
        <dt className="text-label-2">People</dt><dd className="font-semibold">{d.participants || "Needs a number"}</dd>
      </dl>
      {d.lines.length > 0 && (
        <ul className="divide-y divide-sep border-t border-sep">
          {d.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3.5 py-2 text-[0.86rem]">
              <span className="font-semibold">{lineTitle(l)}</span>
              <span className="t-caption">{l.kind === "venue" ? `${l.start} to ${l.end}` : l.kind === "item" ? `Collect ${dateLabel(l.collectDate)}` : "Arrangement"}</span>
            </li>
          ))}
        </ul>
      )}
      {shown.length > 0 && <div className="border-t border-sep p-3"><IssueRows issues={shown} compact /></div>}
      <div className="flex flex-wrap items-center gap-2 border-t border-sep p-3">
        <button type="button" onClick={() => openEventApplication(d)} className="press btn btn-sm btn-primary"><FilePen size={14} /> Review and submit</button>
        {problems > 0 && <span className="t-caption">{problems} to fix first</span>}
        <Link href="/hub?section=events" className="press btn btn-sm btn-plain">Club events</Link>
      </div>
      <p className="t-caption border-t border-sep px-3.5 py-2.5">Draft only. Saved in this browser when you submit. Nothing is sent to a real office.</p>
    </section>
  );
}

export function EventStatusCard({ card, onNavigate }: { card: StatusCardData; onNavigate: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface" aria-label="Your club event applications">
      <ul className="divide-y divide-sep">
        {card.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3">
            <div className="min-w-0 flex-1"><p className="break-words text-[0.92rem] font-semibold">{i.name}</p><p className="t-caption">{i.id}, {dateLabel(i.date)}, {i.answered} of {i.total} lines answered</p></div>
            <StatusPill status={i.status} />
          </li>
        ))}
      </ul>
      <div className="border-t border-sep p-3"><Link href="/hub?section=events" onClick={onNavigate} className="press btn btn-sm btn-primary">Open Club events</Link></div>
    </section>
  );
}
