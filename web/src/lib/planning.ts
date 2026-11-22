/** Deterministic, fictional-data planner. No LLM and no university integration. */
export type StudyTask = {
  id: string;
  title: string;
  due: string;
  status: "todo" | "progress" | "overdue" | "submitted";
  weight: number;
};

export type BusyBlock = { label: string; start: string; end: string };
export type StudySession = { id: string; taskId: string; title: string; start: string; end: string };
export type StudyProposal = {
  sessions: StudySession[];
  blocked: BusyBlock[];
  assumptions: string[];
  skipped: string[];
};
export type PlanInput = {
  prompt: string;
  tasks: StudyTask[];
  classes: BusyBlock[];
  existing: StudySession[];
  now: string;
  weekStart: string;
};

const HOUR = 60 * 60_000;
const HALF_HOUR = HOUR / 2;
const MY_OFFSET = 8 * HOUR;
const DAY = 24 * HOUR;
const MY_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/;

/** Preserves Malaysian wall clock time even when the viewer is outside Malaysia. */
export function asMalaysiaIso(ms: number): string {
  return `${new Date(ms + MY_OFFSET).toISOString().slice(0, 16)}:00+08:00`;
}

function finite(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function overlaps(a: Pick<BusyBlock, "start" | "end">, b: Pick<BusyBlock, "start" | "end">): boolean {
  return finite(a.start) < finite(b.end) && finite(b.start) < finite(a.end);
}

function studyHours(start: number, end: number): boolean {
  const a = new Date(start + MY_OFFSET);
  const b = new Date(end + MY_OFFSET);
  const from = a.getUTCHours() * 60 + a.getUTCMinutes();
  const to = b.getUTCHours() * 60 + b.getUTCMinutes();
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) && from >= 9 * 60 && to <= 21 * 60;
}

export function validateStudySessions(
  sessions: StudySession[],
  tasks: StudyTask[],
  classes: BusyBlock[],
  existing: StudySession[],
  now: string,
): string[] {
  const errors: string[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const saved = existing.map((item) => ({ label: `Saved study: ${item.title}`, start: item.start, end: item.end }));
  for (const session of sessions) {
    const task = tasksById.get(session.taskId);
    const start = finite(session.start);
    const end = finite(session.end);
    const label = session.title || "Study session";
    if (!session.id || seen.has(session.id)) errors.push(`${label}: duplicate or missing session ID.`);
    seen.add(session.id);
    if (!task || task.status === "submitted" || task.status === "overdue") errors.push(`${label}: task is not available for planning.`);
    if (!MY_ISO.test(session.start) || !MY_ISO.test(session.end) || !Number.isFinite(start) || !Number.isFinite(end)) {
      errors.push(`${label}: use valid Malaysian local dates and times.`);
      continue;
    }
    if (start < finite(now)) errors.push(`${label}: cannot start before the demo clock.`);
    if (end <= start || end - start < HALF_HOUR || end - start > 3 * HOUR) errors.push(`${label}: use a 30–180 minute session.`);
    if (!studyHours(start, end)) errors.push(`${label}: sessions must stay between 09:00 and 21:00 MYT on one day.`);
    if (task && end > finite(task.due)) errors.push(`${label}: ends after its assignment deadline.`);
    const busy = [...classes, ...saved];
    for (const block of busy) {
      if (Number.isFinite(finite(block.start)) && Number.isFinite(finite(block.end)) && overlaps(session, block)) {
        errors.push(`${label}: overlaps ${block.label}.`);
      }
    }
    for (const other of sessions) {
      if (session === other || other.id === session.id) continue;
      if (Number.isFinite(finite(other.start)) && Number.isFinite(finite(other.end)) && overlaps(session, other)) {
        errors.push(`${label}: overlaps another proposed study session.`);
        break;
      }
    }
  }
  return errors;
}

export function sanitizeStudySessions(value: unknown): StudySession[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter((entry): entry is StudySession => {
    if (!entry || typeof entry !== "object") return false;
    const s = entry as Partial<StudySession>;
    if (typeof s.id !== "string" || !s.id || s.id.length > 150 || ids.has(s.id)
      || typeof s.taskId !== "string" || !s.taskId || s.taskId.length > 100
      || typeof s.title !== "string" || !s.title || s.title.length > 180
      || typeof s.start !== "string" || !MY_ISO.test(s.start) || !Number.isFinite(finite(s.start))
      || typeof s.end !== "string" || !MY_ISO.test(s.end) || !Number.isFinite(finite(s.end))
      || finite(s.end) <= finite(s.start)) return false;
    ids.add(s.id);
    return true;
  }).slice(0, 50);
}

/** Confirmation gate: the UI cannot bypass the same rules used to create a proposal. */
export function tryConfirmStudyPlan(
  proposed: StudySession[],
  existing: StudySession[],
  tasks: StudyTask[],
  classes: BusyBlock[],
  assumedBlocks: BusyBlock[],
  now: string,
): { ok: true; sessions: StudySession[] } | { ok: false; error: string } {
  if (proposed.length === 0 || proposed.length > 3 || existing.length + proposed.length > 50) {
    return { ok: false, error: "Choose between one and three study sessions (50 saved maximum)." };
  }
  if (proposed.some((session) => existing.some((saved) => saved.id === session.id))) {
    return { ok: false, error: "This study plan has already been saved." };
  }
  const issues = validateStudySessions(proposed, tasks, [...classes, ...assumedBlocks], existing, now);
  return issues.length ? { ok: false, error: issues[0] } : { ok: true, sessions: [...existing, ...proposed] };
}

/** Conservative inferred block, never saved as a real appointment. */
function assumedMeetings(prompt: string, weekStart: number): { blocked: BusyBlock[]; assumptions: string[]; unresolved: boolean } {
  if (!/\b(meeting|appointment|commitment|event)\b/i.test(prompt)) return { blocked: [], assumptions: [], unresolved: false };
  const match = prompt.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[\s\S]{0,30}\bevening\b/i);
  if (!match) return { blocked: [], assumptions: ["Please give the meeting day and time. This demo only understands a named weekday evening (blocked 18:00–21:00); no study sessions were proposed."], unresolved: true };
  const day = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(match[1].toLowerCase());
  const start = weekStart + day * DAY + 18 * HOUR;
  return {
    blocked: [{ label: `${match[1]} evening meeting (assumed)`, start: asMalaysiaIso(start), end: asMalaysiaIso(start + 3 * HOUR) }],
    assumptions: [`${match[1]} evening has no exact time. Temporarily blocked 18:00–21:00 MYT; verify the meeting time before confirming.`],
    unresolved: false,
  };
}

export function proposeStudyPlan(input: PlanInput): StudyProposal {
  const weekStart = finite(input.weekStart);
  const now = finite(input.now);
  if (!Number.isFinite(weekStart) || !Number.isFinite(now)) throw new Error("Invalid demo planning clock");
  const { blocked, assumptions, unresolved } = assumedMeetings(input.prompt, weekStart);
  if (unresolved) return { sessions: [], blocked, assumptions, skipped: [] };
  const busy: BusyBlock[] = [...input.classes, ...blocked, ...input.existing.map((s) => ({ label: `Saved study: ${s.title}`, start: s.start, end: s.end }))];
  const sessions: StudySession[] = [];
  const skipped: string[] = [];
  const pending = input.tasks.filter((t) => (t.status === "todo" || t.status === "progress") && finite(t.due) > now)
    .sort((a, b) => finite(a.due) - finite(b.due) || b.weight - a.weight);
  // The two nearest deadlines get first consideration; one remaining place favours high-weight work.
  const tasks = [...pending.slice(0, 2), ...pending.slice(2).sort((a, b) => b.weight - a.weight || finite(a.due) - finite(b.due)).slice(0, 1)]
    .sort((a, b) => finite(a.due) - finite(b.due));
  const selected = new Set(tasks.map((task) => task.id));
  for (const task of pending) if (!selected.has(task.id)) skipped.push(`${task.title}: not included in this top-three plan; review separately.`);

  for (const task of tasks) {
    const endBoundary = Math.min(finite(task.due), weekStart + 7 * DAY);
    let found: StudySession | undefined;
    const earliest = Math.ceil(now / HALF_HOUR) * HALF_HOUR;
    const preferred = Math.ceil(Math.max(now, finite(task.due) - 2 * DAY) / HALF_HOUR) * HALF_HOUR;
    for (const [from, until] of [[preferred, endBoundary], [earliest, preferred]] as const) {
      for (let candidate = from; candidate + HOUR <= until; candidate += HALF_HOUR) {
        if (!studyHours(candidate, candidate + HOUR)) continue;
        const session: StudySession = {
          id: `study-${task.id}-${candidate}`,
          taskId: task.id,
          title: task.title,
          start: asMalaysiaIso(candidate),
          end: asMalaysiaIso(candidate + HOUR),
        };
        if (validateStudySessions([session], input.tasks, busy, [], input.now).length === 0) {
          found = session;
          busy.push({ label: `Proposed study: ${task.title}`, start: session.start, end: session.end });
          break;
        }
      }
      if (found) break;
    }
    if (found) sessions.push(found);
    else skipped.push(`${task.title}: no conflict-free 60-minute slot before its deadline.`);
  }
  return { sessions, blocked, assumptions, skipped };
}
