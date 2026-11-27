import { readingFromArgs } from "./plans/parse.ts";
import { ASSIGNMENTS } from "./data/academics.ts";
import { DEPARTMENTS } from "./data/life.ts";
import { searchCampus } from "./data/campus.ts";
import { composeEmail } from "./email.ts";
import { draftTicket } from "./aska.ts";
import { findRooms, parseRoomRequest } from "./library/search.ts";
import { checkApplication, problemsOf, warningsOf } from "./events/checks.ts";
import { draftFromRequest, parseEventRequest } from "./events/request.ts";
import { SEEDED_APPLICATIONS, SEEDED_DECISIONS } from "./events/seed.ts";
import { lineWhenText } from "./events/summary.ts";
import { buildLedger, outstanding } from "./finance/ledger.ts";
import { findDocuments, parseDocumentRequest } from "./finance/search.ts";
import { libraryRooms } from "./world/payloads.ts";
import { buildWorld, cleanEventIds } from "./world/world.ts";
import { sanitizeBookings } from "./library/policy.ts";
import { DEMO_NOW } from "./time.ts";
import { DEFAULT_TARGET, GE_BY_CODE, GE_CATALOGUE, STUDENT_STREAM } from "./electives/catalogue.ts";
import { meetingLabel } from "./electives/parse.ts";
import { courseStatus, parsedOf, suggestSets } from "./electives/plan.ts";
import { parseGeRequest, plannerHref } from "./electives/request.ts";
import { ALLOWED_STREAMS, DEFAULT_PREFS } from "./electives/types.ts";
import { demoStudyProposal, sanitizeDemoStudySessions, tasksFrom } from "./planning-demo.ts";
import type { GeminiToolResult } from "./gemini-agent.ts";
import { checkEventFit } from "./eventfit/check.ts";
import { findUrl, readEventLink, readEventText, sanitizeFields, type EventReading } from "./eventfit/read.ts";
import { EXAMS, examName, semesterStatus } from "./calendar/semester.ts";
import { timeAlerts } from "./calendar/alerts.ts";
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
    library: value.library && typeof value.library === "object"
      ? { events: cleanEventIds(Array.isArray((value.library as { events?: unknown }).events) ? (value.library as { events: unknown[] }).events : []), bookings: sanitizeBookings((value.library as { bookings?: unknown }).bookings) }
      : { events: [], bookings: [] },
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
      case "find_finance_documents": {
        const finance = context.campus.asOf.finance;
        if (!finance) return { value: { error: "The Finance Office is not connected. Tell the student to connect it on the Connections page." }, summary: "Finance not connected" };
        const request = typeof args.request === "string" ? args.request.slice(0, 300) : "";
        const parsed = parseDocumentRequest(request);
        const entries = buildLedger(buildWorld(finance));
        const found = parsed.statement && !parsed.kind && !parsed.topic ? { items: [], exact: true } : findDocuments(entries, parsed);
        return {
          value: {
            understood: parsed.summary, exactMatch: found.exact, outstandingRM: outstanding(entries), sent: false,
            documents: found.items.map(({ doc, other }) => ({ docNo: doc.id, kind: doc.kind, date: doc.date.slice(0, 10), description: doc.description, status: doc.status ?? null, pairedWith: other?.id ?? null })),
            note: "The student downloads the PDF by tapping a button on the card. Nothing is emailed or uploaded.",
          },
          summary: `${found.items.length} document${found.items.length === 1 ? "" : "s"}${found.exact ? "" : " (nearest match)"}; not sent`,
          card: { kind: "documents", summary: parsed.summary, items: found.items, exact: found.exact, entries },
        };
      }
      case "find_library_rooms": {
        const request = typeof args.request === "string" ? args.request.slice(0, 300) : "";
        const parsed = parseRoomRequest(request, DEMO_NOW);
        const world = buildWorld(context.library.events);
        const found = await findRooms(async (date) => libraryRooms(world, date)!, parsed, context.library.bookings, DEMO_NOW);
        return {
          value: {
            understood: parsed.summary, exactMatch: !found.alternatives, saved: false,
            rooms: found.options.map((o) => ({ room: o.roomId, date: o.date, slot: `${o.slot}`, note: "free and allowed by the booking rules" })),
            note: "Nothing is booked. The student taps Book on a room in the card. Each person can book one two-hour slot a day, up to 3 days ahead.",
          },
          summary: found.options.length ? `${found.options.length} free room${found.options.length === 1 ? "" : "s"}${found.alternatives ? " (nearest match)" : ""}; not booked` : "No free room matched",
          card: { kind: "rooms", summary: parsed.summary, options: found.options, alternatives: found.alternatives },
        };
      }
      case "prepare_calendar_entry": {
        const request = typeof args.request === "string" ? args.request.slice(0, 600) : "";
        const reading = readingFromArgs(args, request, DEMO_NOW);
        return {
          value: { kind: reading.kind, entry: reading.draft, missing: reading.missing, notes: reading.notes, saved: false },
          summary: `Prepared a ${reading.kind === "todo" ? "to-do" : "calendar event"}, not saved`,
          card: { kind: "plan-entry", reading },
        };
      }
      case "check_event_fit": {
        const request = typeof args.request === "string" ? args.request.slice(0, 2000) : "";
        const given = sanitizeFields(args, "typed");
        let reading: EventReading = given.missing.length === 0 ? given : readEventText(request, DEMO_NOW);
        const url = findUrl(request);
        if (url && given.missing.length) {
          const link = readEventLink(url);
          reading = "unknownLink" in link ? { ...readEventText(request.replace(url, " "), DEMO_NOW), notes: [`Compass does not open links from other sites (${link.unknownLink}). Ask the student to paste the event's text or a screenshot.`] } : link;
        }
        const result = checkEventFit(reading.fields, { thisWeek: ctx.data.classes, studySessions: context.studySessions, personalEvents: context.personalEvents, bookings: context.library.bookings, assignments: ctx.data.assignments });
        return {
          value: { event: reading.fields, assumedEnd: reading.assumedEnd, missing: reading.missing, notes: reading.notes, verdict: result.verdict, headline: result.headline, clashes: result.clashes, warnings: result.warnings.map((w) => w.text), saved: false, booked: false, note: "Plain code decided this. The student decides whether to go. Demo timetable." },
          summary: `Event check: ${result.verdict}`,
          card: { kind: "event-fit", reading },
        };
      }
      case "get_semester_status": {
        const status = semesterStatus(DEMO_NOW);
        const exams = EXAMS.filter((e) => new Date(e.end) > DEMO_NOW).sort((a, b) => a.start.localeCompare(b.start));
        const alerts = timeAlerts({ now: DEMO_NOW, assignments: ctx.data.assignments, markedDone: context.submitted });
        return {
          value: { status, exams: exams.map((e) => ({ name: examName(e), start: e.start, end: e.end, room: e.room, weight: e.weight })), alerts: alerts.map((a) => ({ level: a.level, title: a.title, detail: a.detail })), source: "demo_calendar" },
          summary: status.label,
          card: { kind: "exams", status, exams, alerts: alerts.filter((a) => a.kind === "exam" || a.kind === "phase") },
        };
      }
      case "suggest_general_electives": {
        const request = typeof args.request === "string" ? args.request.slice(0, 600) : "";
        const req = parseGeRequest(request);
        const target = req.credits ?? DEFAULT_TARGET;
        const sets = suggestSets({ stream: STUDENT_STREAM, target, interests: req.interests, prefs: DEFAULT_PREFS });
        const others = GE_CATALOGUE.map((c) => ({ c, st: courseStatus(c, STUDENT_STREAM) })).filter((x) => x.st.kind !== "stream" && x.st.kind !== "fits");
        return {
          value: {
            stream: STUDENT_STREAM, mayTake: ALLOWED_STREAMS[STUDENT_STREAM], creditsNeeded: target, creditsAssumed: !req.credits, interests: req.interests,
            sets: sets.map((s) => ({ credits: s.credits, exact: s.exact, reasons: s.reasons, warnings: s.warnings, courses: s.codes.map((code) => ({ code, title: GE_BY_CODE[code].title, stream: GE_BY_CODE[code].stream, credits: GE_BY_CODE[code].credits, times: parsedOf(code).meetings.map(meetingLabel) })) })),
            cannotTake: others.map((x) => ({ code: x.c.code, title: x.c.title, why: x.st.message })),
            saved: false, registered: false,
            note: "Nothing is saved or registered. The student compares the sets in the GE planner and registers in the AC system themselves. Every course, time and seat count is invented demo data.",
          },
          summary: sets.length ? `${sets.length} GE set${sets.length === 1 ? "" : "s"} for ${target} credits; nothing saved` : `No GE set adds up to ${target} credits`,
          card: { kind: "ge-plan", stream: STUDENT_STREAM, target, interests: req.interests, sets, href: plannerHref(req.credits, req.interests) },
        };
      }
      case "prepare_event_application": {
        const request = typeof args.request === "string" ? args.request.slice(0, 600) : "";
        const parsed = parseEventRequest(request, DEMO_NOW);
        if (!parsed.isEventRequest && !parsed.looksLikeEvent) {
          // The model writes this argument, so keep a short trace of what it sent when the check refuses it.
          console.warn(`prepare_event_application refused ${request.length} characters: ${JSON.stringify(request.slice(0, 200))}`);
          return { value: { error: "Code could not find a room or item and an event detail (date, time, head count or club) in that text. If the student did ask for rooms or items for a club event, call prepare_event_application again with their message copied word for word. Otherwise do not prepare an event application." }, summary: "Not a club event request" };
        }
        const made = draftFromRequest(parsed, SEEDED_APPLICATIONS, SEEDED_DECISIONS);
        const issues = checkApplication(made.draft, SEEDED_APPLICATIONS, SEEDED_DECISIONS, DEMO_NOW);
        const problems = problemsOf(issues);
        return {
          value: {
            understood: parsed.summary, stillNeeded: parsed.missing, notes: made.notes, submitted: false,
            lines: made.draft.lines.map((l) => lineWhenText(l)),
            problemsToFix: problems.map((i) => i.message), thingsToCheck: warningsOf(issues).map((i) => i.message),
            note: "Nothing is submitted or approved. The student opens the card, goes through each step and submits. Each office then answers each line, so some may be refused or changed.",
          },
          summary: `Prepared one event application with ${made.draft.lines.length} line${made.draft.lines.length === 1 ? "" : "s"}; ${problems.length} to fix; not submitted`,
          card: { kind: "event", draft: made.draft, issues, notes: made.notes, missing: parsed.missing },
        };
      }
      case "prepare_aska_ticket": {
        const problem = typeof args.problem === "string" ? args.problem.slice(0, 400) : "";
        const draft = draftTicket(problem);
        if (!draft) return { value: { error: "That does not look like a hostel fault. Do not prepare a help desk ticket." }, summary: "Not a hostel fault" };
        return {
          value: { ticket: { path: draft.path, location: draft.block && draft.room ? `${draft.block}-${draft.room}` : "missing, ask the student to add it", urgent: draft.urgent, title: draft.title }, submitted: false, note: "The student reviews and submits the ticket. Nothing is sent." },
          summary: `Prepared a help desk ticket: ${draft.path}; not submitted`,
          card: { kind: "aska", draft },
        };
      }
      default:
        throw new Error("Unsupported Gemini tool");
    }
  };
}
