import { ASSIGNMENTS, CLASSES, COURSE_BY_ID } from "./data/academics";
import { FINANCE } from "./data/life";
import { searchCampus } from "./data/campus";
import { demoStudyProposal, demoTasks, sanitizeDemoStudySessions } from "./planning-demo";
import type { StudySession } from "./planning";
import type { GeminiToolResult } from "./gemini-agent";

export type DemoAgentContext = { submitted: string[]; studySessions: StudySession[] };

/** Never trust browser-provided demo state as real academic information. */
export function sanitizeDemoContext(raw: unknown): DemoAgentContext {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const ids = new Set(ASSIGNMENTS.map((task) => task.id));
  const submitted = Array.isArray(value.submitted)
    ? [...new Set(value.submitted.filter((id): id is string => typeof id === "string" && ids.has(id)))].slice(0, 30)
    : [];
  return { submitted, studySessions: sanitizeDemoStudySessions(value.studySessions) };
}

/** The only actions the model can execute. All are read-only or proposal-only. */
export async function executeDemoTool(name: string, args: Record<string, unknown>, prompt: string, context: DemoAgentContext): Promise<GeminiToolResult> {
  switch (name) {
    case "get_demo_assignments": {
      const tasks = demoTasks(context.submitted);
      return { value: { source: "fictional_demo", tasks }, summary: `Read ${tasks.length} fictional assignments` };
    }
    case "get_demo_timetable": {
      const classes = CLASSES.map((item) => ({
        day: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][item.day],
        course: COURSE_BY_ID[item.courseId]?.code ?? item.courseId,
        kind: item.kind, start: item.start, end: item.end, room: item.room, status: item.status,
      }));
      return { value: { source: "fictional_demo", weekStart: "2026-11-23", timeZone: "Asia/Kuala_Lumpur", classes }, summary: `Read ${classes.length} fictional class slots` };
    }
    case "propose_study_plan": {
      // Original prompt, not an LLM-rewritten time, is the input to this deterministic safety check.
      const proposal = demoStudyProposal(prompt, context.submitted, context.studySessions);
      return {
        value: { source: "fictional_demo", proposal, saved: false, requiresStudentConfirmation: true },
        summary: `${proposal.sessions.length} proposed sessions; ${proposal.skipped.length} omitted; not saved`,
        card: { kind: "study-plan", proposal },
      };
    }
    case "find_demo_room": {
      const query = typeof args.query === "string" ? args.query.slice(0, 80) : "";
      const matches = query ? searchCampus(query, 5).map((hit) => hit.type === "room"
        ? { code: hit.room.code, name: hit.room.name, floor: hit.room.floor, place: hit.place.name }
        : { place: hit.place.name, category: hit.place.kind }) : [];
      return { value: { source: "illustrative_campus_directory", matches }, summary: `${matches.length} illustrative matches` };
    }
    case "get_demo_finance":
      return { value: { source: "fictional_demo", currency: FINANCE.currency, total: FINANCE.tuitionTotal, paid: FINANCE.paid, dues: FINANCE.dues }, summary: "Read fictional tuition example" };
    default:
      throw new Error("Unsupported Gemini tool");
  }
}
