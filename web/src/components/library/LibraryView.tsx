"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CalendarClock, ChevronDown, DoorClosed, MapPin, Users, Wrench, X } from "lucide-react";
import { fetchLibraryDay, type LibraryDay } from "@/lib/library/client";
import { overlapWith } from "@/lib/library/overlap";
import { bookableDates, cancelDeadline, checkBooking, checkCancel, CANCEL_GRACE_MINUTES, hasStarted, isDate, MAX_DAYS_AHEAD, SLOTS, type LibraryBooking } from "@/lib/library/policy";
import { CATEGORIES, CATEGORY_INFO, LIBRARY_ROOM_BY_ID, whereIs, type LibraryRoom, type RoomCategory } from "@/lib/library/rooms";
import { classBlocksFrom } from "@/lib/planning-demo";
import { DEMO_NOW, dateShort, dayShort } from "@/lib/time";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { getTriggeredEvents, subscribeScenario } from "@/lib/world/storage";
import { PageHeader, Pill, Segmented } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/Sheet";
import { RoomLocator } from "./RoomLocator";

type Tab = RoomCategory | "mine";
type SlotState = "available" | "reserved" | "closed" | "yours" | "started";
type Pick = { roomId: string; date: string; slot: number | null };

const fmtDate = (date: string) => { const d = new Date(`${date}T12:00:00+08:00`); return `${dayShort(d)} ${dateShort(d)}`; };
const fmtSlot = (slot: number) => `${SLOTS[slot].start} to ${SLOTS[slot].end}`;
const niceLabel = (label: string) => label.replace(/^([a-z]{3}\d{4})/, (m) => m.toUpperCase());

export function LibraryView() {
  const params = useSearchParams();
  const { bookings, bookLibraryRoom, cancelLibraryBooking, studySessions, personalEvents, hydrated } = useApp();
  const { data } = useCampus();
  const dates = useMemo(() => bookableDates(DEMO_NOW), []);

  // A link such as /hub?section=library&room=N205&date=2026-11-24&slot=3 opens straight onto that room.
  const linkRoom = LIBRARY_ROOM_BY_ID[params.get("room") ?? ""];
  const linkDate = params.get("date") ?? "";
  const linkSlot = Number(params.get("slot"));
  const [date, setDate] = useState(isDate(linkDate) && dates.includes(linkDate) ? linkDate : dates[0]);
  const [tab, setTab] = useState<Tab>(linkRoom?.category ?? "silent");
  const [pick, setPick] = useState<Pick | null>(() => linkRoom ? { roomId: linkRoom.id, date: isDate(linkDate) && dates.includes(linkDate) ? linkDate : dates[0], slot: Number.isInteger(linkSlot) && linkSlot >= 0 && linkSlot < SLOTS.length && params.get("slot") !== null ? linkSlot : null } : null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [days, setDays] = useState<Record<string, LibraryDay>>({});
  const [problem, setProblem] = useState("");
  const [tick, setTick] = useState(0);

  // Pick up changes the presenter makes in the console window.
  useEffect(() => subscribeScenario(() => setTick((n) => n + 1)), []);

  const needed = useMemo(() => [...new Set([date, ...bookings.map((b) => b.date)])].sort(), [date, bookings]);
  const neededKey = needed.join(",");
  useEffect(() => {
    const ac = new AbortController();
    const events = getTriggeredEvents();
    Promise.all(needed.map((d) => fetchLibraryDay(d, events, ac.signal).then((r) => [d, r] as const)))
      .then((rows) => { setDays((cur) => ({ ...cur, ...Object.fromEntries(rows) })); setProblem(""); })
      .catch((e: unknown) => { if (!ac.signal.aborted) setProblem(e instanceof Error ? e.message : "The library booking system did not answer."); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededKey, tick]);

  const busy = useMemo(() => [
    ...classBlocksFrom(data.classes).map((b) => ({ ...b, label: niceLabel(b.label) })),
    ...studySessions.map((s) => ({ label: `study session "${s.title}"`, start: s.start, end: s.end })),
    ...personalEvents.map((e) => ({ label: `calendar entry "${e.title}"`, start: e.start, end: e.end })),
  ], [data.classes, studySessions, personalEvents]);

  const day = days[date];
  const stateOf = (room: { id: string; slots: { index: number; status: string }[] }, d: string, slot: number): SlotState => {
    if (bookings.some((b) => b.roomId === room.id && b.date === d && b.slot === slot)) return "yours";
    if (hasStarted(d, slot, DEMO_NOW)) return "started";
    const status = days[d]?.rooms.find((r) => r.id === room.id)?.slots[slot]?.status;
    return status === "closed" ? "closed" : status === "reserved" ? "reserved" : "available";
  };

  const visible = tab === "mine" || !day ? [] : day.rooms.filter((r) => r.category === tab);
  const wings = [...new Set(visible.map((r) => r.wing))];
  const mine = [...bookings].sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot);

  return (
    <div>
      <PageHeader
        eyebrow="Block A3 library"
        title="Study rooms"
        sub={`Book a two-hour slot up to ${MAX_DAYS_AHEAD} days ahead, counting today. One slot per day. Availability is invented demo data, and bookings are saved in this browser only.`}
        action={<button onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen} className="press btn btn-plain">Booking rules <ChevronDown size={15} style={{ transform: rulesOpen ? "rotate(180deg)" : "none", transition: "transform .25s" }} /></button>}
      />

      <AnimatePresence initial={false}>
        {rulesOpen && (
          <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="mb-5 overflow-hidden" aria-label="Library room booking rules">
            <ul className="card list-disc space-y-1.5 py-4 pl-9 pr-5 text-[0.9rem]">
              <li>Library rooms are for campus users only, in fixed two-hour slots from 09:00 to 21:00.</li>
              <li>Book up to {MAX_DAYS_AHEAD} days ahead, counting today. Each person can book one slot per day.</li>
              <li>Cancel any time before the start, and up to {CANCEL_GRACE_MINUTES} minutes after it. Then you can book another room if one is free.</li>
              <li>A booking cannot be handed to someone else. The person who booked must be in the room.</li>
              <li>Student success room 3 is for 5 to 10 people. The other rooms hold 2 or 4.</li>
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Day" className="flex gap-1.5">
          {dates.map((d, i) => {
            const on = date === d;
            const dt = new Date(`${d}T12:00:00+08:00`);
            return (
              <button key={d} role="tab" aria-selected={on} onClick={() => setDate(d)} className="press flex min-h-[56px] w-[72px] flex-col items-center justify-center rounded-2xl text-[0.8rem] font-semibold" style={{ background: on ? "var(--accent)" : "var(--surface)", color: on ? "var(--accent-fg)" : "var(--label)", boxShadow: "var(--shadow-sm)" }}>
                <span className="opacity-70">{i === 0 ? "Today" : dayShort(dt)}</span>
                <span className="tnum text-[1.1rem] tracking-[-0.02em]">{dateShort(dt)}</span>
              </button>
            );
          })}
        </div>
        <Segmented<Tab> label="Room type" value={tab} onChange={setTab} options={[...CATEGORIES.map((c) => ({ value: c as Tab, label: CATEGORY_INFO[c].short })), { value: "mine", label: `My bookings${bookings.length ? ` (${bookings.length})` : ""}` }]} />
      </div>

      {problem && <p className="mb-4 flex gap-2 rounded-2xl bg-orange-soft px-4 py-3 text-[0.88rem] text-orange" role="alert"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{problem} Try again in a moment.</p>}

      {tab === "mine" ? (
        <MyBookings bookings={mine} days={days} onFind={(b) => { setDate(b.date); setTab(LIBRARY_ROOM_BY_ID[b.roomId].category); }} onLocate={(b) => setPick({ roomId: b.roomId, date: b.date, slot: null })} onCancel={(b) => { const r = cancelLibraryBooking(b.id); if (!r.ok) setProblem(r.error); }} />
      ) : (
        <>
          <p className="t-sub mb-3">{CATEGORY_INFO[tab].blurb}</p>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.76rem] font-medium text-label-2" aria-label="Slot colours">
            <li className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-accent-soft ring-1 ring-accent" />Available</li>
            <li className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-surface-2 ring-1 ring-sep" />Reserved by someone</li>
            <li className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-green" />Yours</li>
            <li className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-red-soft ring-1 ring-red" />Closed</li>
          </ul>
          {!day && !problem && <p className="t-sub" role="status">Loading the day&rsquo;s availability.</p>}
          {wings.map((wing) => (
            <section key={wing} className="mb-5" aria-label={`${CATEGORY_INFO[tab].title}, ${wing} wing`}>
              <h2 className="t-eyebrow mb-2 px-1">{wing} wing, Level {visible.find((r) => r.wing === wing)?.level}</h2>
              <ul className="card divide-y divide-sep overflow-hidden">
                {visible.filter((r) => r.wing === wing).map((room) => (
                  <li key={room.id} className="px-4 py-3.5">
                    <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h3 className="text-[1rem] font-semibold tracking-[-0.012em]">{room.id}</h3>
                      <span className="t-caption flex items-center gap-1"><Users size={13} />{room.minPax ? `${room.minPax} to ${room.capacity}` : `Up to ${room.capacity}`}</span>
                      {room.remark && <Pill tone="red"><Wrench size={12} /> {room.remark}</Pill>}
                      <button onClick={() => setPick({ roomId: room.id, date, slot: null })} className="press ml-auto inline-flex min-h-[32px] items-center gap-1 text-[0.8rem] font-semibold text-accent"><MapPin size={14} /> Where is it?</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="group" aria-label={`${room.id} time slots`}>
                      {SLOTS.map((s) => {
                        const st = stateOf(room, date, s.index);
                        const can = st === "available";
                        return (
                          <button
                            key={s.index} type="button" disabled={!can && st !== "yours"} onClick={() => setPick({ roomId: room.id, date, slot: s.index })}
                            aria-label={`${room.id}, ${s.start} to ${s.end}, ${st === "started" ? "already started" : st}`}
                            className={`press min-h-[44px] rounded-xl px-1 text-[0.8rem] font-semibold leading-tight ${st === "available" ? "bg-accent-soft text-accent ring-1 ring-accent/50" : st === "yours" ? "bg-green text-bg" : st === "closed" ? "bg-red-soft text-red" : "bg-surface-2 text-label-3"} disabled:cursor-not-allowed`}
                            style={st === "started" ? { opacity: 0.5 } : undefined}
                          >
                            <span className={`tnum block ${st === "reserved" || st === "started" ? "line-through decoration-label-3/60" : ""}`}>{s.start}</span>
                            <span className="block text-[0.66rem] font-medium opacity-80">{st === "available" ? "Free" : st === "yours" ? "Yours" : st === "closed" ? "Closed" : st === "started" ? "Started" : "Reserved"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <BookingSheet
        pick={pick} onClose={() => setPick(null)} day={pick ? days[pick.date] : undefined} bookings={bookings} busy={busy} hydrated={hydrated}
        onConfirm={(p) => { if (p.slot === null) return null; const r = bookLibraryRoom(p.roomId, p.date, p.slot); if (r.ok) { setPick(null); return null; } return r.error; }}
      />
    </div>
  );
}

function MyBookings({ bookings, days, onFind, onLocate, onCancel }: { bookings: LibraryBooking[]; days: Record<string, LibraryDay>; onFind: (b: LibraryBooking) => void; onLocate: (b: LibraryBooking) => void; onCancel: (b: LibraryBooking) => void }) {
  if (bookings.length === 0) {
    return <div className="grid place-items-center rounded-2xl border border-dashed border-sep px-6 py-12 text-center"><CalendarClock size={26} className="text-label-3" /><p className="t-headline mt-2">No rooms booked</p><p className="t-sub mt-1 max-w-sm">Pick a free slot on any room type and it will appear here. Bookings are saved in this browser only.</p></div>;
  }
  return (
    <ul className="space-y-3" aria-label="My library bookings">
      {bookings.map((b) => {
        const room = LIBRARY_ROOM_BY_ID[b.roomId];
        const live = days[b.date]?.rooms.find((r) => r.id === b.roomId);
        const closed = live?.slots[b.slot]?.status === "closed";
        const cancel = checkCancel(b, DEMO_NOW);
        return (
          <li key={b.id} className="card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-soft text-green"><Check size={20} strokeWidth={3} /></span>
              <div className="min-w-0 flex-1">
                <p className="t-headline break-words">{room.name}</p>
                <p className="t-sub">{fmtDate(b.date)}, {fmtSlot(b.slot)}</p>
                <p className="t-caption">A3 Library, {whereIs(room)}. Up to {room.capacity} people.</p>
                {closed && <p className="mt-2 flex gap-2 rounded-xl bg-red-soft px-3 py-2 text-[0.85rem] text-red" role="alert"><DoorClosed size={16} className="mt-0.5 shrink-0" /><span>The library has closed this room for this slot ({live?.remark ?? "closed"}). Cancel it and book another room.</span></p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onLocate(b)} className="press btn btn-sm btn-tint"><MapPin size={14} /> Show on map</button>
              {closed && <button onClick={() => onFind(b)} className="press btn btn-sm btn-plain">Find another room</button>}
              <button onClick={() => onCancel(b)} disabled={!cancel.ok} title={cancel.ok ? `You can cancel until ${new Date(cancelDeadline(b)).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" })}` : cancel.error} className="press btn btn-sm btn-plain disabled:opacity-40"><X size={14} /> Cancel booking</button>
            </div>
            {!cancel.ok && <p className="t-caption mt-2">{cancel.error}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function BookingSheet({ pick, onClose, day, bookings, busy, hydrated, onConfirm }: { pick: Pick | null; onClose: () => void; day: LibraryDay | undefined; bookings: LibraryBooking[]; busy: { label: string; start: string; end: string }[]; hydrated: boolean; onConfirm: (p: Pick) => string | null }) {
  const [error, setError] = useState("");
  const room: LibraryRoom | undefined = pick ? LIBRARY_ROOM_BY_ID[pick.roomId] : undefined;
  const slot = pick?.slot ?? null;
  const rules = pick && slot !== null ? checkBooking({ roomId: pick.roomId, date: pick.date, slot }, bookings, DEMO_NOW) : null;
  const live = pick && slot !== null ? day?.rooms.find((r) => r.id === pick.roomId)?.slots[slot]?.status : undefined;
  const gone = live === "closed" || live === "reserved";
  const clash = pick && slot !== null ? overlapWith(pick.date, slot, busy) : null;
  const label = pick ? `${slot === null ? "Where is" : "Book"} ${pick.roomId}` : "Library room";
  return (
    <Sheet open={pick !== null} onClose={() => { setError(""); onClose(); }} label={label}>
      {room && pick && (
        <>
          <header className="flex shrink-0 items-start gap-3 px-5 pb-3 pt-4 lg:pt-5">
            <div className="min-w-0 flex-1">
              <p className="t-eyebrow">{CATEGORY_INFO[room.category].title}</p>
              <h2 className="t-title !text-[1.6rem]">{slot === null ? room.name : `Book ${room.id}`}</h2>
            </div>
            <button onClick={() => { setError(""); onClose(); }} aria-label="Close" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-label-2"><X size={17} /></button>
          </header>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-2xl bg-surface p-4 text-[0.9rem]">
              {slot !== null && <><dt className="text-label-2">When</dt><dd className="font-semibold">{fmtDate(pick.date)}, {fmtSlot(slot)}</dd></>}
              <dt className="text-label-2">Where</dt><dd className="font-semibold">A3 Library, {whereIs(room)}</dd>
              <dt className="text-label-2">Fits</dt><dd className="font-semibold">{room.minPax ? `${room.minPax} to ${room.capacity} people` : `Up to ${room.capacity} people`}</dd>
              <dt className="text-label-2">Kind</dt><dd>{CATEGORY_INFO[room.category].tips[0]}. {CATEGORY_INFO[room.category].blurb}</dd>
            </dl>

            {slot !== null && rules && !rules.ok && <p className="flex gap-2 rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{rules.error}</p>}
            {slot !== null && gone && <p className="flex gap-2 rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" />This slot is no longer available.</p>}
            {slot !== null && clash && <p className="flex gap-2 rounded-xl bg-orange-soft px-3 py-2.5 text-[0.85rem] text-orange" role="status"><AlertTriangle size={16} className="mt-0.5 shrink-0" />This overlaps your {clash.label}. You can still book it.</p>}
            {error && <p className="rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert">{error}</p>}

            <RoomLocator roomId={room.id} />
          </div>
          <div className="shrink-0 border-t border-sep p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {slot !== null ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" disabled={!hydrated || !rules?.ok || gone} onClick={() => { const e = onConfirm(pick); if (e) setError(e); else setError(""); }} className="press btn btn-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-40"><Check size={16} /> Confirm booking</button>
                <button type="button" onClick={() => { setError(""); onClose(); }} className="press btn btn-plain min-h-11 flex-1 justify-center">Not now</button>
              </div>
            ) : <button type="button" onClick={() => { setError(""); onClose(); }} className="press btn btn-plain min-h-11 w-full justify-center">Close</button>}
            <p className="t-caption mt-2 text-center">Saved in this browser only. This demo does not contact the real library.</p>
          </div>
        </>
      )}
    </Sheet>
  );
}

