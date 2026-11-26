"use client";

import { AnimatePresence, motion } from "motion/react";
import type { CoreClass } from "@/lib/electives/catalogue";
import { GE_BY_CODE } from "@/lib/electives/catalogue";
import { dayShortOf, weeksLabel } from "@/lib/electives/parse";
import { parsedOf, sharedWeeks } from "@/lib/electives/plan";
import type { Meeting, Stream } from "@/lib/electives/types";
import { STREAM_COLOR } from "./icons";

const DAYS = [0, 1, 2, 3, 4, 5];
const FROM = 8, TO = 20, ROW = 38;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

type Block = { id: string; title: string; sub: string; meeting: Meeting; kind: "core" | "ge"; stream?: Stream; clash: boolean; lane: number; lanes: number };

/** Puts overlapping blocks side by side so a clash is visible, not hidden underneath. */
function layout(blocks: Omit<Block, "lane" | "lanes">[]): Block[] {
  const out: Block[] = [];
  for (const day of DAYS) {
    const list = blocks.filter((b) => b.meeting.day === day).sort((a, b) => toMin(a.meeting.start) - toMin(b.meeting.start) || a.id.localeCompare(b.id));
    let cluster: Block[] = [];
    let clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map((b) => b.lane + 1)); cluster.forEach((b) => { b.lanes = n; }); out.push(...cluster); cluster = []; };
    for (const b of list) {
      const start = toMin(b.meeting.start);
      if (cluster.length && start >= clusterEnd) flush();
      const used = new Set(cluster.filter((x) => toMin(x.meeting.end) > start).map((x) => x.lane));
      let lane = 0; while (used.has(lane)) lane++;
      cluster.push({ ...b, lane, lanes: 1 });
      clusterEnd = Math.max(clusterEnd, toMin(b.meeting.end));
    }
    if (cluster.length) flush();
  }
  return out;
}

/** The Semester 2 week: core classes, the chosen electives, and any clash outlined in red with a label. */
export function WeekPreview({ core, selected }: { core: readonly CoreClass[]; selected: readonly string[] }) {
  const ge = selected.flatMap((code) => (GE_BY_CODE[code] ? parsedOf(code).meetings.map((m, i) => ({ code, m, i })) : []));
  const all: Meeting[] = [...core.map((c) => c.meeting), ...ge.map((g) => g.m)];
  const clashes = (m: Meeting) => all.some((o) => o !== m && sharedWeeks(m, o).length > 0);
  const blocks = layout([
    ...core.map((c, i) => ({ id: `core-${i}`, title: c.code, sub: c.kind, meeting: c.meeting, kind: "core" as const, clash: clashes(c.meeting) })),
    ...ge.map(({ code, m, i }) => ({
      id: `${code}-${i}`, title: code, sub: m.dates?.length ? `${m.dates.length} ${dayShortOf(m.day)}s only` : m.weeks.length < 14 ? weeksLabel(m.weeks) : GE_BY_CODE[code].title,
      meeting: m, kind: "ge" as const, stream: GE_BY_CODE[code].stream, clash: clashes(m),
    })),
  ]);
  const hours = Array.from({ length: TO - FROM }, (_, i) => FROM + i);

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[620px]">
        <div className="grid" style={{ gridTemplateColumns: `44px repeat(${DAYS.length}, minmax(0,1fr))` }}>
          <div />
          {DAYS.map((d) => <p key={d} className="t-eyebrow pb-2 text-center">{dayShortOf(d)}</p>)}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `44px repeat(${DAYS.length}, minmax(0,1fr))`, height: (TO - FROM) * ROW }}>
          <div className="relative">
            {hours.map((h, i) => <span key={h} className="tnum t-caption absolute right-2 -translate-y-1/2" style={{ top: i * ROW }}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
          {DAYS.map((d) => (
            <div key={d} className="relative border-l border-sep">
              {hours.map((h, i) => <div key={h} className="absolute inset-x-0 border-t border-sep" style={{ top: i * ROW }} />)}
              <AnimatePresence initial={false}>
                {blocks.filter((b) => b.meeting.day === d).map((b) => {
                  const top = ((toMin(b.meeting.start) - FROM * 60) / 60) * ROW;
                  const h = ((toMin(b.meeting.end) - toMin(b.meeting.start)) / 60) * ROW;
                  const color = b.kind === "core" ? { bg: "var(--surface-3)", fg: "var(--label)" } : STREAM_COLOR[b.stream!];
                  const w = 100 / b.lanes;
                  return (
                    <motion.div
                      key={b.id}
                      layout
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                      className="absolute overflow-hidden rounded-lg px-1.5 py-1 text-[0.72rem] leading-tight"
                      style={{ top: top + 2, height: h - 4, left: `calc(${b.lane * w}% + 3px)`, width: `calc(${w}% - 6px)`, background: color.bg, color: color.fg, outline: b.clash ? "2px solid var(--red)" : undefined, outlineOffset: -2, borderLeft: b.kind === "ge" ? `3px solid ${color.fg}` : undefined }}
                      aria-label={`${b.title} ${b.sub}, ${dayShortOf(b.meeting.day)} ${b.meeting.start} to ${b.meeting.end}${b.clash ? ", clashes" : ""}`}
                      role="img"
                    >
                      <span className="block font-bold">{b.title}</span>
                      <span className="block truncate opacity-80">{b.sub}</span>
                      {b.clash && <span className="mt-0.5 block font-bold text-red">Clash</span>}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.76rem] text-label-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: "var(--surface-3)" }} />Core class</span>
        {(["Business", "Arts", "Science"] as Stream[]).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: STREAM_COLOR[s].bg, borderLeft: `3px solid ${STREAM_COLOR[s].fg}` }} />{s} elective</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ outline: "2px solid var(--red)", outlineOffset: -2 }} />Clash</span>
      </div>
    </div>
  );
}
