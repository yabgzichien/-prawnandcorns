"use client";

import Link from "next/link";
import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Check } from "lucide-react";
import { dateLabel } from "@/lib/events/checks";
import { hourRange, isPast, itemsOnDate, layoutDay, monthWeeks, stripItems, timeText, type TimelineItem } from "@/lib/calendar/timeline";
import { DEMO_NOW, timeOf } from "@/lib/time";
import { toneClass } from "@/components/ui/kit";
import type { Tone } from "@/lib/data/academics";

const ROW = 52;
const TONE_VAR: Record<Tone, string> = { blue: "var(--accent)", orange: "var(--orange)", purple: "var(--purple)", green: "var(--green)", teal: "var(--teal)", red: "var(--red)" };
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayName = (date: string) => dateLabel(date).split(" ")[0];
const dayNumber = (date: string) => Number(date.slice(8, 10));
const minutesOf = (d: Date) => Number(timeOf(d).slice(0, 2)) * 60 + Number(timeOf(d).slice(3, 5));

/** True on a phone-width screen. The server and the first paint say false, so nothing mismatches. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (fn) => { const q = window.matchMedia("(max-width: 639px)"); q.addEventListener("change", fn); return () => q.removeEventListener("change", fn); },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}

const sayItem = (i: TimelineItem) => `${i.label}: ${i.title}, ${timeText(i)}${i.stateLabel ? `, ${i.stateLabel}` : ""}${i.saved ? ", saved in this browser" : ""}`;

export type EntryRef = NonNullable<TimelineItem["edit"]>;
/** What the calendar can do besides show things: open the editor, start a new entry, tick a to-do. */
export type CalendarActions = {
  onEdit: (ref: EntryRef) => void;
  onCreate: (date: string, start: string) => void;
  onToggleTodo: (id: string, done: boolean) => void;
};

/** What the student wrote opens the editor. Everything else opens the page that owns it. */
export function ItemTarget({ item, actions, className, style, children }: { item: TimelineItem; actions: CalendarActions; className: string; style?: CSSProperties; children: ReactNode }) {
  const say = sayItem(item);
  if (item.edit) {
    const ref = item.edit;
    return <button type="button" onClick={() => actions.onEdit(ref)} aria-label={`${say}. Edit`} title={say} className={`${className} w-full text-left`} style={style}>{children}</button>;
  }
  return <Link href={item.href} aria-label={say} title={say} className={className} style={style}>{children}</Link>;
}

/** The round tick. Responds on press, and says its state in words. */
export function CheckButton({ checked, label, onToggle, size = 18 }: { checked: boolean; label: string; onToggle: () => void; size?: number }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="press relative grid h-9 w-9 shrink-0 place-items-center">
      <span className="grid place-items-center rounded-full border-2 transition-[background-color,border-color] duration-150" style={{ width: size, height: size, borderColor: checked ? "var(--green)" : "var(--label-3)", background: checked ? "var(--green)" : "transparent" }}>
        {checked && <Check size={size - 6} color="#fff" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

export function TodoCheck({ item, actions, size = 18 }: { item: TimelineItem; actions: CalendarActions; size?: number }) {
  const ref = item.edit;
  if (!ref) return null;
  return <CheckButton checked={!!item.done} label={`Done: ${item.title}`} onToggle={() => actions.onToggleTodo(ref.id, !item.done)} size={size} />;
}

function DayHead({ date, today, narrow }: { date: string; today: string; narrow: boolean }) {
  const isToday = date === today;
  return (
    <p className="pb-1.5 text-center" aria-label={`${dateLabel(date)}${isToday ? ", today" : ""}`}>
      <span className="t-eyebrow block">{narrow ? dayName(date) : dayName(date).toUpperCase()}</span>
      <span className={`tnum mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-[0.9rem] font-semibold ${isToday ? "text-white" : "text-label"}`} style={isToday ? { background: "var(--accent)" } : undefined}>{dayNumber(date)}</span>
    </p>
  );
}

/** A day column of hours. Blocks are links to the page that owns the item. */
export function WeekGrid({ items, days, today, narrow, actions }: { items: readonly TimelineItem[]; days: string[]; today: string; narrow: boolean; actions: CalendarActions }) {
  const perDay = days.map((d) => itemsOnDate(items, d));
  const laid = perDay.map((list) => layoutDay(list));
  const { from, to } = hourRange(laid.flat());
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const cols = `${narrow ? 34 : 46}px repeat(${days.length}, minmax(0,1fr))`;
  const nowMin = minutesOf(DEMO_NOW);
  const hasStrip = perDay.some((list) => stripItems(list).length > 0);

  return (
    <div role="group" aria-label={`Week grid, ${dateLabel(days[0])} to ${dateLabel(days[days.length - 1])}`}>
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => <DayHead key={d} date={d} today={today} narrow={narrow} />)}
      </div>

      {hasStrip && (
        <div className="grid border-t border-sep" style={{ gridTemplateColumns: cols }}>
          <p className="t-caption pr-1.5 pt-1.5 text-right text-[0.62rem] leading-tight sm:text-[0.7rem]">All day</p>
          {days.map((d, i) => (
            <ul key={d} aria-label={`${dateLabel(d)}, all day and due`} className="min-w-0 space-y-0.5 border-l border-sep p-0.5">
              {stripItems(perDay[i]).map((item) => {
                const toneKey = item.state === "overdue" ? "red" : item.tone;
                const t = toneClass[toneKey];
                const prefix = item.kind === "deadline" || (item.kind === "todo" && !item.allDay) ? `Due ${item.start.slice(11, 16)} ` : "";
                const text = <span className={`line-clamp-2 [overflow-wrap:anywhere] ${item.done ? "line-through" : ""}`}>{prefix}{item.title}</span>;
                const box = `press block rounded-md px-1 py-0.5 text-[0.66rem] font-semibold leading-tight sm:text-[0.72rem] ${t.bg} ${t.fg}`;
                const edge = { borderLeft: `3px solid ${TONE_VAR[toneKey]}` };
                return (
                  <li key={item.id} style={{ opacity: item.done ? 0.55 : 1 }}>
                    {item.kind === "todo" ? (
                      <div className={`flex items-start rounded-md ${t.bg} ${t.fg}`} style={edge}>
                        <TodoCheck item={item} actions={actions} size={14} />
                        <ItemTarget item={item} actions={actions} className="press block min-w-0 flex-1 py-1 pr-1 text-[0.66rem] font-semibold leading-tight sm:text-[0.72rem]">{text}</ItemTarget>
                      </div>
                    ) : (
                      <ItemTarget item={item} actions={actions} className={box} style={edge}>{text}</ItemTarget>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}

      <div className="relative grid border-t border-sep" style={{ gridTemplateColumns: cols, height: (to - from) * ROW }}>
        <div className="relative" aria-hidden>
          {hours.map((h, i) => i > 0 && <span key={h} className="tnum t-caption absolute right-1.5 -translate-y-1/2 text-[0.62rem] sm:text-[0.72rem]" style={{ top: i * ROW }}>{String(h).padStart(2, "0")}:00</span>)}
        </div>
        {days.map((d, di) => (
          <ul
            key={d}
            aria-label={`${dateLabel(d)}, timetable`}
            className="relative cursor-cell border-l border-sep"
            style={d === today ? { background: "color-mix(in srgb, var(--accent) 5%, transparent)" } : undefined}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a, button")) return;
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
              const minutes = Math.min(23 * 60 + 30, Math.max(0, Math.floor(((from * 60) + (y / ROW) * 60) / 30) * 30));
              actions.onCreate(d, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
            }}
          >
            {hours.map((h, i) => i > 0 && <li aria-hidden key={h} className="absolute inset-x-0 border-t border-sep" style={{ top: i * ROW }} />)}
            {d === today && nowMin >= from * 60 && nowMin <= to * 60 && (
              <li aria-label={`Now, ${timeOf(DEMO_NOW)}`} className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: ((nowMin - from * 60) / 60) * ROW }}>
                <span aria-hidden className="-ml-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--red)" }} />
                <span aria-hidden className="h-px flex-1" style={{ background: "var(--red)" }} />
              </li>
            )}
            {laid[di].map((b) => {
              const t = toneClass[b.item.tone];
              const top = ((b.startMin - from * 60) / 60) * ROW;
              const height = Math.max(((b.endMin - b.startMin) / 60) * ROW, 22);
              const w = 100 / b.lanes;
              const cancelled = b.item.state === "cancelled";
              const tall = height >= 44;
              return (
                <li key={b.item.id} className="absolute" style={{ top: top + 1, height: height - 2, left: `calc(${b.lane * w}% + 1px)`, width: `calc(${w}% - 2px)`, opacity: isPast(b.item, DEMO_NOW) ? 0.55 : 1 }}>
                  <ItemTarget item={b.item} actions={actions} className={`press block h-full overflow-hidden rounded-lg px-1 py-0.5 text-[0.66rem] leading-tight sm:px-1.5 sm:py-1 sm:text-[0.72rem] ${t.bg} ${t.fg}`} style={{ borderLeft: `3px solid ${TONE_VAR[b.item.tone]}`, outline: cancelled ? "2px solid var(--red)" : undefined, outlineOffset: -2 }}>
                    <span className={`block truncate font-bold ${cancelled ? "line-through" : ""}`}>{b.item.title}</span>
                    {b.item.stateLabel && tall && <span className="block truncate font-bold" style={{ color: b.item.state === "cancelled" ? "var(--red)" : undefined }}>{b.item.stateLabel}</span>}
                    {tall && <span className="line-clamp-2 block opacity-80 [overflow-wrap:anywhere]">{b.item.detail}</span>}
                  </ItemTarget>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}

/** A Monday first month. Choosing a day opens its week. */
export function MonthGrid({ items, anchor, today, narrow, onOpenDay }: { items: readonly TimelineItem[]; anchor: string; today: string; narrow: boolean; onOpenDay: (date: string) => void }) {
  const weeks = monthWeeks(anchor);
  const month = anchor.slice(0, 7);
  const MAX = narrow ? 4 : 3;
  return (
    <div role="group" aria-label="Month grid">
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((n) => <p key={n} className="t-eyebrow pb-1.5 text-center">{narrow ? n.slice(0, 1) : n}</p>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-sep">
        {weeks.map((week, wi) => (
          <div key={week[0]} className={`grid grid-cols-7 ${wi > 0 ? "border-t border-sep" : ""}`}>
            {week.map((d, di) => {
              const list = itemsOnDate(items, d);
              const inMonth = d.startsWith(month);
              const isToday = d === today;
              const shown = list.slice(0, MAX);
              const more = list.length - shown.length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onOpenDay(d)}
                  aria-label={`${dateLabel(d)}, ${list.length === 0 ? "nothing scheduled" : `${list.length} ${list.length === 1 ? "item" : "items"}`}. Open this week`}
                  className={`press-row flex min-h-[64px] min-w-0 flex-col items-stretch gap-0.5 p-1 text-left sm:min-h-[92px] ${di > 0 ? "border-l border-sep" : ""}`}
                  style={{ opacity: inMonth ? 1 : 0.45 }}
                >
                  <span className={`tnum grid h-6 w-6 place-items-center self-center rounded-full text-[0.8rem] font-semibold sm:self-start ${isToday ? "text-white" : "text-label"}`} style={isToday ? { background: "var(--accent)" } : undefined}>{dayNumber(d)}</span>
                  {narrow ? (
                    <span className="flex flex-wrap justify-center gap-0.5" aria-hidden>
                      {shown.map((i) => <span key={i.id} className={`h-1.5 w-1.5 rounded-full ${i.state === "cancelled" || i.state === "overdue" ? "bg-red" : toneClass[i.tone].dot}`} />)}
                      {more > 0 && <span className="text-[0.6rem] font-bold leading-none text-label-2">+{more}</span>}
                    </span>
                  ) : (
                    <span className="min-w-0 space-y-0.5" aria-hidden>
                      {shown.map((i) => {
                        const t = toneClass[i.state === "overdue" ? "red" : i.tone];
                        return <span key={i.id} className={`block truncate rounded px-1 text-[0.68rem] font-semibold leading-[1.35] ${t.bg} ${t.fg} ${i.state === "cancelled" ? "line-through" : ""}`}>{i.title}</span>;
                      })}
                      {more > 0 && <span className="block px-1 text-[0.68rem] font-semibold text-label-2">+{more} more</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
