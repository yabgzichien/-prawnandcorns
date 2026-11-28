import type { GeCourse, Meeting, Stream } from "./types.ts";

// ──────────────────────────────────────────────────────────
// ALL DATA IN THIS FILE IS INVENTED FOR THE DEMO.
// Course codes, titles, lecturers, seats and times are made up. The schedule text copies the
// different ways an elective list can write a time, so the parser has real variety to read.
// ──────────────────────────────────────────────────────────

/** The demo student's programme stream. BSc Computer Science is a science programme. */
export const STUDENT_STREAM: Stream = "Science";

/** Demo values the student can change: the programme plan's GE credits for this semester, and the semester limit. */
export const DEFAULT_TARGET = 4;
export const SEMESTER_CREDIT_LIMIT = 20;

export type CoreClass = { code: string; title: string; kind: "Lecture" | "Tutorial" | "Lab"; credits: number; meeting: Meeting };
const every = Array.from({ length: 14 }, (_, i) => i + 1);

/** The demo student's Semester 2 core timetable (from the programme outlook), as the AC would publish it. */
export const CORE_SEM2: CoreClass[] = [
  { code: "CST1202", title: "Data Structures", kind: "Lecture", credits: 4, meeting: { day: 0, start: "10:00", end: "12:00", weeks: every, room: "A3-G01" } },
  { code: "CST1202", title: "Data Structures", kind: "Lab", credits: 0, meeting: { day: 2, start: "14:00", end: "16:00", weeks: every, room: "A5-L2" } },
  { code: "MAT1202", title: "Linear Algebra", kind: "Lecture", credits: 3, meeting: { day: 1, start: "09:00", end: "11:00", weeks: every, room: "A3-G02" } },
  { code: "MAT1202", title: "Linear Algebra", kind: "Tutorial", credits: 0, meeting: { day: 3, start: "10:00", end: "11:00", weeks: every, room: "A2-104" } },
  { code: "CST1204", title: "Computer Organisation", kind: "Lecture", credits: 3, meeting: { day: 1, start: "14:00", end: "16:00", weeks: every, room: "A4-301" } },
  { code: "CST1204", title: "Computer Organisation", kind: "Tutorial", credits: 0, meeting: { day: 4, start: "10:00", end: "11:00", weeks: every, room: "A4-105" } },
  { code: "ENG1202", title: "Technical Writing", kind: "Lecture", credits: 2, meeting: { day: 3, start: "14:00", end: "16:00", weeks: every, room: "A3-201" } },
];
export const CORE_CREDITS = CORE_SEM2.reduce((n, c) => n + c.credits, 0);

export const GE_CATALOGUE: GeCourse[] = [
  // Science stream electives (for business and arts students)
  { code: "GES1101", title: "Everyday Physics", stream: "Science", credits: 2, seats: 18, capacity: 60, schedule: "Tue 2:00 PM - 4:00 PM, A2-305 (Weeks 1-14)", lecturer: "Dr. Wong (demo)", blurb: "How the physics of motion, heat and light explains ordinary things.", tags: ["Technology", "Nature"] },
  { code: "GES1203", title: "Environmental Science", stream: "Science", credits: 2, seats: 25, capacity: 50, schedule: "Wed 10:00-12:00; A1-102", lecturer: "Dr. Aziz (demo)", blurb: "Ecosystems, climate and what a campus can do about waste.", tags: ["Nature", "Health"] },
  { code: "GES1305", title: "Astronomy for Everyone", stream: "Science", credits: 1, seats: 9, capacity: 40, schedule: "Thursdays 6pm to 8pm, Weeks 1-7, A3-G02", lecturer: "Dr. Tan (demo)", blurb: "Night sky, telescopes and the story of the universe.", tags: ["Nature", "Technology"] },
  { code: "GES1402", title: "Nutrition and Health", stream: "Science", credits: 2, seats: 30, capacity: 60, schedule: "Mon & Wed 4.00pm-5.00pm, A4-301", lecturer: "Ms. Lee (demo)", blurb: "Food, energy and building habits that last.", tags: ["Health"] },
  { code: "GES1110", title: "Data Literacy for Everyone", stream: "Science", credits: 3, seats: 12, capacity: 40, schedule: "Fri 9am-12pm (Wk 1-14), A5-L1", lecturer: "Dr. Ng (demo)", blurb: "Reading charts, spotting bad statistics and asking good questions of data.", tags: ["Technology"] },

  // Business stream electives (for arts and science students)
  { code: "GEB1101", title: "Entrepreneurship Essentials", stream: "Business", credits: 2, seats: 14, capacity: 50, schedule: "Thu 14:00-16:00 / A2-203", lecturer: "Mr. Goh (demo)", blurb: "From an idea to a first customer, with a pitch at the end.", tags: ["Business", "Communication"] },
  { code: "GEB1203", title: "Personal Finance Basics", stream: "Business", credits: 2, seats: 21, capacity: 60, schedule: "Every Monday, 2pm to 4pm, A4-105", lecturer: "Ms. Chua (demo)", blurb: "Budgets, saving, loans and investing without the jargon.", tags: ["Money", "Business"] },
  { code: "GEB1305", title: "Marketing in the Digital Age", stream: "Business", credits: 3, seats: 6, capacity: 45, schedule: "Tue 09:00-11:00 and Thu 09:00-10:00, A2-203", lecturer: "Dr. Raj (demo)", blurb: "Brands, social media and what makes people click.", tags: ["Business", "Creative", "Film and media"] },
  { code: "GEB1402", title: "Negotiation Skills", stream: "Business", credits: 1, seats: 11, capacity: 30, schedule: "Wed 18:00-21:00 on 10 Mar and 17 Mar 2027, A2-305", lecturer: "Mr. Lau (demo)", blurb: "Two evening workshops on preparing, listening and closing.", tags: ["Communication", "Business"] },
  { code: "GEB1110", title: "Business Etiquette", stream: "Business", credits: 1, seats: 27, capacity: 40, schedule: "Wed 16:00-18:00, Weeks 8-14, A1-210", lecturer: "Ms. Ho (demo)", blurb: "Emails, meetings and first impressions at work.", tags: ["Communication"] },
  { code: "GEB1220", title: "Introduction to Accounting", stream: "Business", credits: 3, seats: 20, capacity: 50, schedule: "TBA", lecturer: "Dr. Yeo (demo)", blurb: "How a business records and reports its money.", tags: ["Money", "Business"] },

  // Arts stream electives (for science and business students)
  { code: "GEA1101", title: "Intermediate Mandarin", stream: "Arts", credits: 3, seats: 8, capacity: 30, schedule: "Mon 10:00-12:00 & Wed 10:00-11:00, A3-201", lecturer: "Ms. Zhang (demo)", blurb: "Everyday conversation and reading for students with some Mandarin.", tags: ["Languages", "Culture"] },
  { code: "GEA1203", title: "Chinese Calligraphy", stream: "Arts", credits: 2, seats: 3, capacity: 24, schedule: "Fri 2:00pm - 4:00pm (Weeks 1-14), A2-305", lecturer: "Mr. Xu (demo)", blurb: "Brush, ink and the basic strokes, with a small exhibition.", tags: ["Culture", "Creative"] },
  { code: "GEA1305", title: "Film Appreciation", stream: "Arts", credits: 2, seats: 19, capacity: 80, schedule: "Thursdays, 4pm-6pm, A3-G02", lecturer: "Dr. Ismail (demo)", blurb: "How films are built, from shots to sound, one screening a week.", tags: ["Film and media", "Creative"] },
  { code: "GEA1402", title: "Creative Writing", stream: "Arts", credits: 2, seats: 10, capacity: 30, schedule: "Tue 16:00-18:00, Wk 1-7; Thu 16:00-18:00, Wk 8-14, A2-104", lecturer: "Ms. Kaur (demo)", blurb: "Short stories and poems, workshopped in small groups.", tags: ["Creative", "Communication"] },
  { code: "GEA1110", title: "Photography Basics", stream: "Arts", credits: 1, seats: 7, capacity: 20, schedule: "Wednesdays 3, 10 and 17 March 2027, 6pm-9pm, A2-305", lecturer: "Mr. Lim (demo)", blurb: "Three evening sessions on light, framing and editing.", tags: ["Creative", "Film and media"] },
  { code: "GEA1220", title: "Bahasa Melayu for Beginners", stream: "Arts", credits: 2, seats: 16, capacity: 40, schedule: "Mon & Wed 8:30am-9:30am, A1-102", lecturer: "Puan Aisyah (demo)", blurb: "Greetings, directions and everyday Malay.", tags: ["Languages", "Culture"] },
  { code: "GEA1330", title: "Music and Society", stream: "Arts", credits: 2, seats: 0, capacity: 60, schedule: "Wed 14:00-16:00, A3-G02", lecturer: "Dr. Chan (demo)", blurb: "How music shapes and reflects the places it comes from.", tags: ["Culture", "Creative"] },
  { code: "GEA1450", title: "Korean Language I", stream: "Arts", credits: 3, seats: 5, capacity: 30, schedule: "Tue 11:00-13:00 & Fri 11:00-12:00, A1-210", lecturer: "Ms. Park (demo)", blurb: "Hangul, greetings and simple conversation.", tags: ["Languages", "Culture"] },
];

export const GE_BY_CODE: Record<string, GeCourse> = Object.fromEntries(GE_CATALOGUE.map((c) => [c.code, c]));
