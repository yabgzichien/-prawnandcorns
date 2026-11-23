import { COURSES } from "./academics.ts";

// Moodle's real web service uses numeric ids. These helpers give each invented course and
// assignment a stable numeric id so the mock API can copy that shape. Nothing here is real.

const COURSE_NUMERIC = new Map(COURSES.map((course, index) => [course.id, 101 + index]));

export const moodleCourseId = (courseId: string): number => COURSE_NUMERIC.get(courseId) ?? 0;
export const courseIdFromMoodle = (numeric: number): string | undefined => [...COURSE_NUMERIC].find(([, value]) => value === numeric)?.[0];

/** "a3" -> 9003. Unknown shapes get 0 so they never match a real record. */
export const moodleAssignmentId = (assignmentId: string): number => {
  const n = Number(assignmentId.replace(/^a/, ""));
  return Number.isFinite(n) ? 9000 + n : 0;
};
export const assignmentIdFromMoodle = (numeric: number): string => `a${numeric - 9000}`;

export const unixSeconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000);
