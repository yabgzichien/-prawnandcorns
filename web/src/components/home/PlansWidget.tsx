"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/state";
import type { WidgetSize } from "@/lib/widget-layout";
import { dayShort, dateShort, timeOf } from "@/lib/time";
import { SLOTS, slotWindow } from "@/lib/library/policy";
import { LIBRARY_ROOM_BY_ID, whereIs } from "@/lib/library/rooms";
import { CardTitle } from "@/components/ui/kit";

/** What the student has saved in this browser: the study plan, then reminders, library bookings and calendar entries. */
export function PlansWidget({ size }: { size: WidgetSize }) {
  const { hydrated, studySessions, removeStudySession, reminders, personalEvents, removeReminder, removeEvent, bookings, cancelLibraryBooking } = useApp();
  const [all, setAll] = useState(false);
  const entries = [
    ...reminders.map((r) => ({ key: `r-${r.id}`, kind: "Reminder", title: r.title, at: r.at, when: `${dayShort(new Date(r.at))} ${dateShort(new Date(r.at))}, ${timeOf(new Date(r.at))}`, remove: () => removeReminder(r.id) })),
    ...bookings.map((b) => { const w = slotWindow(b.date, b.slot); const r = LIBRARY_ROOM_BY_ID[b.roomId]; return { key: `b-${b.id}`, kind: "Library booking", title: r.name, at: w.start, when: `${dayShort(new Date(w.start))} ${dateShort(new Date(w.start))}, ${SLOTS[b.slot].start} to ${SLOTS[b.slot].end}, A3 ${whereIs(r)}`, remove: () => { cancelLibraryBooking(b.id); } }; }),
    ...personalEvents.map((e) => ({ key: `e-${e.id}`, kind: "Calendar", title: e.title, at: e.start, when: `${dayShort(new Date(e.start))} ${dateShort(new Date(e.start))}, ${timeOf(new Date(e.start))} to ${timeOf(new Date(e.end))}${e.place ? `, ${e.place}` : ""}`, remove: () => removeEvent(e.id) })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const sessions = [...studySessions].sort((a, b) => a.start.localeCompare(b.start));
  const compact = size === "compact" && !all;
  const shownSessions = compact ? sessions.slice(0, 1) : sessions;
  const shownEntries = compact ? entries.slice(0, sessions.length ? 0 : 1) : entries;

  return (
    <div>
      <CardTitle title="My plans" action={<span className="t-caption">Saved in this browser (demo data, MYT)</span>} />
      {hydrated && sessions.length === 0 && entries.length === 0 && (
        <p className="t-sub">Nothing saved yet. Study plans, reminders, library bookings and calendar entries you confirm will show here.</p>
      )}

      <div className={size === "wide" ? "home-plans-wide" : undefined}>
        {hydrated && shownSessions.length > 0 && (
          <section aria-label="Confirmed study plan" className="mb-4 last:mb-0">
            <h3 className="t-eyebrow mb-1">Your study plan</h3>
            <ul className="-mx-2 divide-y divide-sep">
              {shownSessions.map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 px-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.92rem] font-semibold">{session.title}</p>
                    <p className="t-caption">{session.start.slice(0, 10)}, {session.start.slice(11, 16)}–{session.end.slice(11, 16)}</p>
                  </div>
                  <button type="button" onClick={() => removeStudySession(session.id)} aria-label={`Remove saved study session for ${session.title}`} className="press btn btn-sm btn-plain shrink-0"><X size={15} /> Remove</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hydrated && shownEntries.length > 0 && (
          <section aria-label="Reminders and calendar entries">
            <h3 className="t-eyebrow mb-1">Reminders, bookings and calendar</h3>
            <ul className="-mx-2 divide-y divide-sep">
              {shownEntries.map((item) => {
                const verb = item.kind === "Library booking" ? "Cancel" : "Remove";
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3 px-2 py-2.5">
                    <div className="min-w-0">
                      <p className="break-words text-[0.92rem] font-semibold">{item.title}</p>
                      <p className="t-caption">{item.kind}, {item.when}</p>
                    </div>
                    <button type="button" onClick={item.remove} aria-label={`${verb} ${item.kind.toLowerCase()}: ${item.title}`} className="press btn btn-sm btn-plain shrink-0"><X size={15} /> {verb}</button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      {hydrated && size === "compact" && sessions.length + entries.length > 1 && (
        <button type="button" onClick={() => setAll((value) => !value)} aria-expanded={all} className="press mt-2 inline-flex items-center gap-1 text-[0.88rem] font-semibold text-accent">
          {all ? "Show fewer" : "View all"} <ChevronDown size={15} className={all ? "rotate-180" : ""} />
        </button>
      )}
    </div>
  );
}
