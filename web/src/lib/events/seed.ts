import type { Decisions, EventApplication, EventLine } from "./types.ts";

/**
 * Applications from other clubs, so the ECA queue looks like a real one and room clashes can be shown. Every club
 * event, adviser, number and date below is invented. They are not saved by Compass; the console and the checks read them.
 */

const v = (id: string, venueId: string, date: string, start: string, end: string): EventLine => ({ kind: "venue", id, venueId, date, start, end });
const i = (id: string, itemId: string, qty: number, collectDate: string, returnDate: string): EventLine => ({ kind: "item", id, itemId, qty, collectDate, returnDate });

export const SEEDED_APPLICATIONS: EventApplication[] = [
  {
    id: "DEMO-EVT-0101", seeded: true, submittedAt: "2026-11-20T16:10:00+08:00", applicant: { name: "Sam Rahim (demo)", id: "DEMO-0101" },
    name: "Inter-Faculty Debate Final (demo)", organisers: "Debate Society", participants: 150, date: "2026-12-12", start: "18:00", end: "22:00",
    description: "The final round of the faculty debate league, with a panel of judges and an audience.",
    adviser: { name: "Dr. Wong (demo)", email: "wong@demo.invalid" },
    lines: [v("v1", "B1-B06-2", "2026-12-12", "17:00", "22:00"), i("i1", "speaker", 2, "2026-12-11", "2026-12-14"), i("i2", "plastic-chair", 40, "2026-12-12", "2026-12-14"), i("i3", "walkie-talkie", 6, "2026-12-12", "2026-12-14")],
  },
  {
    id: "DEMO-EVT-0102", seeded: true, submittedAt: "2026-11-23T09:05:00+08:00", applicant: { name: "Mei Ling (demo)", id: "DEMO-0102" },
    name: "Golden Hour Photo Walk and Exhibition (demo)", organisers: "Photography Club", participants: 60, date: "2026-12-09", start: "17:00", end: "21:00",
    description: "A sunset photo walk followed by an exhibition of the best shots.",
    adviser: { name: "Ms. Chen (demo)", email: "chen@demo.invalid" },
    lines: [v("v1", "A4-G07", "2026-12-09", "16:00", "21:00"), v("v2", "A4-G08", "2026-12-09", "16:00", "21:00"), i("i1", "banquet-table", 6, "2026-12-09", "2026-12-10"), i("i2", "signage-stand", 10, "2026-12-09", "2026-12-10"),
      { kind: "care", id: "c1", arrangement: "furniture", description: "Arrange six tables in a row along the wall for the photo display.", date: "2026-12-09", start: "14:00", end: "16:00" }],
  },
  {
    id: "DEMO-EVT-0103", seeded: true, submittedAt: "2026-11-18T11:30:00+08:00", applicant: { name: "Daniel Lee (demo)", id: "DEMO-0103" },
    name: "3x3 Inter-Faculty Cup (demo)", organisers: "Basketball Club", participants: 120, date: "2026-12-17", start: "15:00", end: "20:00",
    description: "A one day 3x3 basketball tournament on the outdoor courts.",
    adviser: { name: "Mr. Arif (demo)", email: "arif@demo.invalid" },
    lines: [i("i1", "stopwatch", 6, "2026-12-16", "2026-12-18"), i("i2", "megaphone", 2, "2026-12-16", "2026-12-18"), i("i3", "walkie-talkie", 12, "2026-12-17", "2026-12-18"), i("i4", "prize-tray", 3, "2026-12-16", "2026-12-18"), i("i5", "air-cooler", 2, "2026-12-17", "2026-12-18")],
  },
  {
    id: "DEMO-EVT-0104", seeded: true, submittedAt: "2026-11-19T14:45:00+08:00", applicant: { name: "Daniel Lee (demo)", id: "DEMO-0103" },
    name: "3x3 Inter-Faculty Cup (demo)", organisers: "Basketball Club", participants: 120, date: "2026-12-17", start: "15:00", end: "20:00",
    description: "Registration desk and team briefing room for the 3x3 cup.",
    adviser: { name: "Mr. Arif (demo)", email: "arif@demo.invalid" },
    lines: [v("v1", "B1-213", "2026-12-17", "14:00", "20:00")],
  },
  {
    id: "DEMO-EVT-0105", seeded: true, submittedAt: "2026-11-16T10:20:00+08:00", applicant: { name: "Priya Nair (demo)", id: "DEMO-0105" },
    name: "Open Mic Night (demo)", organisers: "Music & Band Club", participants: 80, date: "2026-12-04", start: "19:00", end: "22:00",
    description: "An evening of live music from students.",
    adviser: { name: "Ms. Teo (demo)", email: "teo@demo.invalid" },
    lines: [v("v1", "B1-B08", "2026-12-04", "18:00", "22:00"), i("i1", "speaker", 2, "2026-12-03", "2026-12-07"), i("i2", "media-card", 1, "2026-12-03", "2026-12-07")],
  },
];

/** Open Mic Night was answered two days after it arrived. The others are still waiting, so the queue has work in it. */
export const SEEDED_DECISIONS: Decisions = {
  "DEMO-EVT-0105": {
    eventStatus: "Approved", sentAt: "2026-11-18T15:40:00+08:00",
    lines: {
      v1: { status: "Approved", updatedAt: "2026-11-18T15:40:00+08:00", remark: "Please put all tables and chairs back as you found them. Classes start early the next morning." },
      i1: { status: "Approved", updatedAt: "2026-11-18T15:40:00+08:00" },
      i2: { status: "Approved", updatedAt: "2026-11-18T15:40:00+08:00", remark: "Collect from the A3 Level 2 Circulation Counter." },
    },
  },
};
