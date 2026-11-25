import assert from "node:assert/strict";
import test from "node:test";
import { proposeStudyPlan, reconcileStudySessionTitles, validateStudySessions, sanitizeStudySessions, tryConfirmStudyPlan, type BusyBlock, type StudyTask, type StudySession } from "../src/lib/planning.ts";

const now = "2026-11-23T13:20:00+08:00";
const monday = "2026-11-23T00:00:00+08:00";
const tasks: StudyTask[] = [
  { id: "lab", title: "Lab", due: "2026-11-23T23:59:00+08:00", status: "todo", weight: 3 },
  { id: "quiz", title: "Quiz", due: "2026-11-24T20:00:00+08:00", status: "todo", weight: 4 },
  { id: "essay", title: "Essay", due: "2026-11-27T12:00:00+08:00", status: "progress", weight: 10 },
];
const classes: BusyBlock[] = [
  { label: "Monday lecture", start: "2026-11-23T16:00:00+08:00", end: "2026-11-23T18:00:00+08:00" },
  { label: "Tuesday lecture", start: "2026-11-24T14:00:00+08:00", end: "2026-11-24T16:00:00+08:00" },
];
const proposal = (prompt = "Plan my week", existing: StudySession[] = []) => proposeStudyPlan({ prompt, tasks, classes, existing, now, weekStart: monday });

test("creates an editable study proposal without overlapping classes or other sessions", () => {
  const result = proposal();
  assert.equal(result.sessions.length, 3);
  assert.deepEqual(validateStudySessions(result.sessions, tasks, classes, [], now), []);
  assert.equal(result.sessions[0].taskId, "lab");
  assert.ok(result.sessions.every((s) => Date.parse(s.end) <= Date.parse(tasks.find((t) => t.id === s.taskId)!.due)));
});

test("a weekly plan balances urgent deadlines and higher-weight later work", () => {
  const extra = { id: "worksheet", title: "Wednesday worksheet", due: "2026-11-25T17:00:00+08:00", status: "todo" as const, weight: 2 };
  const result = proposeStudyPlan({ prompt: "I have an assignment due Friday; plan my week", tasks: [...tasks, extra], classes, existing: [], now, weekStart: monday });
  assert.deepEqual(result.sessions.map((s) => s.taskId), ["lab", "quiz", "essay"]);
  assert.match(result.sessions.find((s) => s.taskId === "essay")!.start, /^2026-11-25T/);
  assert.ok(result.skipped.some((s) => s.includes("Wednesday worksheet")));
});

test("a cancelled lesson, excluded from busy blocks, leaves time available", () => {
  const res = proposal();
  assert.equal(res.sessions[0].start, "2026-11-23T13:30:00+08:00");
});

test("vague Wednesday evening meeting is a clearly labelled, conservative assumption", () => {
  const res = proposal("Help me plan this week, meeting on Wednesday evening");
  assert.ok(res.assumptions.some((a) => a.includes("18:00–21:00")));
  assert.ok(res.blocked.some((b) => b.label.includes("assumed") && b.start.startsWith("2026-11-25T18:00")));
  assert.deepEqual(validateStudySessions(res.sessions, tasks, [...classes, ...res.blocked], [], now), []);
});

test("an unspecified meeting cannot be silently ignored when making a plan", () => {
  const res = proposal("I have a meeting sometime. Please plan my week.");
  assert.equal(res.sessions.length, 0);
  assert.ok(res.assumptions.some((text) => text.includes("meeting day and time")));
});

test("adjacent time ranges are legal but overlapping edited plans are not", () => {
  const one: StudySession = { id: "s1", taskId: "lab", title: "Lab", start: "2026-11-23T14:00:00+08:00", end: "2026-11-23T15:00:00+08:00" };
  const adjacent: StudySession = { ...one, id: "s2", taskId: "quiz", title: "Quiz", start: "2026-11-23T15:00:00+08:00", end: "2026-11-23T16:00:00+08:00" };
  assert.deepEqual(validateStudySessions([one, adjacent], tasks, classes, [], now), []);
  const conflicting = { ...adjacent, start: "2026-11-23T14:30:00+08:00" };
  assert.ok(validateStudySessions([one, conflicting], tasks, classes, [], now).some((e) => e.includes("overlaps")));
});

test("edits cannot go past deadlines, into the past, outside study hours, or into saved sessions", () => {
  const base: StudySession = { id: "s1", taskId: "lab", title: "Lab", start: "2026-11-23T18:00:00+08:00", end: "2026-11-23T19:00:00+08:00" };
  const check = (s: StudySession, existing: StudySession[] = []) => validateStudySessions([s], tasks, classes, existing, now);
  assert.ok(check({ ...base, start: "2026-11-23T12:00:00+08:00" }).length);
  assert.ok(check({ ...base, end: "2026-11-24T00:30:00+08:00" }).length);
  assert.ok(check({ ...base, start: "2026-11-23T20:30:00+08:00", end: "2026-11-23T21:30:00+08:00" }).length);
  assert.ok(check(base, [{ ...base, id: "saved" }]).some((e) => e.includes("overlaps")));
});

test("overdue tasks are not scheduled and impossible tasks are disclosed", () => {
  const res = proposeStudyPlan({ prompt: "plan", tasks: [{ id: "old", title: "Old", due: "2026-11-22T22:00:00+08:00", status: "overdue", weight: 5 }, ...tasks], classes: [{ label: "All day", start: "2026-11-23T13:20:00+08:00", end: "2026-11-23T23:59:00+08:00" }, ...classes], existing: [], now, weekStart: monday });
  assert.ok(res.sessions.every((s) => s.taskId !== "old"));
  assert.ok(res.skipped.some((s) => s.includes("Lab")));
});

test("sanitizes invalid or stale localStorage sessions instead of trusting arbitrary objects", () => {
  const good: StudySession = { id: "saved", taskId: "quiz", title: "Quiz", start: "2026-11-24T18:00:00+08:00", end: "2026-11-24T19:00:00+08:00" };
  assert.deepEqual(sanitizeStudySessions([good, null, { id: 8 }, { ...good, id: "duplicate", start: "bad" }, good]), [good]);
  assert.deepEqual(sanitizeStudySessions("not-an-array"), []);
});

test("previously saved demo sessions retain their IDs and times but gain the updated task title", () => {
  const separator = String.fromCodePoint(0x00b7);
  const saved: StudySession = { id: "legacy-plan", taskId: "a1", title: `Lab 6 ${separator} Loops & Arrays`,
    start: "2026-11-23T13:30:00+08:00", end: "2026-11-23T14:30:00+08:00" };
  const canonical = new Map([["a1", "Lab 6: Loops & Arrays"]]);
  const clean = (value: string) => value.replaceAll(` ${separator} `, ", ");
  const migrated = reconcileStudySessionTitles(sanitizeStudySessions([saved]), canonical, clean);
  assert.deepEqual(migrated, [{ ...saved, title: "Lab 6: Loops & Arrays" }]);
  const unknown = reconcileStudySessionTitles(sanitizeStudySessions([{ ...saved, taskId: "unknown", title: `Old ${separator} exercise` }]), canonical, clean);
  assert.equal(unknown[0].title, "Old, exercise");
});

test("confirmation saves only a fresh, valid proposal, leaving existing sessions unchanged on failure", () => {
  const newSession = proposal().sessions[0];
  const ok = tryConfirmStudyPlan([newSession], [], tasks, classes, [], now);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.sessions.length, 1);

  const duplicate = tryConfirmStudyPlan([newSession], ok.sessions, tasks, classes, [], now);
  assert.equal(duplicate.ok, false);
  const conflicting = tryConfirmStudyPlan([{ ...newSession, id: "changed", start: "2026-11-23T16:00:00+08:00", end: "2026-11-23T17:00:00+08:00" }], ok.sessions, tasks, classes, [], now);
  assert.equal(conflicting.ok, false);
  assert.deepEqual(ok.sessions, [newSession]);
});
