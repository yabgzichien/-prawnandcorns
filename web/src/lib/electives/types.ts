// General electives (GE): the AC lists each elective's schedule as text. Compass reads it, checks it and suggests sets.
// All courses, times, seats and the Semester 2 timetable are invented for the demo.

export const STREAMS = ["Science", "Business", "Arts"] as const;
export type Stream = (typeof STREAMS)[number];

/** The rule the team described: a student takes electives only from the two streams that are not their own. */
export const ALLOWED_STREAMS: Record<Stream, Stream[]> = {
  Science: ["Business", "Arts"],
  Business: ["Arts", "Science"],
  Arts: ["Science", "Business"],
};

export const INTERESTS = ["Languages", "Culture", "Creative", "Film and media", "Money", "Business", "Communication", "Health", "Nature", "Technology"] as const;
export type Interest = (typeof INTERESTS)[number];

export type GeCourse = {
  code: string;
  title: string;
  stream: Stream;
  credits: number;
  /** Seats left. 0 means the section is full. */
  seats: number;
  capacity: number;
  /** Exactly as the AC shows it. */
  schedule: string;
  lecturer: string;
  blurb: string;
  tags: Interest[];
};

/** One weekly meeting. `day` is 0 for Monday. `weeks` are semester weeks, 1 to 14. */
export type Meeting = { day: number; start: string; end: string; weeks: number[]; room?: string; dates?: string[] };

export type ParsedSchedule = {
  meetings: Meeting[];
  /** Parts of the text Compass could not read. Never treated as free time. */
  unreadable: string[];
  /** Online and self-paced: readable, with no fixed meeting time. */
  flexible: boolean;
};

export type TimePrefs = { freeFriday: boolean; noEvening: boolean; noEarly: boolean };
export const DEFAULT_PREFS: TimePrefs = { freeFriday: false, noEvening: false, noEarly: false };
export const PREF_LABEL: Record<keyof TimePrefs, string> = { freeFriday: "Keep Friday afternoons free", noEvening: "Nothing after 6 pm", noEarly: "Nothing before 9 am" };

/** What the student saved. Saved in this browser only. It is not a registration. */
export type ElectiveShortlist = { codes: string[]; target: number; savedAt: string };
