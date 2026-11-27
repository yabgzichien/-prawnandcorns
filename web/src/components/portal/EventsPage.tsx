"use client";

import { useMemo, useState } from "react";
import { BookOpen, Check, GraduationCap, History, Inbox, LayoutGrid, LibraryBig, ListChecks, Mail, Play, Presentation, Search, Users, Wallet, type LucideIcon } from "lucide-react";
import { EVENT_BY_ID, EVENT_GROUPS, SCENARIO_EVENTS } from "@/lib/world/events";
import { resetScenario, triggerEvent } from "@/lib/world/storage";
import type { EventGroup, ScenarioEvent } from "@/lib/world/types";
import { Badge, PButton, PCard, PageTitle, type PTone } from "./ui";
import { useTriggered } from "./useScenario";

const GROUP_TONE: Record<EventGroup, PTone> = { Lecturer: "blue", "Academic Centre": "purple", "Finance Office": "green", Clubs: "orange", Library: "teal", "Inbox and systems": "gray" };
const SHOWS_IN: Record<ScenarioEvent["system"], string> = { moodle: "Moodle", ac: "Academic Centre", finance: "Finance Office", mail: "University email", library: "Library rooms" };
const GROUP_ICON: Record<EventGroup | "All", LucideIcon> = { All: LayoutGrid, Lecturer: Presentation, "Academic Centre": GraduationCap, "Finance Office": Wallet, Clubs: Users, Library: LibraryBig, "Inbox and systems": Inbox };
const SYSTEM_ICON: Record<ScenarioEvent["system"], LucideIcon> = { moodle: BookOpen, ac: GraduationCap, finance: Wallet, mail: Mail, library: LibraryBig };
const TILE: Record<PTone, string> = { blue: "bg-[#e8f1ff] text-[#1556c0]", purple: "bg-[#f1e9ff] text-[#6a35c9]", green: "bg-[#e5f7ec] text-[#0f7a37]", orange: "bg-[#fff0dc] text-[#a35200]", teal: "bg-[#dff6f5] text-[#0b6f6c]", gray: "bg-[#eef1f5] text-[#4b5266]", red: "bg-[#fde8ee] text-[#b3113f]" };

/** The presenter's list of things that can happen on the invented campus. One click changes the shared world. */
export function EventsPage() {
  const triggered = useTriggered();
  const [group, setGroup] = useState<EventGroup | "All">("All");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => SCENARIO_EVENTS.filter((e) => (group === "All" || e.group === group) && `${e.title} ${e.summary} ${e.group}`.toLowerCase().includes(query.trim().toLowerCase())), [group, query]);

  return (
    <>
      <PageTitle title="Demo console" crumbs={["E-Services", "Announcements"]} />
      <p className="mb-5 max-w-3xl text-[0.92rem] leading-relaxed text-[var(--p-muted)]">Pretend to be a lecturer or an office. Each button changes the invented campus systems. Open Compass in another window, connect its systems, then trigger events here and watch Compass notice within a second.</p>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
              <span className="sr-only">Search events</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--p-muted)]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" className="min-h-[40px] w-full rounded-lg border border-[var(--p-line)] bg-white pl-9 pr-3 text-[0.88rem] outline-none focus:border-[var(--p-primary)] focus:ring-2 focus:ring-[var(--p-primary-soft)]" />
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by who is acting">
              {(["All", ...EVENT_GROUPS] as const).map((g) => {
                const GIcon = GROUP_ICON[g];
                return (
                  <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-[0.78rem] font-semibold transition-colors ${group === g ? "bg-[var(--p-primary)] text-white" : "bg-white text-[var(--p-muted)] ring-1 ring-[var(--p-line)] hover:text-[var(--p-ink)]"}`}><GIcon size={14} aria-hidden />{g}</button>
                );
              })}
            </div>
          </div>

          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
            {shown.map((event) => {
              const order = triggered.indexOf(event.id) + 1;
              const done = order > 0;
              const GIcon = GROUP_ICON[event.group];
              const SIcon = SYSTEM_ICON[event.system];
              return (
                <li key={event.id} className={`flex flex-col rounded-xl border bg-white p-4 shadow-[0_1px_3px_rgba(24,28,50,0.04)] transition-colors ${done ? "border-[#bfe6cd]" : "border-[var(--p-line)]"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${done ? "bg-[#e5f7ec] text-[#0f7a37]" : TILE[GROUP_TONE[event.group]]}`} aria-hidden>{done ? <Check size={20} strokeWidth={2.6} /> : <GIcon size={20} />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5"><Badge tone={GROUP_TONE[event.group]}>{event.group}</Badge></div>
                      <h3 className="text-[0.95rem] font-semibold leading-snug tracking-[-0.01em]">{event.title}</h3>
                    </div>
                  </div>
                  <p className="mt-2 flex-1 text-[0.82rem] leading-snug text-[var(--p-muted)]">{event.summary}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-[0.74rem] text-[var(--p-muted)]"><SIcon size={13} aria-hidden />Shows in {SHOWS_IN[event.system]}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {done ? <span className="text-[0.78rem] font-semibold text-[var(--p-success)]">Done, number {order}</span> : <span />}
                    <PButton small onClick={() => triggerEvent(event.id)} disabled={done}>{done ? <><Check size={14} strokeWidth={3} /> Triggered</> : <><Play size={13} fill="currentColor" aria-hidden /> Trigger</>}</PButton>
                  </div>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--p-line)] p-8 text-center text-[0.9rem] text-[var(--p-muted)]"><Search size={22} aria-hidden />No events match. Clear the search or pick All.</p>}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[76px]" aria-label="Run guide">
          <PCard title={<span className="inline-flex items-center gap-2"><History size={17} className="text-[var(--p-primary)]" aria-hidden />Triggered so far</span>} subtitle="In the order they happened" action={<PButton small variant="light" onClick={() => resetScenario()} disabled={triggered.length === 0}>Reset</PButton>} bodyClass="p-4">
            {triggered.length === 0 ? <p className="text-[0.85rem] text-[var(--p-muted)]">Nothing yet. The invented campus is in its starting state.</p> : (
              <ol className="list-decimal space-y-1.5 pl-5 text-[0.85rem]">{triggered.map((id) => <li key={id}>{EVENT_BY_ID[id]?.title ?? id}</li>)}</ol>
            )}
          </PCard>
          <PCard title={<span className="inline-flex items-center gap-2"><ListChecks size={17} className="text-[var(--p-primary)]" aria-hidden />Suggested run</span>} bodyClass="p-4">
            <ol className="list-decimal space-y-2 pl-5 text-[0.84rem] leading-snug text-[var(--p-muted)]">
              <li>In Compass, connect all four systems, ask for a study plan and confirm it.</li>
              <li>Here, trigger the Lab 6 deadline change.</li>
              <li>In Compass, tap Review on the banner, approve the fixes, then press Undo.</li>
              <li>Open Library Rooms in the side menu to close a room your student has booked.</li>
            </ol>
          </PCard>
        </aside>
      </div>
    </>
  );
}
