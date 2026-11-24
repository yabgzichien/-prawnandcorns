"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import { fetchLibraryDay } from "@/lib/library/client";
import type { RoomOption } from "@/lib/library/search";
import { SLOTS } from "@/lib/library/policy";
import { LIBRARY_ROOM_BY_ID, whereIs } from "@/lib/library/rooms";
import { useApp } from "@/lib/state";
import { dateShort, dayShort } from "@/lib/time";
import { getTriggeredEvents } from "@/lib/world/storage";

const day = (date: string) => { const d = new Date(`${date}T12:00:00+08:00`); return `${dayShort(d)} ${dateShort(d)}`; };

/** Rooms that are free and fit the rules. Tapping Book is the student's approval: the assistant never books alone. */
export function RoomsCard({ card, onNavigate }: { card: { summary: string; options: RoomOption[]; alternatives: boolean }; onNavigate: () => void }) {
  const { bookings, bookLibraryRoom } = useApp();
  const [error, setError] = useState("");
  if (card.options.length === 0) return <div className="rounded-2xl bg-surface p-4 text-[0.9rem] font-medium" role="status">No library room is free for that. Try another day or time, or open Library rooms to look yourself.</div>;
  return (
    <section className="overflow-hidden rounded-2xl bg-surface" aria-label="Library rooms you can book">
      <div className="border-b border-sep px-3.5 py-3"><h3 className="text-[0.95rem] font-semibold">{card.alternatives ? "Closest free rooms" : "Free rooms"}</h3><p className="t-caption">Understood as: {card.summary}</p></div>
      <ul className="divide-y divide-sep">
        {card.options.map((o) => {
          const room = LIBRARY_ROOM_BY_ID[o.roomId];
          const mine = bookings.some((b) => b.roomId === o.roomId && b.date === o.date && b.slot === o.slot);
          const link = `/hub?section=library&room=${o.roomId}&date=${o.date}&slot=${o.slot}`;
          return (
            <li key={o.roomId} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold">{o.roomId}, {day(o.date)}, {SLOTS[o.slot].start} to {SLOTS[o.slot].end}</p>
                <p className="t-caption">{room.name}, up to {room.capacity}. A3 Library, {whereIs(room)}</p>
              </div>
              <div className="flex gap-2">
                <Link href={link} onClick={onNavigate} className="press btn btn-sm btn-plain"><MapPin size={14} /> Map</Link>
                {mine ? <span className="btn btn-sm btn-tint pointer-events-none"><Check size={14} strokeWidth={3} /> Booked</span> : (
                  <button type="button" onClick={async () => {
                    // the card may be minutes old, so ask the library again before booking
                    try {
                      const day = await fetchLibraryDay(o.date, getTriggeredEvents());
                      if (day.rooms.find((r) => r.id === o.roomId)?.slots[o.slot]?.status !== "available") { setError(`${o.roomId} at ${SLOTS[o.slot].start} is no longer free. Ask again for fresh options.`); return; }
                    } catch { setError("The library booking system did not answer. Try again in a moment."); return; }
                    const r = bookLibraryRoom(o.roomId, o.date, o.slot);
                    setError(r.ok ? "" : r.error);
                  }} className="press btn btn-sm btn-primary">Book</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="border-t border-sep px-3.5 py-2.5 text-[0.82rem] text-red" role="alert">{error}</p>}
      <p className="t-caption border-t border-sep px-3.5 py-2.5">Saved in this browser only, with an Undo. One two-hour slot per day.</p>
    </section>
  );
}
