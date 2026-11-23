import { ASSIGNMENTS, CLASSES, sessionDate, type Assignment, type ClassSession } from "./data/academics.ts";
import { DEMO_NOW, WEEK_START } from "./time.ts";
import { asMalaysiaIso, proposeStudyPlan, reconcileStudySessionTitles, sanitizeStudySessions, type BusyBlock, type StudySession, type StudyTask } from "./planning.ts";
import { normalizeGeneratedCopy } from "./agent-presentation.ts";

/** Keep saved browser sessions from older demo versions, but update their
 * display titles from canonical task IDs so changed copy is consistent. */
export function sanitizeDemoStudySessions(raw: unknown): StudySession[] {
  const titles = new Map(ASSIGNMENTS.map((task) => [task.id, task.title]));
  return reconcileStudySessionTitles(sanitizeStudySessions(raw), titles, normalizeGeneratedCopy);
}

/** Explicit adapter for the competition's entirely fictional academic records. */
/** The same adapter for any list of assignments, such as those read from the connected Moodle demo. */
export function tasksFrom(assignments: readonly Assignment[], submitted: string[] = []): StudyTask[] {
  return assignments.map((task) => ({
    id: task.id,
    title: task.title,
    due: task.due,
    status: submitted.includes(task.id) ? "submitted" : task.status,
    weight: task.weight,
  }));
}

export const demoTasks = (submitted: string[] = []): StudyTask[] => tasksFrom(ASSIGNMENTS, submitted);

export function classBlocksFrom(classes: readonly ClassSession[]): BusyBlock[] {
  return classes.filter((item) => item.status !== "cancelled").map((item) => {
    const dates = sessionDate(item);
    return { label: `${item.courseId} ${item.kind}`, start: asMalaysiaIso(dates.start.getTime()), end: asMalaysiaIso(dates.end.getTime()) };
  });
}

export const demoClassBlocks = (): BusyBlock[] => classBlocksFrom(CLASSES);

export function demoStudyProposal(prompt: string, submitted: string[], existing: StudySession[], source: { assignments: readonly Assignment[]; classes: readonly ClassSession[] } = { assignments: ASSIGNMENTS, classes: CLASSES }) {
  return proposeStudyPlan({
    prompt,
    tasks: tasksFrom(source.assignments, submitted),
    classes: classBlocksFrom(source.classes),
    existing,
    now: asMalaysiaIso(DEMO_NOW.getTime()),
    weekStart: asMalaysiaIso(WEEK_START.getTime()),
  });
}
