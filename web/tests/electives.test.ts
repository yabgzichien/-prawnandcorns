import assert from "node:assert/strict";
import test from "node:test";
import { CORE_CREDITS, GE_BY_CODE, GE_CATALOGUE, SEMESTER_CREDIT_LIMIT } from "../src/lib/electives/catalogue.ts";
import { meetingLabel, parseSchedule, weekOf } from "../src/lib/electives/parse.ts";
import { checkShortlist, coreClashes, courseStatus, electiveClashes, sanitizeShortlist, suggestSets } from "../src/lib/electives/plan.ts";
import { isGeQuestion, parseGeRequest, plannerHref } from "../src/lib/electives/request.ts";
import { ALLOWED_STREAMS, DEFAULT_PREFS } from "../src/lib/electives/types.ts";
import { createDemoExecutor, sanitizeDemoContext } from "../src/lib/gemini-tools.ts";

const one = (text: string) => parseSchedule(text).meetings.map((m) => `${m.day} ${m.start}-${m.end} w${m.weeks.join(",")}${m.room ? ` ${m.room}` : ""}`);

test("the parser reads the shapes the AC uses for elective times", () => {
  assert.deepEqual(one("Tue 2:00 PM - 4:00 PM, A2-305 (Weeks 1-14)"), ["1 14:00-16:00 w1,2,3,4,5,6,7,8,9,10,11,12,13,14 A2-305"]);
  assert.deepEqual(one("Thursdays 6pm to 8pm, Weeks 1-7, A3-G02"), ["3 18:00-20:00 w1,2,3,4,5,6,7 A3-G02"]);
  assert.deepEqual(one("Mon & Wed 4.00pm-5.00pm, A4-301").map((x) => x.slice(0, 13)), ["0 16:00-17:00", "2 16:00-17:00"]);
  assert.deepEqual(one("Fri 9am-12pm (Wk 1-14), A5-L1").map((x) => x.slice(0, 13)), ["4 09:00-12:00"]);
  assert.deepEqual(one("Every Monday, 2pm to 4pm").map((x) => x.slice(0, 13)), ["0 14:00-16:00"]);
  assert.deepEqual(one("Wed 10:00-12:00; A1-102"), [`2 10:00-12:00 w${Array.from({ length: 14 }, (_, i) => i + 1).join(",")} A1-102`]);
  assert.deepEqual(one("Thu 2-4pm").map((x) => x.slice(0, 13)), ["3 14:00-16:00"]);
  assert.deepEqual(one("Wk 8-14 Tue 16:00-18:00"), ["1 16:00-18:00 w8,9,10,11,12,13,14"]);
  // two meetings with different times in one part
  assert.deepEqual(one("Tue 09:00-11:00 and Thu 09:00-10:00, A2-203").map((x) => x.slice(0, 13)), ["1 09:00-11:00", "3 09:00-10:00"]);
  assert.deepEqual(one("Tue 16:00-18:00, Wk 1-7; Thu 16:00-18:00, Wk 8-14, A2-104"), ["1 16:00-18:00 w1,2,3,4,5,6,7 A2-104", "3 16:00-18:00 w8,9,10,11,12,13,14 A2-104"]);
});

test("specific dates become the right weeks and weekdays of Semester 2", () => {
  const p = parseSchedule("Saturdays 6, 13 and 20 March 2027, 9am-12pm, A2-305");
  assert.equal(p.meetings.length, 1);
  assert.deepEqual([p.meetings[0].day, p.meetings[0].weeks], [5, [1, 2, 3]]);
  assert.equal(meetingLabel(p.meetings[0]), "Sat 09:00 to 12:00, on 6 Mar, 13 Mar and 20 Mar");
  const q = parseSchedule("Sat 09:00-17:00 on 13 Mar and 20 Mar 2027");
  assert.deepEqual(q.meetings[0].weeks, [2, 3]);
  assert.deepEqual(weekOf(Date.UTC(2027, 2, 1)), { week: 1, day: 0 });
  assert.equal(weekOf(Date.UTC(2027, 1, 26)), null);
});

test("text that cannot be read is reported, never treated as free time", () => {
  for (const t of ["TBA", "To be announced", "Tuesday afternoons", "Mon 25:00-26:00", "Sat 9am-12pm on 31 Feb 2027", "Thu 14:00-16:00, Weeks 10-20", "Sat 09:00-12:00 on 1 Aug 2027", ""]) {
    const p = parseSchedule(t);
    assert.equal(p.meetings.length, 0, t);
    assert.ok(p.unreadable.length > 0, t);
  }
  const online = parseSchedule("Online, self-paced");
  assert.equal(online.flexible, true);
  assert.equal(online.unreadable.length, 0);
});

test("every catalogue entry except the TBA one parses into meetings", () => {
  for (const c of GE_CATALOGUE) {
    const p = parseSchedule(c.schedule);
    if (c.code === "GEB1220") assert.equal(p.unreadable.length, 1);
    else { assert.ok(p.meetings.length > 0, c.code); assert.equal(p.unreadable.length, 0, c.code); }
  }
});

test("clashes respect weeks: same time in different weeks is not a clash", () => {
  // Creative Writing is on Tuesday in weeks 1 to 7 and Thursday in weeks 8 to 14; Film Appreciation is every Thursday
  const c = electiveClashes("GEA1402", ["GEA1305"]);
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].weeks, [8, 9, 10, 11, 12, 13, 14]);
  // Photography (6, 13, 20 Mar) and Negotiation (13, 20 Mar) share two Wednesday evenings
  assert.deepEqual(electiveClashes("GEA1110", ["GEB1402"])[0].weeks, [2, 3]);
  // Business Etiquette runs in weeks 8 to 14 only, so it never meets the evening workshops
  assert.equal(electiveClashes("GEB1110", ["GEB1402", "GEA1110"]).length, 0);
  assert.equal(coreClashes("GEA1101")[0].label, "CST1202 Lecture");
});

test("the stream rule: science takes business and arts, business takes arts and science, arts takes science and business", () => {
  assert.deepEqual(ALLOWED_STREAMS.Science, ["Business", "Arts"]);
  assert.deepEqual(ALLOWED_STREAMS.Business, ["Arts", "Science"]);
  assert.deepEqual(ALLOWED_STREAMS.Arts, ["Science", "Business"]);
  assert.equal(courseStatus(GE_BY_CODE.GES1203, "Science").kind, "stream");
  assert.equal(courseStatus(GE_BY_CODE.GES1203, "Arts").kind, "fits");
  assert.equal(courseStatus(GE_BY_CODE.GEB1203, "Business").kind, "stream");
  assert.equal(courseStatus(GE_BY_CODE.GEA1203, "Arts").kind, "stream");
});

test("each course says why it can or cannot be chosen, naming both sides of a clash", () => {
  assert.equal(courseStatus(GE_BY_CODE.GEA1330, "Science").kind, "full");
  assert.equal(courseStatus(GE_BY_CODE.GEB1220, "Science").kind, "unreadable");
  assert.equal(courseStatus(GE_BY_CODE.GEA1101, "Science").message, "Clashes with CST1202 Lecture, Mon 10:00");
  assert.equal(courseStatus(GE_BY_CODE.GEA1402, "Science", ["GEA1305"]).message, "Clashes with GEA1305 Film Appreciation, Thu 16:00, weeks 8 to 14");
  assert.equal(courseStatus(GE_BY_CODE.GEA1305, "Science").kind, "fits");
});

test("suggested sets add up exactly, never clash, and only use courses the student may take", () => {
  for (const target of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const sets = suggestSets({ stream: "Science", target, interests: [], prefs: DEFAULT_PREFS });
    assert.ok(sets.length > 0, `target ${target}`);
    for (const s of sets) {
      assert.equal(s.credits, target);
      assert.ok(s.exact);
      for (const code of s.codes) {
        assert.equal(courseStatus(GE_BY_CODE[code], "Science", s.codes).kind, "fits", `${code} in ${s.codes}`);
      }
    }
  }
});

test("interests and time preferences change the ranking, not the rules", () => {
  const lang = suggestSets({ stream: "Science", target: 4, interests: ["Languages"], prefs: DEFAULT_PREFS })[0];
  assert.ok(lang.codes.some((c) => GE_BY_CODE[c].tags.includes("Languages")));
  assert.ok(lang.reasons.some((r) => r.includes("Languages")));
  const money = suggestSets({ stream: "Science", target: 4, interests: ["Money"], prefs: DEFAULT_PREFS })[0];
  assert.ok(money.codes.includes("GEB1203"));
  // the same input always gives the same answer
  assert.deepEqual(suggestSets({ stream: "Arts", target: 3, interests: ["Nature"], prefs: DEFAULT_PREFS }), suggestSets({ stream: "Arts", target: 3, interests: ["Nature"], prefs: DEFAULT_PREFS }));
});

test("saving is checked again: clashes, full courses, unreadable times, the stream and the credit limit block it", () => {
  assert.equal(checkShortlist(["GEA1220", "GEA1305"], "Science", 4).ok, true);
  assert.equal(checkShortlist(["GEA1402", "GEA1305"], "Science", 4).ok, false);
  assert.equal(checkShortlist(["GEA1330"], "Science", 2).ok, false);
  assert.equal(checkShortlist(["GEB1220"], "Science", 3).ok, false);
  assert.equal(checkShortlist(["GES1203"], "Science", 2).ok, false);
  assert.equal(checkShortlist([], "Science", 2).ok, false);
  assert.equal(checkShortlist(["NOPE1"], "Science", 2).ok, false);
  const over = checkShortlist(["GEA1450", "GEA1220", "GEA1305", "GEB1203"], "Science", 9);
  assert.equal(CORE_CREDITS + over.credits > SEMESTER_CREDIT_LIMIT, true);
  assert.equal(over.ok, false);
  const short = checkShortlist(["GEA1305"], "Science", 4);
  assert.equal(short.ok, true);
  assert.deepEqual(short.warnings, ["2 credits short of the 4 you need."]);
});

test("a saved shortlist is sanitised on load", () => {
  assert.deepEqual(sanitizeShortlist({ codes: ["GEA1305", "FAKE", "GEA1305"], target: 4, savedAt: "2026-11-23T13:20:00+08:00" }), { codes: ["GEA1305"], target: 4, savedAt: "2026-11-23T13:20:00+08:00" });
  assert.equal(sanitizeShortlist({ codes: [], target: 4, savedAt: "2026-11-23T13:20:00+08:00" }), null);
  assert.equal(sanitizeShortlist("junk"), null);
  assert.equal(sanitizeShortlist({ codes: ["GEA1305"], target: 99, savedAt: "2026-11-23T13:20:00+08:00" })?.target, 4);
});

test("elective questions in plain words, and phrases that must keep their old routes", () => {
  assert.deepEqual(parseGeRequest("Which electives fit my timetable? I need 4 credits and like languages and film"), { isGeRequest: true, credits: 4, interests: ["Languages", "Film and media"] });
  assert.deepEqual(parseGeRequest("Add 3 credits of GE, something about money").credits, 3);
  assert.deepEqual(parseGeRequest("I need arts electives for 2 credits").interests, []);
  for (const p of ["Book a study room for 2 tomorrow at 3pm", "Where is A3-G01?", "Add a finance widget and hide clubs", "I like robotics and photography, which clubs fit?", "What's due this week?", "Is my 2pm class still on?", "Find my tuition invoice and download it", "The air-con in my room is leaking water"]) {
    assert.equal(isGeQuestion(p), false, p);
  }
  assert.equal(plannerHref(4, ["Languages", "Film and media"]), "/hub?section=electives&credits=4&likes=languages%2Cfilm");
});

test("number words count as credits too", () => {
  assert.equal(parseGeRequest("I need four credits of electives").credits, 4);
  assert.equal(parseGeRequest("GE for two credit hours").credits, 2);
  assert.equal(parseGeRequest("I need nine credits of GE").credits, undefined);
});

test("the Gemini tool suggests sets from the same engine and saves nothing", async () => {
  const exec = createDemoExecutor({ prompt: "x", context: sanitizeDemoContext({}), apiKey: "", model: "gemini-2.5-flash" });
  const r = await exec("suggest_general_electives", { request: "Which electives fit? I need 4 credits and like languages" });
  assert.equal(r.card?.kind, "ge-plan");
  const v = r.value as { creditsNeeded: number; saved: boolean; registered: boolean; sets: { credits: number; courses: { code: string }[] }[]; cannotTake: { code: string; why: string }[] };
  assert.equal(v.creditsNeeded, 4);
  assert.equal(v.saved, false);
  assert.equal(v.registered, false);
  assert.ok(v.sets.length > 0);
  for (const s of v.sets) assert.equal(s.credits, 4);
  assert.ok(v.cannotTake.some((c) => c.code === "GEA1101" && c.why.startsWith("Clashes with")));
  assert.ok(!v.sets.flatMap((s) => s.courses).some((c) => c.code.startsWith("GES")), "a science student is never offered science electives");
  // odd input is handled, not trusted
  const odd = await exec("suggest_general_electives", { request: { evil: true } });
  assert.equal((odd.value as { creditsNeeded: number }).creditsNeeded, 4);
});
