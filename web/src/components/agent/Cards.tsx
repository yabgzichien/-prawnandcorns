"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, ExternalLink, MapPin, Pencil, Undo2 } from "lucide-react";
import type { AgentCard } from "@/lib/agent";
import { COURSE_BY_ID } from "@/lib/data/academics";
import { dueLabel, atDay, dayShort, dateShort } from "@/lib/time";
import { mailtoHref } from "@/lib/email";
import { Pill, Ring } from "@/components/ui/kit";
import { useApp } from "@/lib/state";

const statusTone = { overdue: "red", todo: "orange", progress: "blue", submitted: "green" } as const;

export function AgentCardView({ card, onNavigate, onUndoLayout }: { card: AgentCard; onNavigate: () => void; onUndoLayout?: () => void }) {
  switch (card.kind) {
    case "deadlines":
      return (
        <ul className="divide-y divide-sep overflow-hidden rounded-2xl bg-surface">
          {card.items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className={`h-2 w-2 shrink-0 rounded-full`} style={{ background: `var(--${a.status === "overdue" ? "red" : a.status === "todo" ? "orange" : "accent"})` }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.95rem] font-semibold tracking-[-0.01em]">{a.title}</p>
                <p className="t-caption truncate">{COURSE_BY_ID[a.courseId].code} · {a.status === "overdue" ? "Overdue" : dueLabel(new Date(a.due))} · {a.weight}%</p>
              </div>
              <Pill tone={statusTone[a.status]}>{a.status === "progress" ? "In progress" : a.status === "todo" ? "To do" : a.status === "overdue" ? "Overdue" : "Done"}</Pill>
            </li>
          ))}
          <li><Link href="/assignments" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between px-3.5 text-[0.9rem] font-semibold text-accent">Open Assignments <ArrowRight size={16} /></Link></li>
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
              <p className="font-semibold tracking-[-0.01em]">{course.code} · {c.kind}</p>
              <p className="t-caption">{c.start}–{c.end} · {c.room}</p>
            </div>
            <Pill tone={cancelled ? "red" : c.status === "normal" ? "green" : "orange"}>{cancelled ? "Cancelled" : c.status === "room-changed" ? "Room changed" : c.status === "makeup" ? "Make-up" : "On"}</Pill>
          </div>
          {card.makeup && (
            <div className="border-t border-sep bg-green-soft px-3.5 py-2.5">
              <p className="text-[0.85rem] font-semibold text-green">Make-up · {dayShort(atDay(card.makeup.day, card.makeup.start))} {dateShort(atDay(card.makeup.day, card.makeup.start))}, {card.makeup.start} · {card.makeup.room}</p>
              <Link href={`/map?focus=${card.makeup.room}`} onClick={onNavigate} className="mt-1 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-green underline-offset-2 hover:underline"><MapPin size={14} /> Show {card.makeup.room} on map</Link>
            </div>
          )}
          {card.next && cancelled && (
            <div className="border-t border-sep px-3.5 py-2.5">
              <p className="t-caption">Next up · <span className="font-semibold text-label">{COURSE_BY_ID[card.next.courseId].code} {card.next.start}</span> in {card.next.room}</p>
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
                  <p className={`truncate text-[0.95rem] font-semibold ${c.status === "cancelled" ? "line-through" : ""}`}>{COURSE_BY_ID[c.courseId].code} · {c.kind}</p>
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
            <p className="t-caption truncate">{card.place.name} · {card.room.floor}</p>
          </div>
          <Link href={`/map?focus=${card.room.code}`} onClick={onNavigate} className="press btn btn-sm btn-primary">Show on map</Link>
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
                <p className="t-caption truncate">{c.category} · {c.meets}{c.room ? ` · ${c.room}` : ""} · {c.members} members</p>
              </div>
              <Pill tone="green">Recruiting</Pill>
            </li>
          ))}
          <li><Link href="/clubs" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between px-3.5 text-[0.9rem] font-semibold text-accent">Browse all clubs <ArrowRight size={16} /></Link></li>
        </ul>
      );

    case "fees":
      return (
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-3.5">
          <Ring value={card.paid / card.total} size={56} stroke={6} tone="var(--green)"><span className="tnum text-[0.75rem] font-bold">{Math.round((card.paid / card.total) * 100)}%</span></Ring>
          <div className="min-w-0 flex-1">
            <p className="font-semibold tracking-[-0.01em]">{card.label}</p>
            <p className="t-caption">RM {card.due.toLocaleString("en-MY")} · due {dateShort(new Date(card.dueIso))}</p>
          </div>
          <Link href="/finance" onClick={onNavigate} className="press btn btn-sm btn-tint">Finance</Link>
        </div>
      );

    case "ge":
      return (
        <ul className="divide-y divide-sep overflow-hidden rounded-2xl bg-surface">
          {card.groups.map((g) => (
            <li key={g.title} className="px-3.5 py-3">
              <p className="flex items-center justify-between text-[0.95rem] font-semibold tracking-[-0.01em]">{g.title}<Pill tone="orange">{g.need} credits</Pill></p>
              <p className="t-caption mt-0.5">{g.options.join(" · ")}</p>
            </li>
          ))}
          <li><Link href="/courses" onClick={onNavigate} className="press-row flex min-h-[44px] items-center justify-between px-3.5 text-[0.9rem] font-semibold text-accent">Open Courses <ArrowRight size={16} /></Link></li>
        </ul>
      );

    case "suggest":
      return null;
  }
}

function EmailCard({ card, onNavigate }: { card: Extract<AgentCard, { kind: "email" }>; onNavigate: () => void }) {
  const { showToast } = useApp();
  const d = card.draft;
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface">
      <div className="space-y-1 border-b border-sep px-3.5 py-3">
        <p className="t-caption"><span className="font-semibold text-label">To</span> · {d.to.name} &lt;{d.to.email}&gt;</p>
        <p className="t-caption"><span className="font-semibold text-label">Subject</span> · {d.subject}</p>
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
