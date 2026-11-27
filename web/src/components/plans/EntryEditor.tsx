"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarDays, CheckSquare, Trash2 } from "lucide-react";
import { dateLabel, isTime } from "@/lib/events/checks";
import { hourAfter, overlapsFor, validateDraft, type EntryDraft, type EntryKind } from "@/lib/plans/entries";
import { timeText } from "@/lib/calendar/timeline";
import { useTimeline } from "@/components/home/useTimeline";
import { Segmented } from "@/components/ui/kit";

const field = "min-h-[44px] w-full min-w-0 rounded-xl bg-surface-2 px-3 text-[16px] ring-1 ring-sep outline-none placeholder:text-label-3 focus-visible:ring-2 focus-visible:ring-accent";
const label = "t-caption mb-1 block font-semibold";

const KIND_OPTIONS: { value: "event" | "todo"; label: string }[] = [{ value: "event", label: "Event" }, { value: "todo", label: "To-do" }];

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * One form for adding and editing a calendar event, a reminder or a to-do. Used in the calendar sheet and inside the assistant's card.
 * It never saves by itself: the student presses the button, the app checks the draft again, and only then is it written.
 */
export function EntryEditor({ initial, mode, onSave, onDelete, onCancel, submitLabel, autoFocus = true, notes = [], idPrefix = "entry", stickyActions = false }: {
  initial: EntryDraft;
  mode: "create" | "edit";
  onSave: (draft: EntryDraft) => SaveResult;
  onDelete?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
  /** Things the assistant wants the student to know, such as an assumed end time. */
  notes?: string[];
  idPrefix?: string;
  /** In a sheet: keep the buttons in view while the form scrolls. */
  stickyActions?: boolean;
}) {
  const [d, setD] = useState<EntryDraft>(initial);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const items = useTimeline();
  // the end follows the start until the student sets an end themselves
  const [endIsAuto, setEndIsAuto] = useState(mode === "create" && (!initial.end || initial.end === hourAfter(initial.start)));

  useEffect(() => { if (autoFocus) titleRef.current?.focus({ preventScroll: true }); }, [autoFocus]);

  const set = (patch: Partial<EntryDraft>) => { setError(""); setD((cur) => ({ ...cur, ...patch })); };
  const setStart = (start: string) => set({ start, ...(d.kind === "event" && endIsAuto && isTime(start) ? { end: hourAfter(start) } : {}) });
  const setKind = (kind: EntryKind) => { setError(""); setD((cur) => ({ ...cur, kind, end: kind === "event" ? cur.end || hourAfter(cur.start) : "" })); };

  const overlaps = useMemo(() => overlapsFor(items, d), [items, d]);
  const blocking = touched ? validateDraft(d) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const r = onSave(d);
    if (!r.ok) setError(r.error);
  };

  const id = (k: string) => `${idPrefix}-${k}`;
  const shownError = error || blocking || "";

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      {mode === "create" && d.kind !== "reminder" && (
        <Segmented label="What are you adding" value={d.kind as "event" | "todo"} options={KIND_OPTIONS} onChange={setKind} />
      )}

      <div>
        <label htmlFor={id("title")} className={label}>Title</label>
        <input id={id("title")} ref={titleRef} value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} autoComplete="off" enterKeyHint="done" placeholder={d.kind === "todo" ? "Buy a calculator" : d.kind === "reminder" ? "Bring my ID" : "Dentist appointment"} className={field} aria-invalid={!!shownError && !d.title.trim()} />
      </div>

      {d.kind === "todo" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor={id("date")} className={label}>Due date <span className="font-normal text-label-3">(optional)</span></label>
            <input id={id("date")} type="date" value={d.date} onChange={(e) => set(e.target.value ? { date: e.target.value } : { date: "", start: "" })} className={field} />
          </div>
          <div>
            <label htmlFor={id("start")} className={label}>Due time <span className="font-normal text-label-3">(optional)</span></label>
            <input id={id("start")} type="time" value={d.start} onChange={(e) => set({ start: e.target.value })} disabled={!d.date} className={`${field} disabled:opacity-50`} />
          </div>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor={id("date")} className={label}>Date</label>
            <input id={id("date")} type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className={field} />
          </div>
          <div className={d.kind === "event" ? "grid grid-cols-2 gap-2.5" : ""}>
            <div>
              <label htmlFor={id("start")} className={label}>{d.kind === "event" ? "Starts" : "Time"}</label>
              <input id={id("start")} type="time" value={d.start} onChange={(e) => setStart(e.target.value)} className={field} />
            </div>
            {d.kind === "event" && (
              <div>
                <label htmlFor={id("end")} className={label}>Ends</label>
                <input id={id("end")} type="time" value={d.end} onChange={(e) => { setEndIsAuto(false); set({ end: e.target.value }); }} className={field} />
              </div>
            )}
          </div>
          {d.kind === "event" && (
            <div>
              <label htmlFor={id("place")} className={label}>Place <span className="font-normal text-label-3">(optional)</span></label>
              <input id={id("place")} value={d.place} onChange={(e) => set({ place: e.target.value })} maxLength={60} autoComplete="off" placeholder="A3-G01, Library, Town" className={field} />
            </div>
          )}
        </>
      )}

      {overlaps.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[0.85rem]" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p className="min-w-0 [overflow-wrap:anywhere]"><span className="font-semibold">Overlaps:</span> {overlaps.map((i) => `${i.title}, ${timeText(i)}`).join("; ")}. You can still save it.</p>
        </div>
      )}
      {notes.length > 0 && <p className="t-caption [overflow-wrap:anywhere]">{notes.join(" ")}</p>}
      {shownError && <p role="alert" className="text-[0.88rem] font-semibold text-red [overflow-wrap:anywhere]">{shownError}</p>}

      <div className={`flex flex-wrap items-center gap-2 pt-1 ${stickyActions ? "sticky bottom-0 z-10 -mx-5 border-t border-sep bg-surface px-5 py-3" : ""}`}>
        {mode === "edit" && onDelete && (
          <button type="button" onClick={onDelete} className="press btn btn-plain mr-auto text-red"><Trash2 size={16} /> Delete</button>
        )}
        <span className="ml-auto flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="press btn btn-plain">Cancel</button>}
          <button type="submit" className="press btn btn-primary">{d.kind === "todo" ? <CheckSquare size={16} /> : <CalendarDays size={16} />} {submitLabel ?? (mode === "edit" ? "Save" : d.kind === "todo" ? "Add to-do" : "Add to calendar")}</button>
        </span>
      </div>
      {d.date && d.kind === "event" && isTime(d.start) && <p className="sr-only" aria-live="polite">{dateLabel(d.date)}, {d.start} to {d.end}</p>}
    </form>
  );
}
