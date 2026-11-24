"use client";

import { useState } from "react";
import { CalendarPlus, Check, LifeBuoy, Wrench } from "lucide-react";
import { ASKA_STATUSES, detectDormIssue, draftTicket, type AskaStatus, type AskaTicket } from "@/lib/aska";
import { DEMO_NOW, dateShort, dayShort, timeOf } from "@/lib/time";
import { useApp } from "@/lib/state";
import { PageHeader, Pill } from "@/components/ui/kit";
import { useAskaUpdates } from "./useAska";

const QUICK = ["The air-con in my room is not working", "Water is leaking from the ceiling", "The light in my room keeps flickering", "My wardrobe door is broken"];
const TONE: Record<AskaStatus, "blue" | "orange" | "purple" | "green"> = { Submitted: "blue", "In progress": "orange", "Technician scheduled": "purple", Resolved: "green" };
const when = (iso: string) => { const d = new Date(iso); return `${dayShort(d)} ${dateShort(d)}, ${timeOf(d)}`; };

/** Report a hostel problem the way it is reported on campus: as a help desk ticket, not an email. */
export function HelpDeskView() {
  const { tickets, personalEvents, applyUpdates, openAskaTicket } = useApp();
  const updates = useAskaUpdates();
  const [text, setText] = useState("");
  const [note, setNote] = useState("");

  const prepare = (problem: string) => {
    const d = draftTicket(problem);
    if (!d) { setNote("That does not look like a hostel fault. For fees, your timetable or IT, ask Compass or email the right office."); return; }
    setNote("");
    openAskaTicket(d);
  };

  const addVisit = (t: AskaTicket, visit: { start: string; end: string }) => {
    const r = applyUpdates([{ id: `askavisit-${t.id}`, type: "add_calendar_event", title: `Technician visit: ${t.title.split(":")[0]} (${t.block}-${t.room})`, start: visit.start, end: visit.end, place: `${t.block}-${t.room}`, reason: "The help desk scheduled a technician.", source: "AskA" }]);
    if (!r.ok) setNote(r.error);
  };

  return (
    <div>
      <PageHeader eyebrow="Help desk" title="Hostel problems" sub="Leaks, air-conditioners, lights and broken fittings in your hostel room are reported to the AskA help desk, not by email. Compass prepares the ticket and you check it. This demo sends nothing to a real help desk." />

      <section className="card mb-6 p-5" aria-label="Report a hostel problem">
        <h2 className="t-headline mb-1 flex items-center gap-2"><Wrench size={18} className="text-accent" /> What is wrong?</h2>
        <p className="t-sub mb-3">Describe it in your own words. Add your block and room, like D3-512, if you can.</p>
        <form onSubmit={(e) => { e.preventDefault(); prepare(text); }} className="space-y-3">
          <label className="sr-only" htmlFor="problem">Describe the problem</label>
          <textarea id="problem" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={400} placeholder="The air-con in D3-512 is leaking water onto the floor" className="w-full resize-none rounded-2xl bg-surface-2 p-4 text-[1rem] outline-none ring-1 ring-sep placeholder:text-label-3 focus:ring-2 focus:ring-accent" />
          <div className="flex flex-wrap gap-2">{QUICK.map((q) => <button key={q} type="button" onClick={() => { setText(q); setNote(""); }} className="press rounded-full bg-surface-2 px-3 py-1.5 text-[0.8rem] font-medium text-label-2 ring-1 ring-sep">{q}</button>)}</div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!text.trim()} className="press btn btn-primary disabled:opacity-40"><LifeBuoy size={16} /> Prepare ticket</button>
            {text.trim() && detectDormIssue(text)?.urgent && <Pill tone="red">Looks urgent. If anyone is at risk, tell the hostel office in person now.</Pill>}
          </div>
          {note && <p className="rounded-xl bg-orange-soft px-3 py-2.5 text-[0.85rem] text-orange" role="status">{note}</p>}
        </form>
      </section>

      <section aria-label="My AskA tickets">
        <h2 className="t-headline mb-3 px-1">My tickets</h2>
        {tickets.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-sep px-6 py-10 text-center"><p className="t-headline">No tickets yet</p><p className="t-sub mt-1 max-w-sm">When you submit one it appears here, and the help desk&rsquo;s updates show up next to it.</p></div>
        ) : (
          <ul className="space-y-3">
            {[...tickets].reverse().map((t) => {
              const u = updates[t.id];
              const status: AskaStatus = u?.status ?? "Submitted";
              const added = u?.visit ? personalEvents.some((e) => e.start === u.visit!.start && e.place === `${t.block}-${t.room}`) : false;
              return (
                <li key={t.id} className="card p-4">
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <span className="tnum text-[0.85rem] font-bold text-label-2">{t.id}</span>
                    <Pill tone={TONE[status]}>{status}</Pill>
                    {t.urgent && <Pill tone="red">Urgent</Pill>}
                  </div>
                  <p className="mt-1 break-words text-[1rem] font-semibold tracking-[-0.01em]">{t.title}</p>
                  <p className="t-caption">{t.path}, {t.block}-{t.room}</p>
                  <ol className="mt-3 flex gap-1.5" aria-label={`Progress: ${status}`}>{ASKA_STATUSES.map((s, i) => <li key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= ASKA_STATUSES.indexOf(status) ? "var(--accent)" : "var(--surface-3)" }} />)}</ol>
                  {u?.note && <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[0.88rem]"><span className="font-semibold">Help desk:</span> {u.note}</p>}
                  {u?.visit && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-purple-soft px-3 py-2.5 text-[0.88rem]">
                      <span className="min-w-0 flex-1"><span className="font-semibold">Technician visit:</span> {when(u.visit.start)} to {timeOf(new Date(u.visit.end))}. Someone needs to be in the room.</span>
                      <button type="button" disabled={added} onClick={() => addVisit(t, u.visit!)} className="press btn btn-sm btn-tint disabled:opacity-60">{added ? <><Check size={14} /> In your calendar</> : <><CalendarPlus size={14} /> Add to my calendar</>}</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="t-caption mt-4 px-1">Room allocation and moving rooms are different: those go to the Accommodation Office. Ask Compass to draft that email. Tickets are saved in this browser only, as of {dayShort(DEMO_NOW)} {dateShort(DEMO_NOW)}.</p>
      </section>

    </div>
  );
}
