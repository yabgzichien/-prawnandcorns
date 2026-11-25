import { ASSIGNMENTS, CLASSES, COURSE_BY_ID, sessionDate } from "./data/academics";
import { toICSDate } from "./time";

const esc = (s: string) => s.replace(/[\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

function wrap(events: string[]) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//XMUM Compass//Demo//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function timetableICS() {
  const ev = CLASSES.filter((c) => c.status !== "cancelled").map((c) => {
    const { start, end } = sessionDate(c);
    const course = COURSE_BY_ID[c.courseId];
    return ["BEGIN:VEVENT", `UID:${c.id}@xmum-compass.demo`, `DTSTAMP:${toICSDate(new Date("2026-11-23T05:20:00Z"))}`, `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`, `SUMMARY:${esc(`${course.code} ${c.kind}`)}`, `LOCATION:${esc(c.room)}`, `DESCRIPTION:${esc(course.title + " (demo data)")}`, "END:VEVENT"].join("\r\n");
  });
  return wrap(ev);
}

export function deadlinesICS() {
  const ev = ASSIGNMENTS.filter((a) => a.status !== "submitted").map((a) => {
    const due = new Date(a.due);
    return ["BEGIN:VEVENT", `UID:${a.id}@xmum-compass.demo`, `DTSTAMP:${toICSDate(new Date("2026-11-23T05:20:00Z"))}`, `DTSTART:${toICSDate(new Date(due.getTime() - 30 * 60_000))}`, `DTEND:${toICSDate(due)}`, `SUMMARY:${esc(`DUE: ${COURSE_BY_ID[a.courseId].code} ${a.title}`)}`, `DESCRIPTION:${esc(`${a.weight}%, ${a.type} (demo data)`)}`, "BEGIN:VALARM", "TRIGGER:-PT3H", "ACTION:DISPLAY", "DESCRIPTION:Deadline soon", "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  return wrap(ev);
}

export function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
