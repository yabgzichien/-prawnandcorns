import { atDay, dateShort, dayLong, dayShort } from "../time.ts";

/** "14:30" to 870. */
export const toMin = (hhmm: string): number => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
/** 870 to "14:30". */
export const toHhmm = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const overlaps = (a: { day: number; start: string; end: string }, b: { day: number; start: string; end: string }) =>
  a.day === b.day && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/** "Thu 26 Nov" */
export const dayLabel = (day: number) => { const d = atDay(day, "00:00"); return `${dayShort(d)} ${dateShort(d)}`; };
/** "Thursday 26 Nov" */
export const dayLabelLong = (day: number) => { const d = atDay(day, "00:00"); return `${dayLong(d)} ${dateShort(d)}`; };
/** "Thu 26 Nov, 16:00 to 17:00" */
export const slotLabel = (s: { day: number; start: string; end: string }) => `${dayLabel(s.day)}, ${s.start} to ${s.end}`;
