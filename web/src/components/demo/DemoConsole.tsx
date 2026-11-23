"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, RotateCcw, Send } from "lucide-react";
import { EVENT_BY_ID, EVENT_GROUPS, SCENARIO_EVENTS } from "@/lib/world/events";
import { CUSTOM_LIMITS, CUSTOM_MAIL_KEY, SCENARIO_KEY, addCustomNotice, cleanLocalList, resetScenario, subscribeScenario, triggerEvent } from "@/lib/world/storage";

/** The presenter's raw stored text. A string is a stable snapshot, so React does not re-render needlessly. */
const raw = (key: string) => () => { try { return localStorage.getItem(key) ?? "[]"; } catch { return "[]"; } };
const useStored = (key: string): string => useSyncExternalStore(subscribeScenario, raw(key), () => "[]");

/**
 * A deliberately plain page: it must not look like Moodle, the Academic Centre or any real XMUM site.
 * It has no university logos and is not linked from the student navigation.
 */
export function DemoConsole() {
  const triggered = cleanLocalList(useStored(SCENARIO_KEY));
  const customRaw = useStored(CUSTOM_MAIL_KEY);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");

  let customCount = 0;
  try { const parsed: unknown = JSON.parse(customRaw); customCount = Array.isArray(parsed) ? parsed.length : 0; } catch {}

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const added = addCustomNotice({ from, subject, body });
    setNote(added ? "Added to the mock inbox. Compass will treat it as an untrusted email." : "Write some text first, and check that site storage is enabled.");
    if (added) { setBody(""); setSubject(""); }
  };

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6">
      <p className="mb-3 inline-block rounded-full border border-sep px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wider text-label-2">Presenter only, not part of the student app</p>
      <h1 className="t-title">Demo console: pretend to be a lecturer or office</h1>
      <p className="t-sub mt-2 max-w-2xl">Each button below changes the invented campus systems. Open Compass in another window, connect the systems on its Connections page, then click here. Compass notices within a second. Everything is fictional.</p>

      <section className="mt-6 rounded-2xl border border-sep p-4 text-[0.9rem]" aria-label="How to run the demo">
        <h2 className="font-semibold">Suggested run</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-label-2">
          <li>In Compass, connect all four systems, then ask for a study plan and confirm it. That gives the deadline event something to clash with.</li>
          <li>Click &quot;Extend the Lab 6 report deadline to Friday&quot; here.</li>
          <li>In Compass, tap Review on the banner, read the proposal, then approve it. Undo is available for a few seconds.</li>
        </ol>
      </section>

      {EVENT_GROUPS.map((group) => (
        <section key={group} className="mt-8" aria-labelledby={`g-${group}`}>
          <h2 id={`g-${group}`} className="t-eyebrow mb-2">{group}</h2>
          <ul className="divide-y divide-sep rounded-2xl border border-sep">
            {SCENARIO_EVENTS.filter((e) => e.group === group).map((event) => {
              const done = triggered.includes(event.id);
              return (
                <li key={event.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <p className="font-semibold">{event.title}</p>
                    <p className="t-caption mt-0.5">{event.summary}</p>
                  </div>
                  <button onClick={() => triggerEvent(event.id)} disabled={done} className="press btn btn-sm btn-primary disabled:opacity-50">
                    {done ? <><Check size={14} strokeWidth={3} /> Triggered</> : "Trigger"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-8 rounded-2xl border border-sep p-4" aria-labelledby="g-triggered">
        <div className="flex items-center justify-between gap-3">
          <h2 id="g-triggered" className="t-eyebrow">Triggered so far</h2>
          <button onClick={() => { resetScenario(); setNote("Scenario cleared."); }} className="press btn btn-sm btn-plain"><RotateCcw size={14} /> Reset</button>
        </div>
        {triggered.length === 0 ? <p className="t-sub mt-2">Nothing yet. The invented campus is in its starting state.</p> : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.92rem]">
            {triggered.map((id) => <li key={id}>{EVENT_BY_ID[id]?.title ?? id}</li>)}
          </ol>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-sep p-4" aria-labelledby="g-own">
        <h2 id="g-own" className="t-eyebrow">Write your own email</h2>
        <p className="t-sub mt-1">Good for a judge&rsquo;s question such as &quot;what if the lecturer writes this?&quot;. The text stays in this browser only. Compass reads it like any outside email, as untrusted content, and a connected email system must be on.</p>
        <form onSubmit={send} className="mt-3 grid gap-3">
          <label className="grid gap-1 text-[0.85rem] font-semibold">From
            <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={CUSTOM_LIMITS.from} placeholder="Dr. Lim (demo)" className="rounded-xl bg-surface-2 px-3 py-2.5 text-[0.95rem] font-normal outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent" />
          </label>
          <label className="grid gap-1 text-[0.85rem] font-semibold">Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={CUSTOM_LIMITS.subject} placeholder="Tutorial moved" className="rounded-xl bg-surface-2 px-3 py-2.5 text-[0.95rem] font-normal outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent" />
          </label>
          <label className="grid gap-1 text-[0.85rem] font-semibold">Message
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={CUSTOM_LIMITS.body} rows={5} placeholder="The Thursday tutorial is moved to Friday 27 Nov at 15:00 in A2-104." className="resize-y rounded-xl bg-surface-2 px-3 py-2.5 text-[0.95rem] font-normal outline-none ring-1 ring-sep focus:ring-2 focus:ring-accent" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!body.trim()} className="press btn btn-primary disabled:opacity-40"><Send size={16} /> Add to inbox</button>
            <span className="t-caption" role="status">{note || `${customCount} custom email${customCount === 1 ? "" : "s"} in this browser`}</span>
          </div>
        </form>
      </section>
    </div>
  );
}
