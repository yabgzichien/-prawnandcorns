import { ASSIGNMENTS } from "./data/academics.ts";
import { DEPARTMENTS } from "./data/life.ts";
import { searchCampus } from "./data/campus.ts";
import { composeEmail } from "./email.ts";
import { demoStudyProposal, sanitizeDemoStudySessions, tasksFrom } from "./planning-demo.ts";
import type { GeminiToolResult } from "./gemini-agent.ts";
import { detectConflictsTool, getRecentChanges, noticeItems, proposeUpdatesTool, readNotice } from "./agent-tools/campus.ts";
import { extractNotice } from "./agent-tools/gemini-extract.ts";
import { buildCampusContext, EMPTY_CAMPUS_REQUEST, sanitizeCampusRequest, sanitizePlanExtras, type DemoAgentContext } from "./agent-tools/server-context.ts";
import type { ExtractedFact } from "./world/types.ts";

export type { DemoAgentContext };

/** Never trust browser-provided demo state as real academic information. Only ids and capped text arrive. */
export function sanitizeDemoContext(raw: unknown): DemoAgentContext {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const ids = new Set(ASSIGNMENTS.map((task) => task.id));
  const submitted = Array.isArray(value.submitted)
    ? [...new Set(value.submitted.filter((id): id is string => typeof id === "string" && ids.has(id)))].slice(0, 30)
    : [];
  return {
    submitted,
    studySessions: sanitizeDemoStudySessions(value.studySessions),
    ...sanitizePlanExtras(value),
    campus: value.campus ? sanitizeCampusRequest(value.campus) : EMPTY_CAMPUS_REQUEST,
  };
}

export type DemoExecutorOptions = {
  prompt: string;
  context: DemoAgentContext;
  apiKey: string;
  /** Model for the second, stricter call that reads one email. */
  model: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

/**
 * The only actions the model can execute. All are read-only or proposal-only. The server rebuilds the campus
 * from ids, so nothing the browser sends can add an email, change a date or invent an update.
 */
export function createDemoExecutor(options: DemoExecutorOptions) {
  const { prompt, context } = options;
  const ctx = buildCampusContext(context);
  // Facts the extraction tool produced this run. Later tools use these, never facts supplied by the model.
  const extracted = new Map<string, ExtractedFact[]>();
  const facts = () => [...extracted].flatMap(([noticeId, list]) => list.map((fact) => ({ noticeId, fact })));

  return async function executeDemoTool(name: string, args: Record<string, unknown>): Promise<GeminiToolResult> {
    switch (name) {
      case "get_demo_assignments": {
        const tasks = tasksFrom(ctx.data.assignments, context.submitted);
        return { value: { source: ctx.data.live.includes("moodle") ? "connected_moodle_demo" : "fictional_demo", tasks }, summary: `Read ${tasks.length} fictional assignments` };
      }
      case "get_demo_timetable": {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const classes = ctx.data.classes.map((item) => ({ id: item.id, day: days[item.day], course: item.courseId.toUpperCase(), kind: item.kind, start: item.start, end: item.end, room: item.room, status: item.status }));
        return { value: { source: ctx.data.live.includes("ac") ? "connected_academic_centre_demo" : "fictional_demo", weekStart: "2026-11-23", timeZone: "Asia/Kuala_Lumpur", classes }, summary: `Read ${classes.length} fictional class slots` };
      }
      case "propose_study_plan": {
        // Original prompt, not an LLM-rewritten time, is the input to this deterministic safety check.
        const proposal = demoStudyProposal(prompt, context.submitted, context.studySessions, { assignments: ctx.data.assignments, classes: ctx.data.classes });
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
      case "get_demo_finance": {
        const f = ctx.data.fees;
        return { value: { source: f.live ? "connected_finance_demo" : "fictional_demo", currency: f.currency, total: f.tuitionTotal, paid: f.paid, dues: f.dues }, summary: "Read fictional tuition example" };
      }
      case "get_recent_changes":
        return getRecentChanges(ctx, { forModel: true });
      case "read_notice":
        return readNotice(ctx, args.noticeId);
      case "extract_notice": {
        const id = typeof args.noticeId === "string" ? args.noticeId.slice(0, 120) : "";
        const notice = noticeItems(ctx).find((n) => n.id === id);
        if (!notice) return { value: { error: "No such notice." }, summary: "Notice not found" };
        const result = await extractNotice({ notice, ctx, apiKey: options.apiKey, model: options.model, fetcher: options.fetcher, signal: options.signal });
        extracted.set(notice.id, result.facts);
        const acts = result.facts.filter((f) => f.type !== "no_action");
        return {
          value: {
            noticeId: notice.id, readBy: result.via, ...(result.note ? { note: result.note } : {}),
            facts: result.facts.map((f) => ({ ...f, willBeTreatedAs: f.confidence === "low" && f.type !== "no_action" ? "a question for the student, never a change" : f.type === "no_action" ? "nothing to do" : "a fact checked by code" })),
            rule: "Never present a low-confidence fact as certain. Ask the student instead.",
          },
          summary: result.facts.length === 0 ? "No facts extracted" : acts.length ? `${acts.length} fact${acts.length === 1 ? "" : "s"} (${result.facts.map((f) => f.confidence).join("/")} confidence), read by ${result.via}` : "No action needed",
        };
      }
      case "detect_conflicts":
        return detectConflictsTool(ctx, facts());
      case "propose_updates":
        return proposeUpdatesTool(ctx, args.items, facts());
      case "draft_email": {
        const dept = DEPARTMENTS.find((d) => d.id === args.department);
        const need = typeof args.need === "string" ? args.need.slice(0, 300) : "";
        if (!dept || !need.trim()) return { value: { error: "Choose an office from the list and say what the student needs." }, summary: "Draft not created" };
        const draft = composeEmail(dept, need);
        return {
          value: { draft: { to: `${dept.name} <${dept.email}>`, subject: draft.subject, body: draft.body }, sent: false, note: "Compass never sends email. The student reviews and sends it." },
          summary: `Drafted an email to ${dept.name}; not sent`,
          card: { kind: "email", draft, need },
        };
      }
      default:
        throw new Error("Unsupported Gemini tool");
    }
  };
}
