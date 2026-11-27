"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarX2, Clock, Code2, DoorOpen, MapPin, Search, Users, Wallet } from "lucide-react";
import { CLUBS, EVENTS } from "@/lib/data/life";
import { dateShort, relative } from "@/lib/time";
import { useApp, type WidgetId } from "@/lib/state";
import type { WidgetSize } from "@/lib/widget-layout";
import { useCampus } from "@/lib/sync/CampusProvider";
import { NeedsAttention } from "./HeadsUp";
import { MasterCalendar } from "./MasterCalendar";
import { PlansWidget } from "./PlansWidget";
import { CardTitle, Pill, Ring } from "@/components/ui/kit";

const money = (n: number, currency = "RM") => `${currency} ${n.toLocaleString("en-MY")}`;

function AlertsWidget({ size }: { size: WidgetSize }) {
  const { data } = useCampus();
  const notices = size === "wide" ? data.notices : data.notices.slice(0, size === "compact" ? 1 : 4);
  return (
    <>
      <CardTitle icon={<AlertTriangle size={18} className="text-orange" />} title={`Class changes (${data.notices.length})`} />
      <ul className="-mx-2 divide-y divide-sep">
        {notices.map((n) => (
          <li key={n.id} className="flex gap-3 px-2 py-3">
            <span className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${n.kind === "cancellation" ? "bg-red-soft text-red" : n.kind === "room" ? "bg-orange-soft text-orange" : "bg-accent-soft text-accent"}`}>
              {n.kind === "cancellation" ? <CalendarX2 size={16} /> : n.kind === "room" ? <DoorOpen size={16} /> : <Clock size={16} />}
            </span>
            <div className="min-w-0">
              <p className="text-[0.95rem] font-semibold leading-snug tracking-[-0.01em]">{n.title}</p>
              {size !== "compact" && <p className={`t-caption mt-0.5 ${size === "wide" ? "" : "line-clamp-2"}`}>{n.body}</p>}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function FeesWidget({ size }: { size: WidgetSize }) {
  const { data } = useCampus();
  const FINANCE = data.fees;
  const next = FINANCE.dues.find((d) => d.status === "upcoming");
  return (
    <>
      <CardTitle icon={<Wallet size={18} className="text-accent" />} title="Fees" action={<Link href="/hub?section=finance" className="press text-[0.85rem] font-semibold text-accent">Details <ArrowRight className="inline" size={14} /></Link>} />
      <div className="flex items-center gap-4">
        {size !== "compact" && <Ring value={FINANCE.paid / FINANCE.tuitionTotal} size={72} stroke={8} tone="var(--green)"><span className="tnum text-[0.85rem] font-bold">{Math.round((FINANCE.paid / FINANCE.tuitionTotal) * 100)}%</span></Ring>}
        <div>
          <p className="t-caption">Next instalment</p>
          <p className="tnum text-[1.6rem] font-bold leading-tight tracking-[-0.03em]">{next ? money(next.amount, FINANCE.currency) : "None posted"}</p>
          <p className="t-caption">{next ? `Due ${dateShort(new Date(next.due))}, ${relative(new Date(next.due))}` : "Finance has not posted another instalment."}</p>
        </div>
      </div>
    </>
  );
}

function ProgressWidget({ size }: { size: WidgetSize }) {
  return (
    <>
      <CardTitle title="Degree progress" action={<Link href="/hub?section=courses" className="press text-[0.85rem] font-semibold text-accent">Plan <ArrowRight className="inline" size={14} /></Link>} />
      <div className="flex items-center gap-4">
        {size !== "compact" && <Ring value={14 / 120} size={72} stroke={8}><span className="tnum text-[0.85rem] font-bold">14</span></Ring>}
        <div>
          <p className="text-[1.05rem] font-semibold tracking-[-0.01em]">14 of 120 credits</p>
          {size !== "compact" && <p className="t-caption">Taking 5 courses this semester (4 core, 1 GE)</p>}
        </div>
      </div>
    </>
  );
}

function ClubsWidget({ size }: { size: WidgetSize }) {
  const { joined } = useApp();
  const ev = EVENTS[0];
  const recruiting = CLUBS.filter((c) => c.recruiting && !joined.includes(c.id));
  const picks = size === "wide" ? recruiting : recruiting.slice(0, size === "compact" ? 0 : 2);
  return (
    <>
      <CardTitle icon={<Users size={19} className="text-accent" />} title="Clubs & events" action={<Link href="/hub?section=clubs" className="press text-[0.85rem] font-semibold text-accent">Explore <ArrowRight className="inline" size={14} /></Link>} />
      <div className="rounded-xl bg-accent-soft p-3">
        <span className="club-fair-icon" aria-hidden="true" />
        <p className="text-[0.95rem] font-semibold tracking-[-0.01em] text-accent">{ev.title}</p>
        <p className="t-caption">{ev.when}, {ev.where}</p>
      </div>
      <ul className="mt-2 divide-y divide-sep">
        {picks.map((c, index) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="club-row-icon">{index === 0 ? <Users size={19} /> : <Code2 size={19} />}</span>
            <div className="min-w-0"><p className="truncate text-[0.92rem] font-semibold">{c.name}</p><p className="t-caption">{c.meets}, {c.members} members</p></div>
            <Pill tone="green">Recruiting</Pill>
          </li>
        ))}
      </ul>
    </>
  );
}

function FindWidget({ size }: { size: WidgetSize }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <>
      <CardTitle icon={<MapPin size={19} className="text-accent" />} title="Find a room" />
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/hub?section=map&q=${encodeURIComponent(q.trim())}`); }} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-4 pr-1 ring-1 ring-sep focus-within:ring-2 focus-within:ring-accent">
        <Search size={17} className="text-label-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="A3-G01, library, canteen…" aria-label="Search campus" className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-label-3" />
        <button className="press btn btn-sm btn-primary">Go</button>
      </form>
      {size !== "compact" && <div className="mt-3 flex flex-wrap gap-2">
        {["A3-G01", "A5-L2", "Library", "Canteen"].map((s) => <Link key={s} href={`/hub?section=map&q=${s}`} className="press btn btn-sm btn-plain">{s}</Link>)}
      </div>}
    </>
  );
}

export const WIDGETS: Record<WidgetId, (size: WidgetSize) => ReactNode> = {
  calendar: () => <MasterCalendar />,
  alerts: (size) => <AlertsWidget size={size} />,
  fees: (size) => <FeesWidget size={size} />,
  progress: (size) => <ProgressWidget size={size} />,
  clubs: (size) => <ClubsWidget size={size} />,
  find: (size) => <FindWidget size={size} />,
  attention: (size) => <NeedsAttention size={size} />,
  plans: (size) => <PlansWidget size={size} />,
};
