"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { CLUBS } from "@/lib/data/life";
import { defaultItemDates, nextLineId } from "@/lib/events/application";
import { ITEMS, ITEM_OFFICE_RULES, VENUES, VENUE_BY_ID } from "@/lib/events/catalogue";
import { addDays, checkApplication, dateLabel, freeVenues, issuesForLine, problemsOf, SEMESTER_END, warningsOf } from "@/lib/events/checks";
import { ARRANGEMENT_LABEL, ARRANGEMENTS, OFFICE_LABEL, type ArrangementType, type EventDraft, type EventLine, type Issue } from "@/lib/events/types";
import { SEEDED_APPLICATIONS } from "@/lib/events/seed";
import { useApp } from "@/lib/state";
import { DEMO_NOW } from "@/lib/time";
import { ymd } from "@/lib/library/policy";
import { Field, IssueRows, inputCls, lineTitle, lineWhen } from "./shared";
import { useDecisions } from "./useEventData";

const STEPS = ["Event", "Rooms", "Items", "Arrangements", "Review"] as const;
/**
 * The club event application as a form of five short steps. Compass fills in what it understood from the
 * student's words, and the student checks every step. Nothing is saved until Submit on the last step, and the
 * sheet says nothing is sent to a real office.
 */
export function EventApplicationSheet({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
  return (
    <Sheet open={draft !== null} onClose={onClose} label="Club event application" wide modalOnDesktop>
      {draft && <Form key={JSON.stringify(draft)} initial={draft} onClose={onClose} />}
    </Sheet>
  );
}

function Form({ initial, onClose }: { initial: EventDraft; onClose: () => void }) {
  const { submitEventApplication, eventApplications } = useApp();
  const decisions = useDecisions();
  const router = useRouter();
  const [d, setD] = useState<EventDraft>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  const others = useMemo(() => [...SEEDED_APPLICATIONS, ...eventApplications], [eventApplications]);
  const issues = useMemo(() => checkApplication(d, others, decisions, DEMO_NOW), [d, others, decisions]);
  const problems = problemsOf(issues);
  const today = ymd(DEMO_NOW.getTime());

  const patch = (p: Partial<EventDraft>) => { setError(""); setD((cur) => ({ ...cur, ...p })); };
  const setLine = (id: string, p: Partial<EventLine>) => patch({ lines: d.lines.map((l) => (l.id === id ? { ...l, ...p } as EventLine : l)) });
  const removeLine = (id: string) => patch({ lines: d.lines.filter((l) => l.id !== id) });
  const addLine = (line: EventLine) => patch({ lines: [...d.lines, line] });

  // each check is shown on the step where it can be fixed: a line's own step, room totals on Rooms, the rest on Event
  const venueLevel = (i: Issue) => !i.lineId && /^(capacity|no-lines|no-venue):/.test(i.id);
  const stepOf = (i: Issue): number => i.lineId ? (d.lines.find((l) => l.id === i.lineId)?.kind === "venue" ? 1 : d.lines.find((l) => l.id === i.lineId)?.kind === "item" ? 2 : 3) : venueLevel(i) ? 1 : 0;
  const forStep = (n: number) => issues.filter((i) => stepOf(i) === n && (i.level !== "info" || !!i.lineId));

  const submit = () => {
    const r = submitEventApplication(d);
    if (r.ok) { onClose(); router.push("/hub?section=events"); } else setError(r.error);
  };

  const free = useMemo(() => d.date && d.start && d.end ? freeVenues(d.date, d.start, d.end, 1, others, decisions).filter((v) => !d.lines.some((l) => l.kind === "venue" && l.venueId === v.id)).slice(0, 5) : [], [d.date, d.start, d.end, d.lines, others, decisions]);
  const venues = d.lines.filter((l) => l.kind === "venue");
  const items = d.lines.filter((l) => l.kind === "item");
  const care = d.lines.filter((l) => l.kind === "care");
  const seats = venues.reduce((n, l) => n + (VENUE_BY_ID[(l as { venueId: string }).venueId]?.capacity ?? 0), 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-start gap-3 px-5 pb-2 pt-4 lg:pt-5">
        <div className="min-w-0 flex-1"><p className="t-eyebrow">Club event application, demo</p><h2 ref={heading} tabIndex={-1} className="t-title !text-[1.45rem] outline-none">{STEPS[step]}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-3 text-label-2"><X size={17} /></button>
      </header>
      <ol className="flex shrink-0 gap-1.5 px-5 pb-3" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0 flex-1">
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className="group grid w-full gap-1 text-left">
              <span className="h-1.5 rounded-full transition-colors" style={{ background: i <= step ? "var(--accent)" : "var(--surface-3)" }} />
              <span className={`truncate text-[0.72rem] font-semibold ${i === step ? "text-label" : "text-label-3"}`}>{i + 1}. {s}{forStep(i).some((x) => x.level === "problem") && i < 4 ? " (to fix)" : ""}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        {step === 0 && (
          <>
            <p className="t-sub">Check what Compass understood. Every field can be changed.</p>
            <Field label="Event name" htmlFor="ev-name"><input id="ev-name" value={d.name} onChange={(e) => patch({ name: e.target.value.slice(0, 100) })} className={inputCls} placeholder="Robotics Demo Night" /></Field>
            <Field label="Organising club or clubs" htmlFor="ev-org"><input id="ev-org" list="ev-clubs" value={d.organisers} onChange={(e) => patch({ organisers: e.target.value.slice(0, 120) })} className={inputCls} placeholder="Robotics & AI Society" /><datalist id="ev-clubs">{CLUBS.map((c) => <option key={c.id} value={c.name} />)}</datalist></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Participants" htmlFor="ev-pax"><input id="ev-pax" type="number" inputMode="numeric" min={1} max={500} value={d.participants || ""} onChange={(e) => patch({ participants: Math.floor(Number(e.target.value)) || 0 })} className={inputCls} /></Field>
              <Field label="Date" htmlFor="ev-date"><input id="ev-date" type="date" min={addDays(today, 1)} max={SEMESTER_END} value={d.date} onChange={(e) => patch({ date: e.target.value })} className={inputCls} /></Field>
              <Field label="Starts" htmlFor="ev-start"><input id="ev-start" type="time" value={d.start} onChange={(e) => patch({ start: e.target.value })} className={inputCls} /></Field>
              <Field label="Ends" htmlFor="ev-end"><input id="ev-end" type="time" value={d.end} onChange={(e) => patch({ end: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="What is the event for?" htmlFor="ev-desc" hint="Offices read this first. Two or three sentences are enough."><textarea id="ev-desc" rows={4} value={d.description} onChange={(e) => patch({ description: e.target.value.slice(0, 600) })} className={`${inputCls} resize-y py-2.5 leading-relaxed`} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Adviser's name" htmlFor="ev-adv"><input id="ev-adv" value={d.adviser.name} onChange={(e) => patch({ adviser: { ...d.adviser, name: e.target.value.slice(0, 80) } })} className={inputCls} placeholder="Dr. Lim (demo)" /></Field>
              <Field label="Adviser's email" htmlFor="ev-advmail"><input id="ev-advmail" type="email" value={d.adviser.email} onChange={(e) => patch({ adviser: { ...d.adviser, email: e.target.value.slice(0, 100) } })} className={inputCls} placeholder="lim@demo.invalid" /></Field>
            </div>
            <IssueRows issues={forStep(0)} />
          </>
        )}

        {step === 1 && (
          <>
            <p className="t-sub">Ask for every room in this one application. Capacities are approximate. Rooms can be used from 08:00 to 22:00; add time to set up and clear up.</p>
            {venues.length === 0 && <p className="rounded-xl border border-dashed border-sep px-4 py-6 text-center text-[0.9rem] text-label-2">No room yet. Skip this step if your event is outdoors.</p>}
            {venues.map((l) => l.kind === "venue" && (
              <fieldset key={l.id} className="grid gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-sep">
                <legend className="px-1 text-[0.82rem] font-semibold">{lineTitle(l)}</legend>
                <Field label="Room" htmlFor={`v-${l.id}`}>
                  <select id={`v-${l.id}`} value={l.venueId} onChange={(e) => setLine(l.id, { venueId: e.target.value })} className={inputCls}>
                    {(["Block A classrooms", "Block B classrooms"] as const).map((g) => <optgroup key={g} label={g}>{VENUES.filter((v) => v.group === g).map((v) => <option key={v.id} value={v.id}>{v.name}, about {v.capacity} seats</option>)}</optgroup>)}
                  </select>
                </Field>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  <Field label="Date" htmlFor={`vd-${l.id}`}><input id={`vd-${l.id}`} type="date" value={l.date} onChange={(e) => setLine(l.id, { date: e.target.value })} className={inputCls} /></Field>
                  <Field label="From" htmlFor={`vs-${l.id}`}><input id={`vs-${l.id}`} type="time" value={l.start} onChange={(e) => setLine(l.id, { start: e.target.value })} className={inputCls} /></Field>
                  <Field label="Until" htmlFor={`ve-${l.id}`}><input id={`ve-${l.id}`} type="time" value={l.end} onChange={(e) => setLine(l.id, { end: e.target.value })} className={inputCls} /></Field>
                </div>
                <IssueRows issues={issuesForLine(issues, l.id)} compact />
                <button type="button" onClick={() => removeLine(l.id)} className="press btn btn-sm btn-plain justify-self-start text-red"><Trash2 size={14} /> Remove this room</button>
              </fieldset>
            ))}
            {venues.length > 0 && d.participants > 0 && <p className="t-caption">Your rooms seat about {seats}. You expect {d.participants} people.</p>}
            <div>
              <p className="t-eyebrow mb-2">{free.length ? "Free at your event time" : "Add a room"}</p>
              <div className="flex flex-wrap gap-2">
                {free.map((v) => <button key={v.id} type="button" onClick={() => addLine({ kind: "venue", id: nextLineId(d.lines, "venue"), venueId: v.id, date: d.date, start: d.start, end: d.end })} className="press btn btn-sm btn-tint"><Plus size={14} /> {v.id}, {v.capacity} seats{v.asked ? ", also asked for" : ""}</button>)}
                <button type="button" onClick={() => addLine({ kind: "venue", id: nextLineId(d.lines, "venue"), venueId: VENUES[0].id, date: d.date, start: d.start, end: d.end })} className="press btn btn-sm btn-plain"><Plus size={14} /> Choose another room</button>
              </div>
            </div>
            <IssueRows issues={forStep(1).filter((i) => !i.lineId)} />
          </>
        )}

        {step === 2 && (
          <>
            <p className="t-sub">Each office hands out its own items at set times. Collect and return dates are filled in from the office rules; change them if you need to.</p>
            {items.length === 0 && <p className="rounded-xl border border-dashed border-sep px-4 py-6 text-center text-[0.9rem] text-label-2">No items yet. Skip this step if you only need rooms.</p>}
            {items.map((l) => l.kind === "item" && (
              <fieldset key={l.id} className="grid gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-sep">
                <legend className="px-1 text-[0.82rem] font-semibold">{lineTitle(l)}</legend>
                <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
                  <Field label="Item" htmlFor={`i-${l.id}`}>
                    <select id={`i-${l.id}`} value={l.itemId} onChange={(e) => setLine(l.id, { itemId: e.target.value, ...defaultItemDates(e.target.value, d.date || addDays(today, 15)) })} className={inputCls}>
                      {(["eca", "pamo", "it"] as const).map((o) => <optgroup key={o} label={OFFICE_LABEL[o]}>{ITEMS.filter((i) => i.office === o).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}
                    </select>
                  </Field>
                  <Field label="How many" htmlFor={`iq-${l.id}`}><input id={`iq-${l.id}`} type="number" inputMode="numeric" min={1} value={l.qty || ""} onChange={(e) => setLine(l.id, { qty: Math.floor(Number(e.target.value)) || 0 })} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                  <Field label="Collect on" htmlFor={`ic-${l.id}`}><input id={`ic-${l.id}`} type="date" value={l.collectDate} onChange={(e) => setLine(l.id, { collectDate: e.target.value })} className={inputCls} /></Field>
                  <Field label="Return on" htmlFor={`ir-${l.id}`}><input id={`ir-${l.id}`} type="date" value={l.returnDate} onChange={(e) => setLine(l.id, { returnDate: e.target.value })} className={inputCls} /></Field>
                </div>
                <IssueRows issues={issuesForLine(issues, l.id)} compact />
                <button type="button" onClick={() => removeLine(l.id)} className="press btn btn-sm btn-plain justify-self-start text-red"><Trash2 size={14} /> Remove this item</button>
              </fieldset>
            ))}
            <Field label="Add an item" htmlFor="add-item">
              <select id="add-item" value="" onChange={(e) => { const id = e.target.value; if (id) addLine({ kind: "item", id: nextLineId(d.lines, "item"), itemId: id, qty: 1, ...defaultItemDates(id, d.date || addDays(today, 15)) }); }} className={inputCls}>
                <option value="">Choose an item to add</option>
                {(["eca", "pamo", "it"] as const).map((o) => <optgroup key={o} label={`${OFFICE_LABEL[o]}, collect ${ITEM_OFFICE_RULES[o].collect.start} to ${ITEM_OFFICE_RULES[o].collect.end}`}>{ITEMS.filter((i) => i.office === o).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}
              </select>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <p className="t-sub">Optional. Ask the Operation and Maintenance Office for something the room needs, such as a table layout, power or extra cleaning.</p>
            {care.map((l) => l.kind === "care" && (
              <fieldset key={l.id} className="grid gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-sep">
                <legend className="px-1 text-[0.82rem] font-semibold">{ARRANGEMENT_LABEL[l.arrangement]}</legend>
                <Field label="Type" htmlFor={`c-${l.id}`}><select id={`c-${l.id}`} value={l.arrangement} onChange={(e) => setLine(l.id, { arrangement: e.target.value as ArrangementType })} className={inputCls}>{ARRANGEMENTS.map((a) => <option key={a} value={a}>{ARRANGEMENT_LABEL[a]}</option>)}</select></Field>
                <Field label="What do you need?" htmlFor={`cd-${l.id}`}><textarea id={`cd-${l.id}`} rows={3} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value.slice(0, 300) })} className={`${inputCls} resize-y py-2.5`} /></Field>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                  <Field label="Date" htmlFor={`cdt-${l.id}`}><input id={`cdt-${l.id}`} type="date" value={l.date} onChange={(e) => setLine(l.id, { date: e.target.value })} className={inputCls} /></Field>
                  <Field label="From" htmlFor={`cs-${l.id}`}><input id={`cs-${l.id}`} type="time" value={l.start} onChange={(e) => setLine(l.id, { start: e.target.value })} className={inputCls} /></Field>
                  <Field label="Until" htmlFor={`ce-${l.id}`}><input id={`ce-${l.id}`} type="time" value={l.end} onChange={(e) => setLine(l.id, { end: e.target.value })} className={inputCls} /></Field>
                </div>
                <IssueRows issues={issuesForLine(issues, l.id)} compact />
                <button type="button" onClick={() => removeLine(l.id)} className="press btn btn-sm btn-plain justify-self-start text-red"><Trash2 size={14} /> Remove</button>
              </fieldset>
            ))}
            <button type="button" onClick={() => addLine({ kind: "care", id: nextLineId(d.lines, "care"), arrangement: "furniture", description: "", date: d.date, start: d.start, end: d.end })} className="press btn btn-sm btn-tint"><Plus size={14} /> Add an arrangement</button>
          </>
        )}

        {step === 4 && (
          <>
            <section aria-label="Summary" className="rounded-2xl bg-surface p-4 ring-1 ring-sep">
              <h3 className="break-words text-[1.05rem] font-semibold">{d.name || "Untitled event"}</h3>
              <p className="t-caption">{d.organisers || "No club yet"}, {d.date ? dateLabel(d.date) : "no date"}, {d.start} to {d.end}, {d.participants || 0} people</p>
              <p className="t-caption">Adviser: {d.adviser.name || "none"} {d.adviser.email}</p>
              <ul className="mt-3 grid gap-1.5 text-[0.88rem]">
                {d.lines.length === 0 && <li className="text-label-2">No rooms or items yet.</li>}
                {d.lines.map((l) => <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3"><span className="font-semibold">{lineTitle(l)}</span><span className="text-label-2">{lineWhen(l)}</span></li>)}
              </ul>
              <p className="t-caption mt-3">{d.lines.length} line{d.lines.length === 1 ? "" : "s"} go in one application. The ECA office answers each line, so you may get a mix of answers.</p>
            </section>
            {issues.filter((i) => i.level !== "info").length > 0 && (
              <section aria-label="Checks" className="grid gap-2">
                <h3 className="t-eyebrow">{problems.length ? `${problems.length} to fix before you submit` : `${warningsOf(issues).length} to read before you submit`}</h3>
                <IssueRows issues={issues.filter((i) => i.level !== "info")} />
                {problems.length > 0 && <button type="button" onClick={() => setStep(stepOf(problems[0]))} className="press btn btn-sm btn-tint justify-self-start">Go to the first one</button>}
              </section>
            )}
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[0.84rem] leading-relaxed text-label-2">Submitting saves this application in this browser. This demo sends nothing to a real office. In the console window, open Event Applications to answer it as the ECA office.</p>
          </>
        )}
        {error && <p className="rounded-xl bg-red-soft px-3 py-2.5 text-[0.85rem] text-red" role="alert">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-sep p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="press btn btn-plain min-h-11"><ArrowLeft size={16} /> Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" onClick={() => setStep(step + 1)} className="press btn btn-primary ml-auto min-h-11 flex-1 justify-center sm:flex-none">Next: {STEPS[step + 1]} <ArrowRight size={16} /></button>
          : <button type="button" onClick={submit} disabled={problems.length > 0} className="press btn btn-primary ml-auto min-h-11 flex-1 justify-center disabled:opacity-40 sm:flex-none"><Check size={16} /> Submit application</button>}
      </div>
    </div>
  );
}
