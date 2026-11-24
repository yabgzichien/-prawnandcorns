"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Check, Inbox } from "lucide-react";
import { ASKA_UPDATES_KEY, DORM_KIND_LABEL, sanitizeTickets, sanitizeUpdates, type AskaStatus, type AskaTicket, type AskaUpdate } from "@/lib/aska";
import { dateShort, dayShort, timeOf } from "@/lib/time";
import { setAskaUpdate } from "@/lib/world/storage";
import { Badge, PButton, PCard, PageTitle, type PTone } from "./ui";
import { useStored } from "./useScenario";

const TONE: Record<AskaStatus, PTone> = { Submitted: "blue", "In progress": "orange", "Technician scheduled": "purple", Resolved: "green" };
/** Visit times the presenter can offer, all in the demo week. */
const VISITS = [
  { label: "Tue 24 Nov, 10:00", start: "2026-11-24T10:00:00+08:00", end: "2026-11-24T11:00:00+08:00" },
  { label: "Wed 25 Nov, 15:00", start: "2026-11-25T15:00:00+08:00", end: "2026-11-25T16:00:00+08:00" },
  { label: "Thu 26 Nov, 09:00", start: "2026-11-26T09:00:00+08:00", end: "2026-11-26T10:00:00+08:00" },
];
const when = (iso: string) => { const d = new Date(iso); return `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}`; };

/**
 * The help desk's side of the tickets your student submitted in Compass. Tickets are read from the Compass window's
 * saved data. The status changes made here are written to one key that only this window writes.
 */
export function AskaDeskPage() {
  const saved = useStored("xmum-compass:v1");
  const updatesText = useStored(ASKA_UPDATES_KEY);
  const tickets = useMemo(() => {
    try { const v: unknown = JSON.parse(saved); return sanitizeTickets(v && typeof v === "object" && !Array.isArray(v) ? (v as { tickets?: unknown }).tickets : []); } catch { return []; }
  }, [saved]);
  const updates = useMemo(() => { try { return sanitizeUpdates(JSON.parse(updatesText)); } catch { return {}; } }, [updatesText]);

  return (
    <>
      <PageTitle title="AskA Help Desk" crumbs={["Help desk", "AskA"]} />
      <p className="mb-5 max-w-3xl text-[0.92rem] leading-relaxed text-[var(--p-muted)]">When your student submits a hostel problem in Compass it appears here. Change its status and Compass shows the update, including a technician visit time the student can add to their calendar.</p>
      {tickets.length === 0 ? (
        <PCard bodyClass="grid place-items-center gap-2 px-6 py-14 text-center">
          <Inbox size={26} className="text-[var(--p-muted)]" />
          <p className="font-semibold">No tickets yet</p>
          <p className="max-w-sm text-[0.88rem] text-[var(--p-muted)]">In Compass, say &quot;the air-con in D3-512 is leaking&quot;, prepare the ticket and submit it. It shows up here.</p>
        </PCard>
      ) : (
        <ul className="space-y-4">{[...tickets].reverse().map((t) => <TicketRow key={t.id} ticket={t} update={updates[t.id]} />)}</ul>
      )}
    </>
  );
}

function TicketRow({ ticket, update }: { ticket: AskaTicket; update?: AskaUpdate }) {
  const status: AskaStatus = update?.status ?? "Submitted";
  const [visit, setVisit] = useState(VISITS[0].start);
  const [note, setNote] = useState(update?.note ?? "");
  const set = (next: AskaUpdate) => setAskaUpdate(ticket.id, next);
  const trimmed = note.trim().slice(0, 200);
  const withNote = (u: AskaUpdate): AskaUpdate => ({ ...u, ...(trimmed ? { note: trimmed } : {}) });

  return (
    <li>
      <PCard bodyClass="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.85rem] font-bold text-[var(--p-muted)]">{ticket.id}</span>
          <Badge tone={TONE[status]}>{status}</Badge>
          {ticket.urgent && <Badge tone="red">Urgent</Badge>}
          <Badge tone="gray">{DORM_KIND_LABEL[ticket.kind]}</Badge>
          <span className="ml-auto text-[0.8rem] text-[var(--p-muted)]">{ticket.block}-{ticket.room}</span>
        </div>
        <h3 className="mt-2 break-words text-[1rem] font-semibold">{ticket.title}</h3>
        <p className="mt-1 whitespace-pre-line text-[0.86rem] leading-relaxed text-[var(--p-muted)]">{ticket.description}</p>
        {update?.visit && <p className="mt-3 flex items-center gap-2 text-[0.84rem] font-semibold text-[#6a35c9]"><CalendarClock size={15} /> Visit: {when(update.visit.start)} to {timeOf(new Date(update.visit.end))}</p>}

        <div className="mt-4 grid gap-3 border-t border-[var(--p-line)] pt-4">
          <label className="grid gap-1 text-[0.8rem] font-semibold">Note to the student (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Please keep the room unlocked between 10:00 and 11:00" className="min-h-[40px] rounded-lg border border-[var(--p-line)] px-3 text-[0.88rem] font-normal outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <PButton small variant="light" onClick={() => set(withNote({ status: "In progress" }))} disabled={status === "In progress"}>Mark in progress</PButton>
            <label className="grid gap-1 text-[0.78rem] font-semibold">Visit time
              <select value={visit} onChange={(e) => setVisit(e.target.value)} className="min-h-[34px] rounded-lg border border-[var(--p-line)] bg-white px-2 text-[0.82rem] font-normal">{VISITS.map((v) => <option key={v.start} value={v.start}>{v.label}</option>)}</select>
            </label>
            <PButton small onClick={() => { const v = VISITS.find((x) => x.start === visit)!; set(withNote({ status: "Technician scheduled", visit: { start: v.start, end: v.end } })); }}>Schedule technician</PButton>
            <PButton small variant="ghost" onClick={() => set(withNote({ status: "Resolved" }))} disabled={status === "Resolved"}><Check size={13} strokeWidth={3} /> Mark resolved</PButton>
          </div>
        </div>
      </PCard>
    </li>
  );
}
