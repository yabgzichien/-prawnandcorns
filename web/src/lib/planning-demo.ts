import { ASSIGNMENTS, CLASSES, sessionDate } from "./data/academics";
import { DEMO_NOW, WEEK_START } from "./time";
import { asMalaysiaIso, proposeStudyPlan, reconcileStudySessionTitles, sanitizeStudySessions, type BusyBlock, type StudySession, type StudyTask } from "./planning";
import { normalizeGeneratedCopy } from "./agent-presentation";

/** Keep saved browser sessions from older demo versions, but update their
 * display titles from canonical task IDs so changed copy is consistent. */
export function sanitizeDemoStudySessions(raw: unknown): StudySession[] {
  const titles = new Map(ASSIGNMENTS.map((task) => [task.id, task.title]));
  return reconcileStudySessionTitles(sanitizeStudySessions(raw), titles, normalizeGeneratedCopy);
}

/** Explicit adapter for the competition's entirely fictional academic records. */
export function demoTasks(submitted: string[] = []): StudyTask[] {
  return ASSIGNMENTS.map((task) => ({
    id: task.id,
    title: task.title,
    due: task.due,
    status: submitted.includes(task.id) ? "submitted" : task.status,
    weight: task.weight,
  }));
}

export function demoClassBlocks(): BusyBlock[] {
  return CLASSES.filter((item) => item.status !== "cancelled").map((item) => {
    const dates = sessionDate(item);
    return { label: `${item.courseId} ${item.kind}`, start: asMalaysiaIso(dates.start.getTime()), end: asMalaysiaIso(dates.end.getTime()) };
  });
}

export function demoStudyProposal(prompt: string, submitted: string[], existing: StudySession[]) {
  return proposeStudyPlan({
    prompt,
    tasks: demoTasks(submitted),
    classes: demoClassBlocks(),
    existing,
    now: asMalaysiaIso(DEMO_NOW.getTime()),
    weekStart: asMalaysiaIso(WEEK_START.getTime()),
  });
}
