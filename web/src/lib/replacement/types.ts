// Replacement classes: a lecturer finds a new time for a lost class and tells the students.
// Everything here is invented demo data. No real timetable or student record is read.

export const REASONS = ["Lecturer on leave", "Public holiday", "Other"] as const;
export type ReplacementReason = (typeof REASONS)[number];

/** One time the lecturer offers or sets. `day` is days from Monday 23 Nov 2026 (0 = Mon). */
export type SlotOption = { id: string; day: number; start: string; end: string; room: string };

export type ReplacementStatus = "asking" | "scheduled";

export type ReplacementRequest = {
  /** Shown to people, for example DEMO-RPL-0001. */
  id: string;
  /** Changes every time the desk asks again or sets a new time, so old answers and "seen" marks stop counting. */
  stamp: string;
  courseId: string;
  /** The class that is lost, an id from the student's timetable (for example c11). */
  sessionId: string;
  reason: ReplacementReason;
  note: string;
  status: ReplacementStatus;
  /** While asking: the two or three times offered. */
  options: SlotOption[];
  /** Once scheduled: the time and room set. */
  chosen?: SlotOption;
  updatedAt: string;
};

/** Written only by the console (the lecturer desk). */
export const REPLACEMENTS_KEY = "compass:replacements:v1";
/** Written only by Compass: which offered times work for the student. */
export const REPLACEMENT_ANSWERS_KEY = "compass:replacement-answers:v1";
/** Written only by Compass: which updates the student has been told about. */
export const REPLACEMENT_SEEN_KEY = "compass:replacement-seen:v1";

/** For each request id: the stamp it answered and, for each option id, whether that time works. */
export type ReplacementAnswers = Record<string, { stamp: string; works: Record<string, boolean>; at: string }>;

export const MAX_OPTIONS = 3;
export const NOTE_MAX = 160;
