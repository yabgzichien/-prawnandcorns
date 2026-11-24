import { COURSE_BY_ID, GE_GROUPS, STUDENT, type Assignment, type ClassSession, type Notice } from "./data/academics";
import { CLUBS, type Club } from "./data/life";
import { PLACE_BY_ID, ROOM_BY_CODE, searchCampus, type Place, type Room } from "./data/campus";
import { DEMO_NOW, dateShort, dayLong, dayShort, dueLabel, relative, timeOf, atDay } from "./time";
import { WIDGET_META, type WidgetId, type WidgetPref } from "./state";
import { TODAY_IDX, upcomingClasses } from "./schedule";
import { composeEmail, extractNeed, routeDepartment, type Draft } from "./email";
import { demoStudyProposal } from "./planning-demo";
import type { StudyProposal, StudySession } from "./planning";
import type { UpdatesProposal } from "./updates/types";
import { DORM_KIND_LABEL, detectDormIssue, draftTicket, type AskaDraft } from "./aska";
import { fetchLibraryDay } from "./library/client";
import { findRooms, parseRoomRequest, type RoomOption } from "./library/search";
import { SLOTS, type LibraryBooking } from "./library/policy";
import type { CampusToolContext } from "./agent-tools/campus";
import { detectConflictsTool, getRecentChanges, noticeItems, conflictsFor, readNotice } from "./agent-tools/campus";
import { expectedFacts } from "./agent-tools/expected";
import { validateFacts } from "./agent-tools/facts";
import { planFixes } from "./agent-tools/review";
import { baseCampusData, markedHereOnly } from "./sync/view";
import { isSyncReviewPrompt } from "./sync/review";
import type { ExtractedFact } from "./world/types";

/* ───────────────────────────────────────────────────────────
   Agent runtime (front-end mock).
   Everything goes through runAgent(): prompt in, event stream out.
   Swap this one function for a server route that streams events
   from a real LLM tool-calling loop — the UI will not change.
   The tools below only read invented demo data.
   ─────────────────────────────────────────────────────────── */

export type AgentCard =
  | { kind: "study-plan"; proposal: StudyProposal }
  | { kind: "updates"; proposal: UpdatesProposal }
  | { kind: "aska"; draft: AskaDraft }
  | { kind: "rooms"; summary: string; options: RoomOption[]; alternatives: boolean }
  | { kind: "deadlines"; items: Assignment[] }
  | { kind: "class"; session: ClassSession; notice?: Notice; makeup?: ClassSession; next?: ClassSession }
  | { kind: "schedule"; label: string; items: ClassSession[] }
  | { kind: "room"; room: Room; place: Place }
  | { kind: "email"; draft: Draft; need: string }
  | { kind: "layout"; summary: string[]; before: WidgetPref[]; after: WidgetPref[] }
  | { kind: "clubs"; items: Club[] }
  | { kind: "fees"; due: number; label: string; dueIso: string; paid: number; total: number }
  | { kind: "ge"; groups: { title: string; need: number; done: number; options: string[] }[] }
  | { kind: "suggest"; prompts: string[] };

export type AgentEvent =
  | { type: "plan"; steps: string[] }
  | { type: "step"; index: number }
  | { type: "tool"; id: string; tool: string; input: string; status: "running" | "done"; output?: string }
  | { type: "text"; text: string }
  | { type: "card"; card: AgentCard }
  | { type: "done" };

export type AgentContext = {
  widgets: WidgetPref[];
  submitted: string[];
  studySessions: StudySession[];
  /** What the connected campus systems last said. Absent before anything is connected. */
  campus?: CampusToolContext;
  /** The library: scenario events that change who has booked what, and the rooms this student has booked. */
  library?: { events: string[]; bookings: LibraryBooking[] };
};

export const SUGGESTIONS = [
  "Help me plan my week around my deadlines",
  "What's due this week?",
  "Is my 2pm class still on?",
  "Where is A3-G01?",
  "Draft an email to Finance about my fee instalment",
  "Add a finance widget and hide clubs",
  "I like robotics and photography — which clubs fit?",
  "The air-con in my room is leaking water",
  "Book a study room for 2 tomorrow at 3pm",
];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("aborted", "AbortError")); }, { once: true });
  });

let toolSeq = 0;
async function* tool<T>(name: string, input: string, work: () => { output: string; value: T }, signal?: AbortSignal): AsyncGenerator<AgentEvent, T> {
  const id = `t${++toolSeq}`;
  yield { type: "tool", id, tool: name, input, status: "running" };
  await sleep(420 + Math.random() * 260, signal);
  const r = work();
  yield { type: "tool", id, tool: name, input, status: "done", output: r.output };
  return r.value;
}

/** Like `tool`, for work that has to wait for an answer, such as asking the library's booking system. */
async function* toolAsync<T>(name: string, input: string, work: () => Promise<{ output: string; value: T }>): AsyncGenerator<AgentEvent, T> {
  const id = `t${++toolSeq}`;
  yield { type: "tool", id, tool: name, input, status: "running" };
  const r = await work();
  yield { type: "tool", id, tool: name, input, status: "done", output: r.output };
  return r.value;
}

async function* say(text: string, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  // stream word-by-word so the answer arrives continuously
  const words = text.split(/(\s+)/);
  let acc = "";
  for (const w of words) {
    acc += w;
    if (/\S/.test(w)) {
      yield { type: "text", text: acc };
      await sleep(16, signal);
    }
  }
  yield { type: "text", text: acc };
}

const money = (n: number) => `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const has = (t: string, re: RegExp) => re.test(t);

type Intent = "review" | "booking" | "dorm" | "study" | "ge" | "next" | "layout" | "email" | "room" | "class" | "deadlines" | "fees" | "clubs" | "schedule" | "help";

function detectIntent(raw: string): Intent {
  const t = raw.toLowerCase();
  if (isSyncReviewPrompt(raw)) return "review";
  if (parseRoomRequest(raw).isRoomRequest) return "booking";
  // A hostel fault goes to the AskA help desk, not to an email, unless the student asks for an email.
  if (!/\b(e-?mail|mail)\b/.test(t) && detectDormIssue(raw)) return "dorm";
  if (/\b(plan (my|the|this|next|our)?\s*week|weekly plan|study plan|study schedule|schedule (my|some|a)?\s*study|when can i (study|work on)|help me plan|plan (my|some) (study|assignment)|prioriti[sz]e my week|top priorities this week|priorities this week)\b/.test(t)) return "study";
  const aliasHit = Object.values(WIDGET_META).some((m) => m.aliases.some((a) => t.includes(a)));
  if (has(t, /\b(widget|widgets|dashboard|home ?screen|layout|personali[sz]e|customi[sz]e)\b/) ||
      (aliasHit && has(t, /\b(add|show|hide|remove|move|put|only|pin|reorder|first|top)\b/) && !has(t, /\b(email|mail|draft)\b/) && !has(t, /\bwhere\b/))) return "layout";
  if (has(t, /\b(draft|write|compose)\b.*\b(email|e-mail|mail|message|letter)\b|\b(email|e-mail)\b/)) return "email";
  if (has(t, /\b(where|locate|find|directions?|how (do|to) (i )?get)\b/) || has(t, /\b[a-d]\d?-?(g\d{2}|l\d|\d{3}|lib|hall)\b/i)) return "room";
  if (has(t, /\b(ge|general education|electives?)\b/)) return "ge";
  if (has(t, /\b(next|upcoming)\b.*\b(class|lecture|lesson|tutorial|lab)\b|\bwhat('?s| is) (on|next)\b(?!.*tomorrow)/)) return "next";
  if (has(t, /\b(cancel|cancelled|canceled|still on|still happening|replacement|re-?schedul|moved|changed|make-?up|is my .* class)\b/)) return "class";
  if (has(t, /\b(due|deadline|deadlines|assignment|assignments|homework|submit|moodle|quiz)\b/)) return "deadlines";
  if (has(t, /\b(fee|fees|tuition|owe|instalment|installment|payment|pay|balance|finance)\b/)) return "fees";
  if (has(t, /\b(club|clubs|society|societies|join|activity|activities|eca)\b/)) return "clubs";
  if (has(t, /\b(today|tomorrow|schedule|timetable|classes|lecture)\b/)) return "schedule";
  return "help";
}

function parseHour(t: string): number | null {
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ?? t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h;
}

const todayIdx = TODAY_IDX;

/* ───────────────── the runner ───────────────── */
export async function* runAgent(prompt: string, ctx: AgentContext, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const intent = detectIntent(prompt);
  const t = prompt.toLowerCase();
  // Read connected systems when there are any, otherwise the built-in example data.
  const campusData = ctx.campus?.data ?? baseCampusData();
  const { classes: CLASSES, assignments: ASSIGNMENTS, notices: NOTICES, fees: FINANCE } = campusData;

  try {
    switch (intent) {
      case "review": {
        const c = ctx.campus;
        if (!c || c.changes.length === 0) {
          yield { type: "plan", steps: ["Check the latest sync"] };
          yield { type: "step", index: 0 };
          yield* tool("get_recent_changes", "latest sync", () => ({ output: "No new updates", value: [] }), signal);
          yield* say(c?.failed.length
            ? `Nothing new to review, but ${c.failed.map((f) => f.message.replace(/\.$/, "")).join(" and ")}. What I show for that system is from an earlier read. Try syncing again from the **Connections** page in a moment.`
            : c ? "You are up to date. There is nothing new to review since your last check." : "No campus system is connected yet, so there is nothing to review. Open **Connections** to connect Moodle, the Academic Centre, Finance or your email.", signal);
          break;
        }
        yield { type: "plan", steps: ["Read the latest changes", "Read and check any new emails", "Look for clashes in your plan", "Propose fixes for you to approve"] };
        yield { type: "step", index: 0 };
        const recent = yield* tool("get_recent_changes", "latest sync", () => { const r = getRecentChanges(c); return { output: r.summary, value: r.value as { changes: { summary: string }[] } }; }, signal);
        yield { type: "step", index: 1 };
        const facts = new Map<string, ExtractedFact[]>();
        for (const change of c.changes.filter((x) => x.itemKind === "notice" && x.system === "mail")) {
          const notice = noticeItems(c).find((n) => n.id === change.itemId);
          if (!notice) continue;
          yield* tool("read_notice", notice.id.replace("mail:notice:", ""), () => { const r = readNotice(c, notice.id); return { output: r.summary, value: r.value }; }, signal);
          const found = yield* tool("extract_notice", notice.id.replace("mail:notice:", ""), () => {
            const expected = expectedFacts(notice);
            if (!expected) return { output: "Cannot read this email offline", value: [] as ExtractedFact[] };
            const checked = validateFacts(expected, notice.text, c.data);
            const acts = checked.filter((f) => f.type !== "no_action");
            return { output: acts.length ? `${acts.length} fact${acts.length === 1 ? "" : "s"}, ${checked.map((f) => f.confidence).join("/")} confidence` : "No action needed", value: checked };
          }, signal);
          facts.set(notice.id, found);
        }
        yield { type: "step", index: 2 };
        const flat = [...facts].flatMap(([noticeId, list]) => list.map((fact) => ({ noticeId, fact })));
        const conflicts = yield* tool("detect_conflicts", "timetable, deadlines, study sessions, reminders", () => { const r = detectConflictsTool(c, flat); return { output: r.summary, value: conflictsFor(c, flat) }; }, signal);
        yield { type: "step", index: 3 };
        const proposal = yield* tool("propose_updates", "checked against your plan", () => { const p = planFixes({ ctx: c, facts, conflicts }); return { output: `${p.fixes.length} proposed, not saved`, value: p }; }, signal);
        const act = proposal.fixes.filter((f) => ["move_study_session", "remove_study_session", "add_reminder", "add_calendar_event"].includes(f.type)).length;
        const asks = proposal.fixes.filter((f) => f.type === "ask_question").length;
        const marks = proposal.fixes.filter((f) => f.type === "acknowledge").length;
        const lines = recent.changes.slice(0, 6).map((x) => `- ${x.summary}`).join("\n");
        const clash = conflicts.filter((x) => x.kind !== "fee-no-plan").slice(0, 3).map((x) => `- ${x.message}`).join("\n");
        yield* say([
          `You have **${c.changes.length} new update${c.changes.length === 1 ? "" : "s"}**. Here is what changed:`,
          lines,
          recent.changes.length > 6 ? `- and ${recent.changes.length - 6} more` : "",
          clash ? `**Worth a look:**\n${clash}` : "",
          proposal.notes.length ? proposal.notes.map((n) => `**Note:** ${n}`).join("\n") : "",
          `I suggest ${act} change${act === 1 ? "" : "s"} to your plan${marks ? `, mark ${marks} as reviewed` : ""}${asks ? ` and I have ${asks} question${asks === 1 ? "" : "s"} for you` : ""}. **Nothing is saved until you approve.**`,
        ].filter(Boolean).join("\n\n"), signal);
        yield { type: "card", card: { kind: "updates", proposal } };
        break;
      }
      case "booking": {
        const req = parseRoomRequest(prompt);
        const mine = ctx.library?.bookings ?? [];
        yield { type: "plan", steps: ["Work out when and how many people", "Check the library's availability", "Check the booking rules", "Offer rooms for you to book"] };
        yield { type: "step", index: 0 };
        yield* tool("library.parse_request", `"${prompt.slice(0, 48)}"`, () => ({ output: req.summary, value: req }), signal);
        yield { type: "step", index: 1 };
        const found = yield* toolAsync("library.get_availability", req.date, async () => {
          const r = await findRooms((d) => fetchLibraryDay(d, ctx.library?.events ?? [], signal), req, mine);
          return { output: `${r.options.length} free room${r.options.length === 1 ? "" : "s"}${r.alternatives ? " (nearest match)" : ""}`, value: r };
        });
        yield { type: "step", index: 2 };
        const taken = mine.find((b) => b.date === req.date);
        yield* tool("library.check_rules", "one 2-hour slot a day, 3 days ahead", () => ({ output: taken ? `Already booked ${taken.roomId} that day` : "No rule is in the way", value: !taken }), signal);
        yield { type: "step", index: 3 };
        if (taken && found.options.length === 0) {
          yield* say(`You already have a booking that day (**${taken.roomId}**, ${SLOTS[taken.slot].start}). The library allows one two-hour slot per person per day, so cancel that one first if you want a different room.`, signal);
        } else if (found.options.length === 0) {
          yield* say(`I understood **${req.summary}**, but no library room is free that fits, now or over the next two days. Try a different time, or open **Library rooms** to look yourself.`, signal);
        } else {
          yield* say(`I understood **${req.summary}**. ${found.alternatives ? "Nothing matched exactly, so these are the closest free rooms." : "These rooms are free and fit the library's rules."} Tap **Book** on one to reserve it, or **Map** to see where it is. **Nothing is booked until you tap.**${req.people === null ? " I didn't hear how many people, so I looked for any size." : ""}`, signal);
        }
        yield { type: "card", card: { kind: "rooms", summary: req.summary, options: found.options, alternatives: found.alternatives } };
        break;
      }
      case "dorm": {
        yield { type: "plan", steps: ["Work out what kind of problem it is", "Check where hostel faults are reported", "Prepare a help desk ticket for you to review"] };
        yield { type: "step", index: 0 };
        const issue = yield* tool("aska.classify", `"${prompt.slice(0, 48)}"`, () => {
          const i = detectDormIssue(prompt)!;
          return { output: `${DORM_KIND_LABEL[i.kind]}${i.urgent ? ", urgent" : ""}`, value: i };
        }, signal);
        yield { type: "step", index: 1 };
        yield* tool("help_desk.route", DORM_KIND_LABEL[issue.kind], () => ({ output: "AskA (Accommodation, Maintenance), not an email", value: true }), signal);
        yield { type: "step", index: 2 };
        const draft = yield* tool("aska.prepare_ticket", "not submitted", () => {
          const d = draftTicket(prompt)!;
          return { output: `${d.path}, ${d.block && d.room ? `${d.block}-${d.room}` : "location missing"}`, value: d };
        }, signal);
        yield* say([
          `Hostel faults like this are reported on the **AskA** help desk, not by email to the Accommodation Office. I've prepared a ticket under **${draft.path}**.`,
          draft.urgent ? "**This sounds urgent.** If anyone could be hurt (flooding, sparks, no power), tell the hostel office in person right away, then submit the ticket." : "",
          !draft.block || !draft.room ? "I couldn't see your block and room number, so please add them on the form. A technician needs them." : "",
          "**Nothing has been submitted.** Check it, then submit. I'll show the help desk's updates under Help desk.",
        ].filter(Boolean).join("\n\n"), signal);
        yield { type: "card", card: { kind: "aska", draft } };
        break;
      }
      case "study": {
        yield { type: "plan", steps: ["Read fictional deadlines and timetable", "Find free study windows and check conflicts", "Ask you to review and confirm the proposed sessions"] };
        yield { type: "step", index: 0 };
        const result = yield* tool("demo.study_plan", "fictional classes, deadlines and saved sessions", () => {
          const proposal = demoStudyProposal(prompt, ctx.submitted, ctx.studySessions, { assignments: ASSIGNMENTS, classes: CLASSES });
          return { value: proposal, output: `${proposal.sessions.length} possible study blocks; ${proposal.skipped.length} unscheduled` };
        }, signal);
        yield { type: "step", index: 1 };
        yield* tool("schedule.check_conflicts", "09:00–21:00 MYT; deadlines; existing commitments", () => ({ value: true, output: "Validated using application logic (not the AI model)" }), signal);
        yield { type: "step", index: 2 };
        yield* say(result.sessions.length
          ? `I found **${result.sessions.length} possible study sessions** from the fictional timetable. Review or change the times below before saving. **Nothing has been saved yet.** This is a rule-based demo planner, not a live LLM.`
          : result.assumptions.length && !result.skipped.length
            ? "I need a clearer meeting time before I can safely propose a study plan. Please specify the weekday and whether it's in the evening. Nothing was saved."
            : "I couldn't find a feasible study slot before the deadlines in the fictional timetable. Nothing was saved.", signal);
        yield { type: "card", card: { kind: "study-plan", proposal: result } };
        break;
      }
      case "deadlines": {
        yield { type: "plan", steps: ["Check Moodle sync status", "Read assignments due 23–29 Nov", "Rank by urgency and weight"] };
        yield { type: "step", index: 0 };
        await sleep(250, signal);
        yield* tool("moodle.status", "account: demo", () => ({ output: "Connected (demo sync, read-only)", value: true }), signal);
        yield { type: "step", index: 1 };
        const week = yield* tool("moodle.get_assignments", "23 to 29 Nov", () => {
          const items = ASSIGNMENTS.filter((a) => !ctx.submitted.includes(a.id) && a.status !== "submitted" && new Date(a.due) < atDay(7, "00:00"));
          return { output: `${items.length} open, ${ASSIGNMENTS.length - items.length} done or later`, value: items };
        }, signal);
        yield { type: "step", index: 2 };
        const ranked = yield* tool("rank.by_urgency", `${week.length} items`, () => {
          const r = [...week].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
          return { output: "Sorted by due date", value: r };
        }, signal);
        const hereOnly = ASSIGNMENTS.filter((a) => markedHereOnly(a, ctx.submitted, campusData));
        const overdue = ranked.filter((a) => a.status === "overdue");
        const next = ranked.find((a) => a.status !== "overdue");
        if (!next) {
          yield* say("Nothing is open this week. Enjoy it.", signal);
          yield { type: "card", card: { kind: "deadlines", items: ranked } };
          break;
        }
        yield* say(`You have **${ranked.length} open items** this week. Most urgent: **${next.title}** (${COURSE_BY_ID[next.courseId].code}) — due ${dueLabel(new Date(next.due)).toLowerCase()}, ${relative(new Date(next.due))}.${overdue.length ? ` ${overdue[0].title} is overdue — ${overdue[0].note ?? "check whether late attempts are open"}.` : ""} The Reflective Essay carries the most marks (10%), so start it early.${hereOnly.length ? ` **Heads up:** you marked ${hereOnly.map((a) => a.title).join(", ")} as done here, but Moodle still shows ${hereOnly.length === 1 ? "it" : "them"} as not submitted. Compass cannot submit for you, so check Moodle.` : ""}`, signal);
        yield { type: "card", card: { kind: "deadlines", items: ranked } };
        break;
      }

      case "class": {
        yield { type: "plan", steps: ["Find the class you mean", "Check today's class notices", "Look for a make-up or room change"] };
        yield { type: "step", index: 0 };
        const hour = parseHour(t);
        const tomorrow = has(t, /\btomorrow\b/);
        const day = tomorrow ? 1 : todayIdx;
        const found = yield* tool("timetable.get", `${tomorrow ? "Tue 24" : "Mon 23"} Nov${hour !== null ? `, around ${String(hour).padStart(2, "0")}:00` : ""}`, () => {
          const list = CLASSES.filter((c) => c.day === day).sort((a, b) => a.start.localeCompare(b.start));
          // if a time was given, only that time counts — never substitute a different class
          const pick = hour !== null ? list.find((c) => parseInt(c.start, 10) === hour) : (list.find((c) => c.status !== "normal") ?? list[0]);
          return { output: pick ? `${COURSE_BY_ID[pick.courseId].code} ${pick.kind}, ${pick.start}–${pick.end}, ${pick.room}` : "No class found", value: pick };
        }, signal);
        yield { type: "step", index: 1 };
        const notice = yield* tool("notices.search", found ? COURSE_BY_ID[found.courseId].code : "—", () => {
          const n = found?.noticeId ? NOTICES.find((x) => x.id === found.noticeId) : undefined;
          return { output: n ? `Found: "${n.title}", ${n.source}` : "No notices", value: n };
        }, signal);
        yield { type: "step", index: 2 };
        const makeup = yield* tool("timetable.find_makeup", found?.courseId ?? "—", () => {
          const m = CLASSES.find((c) => c.courseId === found?.courseId && c.status === "makeup");
          return { output: m ? `${dayShort(atDay(m.day, m.start))} ${m.start}, ${m.room}` : "None scheduled", value: m };
        }, signal);
        const next = upcomingClasses(DEMO_NOW, CLASSES)[0];
        if (!found) {
          yield* say(`You don't have a class ${hour !== null ? `at ${String(hour).padStart(2, "0")}:00` : "then"} ${tomorrow ? "tomorrow" : "today"}. Here is your schedule for the day.`, signal);
          yield { type: "card", card: { kind: "schedule", label: "Today", items: CLASSES.filter((c) => c.day === day) } };
        } else if (found.status === "cancelled") {
          const mk = makeup ? `${dayLong(atDay(makeup.day, makeup.start))} ${dateShort(atDay(makeup.day, makeup.start))}, ${makeup.start} in ${makeup.room}` : "a make-up time hasn't been announced yet";
          yield* say(`**No — it's cancelled.** ${COURSE_BY_ID[found.courseId].code} ${found.kind} at ${found.start} (${found.room}) was called off at ${timeOf(new Date(notice?.posted ?? DEMO_NOW))}. The make-up is ${mk}. Your next class today is **${COURSE_BY_ID[next.courseId].code} at ${next.start}** in ${next.room} — you have a free slot until then.`, signal);
          yield { type: "card", card: { kind: "class", session: found, notice, makeup, next } };
        } else if (found.status === "room-changed") {
          yield* say(`The class is still on, but **the room changed**: ${found.originalRoom} → **${found.room}**. Time is the same.`, signal);
          yield { type: "card", card: { kind: "class", session: found, notice, next } };
        } else {
          yield* say(`Yes — ${COURSE_BY_ID[found.courseId].code} ${found.kind} at ${found.start} in ${found.room} is going ahead. I found no cancellation or room-change notices for it.`, signal);
          yield { type: "card", card: { kind: "class", session: found, next } };
        }
        break;
      }

      case "next": {
        yield { type: "plan", steps: ["Read your timetable", "Skip cancelled classes", "Find the next one"] };
        yield { type: "step", index: 0 };
        await sleep(200, signal);
        yield { type: "step", index: 1 };
        const cancelled = yield* tool("timetable.get", "Mon 23 Nov", () => {
          const c = CLASSES.filter((x) => x.day === todayIdx && x.status === "cancelled");
          return { output: `${CLASSES.filter((x) => x.day === todayIdx).length} sessions, ${c.length} cancelled`, value: c };
        }, signal);
        yield { type: "step", index: 2 };
        const nxt = yield* tool("timetable.next_class", `after ${timeOf(DEMO_NOW)}`, () => {
          const n = upcomingClasses(DEMO_NOW, CLASSES)[0];
          return { output: `${COURSE_BY_ID[n.courseId].code} ${n.start}, ${n.room}`, value: n };
        }, signal);
        const when = atDay(nxt.day, nxt.start);
        yield* say(`Your next class is **${COURSE_BY_ID[nxt.courseId].title}** (${COURSE_BY_ID[nxt.courseId].code}) ${nxt.kind.toLowerCase()} at **${nxt.start}** in **${nxt.room}** — ${relative(when)}.${cancelled.length ? ` Note: ${COURSE_BY_ID[cancelled[0].courseId].code} at ${cancelled[0].start} today is cancelled, so you're free until then.` : ""}`, signal);
        yield { type: "card", card: { kind: "class", session: nxt } };
        yield { type: "card", card: { kind: "room", room: ROOM_BY_CODE[nxt.room], place: PLACE_BY_ID[ROOM_BY_CODE[nxt.room].place] } };
        break;
      }

      case "ge": {
        yield { type: "plan", steps: ["Read your General Education requirements", "Find the groups you haven't finished"] };
        yield { type: "step", index: 0 };
        const groups = yield* tool("courses.get_ge_status", "BSc Computer Science", () => ({ output: `${GE_GROUPS.length} groups`, value: GE_GROUPS }), signal);
        yield { type: "step", index: 1 };
        const open = yield* tool("courses.unmet", "—", () => {
          const o = groups.filter((g) => g.done < g.need);
          return { output: `${o.length} groups still open, ${o.reduce((a, g) => a + (g.need - g.done), 0)} credits`, value: o };
        }, signal);
        yield* say(`You still need **${open.reduce((a, g) => a + (g.need - g.done), 0)} General Education credits** across ${open.length} groups. Malaysian Studies already covers *Society & Nation*. Since you're already juggling 4 core courses, pick ${open.length > 1 ? "one or two" : "one"} light option${open.length > 1 ? "s" : ""} next semester — *Language & Culture* is the biggest gap. Always confirm against the official handbook before registering.`, signal);
        yield { type: "card", card: { kind: "ge", groups: open.map((g) => ({ title: g.title, need: g.need - g.done, done: 0, options: g.options })) } };
        break;
      }

      case "room": {
        yield { type: "plan", steps: ["Work out which place you mean", "Look it up in the campus directory", "Prepare a map link"] };
        yield { type: "step", index: 0 };
        let query = prompt;
        const nextMention = has(t, /\bnext class\b|\bmy class\b/);
        if (nextMention) query = upcomingClasses(DEMO_NOW, CLASSES)[0].room;
        else {
          const code = prompt.match(/\b([a-dA-D]\d?-?(?:[gG]\d{2}|[lL]\d|\d{3}|[lL][iI][bB]|[sS]\d{2}))\b/);
          const place = prompt.match(/\b(library|canteen|cafe|café|gym|court|courts|track|statue|gate|hall|[a-d]\d{1})\b/i);
          query = code?.[1] ?? place?.[1] ?? prompt.replace(/\b(where|is|the|find|locate|how|do|i|get|to)\b/gi, "").trim();
        }
        const norm = query.replace(/^([a-dA-D]\d?)(?=[gGlL\d])/, "$1-").toUpperCase();
        yield { type: "step", index: 1 };
        const hit = yield* tool("campus.search", `"${norm}"`, () => {
          const hits = searchCampus(norm, 3);
          const first = hits[0];
          const label = first ? (first.type === "room" ? `${first.room.code}, ${first.place.name}, ${first.room.floor}` : first.place.name) : "No match";
          return { output: label, value: first };
        }, signal);
        yield { type: "step", index: 2 };
        yield* tool("map.build_link", hit ? (hit.type === "room" ? hit.room.code : hit.place.id) : "—", () => ({ output: "Ready", value: true }), signal);
        if (!hit) {
          yield* say("I couldn't find that place. Try a room code like **A3-G01**, or a place like *Library* or *Canteen*.", signal);
          yield { type: "card", card: { kind: "suggest", prompts: ["Where is A5-L2?", "Where is the canteen?"] } };
        } else if (hit.type === "room") {
          yield* say(`**${hit.room.code}** is the ${hit.room.name} in **${hit.place.name}**, ${hit.room.floor.toLowerCase()}${hit.room.seats ? ` (${hit.room.seats} seats)` : ""}. Tap the button to see it on the map.`, signal);
          yield { type: "card", card: { kind: "room", room: hit.room, place: hit.place } };
        } else {
          yield* say(`**${hit.place.name}** — ${hit.place.blurb.toLowerCase()}. Open the map to see where it is.`, signal);
          const r = Object.values(ROOM_BY_CODE).find((x) => x.place === hit.place.id);
          yield { type: "card", card: { kind: "room", room: r ?? { code: hit.place.id, place: hit.place.id, floor: "—", name: hit.place.name, type: "Hall" }, place: hit.place } };
        }
        break;
      }

      case "email": {
        yield { type: "plan", steps: ["Understand what you need", "Pick the right office", "Draft the email — you review before anything is sent"] };
        yield { type: "step", index: 0 };
        const need = extractNeed(prompt);
        await sleep(300, signal);
        yield { type: "step", index: 1 };
        const routed = yield* tool("directory.route", `"${need.slice(0, 44)}"`, () => {
          const r = routeDepartment(prompt);
          const best = r[0];
          return { output: best ? `${best.dept.name}, ${Math.round(Math.min(0.97, 0.55 + best.confidence * 0.45) * 100)}% match` : "No clear match", value: best };
        }, signal);
        yield { type: "step", index: 2 };
        const dept = routed?.dept ?? routeDepartment("student affairs welfare")[0].dept;
        const draft = yield* tool("email.compose", `${dept.email}, formal`, () => ({ output: "Draft ready — not sent", value: composeEmail(dept, need, "formal") }), signal);
        yield* say(`I'll send this to the **${dept.name}** (${dept.email}) — they handle ${dept.handles.toLowerCase()}. I've drafted it below. **Nothing is sent automatically**: edit it, copy it, or open it in your mail app when you're happy.`, signal);
        yield { type: "card", card: { kind: "email", draft, need } };
        break;
      }

      case "layout": {
        yield { type: "plan", steps: ["Read your current dashboard", "Work out the changes you asked for", "Apply them (you can undo)"] };
        yield { type: "step", index: 0 };
        const before = yield* tool("dashboard.get_layout", "home", () => ({ output: `${ctx.widgets.filter((w) => !w.hidden).length} widgets visible`, value: ctx.widgets }), signal);
        yield { type: "step", index: 1 };
        const plan = yield* tool("dashboard.plan_changes", `"${prompt.slice(0, 48)}"`, () => {
          const r = planLayout(prompt, before);
          return { output: r.summary.length ? r.summary.join(", ") : "No change needed", value: r };
        }, signal);
        yield { type: "step", index: 2 };
        if (!plan.summary.length) {
          yield* say("Your dashboard already looks like that. You can name widgets like *fees*, *deadlines*, *clubs*, *map* or *progress* — try “show only deadlines and fees”.", signal);
        } else {
          yield* tool("dashboard.apply", `${plan.summary.length} change${plan.summary.length > 1 ? "s" : ""}`, () => ({ output: "Saved to this device", value: true }), signal);
          yield* say(`Done — your dashboard is updated. Open **Home** to see it. If it isn't what you wanted, press **Undo**.`, signal);
          yield { type: "card", card: { kind: "layout", summary: plan.summary, before, after: plan.after } };
        }
        break;
      }

      case "fees": {
        yield { type: "plan", steps: ["Read your fee schedule", "Find the next payment due"] };
        yield { type: "step", index: 0 };
        const dues = yield* tool("finance.get_schedule", "sem 1", () => ({ output: `${FINANCE.dues.length} items, ${money(FINANCE.paid)} paid`, value: FINANCE.dues }), signal);
        yield { type: "step", index: 1 };
        const next = dues.find((d) => d.status === "upcoming");
        if (!next) {
          yield* say(`You've paid **${money(FINANCE.paid)}** of ${money(FINANCE.tuitionTotal)} tuition. The Finance Office has not posted another instalment yet, so nothing is due. I'll tell you when something is posted.`, signal);
          break;
        }
        yield* tool("finance.next_due", "—", () => ({ output: `${money(next.amount)}, ${relative(new Date(next.due))}`, value: next }), signal);
        yield* say(`You've paid **${money(FINANCE.paid)}** of ${money(FINANCE.tuitionTotal)} tuition. The next instalment — **${money(next.amount)}** — is due **${dateShort(new Date(next.due))}** (${relative(new Date(next.due))}). ${FINANCE.dues.some((d) => d.id === "f3") ? `A hostel payment of ${money(1200)} follows on 15 Dec. ` : ""}If you need more time, I can draft an email to the Finance Office.`, signal);
        yield { type: "card", card: { kind: "fees", due: next.amount, label: next.label, dueIso: next.due, paid: FINANCE.paid, total: FINANCE.tuitionTotal } };
        yield { type: "card", card: { kind: "suggest", prompts: ["Draft an email to Finance about my fee instalment"] } };
        break;
      }

      case "clubs": {
        yield { type: "plan", steps: ["Read your interests", "Match them to recruiting clubs", "Check meeting times against your timetable"] };
        yield { type: "step", index: 0 };
        const words = t.split(/[^a-z]+/).filter((w) => w.length > 3 && !["clubs", "club", "like", "which", "that", "what", "with", "want", "join"].includes(w));
        yield { type: "step", index: 1 };
        const matches = yield* tool("clubs.match", words.slice(0, 6).join(", ") || "all", () => {
          const scored = CLUBS.filter((c) => c.recruiting).map((c) => ({ c, s: c.tags.filter((tag) => words.some((w) => tag === w || (w.length >= 5 && (tag.startsWith(w) || w.startsWith(tag))))).length + (words.some((w) => c.category.toLowerCase().includes(w)) ? 1 : 0) }));
          const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
          const list = (top.length ? top : scored.sort((a, b) => b.c.members - a.c.members).slice(0, 3)).map((x) => x.c);
          return { output: `${list.length} matches`, value: { list, matched: top.length > 0 } };
        }, signal);
        yield { type: "step", index: 2 };
        yield* tool("timetable.check_clash", matches.list.map((c) => c.meets).join(", "), () => ({ output: "No clashes with classes", value: true }), signal);
        yield* say(matches.matched ? `Based on what you told me, these fit: ${matches.list.map((c) => `**${c.name}**`).join(", ")}. None of their meeting times clash with your classes.` : `You didn't mention specific interests, so here are the most popular clubs that are recruiting. Tell me what you enjoy and I'll narrow it down.`, signal);
        yield { type: "card", card: { kind: "clubs", items: matches.list } };
        break;
      }

      case "schedule": {
        const tomorrow = has(t, /\btomorrow\b/);
        yield { type: "plan", steps: ["Read your timetable", "Mark cancelled or changed classes"] };
        yield { type: "step", index: 0 };
        const day = tomorrow ? 1 : todayIdx;
        const list = yield* tool("timetable.get", `${tomorrow ? "Tue 24" : "Mon 23"} Nov`, () => {
          const l = CLASSES.filter((c) => c.day === day).sort((a, b) => a.start.localeCompare(b.start));
          return { output: `${l.length} sessions`, value: l };
        }, signal);
        yield { type: "step", index: 1 };
        await sleep(250, signal);
        const live = list.filter((c) => c.status !== "cancelled");
        yield* say(`${tomorrow ? "Tomorrow" : "Today"} you have **${live.length} classes**${list.length !== live.length ? ` (${list.length - live.length} cancelled)` : ""}.`, signal);
        yield { type: "card", card: { kind: "schedule", label: tomorrow ? "Tuesday 24 Nov" : "Monday 23 Nov", items: list } };
        break;
      }

      default: {
        yield { type: "plan", steps: ["Understand the request", "Check what I can do"] };
        yield { type: "step", index: 0 };
        await sleep(300, signal);
        yield { type: "step", index: 1 };
        yield* say(`I'm not sure how to help with that yet, ${STUDENT.first}. I can read your **timetable**, **deadlines**, **fees** and **clubs**, find **rooms** on the map, **draft emails** to the right office, and **rearrange your dashboard**. Try one of these:`, signal);
        yield { type: "card", card: { kind: "suggest", prompts: SUGGESTIONS.slice(0, 4) } };
      }
    }
    yield { type: "done" };
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") { yield { type: "done" }; return; }
    throw e;
  }
}

/* ── dashboard prompt → layout diff ── */
function planLayout(prompt: string, before: WidgetPref[]): { after: WidgetPref[]; summary: string[] } {
  const t = prompt.toLowerCase();
  const mentioned = (Object.keys(WIDGET_META) as WidgetId[]).filter((id) => WIDGET_META[id].aliases.some((a) => new RegExp(`\\b${a}\\b`).test(t)));
  let after = before.map((w) => ({ ...w }));
  const summary: string[] = [];
  const clauses = t.split(/\b(?:and|then|but|,|;)\b|,/).map((c) => c.trim()).filter(Boolean);
  const idsIn = (c: string) => mentioned.filter((id) => WIDGET_META[id].aliases.some((a) => new RegExp(`\\b${a}\\b`).test(c)));

  if (has(t, /\bonly\b/) && mentioned.length) {
    const keep = new Set(mentioned);
    after = after.map((w) => ({ ...w, hidden: !keep.has(w.id) }));
    summary.push(`Showing only ${mentioned.map((m) => WIDGET_META[m].title).join(", ")}`);
  } else {
    let verb: "show" | "hide" | null = null;
    for (const c of clauses) {
      if (has(c, /\b(hide|remove|drop|get rid|without|delete)\b/)) verb = "hide";
      else if (has(c, /\b(add|show|bring|include|want|need|pin|put)\b/)) verb = "show";
      const ids = idsIn(c);
      for (const id of ids) {
        const w = after.find((x) => x.id === id)!;
        if (verb === "hide" && !w.hidden) { w.hidden = true; summary.push(`Hid ${WIDGET_META[id].title}`); }
        else if (verb === "show" && w.hidden) { w.hidden = false; summary.push(`Added ${WIDGET_META[id].title}`); }
      }
    }
  }
  if (has(t, /\b(first|top|front|priority|above everything)\b/) && mentioned.length) {
    const lead = mentioned[0];
    const idx = after.findIndex((w) => w.id === lead);
    const [w] = after.splice(idx, 1);
    w.hidden = false;
    after.unshift(w);
    summary.push(`Moved ${WIDGET_META[lead].title} to the top`);
  }
  const changed = JSON.stringify(after) !== JSON.stringify(before);
  return { after, summary: changed ? summary : [] };
}

