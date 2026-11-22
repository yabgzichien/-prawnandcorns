import { atDay } from "../time";

// ──────────────────────────────────────────────────────────
// ALL DATA IN THIS FILE IS INVENTED FOR THE DEMO.
// No real student, lecturer, course-offering or finance record is used.
// ──────────────────────────────────────────────────────────

export type Tone = "blue" | "orange" | "purple" | "green" | "teal" | "red";

export const STUDENT = {
  name: "Alex Tan",
  first: "Alex",
  programme: "BSc Computer Science (Year 1)",
  id: "DEMO-0000",
  semester: "Semester 1 · Week 10",
};

export type Course = {
  id: string;
  code: string;
  title: string;
  kind: "Core" | "GE";
  credits: number;
  lecturer: string;
  tone: Tone;
  blurb: string;
  assessment: string;
};

export const COURSES: Course[] = [
  { id: "cst1101", code: "CST1101", title: "Programming Fundamentals", kind: "Core", credits: 4, lecturer: "Dr. Lim (demo)", tone: "blue", blurb: "Variables, control flow, arrays and functions in Python.", assessment: "Labs 30% · Project 30% · Final 40%" },
  { id: "mat1101", code: "MAT1101", title: "Calculus I", kind: "Core", credits: 3, lecturer: "Prof. Chen (demo)", tone: "orange", blurb: "Limits, derivatives and integrals of one variable.", assessment: "Problem sets 20% · Midterm 30% · Final 50%" },
  { id: "cst1103", code: "CST1103", title: "Digital Logic Design", kind: "Core", credits: 3, lecturer: "Dr. Ooi (demo)", tone: "purple", blurb: "Boolean algebra, combinational and sequential circuits.", assessment: "Quizzes 20% · Labs 20% · Final 60%" },
  { id: "eng1101", code: "ENG1101", title: "Academic English", kind: "Core", credits: 2, lecturer: "Ms. Rao (demo)", tone: "green", blurb: "Reading, essay writing and presentation skills.", assessment: "Essays 50% · Presentation 20% · Quizzes 30%" },
  { id: "gen1201", code: "GEN1201", title: "Malaysian Studies", kind: "GE", credits: 2, lecturer: "Dr. Siti (demo)", tone: "teal", blurb: "History, society and governance of Malaysia.", assessment: "Presentation 40% · Final 60%" },
];

export const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));

// Programme outlook shown on the Courses page.
export const CORE_PLAN = [
  { sem: "Year 1 · Sem 1", status: "current", items: ["CST1101 Programming Fundamentals", "MAT1101 Calculus I", "CST1103 Digital Logic Design", "ENG1101 Academic English"] },
  { sem: "Year 1 · Sem 2", status: "next", items: ["CST1202 Data Structures", "MAT1202 Linear Algebra", "CST1204 Computer Organisation", "ENG1202 Technical Writing"] },
  { sem: "Year 2 · Sem 1", status: "later", items: ["CST2101 Algorithms", "CST2103 Database Systems", "MAT2101 Probability & Statistics"] },
];

export const GE_GROUPS = [
  { id: "culture", title: "Language & Culture", need: 4, done: 0, options: ["Intermediate Mandarin", "Intro to Chinese Culture", "Bahasa Melayu for Beginners"] },
  { id: "society", title: "Society & Nation", need: 2, done: 2, taking: "GEN1201 Malaysian Studies", options: ["Malaysian Studies", "Ethics in the Digital Age"] },
  { id: "enterprise", title: "Enterprise & Skills", need: 2, done: 0, options: ["Entrepreneurship Essentials", "Design Thinking", "Personal Finance Basics"] },
  { id: "wellbeing", title: "Wellbeing & Sport", need: 2, done: 0, options: ["Fitness & Wellness", "Badminton", "Mindfulness"] },
];

export type ClassStatus = "normal" | "cancelled" | "room-changed" | "makeup";

export type ClassSession = {
  id: string;
  courseId: string;
  day: number; // 0 = Mon
  start: string;
  end: string;
  kind: "Lecture" | "Tutorial" | "Lab";
  room: string;
  status: ClassStatus;
  originalRoom?: string;
  noticeId?: string;
};

export const CLASSES: ClassSession[] = [
  { id: "c1", courseId: "cst1101", day: 0, start: "10:00", end: "12:00", kind: "Lecture", room: "A2-203", status: "normal" },
  { id: "c2", courseId: "mat1101", day: 0, start: "14:00", end: "16:00", kind: "Tutorial", room: "A4-105", status: "cancelled", noticeId: "n1" },
  { id: "c3", courseId: "eng1101", day: 0, start: "16:00", end: "18:00", kind: "Lecture", room: "A3-G01", status: "normal" },
  { id: "c4", courseId: "mat1101", day: 1, start: "09:00", end: "11:00", kind: "Lecture", room: "A3-G01", status: "normal" },
  { id: "c5", courseId: "cst1103", day: 1, start: "14:00", end: "16:00", kind: "Lecture", room: "A4-301", status: "normal" },
  { id: "c6", courseId: "cst1101", day: 2, start: "10:00", end: "12:00", kind: "Lab", room: "A5-L2", status: "room-changed", originalRoom: "A5-L1", noticeId: "n2" },
  { id: "c7", courseId: "gen1201", day: 2, start: "14:00", end: "16:00", kind: "Lecture", room: "A3-G01", status: "normal" },
  { id: "c8", courseId: "mat1101", day: 3, start: "10:00", end: "12:00", kind: "Tutorial", room: "A2-104", status: "makeup", noticeId: "n1" },
  { id: "c9", courseId: "cst1103", day: 3, start: "14:00", end: "16:00", kind: "Lab", room: "A5-L3", status: "normal" },
  { id: "c10", courseId: "eng1101", day: 4, start: "09:00", end: "11:00", kind: "Lecture", room: "A3-201", status: "normal" },
  { id: "c11", courseId: "cst1101", day: 4, start: "14:00", end: "15:00", kind: "Tutorial", room: "A4-105", status: "normal" },
];

export type Notice = {
  id: string;
  kind: "cancellation" | "room" | "admin";
  title: string;
  body: string;
  posted: string; // ISO
  source: string;
  courseId?: string;
};

export const NOTICES: Notice[] = [
  {
    id: "n1", kind: "cancellation", courseId: "mat1101",
    title: "MAT1101 tutorial today is cancelled",
    body: "Mon 14:00 tutorial is cancelled. A make-up session is on Thu 26 Nov, 10:00 in A2-104.",
    posted: "2026-11-23T13:05:00+08:00", source: "Course announcement (demo)",
  },
  {
    id: "n2", kind: "room", courseId: "cst1101",
    title: "CST1101 lab moved to A5-L2",
    body: "Wednesday's lab moves from A5-L1 to A5-L2 because of equipment servicing. Time is unchanged.",
    posted: "2026-11-22T18:30:00+08:00", source: "Course announcement (demo)",
  },
  {
    id: "n3", kind: "admin",
    title: "Add/drop window closes Friday",
    body: "Course add/drop for this semester closes on Fri 27 Nov, 17:00. Changes after that need a form.",
    posted: "2026-11-20T09:00:00+08:00", source: "Academic Affairs (demo)",
  },
];

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  due: string; // ISO
  weight: number;
  type: "Submission" | "Quiz" | "Essay" | "Presentation";
  status: "todo" | "progress" | "submitted" | "overdue";
  note?: string;
};

export const ASSIGNMENTS: Assignment[] = [
  { id: "a0", courseId: "eng1101", title: "Vocabulary Quiz 4", due: "2026-11-22T23:59:00+08:00", weight: 2, type: "Quiz", status: "overdue", note: "Late attempts open until Wed 25 Nov" },
  { id: "a1", courseId: "cst1101", title: "Lab 6 · Loops & Arrays", due: "2026-11-23T23:59:00+08:00", weight: 3, type: "Submission", status: "todo" },
  { id: "a2", courseId: "cst1103", title: "Quiz 3 · Boolean Algebra", due: "2026-11-24T20:00:00+08:00", weight: 4, type: "Quiz", status: "todo" },
  { id: "a3", courseId: "mat1101", title: "Problem Set 5", due: "2026-11-25T17:00:00+08:00", weight: 4, type: "Submission", status: "progress" },
  { id: "a4", courseId: "eng1101", title: "Reflective Essay · Draft", due: "2026-11-27T12:00:00+08:00", weight: 10, type: "Essay", status: "progress" },
  { id: "a5", courseId: "gen1201", title: "Group Presentation Slides", due: "2026-11-30T23:59:00+08:00", weight: 15, type: "Presentation", status: "todo" },
  { id: "a6", courseId: "cst1101", title: "Mini Project Proposal", due: "2026-11-20T18:00:00+08:00", weight: 5, type: "Submission", status: "submitted" },
];

export const sessionDate = (c: ClassSession) => ({ start: atDay(c.day, c.start), end: atDay(c.day, c.end) });
