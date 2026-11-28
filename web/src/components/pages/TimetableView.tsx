"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, CalendarX2, DoorOpen, MapPin } from "lucide-react";
import { COURSE_BY_ID, type ClassSession } from "@/lib/data/academics";
import { PLACE_BY_ID, ROOM_BY_CODE } from "@/lib/data/campus";
import { atDay, dateShort } from "@/lib/time";
import { classesOn, TODAY_IDX, statusText } from "@/lib/schedule";
import { download, timetableICS } from "@/lib/ics";
import { Item, PageHeader, Pill, Segmented, Stagger, toneClass } from "@/components/ui/kit";
import { useApp } from "@/lib/state";
import { ReplacementPanel } from "@/components/replacement/ReplacementPanel";
import { useCampus } from "@/lib/sync/CampusProvider";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

export function TimetableView() {
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState(TODAY_IDX);
  const { showToast } = useApp();
  const { data } = useCampus();
  const list = classesOn(day, data.classes);
  const changed = data.classes.filter((c) => c.status !== "normal").length;

  return (
    <div>
      <PageHeader eyebrow="Semester 1, Week 10" title="Timetable" sub={`${changed} changes this week — cancelled, moved and make-up classes are flagged so you never turn up to an empty room.`}
        action={<button onClick={() => { download("xmum-timetable.ics", timetableICS(data.classes)); showToast("Timetable exported to calendar file"); }} className="press btn btn-plain"><CalendarPlus size={17} /> Export .ics</button>} />

      <ReplacementPanel onShowDay={(d) => { setView("day"); setDay(d); }} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="View" value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
        {view === "day" && (
          <div className="rail flex min-w-0 max-w-full gap-1.5 overflow-x-auto" role="tablist" aria-label="Day">
            {WEEKDAYS.map((d, i) => {
              const dots = classesOn(i, data.classes).some((c) => c.status !== "normal");
              return (
                <button key={d} role="tab" aria-selected={day === i} onClick={() => setDay(i)} className="press relative flex min-h-[56px] w-[58px] shrink-0 flex-col items-center justify-center rounded-2xl text-[0.8rem] font-semibold" style={{ background: day === i ? "var(--accent)" : "var(--surface)", color: day === i ? "var(--accent-fg)" : "var(--label)", boxShadow: "var(--shadow-sm)" }}>
                  <span className="opacity-70">{d}</span>
                  <span className="tnum text-[1.1rem] tracking-[-0.02em]">{23 + i}</span>
                  {dots && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: day === i ? "var(--accent-fg)" : "var(--orange)" }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {view === "day" ? (
        <Stagger key={day} className="space-y-3">
          {list.length === 0 && <p className="t-sub">No classes.</p>}
          {list.map((c) => {
            const course = COURSE_BY_ID[c.courseId];
            const t = toneClass[course.tone];
            const cancelled = c.status === "cancelled";
            const room = ROOM_BY_CODE[c.room];
            const notice = data.notices.find((n) => n.id === c.noticeId);
            return (
              <Item key={c.id}>
                <article className="card flex min-w-0 flex-wrap gap-4 p-4 sm:flex-nowrap sm:p-5">
                  <div className="w-14 shrink-0 text-right">
                    <p className="tnum text-[1.1rem] font-bold tracking-[-0.02em]" style={{ textDecoration: cancelled ? "line-through" : undefined, opacity: cancelled ? 0.5 : 1 }}>{c.start}</p>
                    <p className="tnum t-caption">{c.end}</p>
                  </div>
                  <span className={`w-1 shrink-0 rounded-full ${cancelled ? "bg-red" : t.dot}`} aria-hidden />
                  <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className={`t-headline timetable-entry min-w-0 break-words ${cancelled ? "line-through opacity-50" : ""}`}>{course.title}</h3>
                      {c.status !== "normal" && <Pill tone={cancelled ? "red" : c.status === "makeup" ? "green" : "orange"}>{statusText(c)}</Pill>}
                    </div>
                    <p className="t-sub mt-0.5">{course.code} {c.kind} in {c.room}{room ? `, ${PLACE_BY_ID[room.place].name}` : ""}{c.status === "room-changed" ? ` (was ${c.originalRoom})` : ""}</p>
                    {notice && c.status !== "normal" && (
                      <p className="mt-3 flex min-w-0 gap-2 rounded-xl px-3 py-2 text-[0.85rem]" style={{ background: cancelled ? "var(--red-soft)" : "var(--orange-soft)" }}>
                        {cancelled ? <CalendarX2 size={16} className="mt-0.5 shrink-0 text-red" /> : <DoorOpen size={16} className="mt-0.5 shrink-0 text-orange" />}
                        <span className="min-w-0 flex-1 break-words">{notice.body}</span>
                      </p>
                    )}
                  </div>
                  {!cancelled && <Link href={`/hub?section=map&focus=${c.room}`} aria-label={`Show ${c.room} on map`} className="press grid h-11 w-11 shrink-0 place-items-center self-center rounded-full bg-accent-soft text-accent"><MapPin size={19} /></Link>}
                </article>
              </Item>
            );
          })}
        </Stagger>
      ) : (
        <WeekGrid classes={data.classes} days={WEEKDAYS} />
      )}
    </div>
  );
}

function WeekGrid({ classes, days }: { classes: readonly ClassSession[]; days: string[] }) {
  const rowH = 56;
  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[720px] p-4">
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
          <div />
          {days.map((d, i) => (
            <div key={d} className="pb-3 text-center"><p className="t-eyebrow">{d}</p><p className="tnum text-[1.15rem] font-bold" style={{ color: i === TODAY_IDX ? "var(--accent)" : undefined }}>{dateShort(atDay(i, "00:00")).split(" ")[0]}</p></div>
          ))}
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, height: HOURS.length * rowH }}>
          <div className="relative">
            {HOURS.map((h, i) => <span key={h} className="tnum t-caption absolute right-2 -translate-y-1/2" style={{ top: i * rowH }}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
          {days.map((d, di) => (
            <div key={d} className="relative border-l border-sep">
              {HOURS.map((h, i) => <div key={h} className="absolute inset-x-0 border-t border-sep" style={{ top: i * rowH }} />)}
              {classesOn(di, classes).map((c) => {
                const [sh, sm] = c.start.split(":").map(Number);
                const [eh, em] = c.end.split(":").map(Number);
                const top = ((sh - 8) * 60 + sm) / 60 * rowH;
                const h = ((eh * 60 + em) - (sh * 60 + sm)) / 60 * rowH;
                const course = COURSE_BY_ID[c.courseId];
                const t = toneClass[course.tone];
                const cancelled = c.status === "cancelled";
                return (
                  <Link key={c.id} href={cancelled ? "/hub?section=timetable" : `/hub?section=map&focus=${c.room}`} className={`press absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1.5 text-[0.75rem] leading-tight ${cancelled ? "bg-red-soft text-red" : `${t.bg} ${t.fg}`}`} style={{ top: top + 2, height: h - 4, outline: c.status !== "normal" && !cancelled ? "2px solid var(--orange)" : undefined }}>
                    <span className={`block font-bold ${cancelled ? "line-through" : ""}`}>{course.code}</span>
                    <span className="block opacity-80">{c.kind} in {c.room}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
