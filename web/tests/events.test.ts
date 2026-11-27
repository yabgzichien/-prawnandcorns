import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRoomRequest } from "../src/lib/library/search.ts";
import { ITEMS, VENUES } from "../src/lib/events/catalogue.ts";
import { checkApplication, dateLabel, freeVenues, itemsLeft, problemsOf, warningsOf } from "../src/lib/events/checks.ts";
import { applyDecisionBatch, decisionStamp, deriveEventStatus, eventStatusOf, sanitizeDecisions } from "../src/lib/events/decisions.ts";
import { applicationFrom, defaultItemDates, nextApplicationId, relatedApplications, sanitizeApplications } from "../src/lib/events/application.ts";
import { draftFromRequest, isEventStatusQuestion, parseEventRequest, parseItems } from "../src/lib/events/request.ts";
import { SEEDED_APPLICATIONS, SEEDED_DECISIONS } from "../src/lib/events/seed.ts";
import { readStoredDecisions, withSeeded, writeStoredDecisions } from "../src/lib/events/storage.ts";
import { DECISIONS_KEY } from "../src/lib/events/types.ts";
import { resetScenario } from "../src/lib/world/storage.ts";
import { createDemoExecutor, sanitizeDemoContext } from "../src/lib/gemini-tools.ts";
import { bookingSlipPdf } from "../src/lib/events/slip.ts";
import type { Decisions, EventDraft } from "../src/lib/events/types.ts";

const DEMO_PROMPT = "Book 3 classrooms and 30 plastic chairs, 10 banquet tables, 2 megaphones and 10 walkie talkies for our Robotics Demo Night on 10 December from 4pm to 10pm, 80 people. The Robotics & AI Society is organising it.";
const ADVISER = { name: "Dr. Lim (demo)", email: "lim@demo.invalid" };

const goodDraft = (): EventDraft => ({
  name: "Demo Night", organisers: "Robotics & AI Society", participants: 80, date: "2026-12-10", start: "16:00", end: "22:00", description: "", adviser: ADVISER,
  lines: [{ kind: "venue", id: "v1", venueId: "B1-B08", date: "2026-12-10", start: "15:00", end: "22:00" }],
});

describe("request parser", () => {
  it("reads the demo prompt into an event, with rooms, items and numbers", () => {
    const r = parseEventRequest(DEMO_PROMPT);
    assert.equal(r.isEventRequest, true);
    assert.equal(r.name, "Robotics Demo Night");
    assert.equal(r.date, "2026-12-10");
    assert.equal(r.start, "16:00");
    assert.equal(r.end, "22:00");
    assert.equal(r.participants, 80);
    assert.equal(r.roomCount, 3);
    assert.equal(r.organisers, "Robotics & AI Society");
    const qty = Object.fromEntries(r.items.map((i) => [i.itemId, i.qty]));
    assert.deepEqual(qty, { "plastic-chair": 30, "banquet-table": 10, megaphone: 2, "walkie-talkie": 10 });
    assert.deepEqual(r.missing, []);
  });

  it("keeps a library room request in the library, and routes club events to the new flow", () => {
    assert.equal(parseEventRequest("Book a study room for 2 tomorrow at 3pm").isEventRequest, false);
    assert.equal(parseRoomRequest("Book a study room for 2 tomorrow at 3pm").isRoomRequest, true);
    assert.equal(parseEventRequest("book 3 rooms and 30 chairs for our club event, 80 people").isEventRequest, true);
    assert.equal(parseRoomRequest("book 3 rooms and 30 chairs for our club event, 80 people").isRoomRequest, false);
    assert.equal(parseEventRequest("The air-con in D3-512 is leaking").isEventRequest, false);
    assert.equal(parseEventRequest("What is due this week?").isEventRequest, false);
  });

  it("still accepts the event when a model rewrites the request and drops the ask word or the event word", () => {
    const rewrites = [
      "3 classrooms, 30 plastic chairs, 10 banquet tables and 2 megaphones for Robotics Demo Night on 10 December, 4pm to 10pm, 80 people",
      "Book 3 classrooms and 30 plastic chairs for Robotics Night on 10 December",
      "Draft an application to book 3 classrooms and 30 chairs for our Robotics Demo Night",
      "Robotics Demo Night, 10 December, 16:00 to 22:00, 80 people, 3 classrooms, 30 plastic chairs, 10 banquet tables",
    ];
    for (const text of rewrites) assert.equal(parseEventRequest(text).looksLikeEvent, true, text);
    // the strict check that routes the offline demo is unchanged
    assert.equal(parseEventRequest(rewrites[0]).isEventRequest, false);
  });

  it("does not stretch the lenient check to library rooms, emails, faults or ordinary questions", () => {
    const others = [
      "Book a study room for 2 tomorrow at 3pm",
      "The air-con in D3-512 is leaking",
      "What is due this week?",
      "Draft an email to ECA about our venue booking and 30 chairs",
      "Hello, can you help me?",
      "The Robotics & AI Society is organising it on 10 December from 4pm to 10pm, 80 people.",
    ];
    for (const text of others) assert.equal(parseEventRequest(text).looksLikeEvent, false, text);
  });

  it("leaves emails, library rooms and ordinary questions alone", () => {
    assert.equal(parseEventRequest("Draft an email to ECA about our venue booking and 30 chairs").isEventRequest, false);
    assert.equal(isEventStatusQuestion("What is the status of my event application?"), true);
    assert.equal(isEventStatusQuestion("what's the status of my room booking in the library"), false);
    assert.equal(isEventStatusQuestion("how is my class timetable"), false);
  });

  it("does not count guest speakers as a speaker to borrow", () => {
    assert.deepEqual(parseItems("2 guest speakers and 1 portable speaker"), [{ itemId: "speaker", qty: 1 }]);
  });

  it("counts a phrase once and prefers the longest alias", () => {
    assert.deepEqual(parseItems("30 plastic chairs and 4 tables"), [{ itemId: "plastic-chair", qty: 30 }, { itemId: "banquet-table", qty: 4 }]);
  });

  it("reads times written in several ways", () => {
    assert.deepEqual([parseEventRequest("book rooms for our event 4-10pm").start, parseEventRequest("book rooms for our event 4-10pm").end], ["16:00", "22:00"]);
    assert.deepEqual([parseEventRequest("book rooms for our event from 9am to 12pm").start, parseEventRequest("book rooms for our event from 9am to 12pm").end], ["09:00", "12:00"]);
    assert.deepEqual([parseEventRequest("book rooms for our event 16:00 to 22:00").start, parseEventRequest("book rooms for our event 16:00 to 22:00").end], ["16:00", "22:00"]);
  });

  it("reads named rooms and weekdays", () => {
    const r = parseEventRequest("Reserve B1-B06-2 and A4-G08 for our club event next Saturday for 100 people");
    assert.deepEqual(r.venueIds, ["B1-B06-2", "A4-G08"]);
    assert.equal(r.date, "2026-12-05", "next Saturday is the Saturday of next week");
    assert.equal(parseEventRequest("book chairs for our club event this saturday").date, "2026-11-28");
  });

  it("lists what the message left out", () => {
    const r = parseEventRequest("book 2 classrooms for our club event");
    assert.ok(r.missing.includes("the date") && r.missing.includes("how many people are coming"));
  });
});

describe("draft from a request", () => {
  it("picks the smallest free rooms that fit, with set up time, and item dates from each office", () => {
    const r = parseEventRequest(DEMO_PROMPT);
    const { draft } = draftFromRequest(r, SEEDED_APPLICATIONS, SEEDED_DECISIONS, ADVISER);
    const venues = draft.lines.filter((l) => l.kind === "venue");
    assert.equal(venues.length, 3);
    for (const v of venues) assert.ok(v.kind === "venue" && v.start === "15:00" && v.end === "22:00");
    const chair = draft.lines.find((l) => l.kind === "item" && l.itemId === "plastic-chair");
    const megaphone = draft.lines.find((l) => l.kind === "item" && l.itemId === "megaphone");
    assert.ok(chair?.kind === "item" && chair.collectDate === "2026-12-10" && chair.returnDate === "2026-12-11");
    assert.ok(megaphone?.kind === "item" && megaphone.collectDate === "2026-12-09");
    assert.equal(problemsOf(checkApplication(draft, SEEDED_APPLICATIONS, SEEDED_DECISIONS)).length, 0);
  });

  it("does not offer a room another club already holds", () => {
    const free = freeVenues("2026-12-04", "18:00", "22:00", 1, SEEDED_APPLICATIONS, SEEDED_DECISIONS).map((v) => v.id);
    assert.ok(!free.includes("B1-B08"), "B1-B08 is approved for Open Mic Night that evening");
    assert.ok(free.includes("B1-B06-2"));
  });
});

describe("checks", () => {
  it("accepts a sound draft", () => {
    assert.deepEqual(problemsOf(checkApplication(goodDraft(), SEEDED_APPLICATIONS, SEEDED_DECISIONS)), []);
  });

  it("blocks a room another club already has approved, and warns about one it has only asked for", () => {
    const taken = goodDraft();
    taken.date = "2026-12-04"; taken.lines = [{ kind: "venue", id: "v1", venueId: "B1-B08", date: "2026-12-04", start: "18:00", end: "22:00" }];
    assert.ok(problemsOf(checkApplication(taken, SEEDED_APPLICATIONS, SEEDED_DECISIONS)).some((i) => /already approved for Music/.test(i.message)));
    const asked = goodDraft();
    asked.date = "2026-12-12"; asked.lines = [{ kind: "venue", id: "v1", venueId: "B1-B06-2", date: "2026-12-12", start: "17:00", end: "22:00" }];
    const issues = checkApplication(asked, SEEDED_APPLICATIONS, SEEDED_DECISIONS);
    assert.equal(problemsOf(issues).length, 0);
    assert.ok(warningsOf(issues).some((i) => /also asked for B1-B06-2/.test(i.message)));
  });

  it("frees a room when the other club's line was refused", () => {
    const decisions: Decisions = { ...SEEDED_DECISIONS, "DEMO-EVT-0105": { ...SEEDED_DECISIONS["DEMO-EVT-0105"], lines: { ...SEEDED_DECISIONS["DEMO-EVT-0105"].lines, v1: { status: "Rejected", updatedAt: "2026-11-19T10:00:00+08:00" } } } };
    const d = goodDraft();
    d.date = "2026-12-04"; d.lines = [{ kind: "venue", id: "v1", venueId: "B1-B08", date: "2026-12-04", start: "18:00", end: "22:00" }];
    assert.equal(problemsOf(checkApplication(d, SEEDED_APPLICATIONS, decisions)).length, 0);
  });

  it("follows a room swap: the room staff gave is the room that is taken", () => {
    const decisions: Decisions = { "DEMO-EVT-0102": { eventStatus: "Approve With Condition", sentAt: "2026-11-24T10:00:00+08:00", lines: { v1: { status: "Approve With Condition", assignedVenueId: "A4-G09", updatedAt: "2026-11-24T10:00:00+08:00" } } } };
    const d = goodDraft();
    d.date = "2026-12-09"; d.lines = [{ kind: "venue", id: "v1", venueId: "A4-G09", date: "2026-12-09", start: "16:00", end: "21:00" }];
    assert.ok(problemsOf(checkApplication(d, SEEDED_APPLICATIONS, decisions)).some((i) => /A4-G09 is already approved/.test(i.message)));
  });

  it("flags dates, times, capacity, maximums, stock and weekends", () => {
    const d = goodDraft();
    d.date = "2026-11-20"; d.end = "15:00"; d.participants = 0;
    let msgs = problemsOf(checkApplication(d, [], {})).map((i) => i.message).join("|");
    assert.match(msgs, /passed/); assert.match(msgs, /end after it starts/); assert.match(msgs, /number of participants/);

    const late = goodDraft(); late.date = "2027-01-05";
    assert.match(problemsOf(checkApplication(late, [], {})).map((i) => i.message).join("|"), /semester/);

    const short = goodDraft(); short.date = "2026-11-30";
    short.lines = [{ kind: "venue", id: "v1", venueId: "B1-B08", date: "2026-11-30", start: "15:00", end: "22:00" }];
    assert.ok(warningsOf(checkApplication(short, [], {})).some((i) => /Short notice/.test(i.message)));

    const small = goodDraft(); small.lines = [{ kind: "venue", id: "v1", venueId: "B1-213", date: "2026-12-10", start: "15:00", end: "22:00" }];
    assert.ok(warningsOf(checkApplication(small, [], {})).some((i) => /hold about 50 people/.test(i.message)));

    const hours = goodDraft(); hours.lines = [{ kind: "venue", id: "v1", venueId: "B1-B08", date: "2026-12-10", start: "15:00", end: "23:00" }];
    assert.ok(problemsOf(checkApplication(hours, [], {})).some((i) => /08:00 to 22:00/.test(i.message)));

    const items = goodDraft();
    items.lines = [
      { kind: "item", id: "i1", itemId: "walkie-talkie", qty: 11, collectDate: "2026-12-10", returnDate: "2026-12-11" },
      { kind: "item", id: "i2", itemId: "megaphone", qty: 2, collectDate: "2026-12-12", returnDate: "2026-12-11" },
    ];
    msgs = problemsOf(checkApplication(items, [], {})).map((i) => i.message).join("|");
    assert.match(msgs, /at most 10/); assert.match(msgs, /return date cannot be before/);

    const sunday = goodDraft(); sunday.lines = [{ kind: "item", id: "i1", itemId: "megaphone", qty: 1, collectDate: "2026-12-12", returnDate: "2026-12-13" }];
    assert.ok(warningsOf(checkApplication(sunday, [], {})).some((i) => /closed on Sundays/.test(i.message)));
  });

  it("warns when the return window closes before the event ends, as on the real PAMO slip", () => {
    const d = goodDraft();
    d.lines = [{ kind: "item", id: "i1", itemId: "plastic-chair", qty: 30, collectDate: "2026-12-10", returnDate: "2026-12-10" }];
    assert.ok(warningsOf(checkApplication(d, [], {})).some((i) => /closes before your event ends/.test(i.message)));
  });

  it("counts stock other clubs have asked for", () => {
    assert.equal(itemsLeft("walkie-talkie", "2026-12-17", "2026-12-18", SEEDED_APPLICATIONS, SEEDED_DECISIONS), 0);
    assert.equal(itemsLeft("walkie-talkie", "2026-12-01", "2026-12-02", SEEDED_APPLICATIONS, SEEDED_DECISIONS), 12);
  });

  it("checks every seeded application against the catalogue without throwing, and the seeds hold together", () => {
    for (const app of SEEDED_APPLICATIONS) {
      const others = SEEDED_APPLICATIONS.filter((o) => o.id !== app.id);
      assert.ok(Array.isArray(checkApplication(app, others, SEEDED_DECISIONS)));
    }
    const basketball = SEEDED_APPLICATIONS.find((a) => a.id === "DEMO-EVT-0103")!;
    assert.deepEqual(relatedApplications(basketball, SEEDED_APPLICATIONS).map((a) => a.id), ["DEMO-EVT-0104"]);
    assert.ok(problemsOf(checkApplication(basketball, SEEDED_APPLICATIONS.filter((o) => o.id !== basketball.id), SEEDED_DECISIONS)).some((i) => /at most 10/.test(i.message)));
  });
});

describe("decisions", () => {
  const app = SEEDED_APPLICATIONS.find((a) => a.id === "DEMO-EVT-0101")!;
  const at = "2026-11-24T09:00:00+08:00";

  it("derives the event status from its lines, as the real slips do", () => {
    assert.equal(deriveEventStatus(["Pending", "Approved"]), "Pending");
    assert.equal(deriveEventStatus(["Approved", "Approved"]), "Approved");
    assert.equal(deriveEventStatus(["Approved", "Rejected"]), "Approve With Condition");
    assert.equal(deriveEventStatus(["Approved", "Approve With Condition"]), "Approve With Condition");
    assert.equal(deriveEventStatus(["Rejected", "Rejected"]), "Rejected");
    assert.equal(deriveEventStatus([]), "Pending");
  });

  it("sends a partial decision and leaves the other lines pending, then merges a later one", () => {
    const first = applyDecisionBatch({}, app, { i1: { status: "Approved", updatedAt: at }, i2: { status: "Approved", updatedAt: at } }, { sentAt: at });
    assert.equal(eventStatusOf(app, first), "Pending");
    assert.deepEqual(Object.keys(first[app.id].lines).sort(), ["i1", "i2"]);
    const second = applyDecisionBatch(first, app, { v1: { status: "Approve With Condition", remark: "Tidy up.", assignedVenueId: "B1-B08", updatedAt: at }, i3: { status: "Rejected", remark: "Over the limit.", updatedAt: at } }, { sentAt: at });
    assert.equal(eventStatusOf(app, second), "Approve With Condition");
    assert.equal(second[app.id].lines.i1.status, "Approved");
    assert.equal(second[app.id].lines.v1.assignedVenueId, "B1-B08");
  });

  it("lets staff set the event status and ignores lines that are not in the application", () => {
    const d = applyDecisionBatch({}, app, { i1: { status: "Approved", updatedAt: at }, zz9: { status: "Approved", updatedAt: at } }, { sentAt: at, eventStatus: "Approve With Condition", eventRemark: "Only the items for now." });
    assert.equal(eventStatusOf(app, d), "Approve With Condition");
    assert.equal(d[app.id].lines.zz9, undefined);
    assert.equal(d[app.id].eventRemark, "Only the items for now.");
  });

  it("changes the alert stamp for every kind of revision, so the student is told again", () => {
    const at = "2026-11-24T09:00:00+08:00";
    const base = applyDecisionBatch({}, app, { v1: { status: "Approved", updatedAt: at } }, { sentAt: at });
    const stamps = new Set([
      decisionStamp(app, base),
      decisionStamp(app, applyDecisionBatch(base, app, { v1: { status: "Approve With Condition", updatedAt: at } }, { sentAt: at })),
      decisionStamp(app, applyDecisionBatch(base, app, { v1: { status: "Approved", remark: "Tidy up.", updatedAt: at } }, { sentAt: at })),
      decisionStamp(app, applyDecisionBatch(base, app, { v1: { status: "Approved", assignedVenueId: "B1-B08", updatedAt: at } }, { sentAt: at })),
      decisionStamp(app, applyDecisionBatch(base, app, { i1: { status: "Approved", approvedQty: 1, updatedAt: at } }, { sentAt: at })),
    ]);
    assert.equal(stamps.size, 5);
    assert.equal(decisionStamp(app, {}), "");
    assert.equal(decisionStamp(app, base), decisionStamp(app, base));
  });

  it("cleans damaged or hostile saved decisions", () => {
    assert.deepEqual(sanitizeDecisions("nope"), {});
    assert.deepEqual(sanitizeDecisions(null), {});
    const dirty = sanitizeDecisions({
      "DEMO-EVT-0001": { eventStatus: "Approved", sentAt: at, lines: { v1: { status: "Approved", updatedAt: at, remark: "x".repeat(500), assignedVenueId: "NOT-A-ROOM", approvedQty: -3 }, "<script>": { status: "Approved", updatedAt: at }, v2: { status: "Maybe", updatedAt: at } } },
      "../etc": { eventStatus: "Approved", sentAt: at, lines: {} },
      "DEMO-EVT-0002": { eventStatus: "Whatever", sentAt: at, lines: {} },
    });
    assert.deepEqual(Object.keys(dirty), ["DEMO-EVT-0001"]);
    assert.deepEqual(Object.keys(dirty["DEMO-EVT-0001"].lines), ["v1"]);
    assert.equal(dirty["DEMO-EVT-0001"].lines.v1.remark?.length, 200);
    assert.equal(dirty["DEMO-EVT-0001"].lines.v1.assignedVenueId, undefined);
    assert.equal(dirty["DEMO-EVT-0001"].lines.v1.approvedQty, undefined);
  });
});

describe("saved applications", () => {
  it("round trips a submitted application and drops anything malformed", () => {
    const { draft } = draftFromRequest(parseEventRequest(DEMO_PROMPT), SEEDED_APPLICATIONS, SEEDED_DECISIONS, ADVISER);
    const app = applicationFrom(draft, "DEMO-EVT-0001", "2026-11-23T13:20:00+08:00");
    const back = sanitizeApplications(JSON.parse(JSON.stringify([app, { id: "bad" }, 5, null, { ...app, id: "DEMO-EVT-0002", lines: [{ kind: "venue", id: "v1", venueId: "NOPE", date: "2026-12-10", start: "15:00", end: "22:00" }] }])));
    assert.equal(back.length, 1);
    assert.deepEqual(back[0], app);
  });

  it("numbers applications without reusing one the desk has already answered", () => {
    assert.equal(nextApplicationId([], {}), "DEMO-EVT-0001");
    assert.equal(nextApplicationId([{ id: "DEMO-EVT-0001" }], {}), "DEMO-EVT-0002");
    assert.equal(nextApplicationId([], { "DEMO-EVT-0001": { eventStatus: "Approved", sentAt: "2026-11-24T09:00:00+08:00", lines: {} } }), "DEMO-EVT-0002");
  });

  it("follows each office's collect and return days", () => {
    assert.deepEqual(defaultItemDates("plastic-chair", "2026-12-10"), { collectDate: "2026-12-10", returnDate: "2026-12-11" });
    assert.deepEqual(defaultItemDates("speaker", "2026-12-10"), { collectDate: "2026-12-09", returnDate: "2026-12-11" });
  });
});

describe("catalogue and seeds", () => {
  it("has unique ids, sensible numbers, and nothing taken from a real record", () => {
    assert.equal(new Set(VENUES.map((v) => v.id)).size, VENUES.length);
    assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
    for (const i of ITEMS) assert.ok(i.maxPerRequest > 0 && i.maxPerRequest <= i.stock, i.id);
    const everything = JSON.stringify([SEEDED_APPLICATIONS, SEEDED_DECISIONS]);
    assert.doesNotMatch(everything, /@xmu\.edu\.my|EVT26/);
    assert.match(everything, /@demo\.invalid/);
  });

  it("formats dates the way the screens do", () => {
    assert.equal(dateLabel("2026-12-10"), "Thu 10 Dec");
  });
});

describe("booking slip", () => {
  it("makes a PDF with every section, the room swap and the fictional notice", () => {
    const app = SEEDED_APPLICATIONS.find((a) => a.id === "DEMO-EVT-0102")!;
    const at = "2026-11-24T09:00:00+08:00";
    const decisions = applyDecisionBatch({}, app, {
      v1: { status: "Approve With Condition", assignedVenueId: "A4-G09", remark: "Please put all tables and chairs back.", updatedAt: at },
      i1: { status: "Approved", approvedQty: 4, remark: "Collect from LG-B12", updatedAt: at },
      i2: { status: "Rejected", remark: "Not available", updatedAt: at },
    }, { sentAt: at });
    const bytes = bookingSlipPdf(app, decisions);
    const text = Buffer.from(bytes).toString("latin1");
    assert.ok(text.startsWith("%PDF-1.4") && text.trimEnd().endsWith("%%EOF"));
    for (const word of ["BOOKING SLIP", "DEMO-EVT-0102", "Venues", "Items", "Operation and Maintenance", "A4-G07", "A4-G09", "asked", "given", "4 of 6", "Rejected", "Fictional demo document", "Waiting for"]) assert.ok(text.includes(word), word);
  });

  it("flows onto a second page when there are many lines", () => {
    const app = { ...SEEDED_APPLICATIONS[0], lines: Array.from({ length: 20 }, (_, n) => ({ kind: "item" as const, id: `i${n + 1}`, itemId: "plastic-chair", qty: 5 + n, collectDate: "2026-12-12", returnDate: "2026-12-14" })) };
    const text = Buffer.from(bookingSlipPdf(app, {})).toString("latin1");
    assert.ok((text.match(/\/Type \/Page /g) ?? []).length >= 2);
  });
});

const memory = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
};

describe("desk storage", () => {
  it("saves only what the desk wrote, reads it back cleaned, and is cleared by Reset scenario", () => {
    const storage = memory();
    assert.deepEqual(readStoredDecisions(storage), {});
    const app = SEEDED_APPLICATIONS.find((a) => a.id === "DEMO-EVT-0102")!;
    const at = "2026-11-24T09:00:00+08:00";
    const next = applyDecisionBatch({}, app, { v1: { status: "Approved", updatedAt: at } }, { sentAt: at });
    assert.ok(writeStoredDecisions(next, storage));
    assert.equal(readStoredDecisions(storage)[app.id].lines.v1.status, "Approved");
    assert.ok(withSeeded(readStoredDecisions(storage))["DEMO-EVT-0105"], "the invented answers sit underneath");
    storage.setItem(DECISIONS_KEY, "{not json");
    assert.deepEqual(readStoredDecisions(storage), {});
    writeStoredDecisions(next, storage);
    resetScenario(storage);
    assert.equal(storage.getItem(DECISIONS_KEY), null);
  });
});

describe("Gemini tool", () => {
  const exec = () => createDemoExecutor({ prompt: "x", context: sanitizeDemoContext({}), apiKey: "", model: "gemini-2.5-flash" });

  it("prepares one application from the student's words and never submits", async () => {
    const r = await exec()("prepare_event_application", { request: DEMO_PROMPT });
    assert.equal(r.card?.kind, "event");
    const v = r.value as { submitted: boolean; lines: string[]; problemsToFix: string[] };
    assert.equal(v.submitted, false);
    assert.ok(v.lines.some((l) => /Room B1-212/.test(l)));
    assert.ok(v.lines.some((l) => /30 x Plastic chair/.test(l)));
    // only the adviser is missing: the student has to supply that, so it is left as a problem to fix
    assert.deepEqual(v.problemsToFix.map((m) => /adviser/i.test(m)), [true, true]);
  });

  it("refuses requests that are not club events, and ignores a model-set structure", async () => {
    const run = exec();
    assert.equal((await run("prepare_event_application", { request: "Book a study room for 2 tomorrow at 3pm" })).card, undefined);
    assert.equal((await run("prepare_event_application", { request: { evil: true } })).card, undefined);
    assert.equal((await run("prepare_event_application", { request: "What is due this week?" })).card, undefined);
  });

  it("reports a clash instead of hiding it", async () => {
    const r = await exec()("prepare_event_application", { request: "Reserve B1-B08 for our club event on 4 December from 6pm to 10pm for 80 people" });
    assert.match((r.value as { problemsToFix: string[] }).problemsToFix.join(" "), /already approved/);
  });
});
