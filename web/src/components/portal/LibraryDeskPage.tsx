"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Wrench } from "lucide-react";
import { fetchLibraryDay, type LibraryDay } from "@/lib/library/client";
import { bookableDates, BOOKING_RULES, hasStarted, SLOTS, sanitizeBookings } from "@/lib/library/policy";
import { CATEGORIES, LIBRARY_ROOM_BY_ID, type RoomCategory } from "@/lib/library/rooms";
import { DEMO_NOW, dateShort, dayShort } from "@/lib/time";
import { SCENARIO_EVENTS } from "@/lib/world/events";
import { triggerEvent } from "@/lib/world/storage";
import { Badge, PButton, PCard, PModal, PageTitle } from "./ui";
import { useStored, useTriggered } from "./useScenario";

const TAB_LABEL: Record<RoomCategory, string> = { silent: "Silent Study Room", study: "Study Room", group: "Group Discussion Room", success: "Student Success Room" };

const fmt = (date: string) => { const d = new Date(`${date}T12:00:00+08:00`); return `${dayShort(d)} ${dateShort(d)}`; };

/**
 * The library's side of the booking system: the same availability Compass reads, laid out like a booking page,
 * plus the buttons that fill or close rooms. The student's own bookings are read from the Compass window.
 */
export function LibraryDeskPage() {
  const dates = useMemo(() => bookableDates(DEMO_NOW), []);
  const triggered = useTriggered();
  const saved = useStored("xmum-compass:v1");
  const bookings = useMemo(() => {
    try { const parsed: unknown = JSON.parse(saved); return sanitizeBookings(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as { bookings?: unknown }).bookings : []); } catch { return []; }
  }, [saved]);
  const [date, setDate] = useState(dates[0]);
  const [tab, setTab] = useState<RoomCategory>("silent");
  const [modal, setModal] = useState<"policy" | "mine" | null>(null);
  const [days, setDays] = useState<Record<string, LibraryDay>>({});
  const [problem, setProblem] = useState("");

  const eventsKey = triggered.join(",");
  useEffect(() => {
    const ac = new AbortController();
    fetchLibraryDay(date, triggered, ac.signal)
      .then((day) => { setDays((cur) => ({ ...cur, [date]: day })); setProblem(""); })
      .catch((e: unknown) => { if (!ac.signal.aborted) setProblem(e instanceof Error ? e.message : "The booking system did not answer."); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, eventsKey]);

  const day = days[date];
  const rooms = day?.rooms.filter((r) => r.category === tab) ?? [];
  const mineAt = (roomId: string, slot: number) => bookings.some((b) => b.roomId === roomId && b.date === date && b.slot === slot);
  const libraryEvents = SCENARIO_EVENTS.filter((e) => e.group === "Library");

  return (
    <>
      <PageTitle title="Library Space Booking" crumbs={["Space Booking", "Library Rooms"]} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PCard
          title="Library Space Booking"
          subtitle="What the booking system shows right now. Compass reads this same availability."
          action={<div className="flex gap-2"><PButton small variant="light" onClick={() => setModal("policy")}>Policy</PButton><PButton small variant="light" onClick={() => setModal("mine")}>My Bookings{bookings.length ? ` (${bookings.length})` : ""}</PButton></div>}
          bodyClass="p-5"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[0.82rem] font-semibold text-[var(--p-muted)]">Booking Date:</span>
            {dates.map((d) => (
              <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className={`min-h-[36px] rounded-lg px-3 text-[0.84rem] font-semibold ${date === d ? "bg-[var(--p-primary)] text-white" : "bg-[#eef1f5] hover:bg-[#e3e8ee]"}`}>{fmt(d)}</button>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[0.78rem]" aria-label="Status legend">
            <span className="font-semibold text-[var(--p-muted)]">Status:</span>
            <Badge tone="blue">Available</Badge><Badge tone="gray">Reserved</Badge><Badge tone="green">Booked by your student</Badge><Badge tone="red">Closed</Badge>
          </div>
          <div role="tablist" aria-label="Room type" className="mb-4 flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} role="tab" aria-selected={tab === c} onClick={() => setTab(c)} className={`min-h-[36px] rounded-lg px-3 text-[0.84rem] font-semibold ${tab === c ? "bg-[var(--p-primary-soft)] text-[var(--p-primary)]" : "text-[var(--p-muted)] hover:bg-[#eef1f5]"}`}>{TAB_LABEL[c]}</button>
            ))}
          </div>
          {problem && <p className="mb-3 flex gap-2 rounded-lg bg-[var(--p-warn-soft)] px-3 py-2 text-[0.84rem] text-[var(--p-warn)]" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{problem}</p>}

          <div className="overflow-x-auto rounded-lg border border-[var(--p-line)]">
            <table className="w-full min-w-[620px] border-collapse text-left text-[0.84rem]">
              <thead className="bg-[#f5f8fa] text-[0.72rem] font-semibold uppercase tracking-[0.05em] text-[var(--p-muted)]">
                <tr><th className="px-3 py-2.5">Level</th><th className="px-3 py-2.5">Room Name</th><th className="px-3 py-2.5">Capacity</th><th className="px-3 py-2.5">Available Time</th></tr>
              </thead>
              <tbody>
                {!day && !problem && <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--p-muted)]" role="status">Loading availability.</td></tr>}
                {rooms.map((room) => (
                  <tr key={room.id} className="border-t border-[var(--p-line)] align-top">
                    <td className="px-3 py-2.5 font-semibold">L{room.level}</td>
                    <td className="px-3 py-2.5 font-semibold">
                      {room.id.startsWith("SSR") ? LIBRARY_ROOM_BY_ID[room.id].name : room.id}
                      {room.remark && <span className="ml-2 inline-flex items-center gap-1 text-[var(--p-danger)]" title={room.remark}><Wrench size={13} /><span className="text-[0.72rem]">{room.remark}</span></span>}
                    </td>
                    <td className="px-3 py-2.5">{room.capacity}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {SLOTS.map((s) => {
                          const slot = room.slots[s.index];
                          const yours = mineAt(room.id, s.index);
                          const past = hasStarted(date, s.index, DEMO_NOW);
                          const look = yours ? "bg-[var(--p-success)] text-white" : slot.status === "closed" ? "bg-[var(--p-danger-soft)] text-[var(--p-danger)]" : slot.status === "reserved" || past ? "bg-[#e4e7ee] text-[#8a8fa6]" : "bg-[var(--p-primary)] text-white";
                          const word = yours ? "booked by your student" : slot.status === "closed" ? "closed" : past ? "already started" : slot.status;
                          return <span key={s.index} title={`${s.start} to ${s.end}, ${word}`} aria-label={`${room.id} ${s.start} to ${s.end}, ${word}`} className={`inline-flex min-h-[30px] items-center rounded-md px-2 text-[0.74rem] font-semibold ${look}`}>{s.start} - {s.end}{yours && <Check size={12} strokeWidth={3} className="ml-1" />}</span>;
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PCard>

        <aside className="space-y-4 lg:sticky lg:top-[76px]" aria-label="Library desk actions">
          <PCard title="Library desk" subtitle="Change what other people have booked" bodyClass="p-4">
            <ul className="space-y-3">
              {libraryEvents.map((event) => {
                const done = triggered.includes(event.id);
                return (
                  <li key={event.id} className="rounded-lg bg-[#f5f8fa] p-3">
                    <p className="text-[0.86rem] font-semibold leading-snug">{event.title}</p>
                    <p className="mt-0.5 text-[0.78rem] leading-snug text-[var(--p-muted)]">{event.summary}</p>
                    <PButton small className="mt-2" onClick={() => triggerEvent(event.id)} disabled={done}>{done ? <><Check size={13} strokeWidth={3} /> Triggered</> : "Trigger"}</PButton>
                  </li>
                );
              })}
            </ul>
          </PCard>
          <PCard bodyClass="p-4"><p className="text-[0.82rem] leading-snug text-[var(--p-muted)]">When a room your student has booked is closed here, Compass flags that booking under My bookings and offers to find another room.</p></PCard>
        </aside>
      </div>

      <PModal open={modal === "policy"} title="Library Rooms Guidelines and Notes" onClose={() => setModal(null)}>
        <ul className="list-disc space-y-2 pl-5 text-[0.9rem] leading-relaxed">{BOOKING_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="mt-4 rounded-lg bg-[var(--p-warn-soft)] px-3 py-2 text-[0.8rem] text-[var(--p-warn)]">These rules were written for this demo. They follow the real library&rsquo;s rules in outline only.</p>
      </PModal>
      <PModal open={modal === "mine"} title="My Bookings" onClose={() => setModal(null)}>
        {bookings.length === 0 ? <p className="text-[0.9rem] text-[var(--p-muted)]">Your student has no bookings yet. Book a room in Compass and it appears here.</p> : (
          <ul className="divide-y divide-[var(--p-line)]">
            {[...bookings].sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div><p className="text-[0.92rem] font-semibold">{LIBRARY_ROOM_BY_ID[b.roomId].name}</p><p className="text-[0.8rem] text-[var(--p-muted)]">{fmt(b.date)}, {SLOTS[b.slot].start} - {SLOTS[b.slot].end}</p></div>
                <Badge tone="green">Booked</Badge>
              </li>
            ))}
          </ul>
        )}
      </PModal>
    </>
  );
}
