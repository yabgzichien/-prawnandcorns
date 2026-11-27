"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AlarmClock, CalendarDays, Check, ChevronDown, CloudUpload, GraduationCap, Hourglass, X, type LucideIcon } from "lucide-react";
import { sanitizeSeen, seenKey, timeAlerts, type AlertLevel, type TimeAlert } from "@/lib/calendar/alerts";
import { semesterStatus } from "@/lib/calendar/semester";
import { SPRING } from "@/lib/hooks";
import { useApp, WIDGET_META } from "@/lib/state";
import type { WidgetSize } from "@/lib/widget-layout";
import { useCampus } from "@/lib/sync/CampusProvider";
import { markedHereOnly, MOODLE_NOT_SUBMITTED } from "@/lib/sync/view";
import { COURSE_BY_ID } from "@/lib/data/academics";
import { DEMO_NOW, dueLabel } from "@/lib/time";
import { CardTitle } from "@/components/ui/kit";

export const ALERTS_SEEN_KEY = "compass:time-alerts-seen:v1";
const CHANGED = "compass:time-alerts-seen";

const readSeen = () => { try { return localStorage.getItem(ALERTS_SEEN_KEY) ?? "[]"; } catch { return "[]"; } };
const subscribe = (fn: () => void) => {
  window.addEventListener(CHANGED, fn);
  const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === ALERTS_SEEN_KEY) fn(); };
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(CHANGED, fn); window.removeEventListener("storage", onStorage); };
};

const KIND_ICON: Record<TimeAlert["kind"], LucideIcon> = { deadline: Hourglass, overdue: AlarmClock, unsubmitted: CloudUpload, exam: GraduationCap, phase: CalendarDays };
const LEVEL: Record<AlertLevel, { label: string; bg: string; fg: string }> = {
  urgent: { label: "Now", bg: "var(--red-soft)", fg: "var(--red)" },
  soon: { label: "Soon", bg: "var(--orange-soft)", fg: "var(--orange)" },
  info: { label: "Coming up", bg: "var(--accent-soft)", fg: "var(--accent)" },
};

/** The semester week and what needs attention, from plain rules. Each line can be hidden until its next tier. */
export function NeedsAttention({ size }: { size: WidgetSize }) {
  const { submitted, toggleSubmitted, hydrated } = useApp();
  const { data } = useCampus();
  const reduce = useReducedMotion();
  const seenText = useSyncExternalStore(subscribe, readSeen, () => "[]");
  const seen = useMemo(() => { try { return new Set(sanitizeSeen(JSON.parse(seenText))); } catch { return new Set<string>(); } }, [seenText]);
  const [all, setAll] = useState(false);
  const status = semesterStatus(DEMO_NOW);
  const alerts = timeAlerts({ assignments: data.assignments, markedDone: submitted });
  const byId = new Map(alerts.map((a) => [a.id, a]));
  const assignments = data.assignments.filter((a) => a.status !== "submitted").map((a) => {
    const id = `a:${a.id}`;
    const alert = byId.get(id);
    const overdue = Date.parse(a.due) <= DEMO_NOW.getTime();
    const warning = alert && !seen.has(seenKey(alert)) ? alert : undefined;
    const detail = warning?.detail ?? `${COURSE_BY_ID[a.courseId]?.code ?? a.courseId}, ${dueLabel(new Date(a.due))}`;
    return { id, title: a.title, assignment: a, warning, detail, at: a.due,
      level: alert?.level ?? (overdue ? "urgent" as const : "info" as const),
      kind: overdue ? "overdue" as const : "deadline" as const, href: "/hub?section=assignments" };
  });
  const exams = alerts.filter((a) => a.kind === "exam" && !seen.has(seenKey(a))).map((a) => ({
    ...a, warning: a, assignment: undefined,
  }));
  const rank = { urgent: 0, soon: 1, info: 2 };
  const items = [...assignments, ...exams].sort((a, b) => rank[a.level] - rank[b.level] || Date.parse(a.at) - Date.parse(b.at));
  const phase = alerts.find((a) => a.kind === "phase" && !seen.has(seenKey(a)));
  const hide = useCallback((a: TimeAlert) => {
    try { localStorage.setItem(ALERTS_SEEN_KEY, JSON.stringify(sanitizeSeen([...seen, seenKey(a)]))); } catch {}
    window.dispatchEvent(new Event(CHANGED));
  }, [seen]);
  const limit = { compact: 1, standard: 4, wide: 8 }[size];
  const shown = all ? items : items.slice(0, limit);
  const urgent = items.filter((a) => a.level === "urgent").length;

  return (
    <div>
      <CardTitle
        icon={<AlarmClock size={18} className="text-accent" />}
        title={WIDGET_META.attention.title}
        action={hydrated && items.length > 0 ? <span className="t-caption font-semibold">{urgent > 0 ? `${urgent} need${urgent === 1 ? "s" : ""} you now` : `${items.length} coming up`}</span> : undefined}
      />

      {hydrated && (
        <ul className="mt-3 grid grid-cols-1 gap-2" aria-label="Deadline and exam alerts">
          <AnimatePresence initial={false}>
            {shown.map((a) => {
              const I = KIND_ICON[a.kind];
              const { assignment, warning } = a;
              const done = !!assignment && submitted.includes(assignment.id);
              const lv = LEVEL[a.level];
              return (
                <motion.li key={a.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -8 }} transition={SPRING}
                  className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                  {assignment ? <button type="button" aria-label={`Mark ${assignment.title} done in Compass`} aria-pressed={done} onClick={() => toggleSubmitted(assignment.id)} className="press mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-sep text-green">{done && <Check size={17} />}</button> : <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: lv.bg, color: lv.fg }}><I size={17} /></span>}
                  <Link href={a.href} className="press min-w-0 flex-1">
                    <span className="mb-0.5 inline-block rounded-full px-2 text-[0.7rem] font-bold uppercase tracking-wide" style={{ background: lv.bg, color: lv.fg }}>{a.kind === "overdue" ? "Overdue" : lv.label}</span>
                    <span className="block text-[0.93rem] font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]">{a.title}</span>
                    <span className="t-caption block [overflow-wrap:anywhere]">{a.detail}</span>
                    {assignment && markedHereOnly(assignment, submitted, data) && <span className="t-caption block font-semibold text-orange">{MOODLE_NOT_SUBMITTED}</span>}
                  </Link>
                  {warning && <button type="button" onClick={() => hide(warning)} aria-label={`Dismiss alert: ${a.title}`} title="Hide until it gets closer" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-label-2"><X size={16} /></button>}
                </motion.li>
              );
            })}
          </AnimatePresence>
          {items.length === 0 && <li className="t-sub rounded-2xl bg-surface-2 p-3">Nothing urgent. Hidden alerts come back when they get closer.</li>}
        </ul>
      )}
      {hydrated && items.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="press mt-2 inline-flex items-center gap-1 text-[0.88rem] font-semibold text-accent">
          {all ? "Show fewer" : "View all"} <ChevronDown size={15} className={all ? "rotate-180" : ""} />
        </button>
      )}
      {(size !== "compact" || all) && <p className="t-caption mt-2"><strong>{status.label}.</strong> {status.detail} {phase && <>{phase.detail} <button type="button" onClick={() => hide(phase)} className="text-accent">Dismiss semester alert</button> </>}Demo semester dates and exam timetable. Deadlines from {data.live.includes("moodle") ? "Moodle (demo sync)" : "the demo data"}.</p>}
    </div>
  );
}
