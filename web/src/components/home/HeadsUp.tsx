"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { AlarmClock, CalendarDays, ChevronDown, CloudUpload, GraduationCap, Hourglass, X, type LucideIcon } from "lucide-react";
import { sanitizeSeen, seenKey, timeAlerts, type AlertLevel, type TimeAlert } from "@/lib/calendar/alerts";
import { semesterStatus } from "@/lib/calendar/semester";
import { SPRING } from "@/lib/hooks";
import { useApp } from "@/lib/state";
import { useCampus } from "@/lib/sync/CampusProvider";
import { DEMO_NOW } from "@/lib/time";
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
const SHOWN = 4;

/** The semester week and what needs attention, from plain rules. Each line can be hidden until its next tier. */
export function HeadsUp() {
  const { submitted, hydrated } = useApp();
  const { data } = useCampus();
  const reduce = useReducedMotion();
  const seenText = useSyncExternalStore(subscribe, readSeen, () => "[]");
  const seen = useMemo(() => { try { return new Set(sanitizeSeen(JSON.parse(seenText))); } catch { return new Set<string>(); } }, [seenText]);
  const [all, setAll] = useState(false);
  const status = semesterStatus(DEMO_NOW);
  const alerts = useMemo(() => timeAlerts({ now: DEMO_NOW, assignments: data.assignments, markedDone: submitted }).filter((a) => !seen.has(seenKey(a))), [data.assignments, submitted, seen]);
  const hide = useCallback((a: TimeAlert) => {
    try { localStorage.setItem(ALERTS_SEEN_KEY, JSON.stringify(sanitizeSeen([...seen, seenKey(a)]))); } catch {}
    window.dispatchEvent(new Event(CHANGED));
  }, [seen]);
  const shown = all ? alerts : alerts.slice(0, SHOWN);
  const urgent = alerts.filter((a) => a.level === "urgent").length;

  return (
    <div>
      <CardTitle
        icon={<AlarmClock size={18} className="text-accent" />}
        title="Heads-up"
        action={hydrated && alerts.length > 0 ? <span className="t-caption font-semibold">{urgent > 0 ? `${urgent} need${urgent === 1 ? "s" : ""} you now` : `${alerts.length} coming up`}</span> : undefined}
      />
      <p className="t-sub -mt-1 [overflow-wrap:anywhere]"><span className="font-semibold text-label">{status.label}.</span> {status.detail}</p>

      {hydrated && (
        <ul className="mt-3 grid grid-cols-1 gap-2" aria-label="Deadline and exam alerts">
          <AnimatePresence initial={false}>
            {shown.map((a) => {
              const I = KIND_ICON[a.kind];
              const lv = LEVEL[a.level];
              return (
                <motion.li key={a.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -8 }} transition={SPRING}
                  className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: lv.bg, color: lv.fg }}><I size={17} /></span>
                  <Link href={a.href} className="press min-w-0 flex-1">
                    <span className="mb-0.5 inline-block rounded-full px-2 text-[0.7rem] font-bold uppercase tracking-wide" style={{ background: lv.bg, color: lv.fg }}>{lv.label}</span>
                    <span className="block text-[0.93rem] font-semibold leading-snug tracking-[-0.01em] [overflow-wrap:anywhere]">{a.title}</span>
                    <span className="t-caption block [overflow-wrap:anywhere]">{a.detail}</span>
                  </Link>
                  <button type="button" onClick={() => hide(a)} aria-label={`Hide for now: ${a.title}`} title="Hide until it gets closer" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-label-2"><X size={16} /></button>
                </motion.li>
              );
            })}
          </AnimatePresence>
          {alerts.length === 0 && <li className="t-sub rounded-2xl bg-surface-2 p-3">Nothing urgent. Hidden alerts come back when they get closer.</li>}
        </ul>
      )}
      {hydrated && alerts.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="press mt-2 inline-flex items-center gap-1 text-[0.88rem] font-semibold text-accent">
          {all ? "Show fewer" : `Show ${alerts.length - SHOWN} more`} <ChevronDown size={15} className={all ? "rotate-180" : ""} />
        </button>
      )}
      <p className="t-caption mt-2">Demo semester dates and exam timetable. Deadlines from {data.live.includes("moodle") ? "Moodle (demo sync)" : "the demo data"}.</p>
    </div>
  );
}
